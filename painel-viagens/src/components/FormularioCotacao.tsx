import { useEffect, useState } from 'react';
import { buscarClientePorTelefoneDoUsuario } from '../services/clientesService';
import { listarNomesClientesDasCotacoes } from '../services/cotacoesService';
import type { Cliente, Companhia } from '../types';
import type { SmartPasteCandidate, SmartPasteCandidatesResult } from '../lib/smartPasteCandidatesUtils';
import { LEAD_STATUS_OPTIONS, PRODUTOS_OFERTADOS_OPTIONS, type LeadStatus, type ProdutoOfertado } from '../lib/leadUtils';

// Função auxiliar para garantir que a máscara de hora funcione perfeitamente
const maskHora = (value: string) => {
  return value
    .replace(/\D/g, '') // Remove tudo o que não é número
    .replace(/(\d{2})(\d)/, '$1:$2') // Coloca os dois pontos
    .slice(0, 5); // Limita a 5 caracteres (Ex: 14:30)
};

const extrairNumero = (value: string) => {
  const apenasNumeros = value.replace(/\D/g, '');
  return apenasNumeros ? parseInt(apenasNumeros, 10) : 0;
};

const normalizarTelefone = (value: string) => value.replace(/\D/g, '');

interface FormularioCotacaoProps {
  userId?: string;
  cliente: string; setCliente: (v: string) => void;
  telefone: string; setTelefone: (v: string) => void;
  origem: string; setOrigem: (v: string) => void;
  destino: string; setDestino: (v: string) => void;
  companhia: Companhia; setCompanhia: (v: Companhia) => void;
  companhiaIda: string; setCompanhiaIda: (v: Companhia) => void;
  companhiaVolta: string; setCompanhiaVolta: (v: Companhia) => void;
  tipoVoo: string; setTipoVoo: (v: string) => void;
  dataIda: string; setDataIda: (v: string) => void;
  horaSaidaIda: string; setHoraSaidaIda: (v: string) => void;
  horaChegadaIda: string; setHoraChegadaIda: (v: string) => void;
  paradasIda: string; setParadasIda: (v: string) => void;
  dataVolta: string; setDataVolta: (v: string) => void;
  horaSaidaVolta: string; setHoraSaidaVolta: (v: string) => void;
  horaChegadaVolta: string; setHoraChegadaVolta: (v: string) => void;
  paradasVolta: string; setParadasVolta: (v: string) => void;
  pontosIda: string; setPontosIda: (v: string) => void;
  pontosVolta: string; setPontosVolta: (v: string) => void;
  taxaIda: string; setTaxaIda: (v: string) => void;
  taxaVolta: string; setTaxaVolta: (v: string) => void;
  pontos: string; setPontos: (v: string) => void;
  taxaEmbarque: string; setTaxaEmbarque: (v: string) => void;
  produtosOfertados: ProdutoOfertado[]; setProdutosOfertados: (v: ProdutoOfertado[]) => void;
  observacao: string; setObservacao: (v: string) => void;
  leadStatus: LeadStatus; setLeadStatus: (v: LeadStatus) => void;
  handleSmartPaste: () => void;
  handleSmartPasteIda: () => void;
  handleSmartPasteVolta: () => void;
  smartPasteConferencia?: (SmartPasteCandidatesResult & { textoOrigemPreview?: string }) | null;
  onAplicarCandidatoSmartPaste: (candidate: SmartPasteCandidate) => void;
  gerarCotacao: () => void;
}

function formatarTrecho(trecho: SmartPasteCandidate['trecho']) {
  if (trecho === 'ida') return 'Ida';
  if (trecho === 'volta') return 'Volta';
  return 'Total';
}

export default function FormularioCotacao({
  userId,
  cliente, setCliente, telefone, setTelefone, origem, setOrigem, destino, setDestino,
  companhia, setCompanhia, companhiaIda, setCompanhiaIda, companhiaVolta, setCompanhiaVolta, tipoVoo, setTipoVoo,
  dataIda, setDataIda, horaSaidaIda, setHoraSaidaIda, horaChegadaIda, setHoraChegadaIda, paradasIda, setParadasIda,
  dataVolta, setDataVolta, horaSaidaVolta, setHoraSaidaVolta, horaChegadaVolta, setHoraChegadaVolta, paradasVolta, setParadasVolta,
  pontosIda, setPontosIda, pontosVolta, setPontosVolta, taxaIda, setTaxaIda, taxaVolta, setTaxaVolta,
  pontos, setPontos, taxaEmbarque, setTaxaEmbarque,
  produtosOfertados, setProdutosOfertados, observacao, setObservacao, leadStatus, setLeadStatus,
  handleSmartPaste, handleSmartPasteIda, handleSmartPasteVolta, smartPasteConferencia, onAplicarCandidatoSmartPaste, gerarCotacao
}: FormularioCotacaoProps) {
  
  // 🧠 ESTADOS DA MEMÓRIA DE CLIENTES
  const [clientesAntigos, setClientesAntigos] = useState<string[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [sugestaoPorTelefone, setSugestaoPorTelefone] = useState<{
    telefoneNormalizado: string;
    cliente: Cliente | null;
  } | null>(null);

  // 🧠 BUSCAR CLIENTES NO FIREBASE AO CARREGAR
  useEffect(() => {
    if (!userId) {
      return;
    }

    const buscarNomes = async () => {
      try {
        const nomes = await listarNomesClientesDasCotacoes(userId);
        setClientesAntigos(nomes);
      } catch (error) {
        console.error("Erro ao buscar clientes antigos:", error);
      }
    };
    buscarNomes();
  }, [userId]);

  useEffect(() => {
    const telefoneNormalizado = normalizarTelefone(telefone);

    if (!userId || !telefoneNormalizado) {
      return;
    }

    let buscaAtiva = true;

    const buscarClientePorTelefone = async () => {
      try {
        const clienteEncontrado = await buscarClientePorTelefoneDoUsuario(userId, telefoneNormalizado);
        if (buscaAtiva) {
          setSugestaoPorTelefone({ telefoneNormalizado, cliente: clienteEncontrado });
        }
      } catch (error) {
        console.error("Erro ao buscar cliente por telefone:", error);
        if (buscaAtiva) {
          setSugestaoPorTelefone({ telefoneNormalizado, cliente: null });
        }
      }
    };

    buscarClientePorTelefone();

    return () => {
      buscaAtiva = false;
    };
  }, [telefone, userId]);

  // 🧠 FILTRAR NOMES CONFORME DIGITAÇÃO
  const clientesSugeridos = userId
    ? clientesAntigos.filter(nome => 
        nome.toLowerCase().includes(cliente.toLowerCase()) && cliente.length > 0
      )
    : [];
  const telefoneNormalizadoAtual = normalizarTelefone(telefone);
  const clienteSugeridoPorTelefone = sugestaoPorTelefone?.telefoneNormalizado === telefoneNormalizadoAtual
    ? sugestaoPorTelefone.cliente
    : null;
  const totalPontosTrechos = extrairNumero(pontosIda) + (tipoVoo === 'ida_volta' ? extrairNumero(pontosVolta) : 0);
  const totalTaxasTrechos = extrairNumero(taxaIda) + (tipoVoo === 'ida_volta' ? extrairNumero(taxaVolta) : 0);
  const mostrarResumoTrechos = Boolean(
    pontosIda.trim() ||
    taxaIda.trim() ||
    (tipoVoo === 'ida_volta' && (pontosVolta.trim() || taxaVolta.trim()))
  );
  const alternarProdutoOfertado = (produto: ProdutoOfertado) => {
    setProdutosOfertados(
      produtosOfertados.includes(produto)
        ? produtosOfertados.filter((item) => item !== produto)
        : [...produtosOfertados, produto]
    );
  };
  const usarDadosClienteSugerido = () => {
    if (!clienteSugeridoPorTelefone) return;

    setCliente(clienteSugeridoPorTelefone.nome);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
      <div className="flex justify-between items-end mb-4">
        <h2 className="text-sm font-bold text-slate-500 uppercase">Dados da Pesquisa</h2>
        <button 
          onClick={handleSmartPaste}
          className="bg-indigo-100 text-indigo-700 text-xs font-bold py-1.5 px-3 rounded-md hover:bg-indigo-200 transition shadow-sm border border-indigo-200 flex items-center gap-1"
        >
          🪄 Smart Paste
        </button>
      </div>

      <div className="space-y-4">
        {smartPasteConferencia && smartPasteConferencia.candidates.length > 0 && (
          <section className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-900">Conferência Smart Paste</p>
                <p className="mt-1 text-xs font-semibold text-indigo-800">{smartPasteConferencia.companhia || 'Companhia não identificada'}</p>
                <p className="mt-1 text-[11px] font-medium text-indigo-900/70">Sugestões para aplicar manualmente.</p>
              </div>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-indigo-700">
                Revisar
              </span>
            </div>

            <div className="space-y-2">
              {smartPasteConferencia.candidates.map((candidate, index) => (
                <div key={`${candidate.trecho}-${index}`} className="rounded-md border border-indigo-100 bg-white p-2 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Trecho</p>
                      <p className="mt-0.5 font-black text-slate-800">{formatarTrecho(candidate.trecho)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Pontos</p>
                      <p className="mt-0.5 font-black text-slate-800">{candidate.rounded.pontos ?? '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Taxa</p>
                      <p className="mt-0.5 font-black text-slate-800">{candidate.rounded.taxa ?? '-'}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAplicarCandidatoSmartPaste(candidate)}
                    disabled={!candidate.rounded.pontos && !candidate.rounded.taxa}
                    className="mt-2 w-full rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-black uppercase text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Aplicar este candidato
                  </button>
                </div>
              ))}
            </div>

            {smartPasteConferencia.textoOrigemPreview && (
              <p className="mt-2 line-clamp-2 text-[11px] font-medium text-indigo-900/70">
                {smartPasteConferencia.textoOrigemPreview}
              </p>
            )}
          </section>
        )}
        
        {/* CAMPO DE CLIENTE COM AUTO-COMPLETAR */}
        <div className="relative">
          <input 
            type="text" 
            value={cliente} 
            onChange={(e) => {
              setCliente(e.target.value);
              setMostrarSugestoes(true);
            }} 
            onBlur={() => setTimeout(() => setMostrarSugestoes(false), 200)}
            placeholder="Nome do Cliente" 
            className="w-full px-4 py-2 border rounded-lg bg-slate-50 focus:bg-white transition" 
          />
          
          {/* LISTA SUSPENSA DE SUGESTÕES */}
          {mostrarSugestoes && clientesSugeridos.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
              {clientesSugeridos.map((nome, index) => (
                <li 
                  key={index}
                  className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-slate-700 text-sm font-medium transition"
                  onClick={() => {
                    setCliente(nome);
                    setMostrarSugestoes(false);
                  }}
                >
                  {nome}
                </li>
              ))}
            </ul>
          )}
        </div>

        <input
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="Telefone do solicitante"
          className="w-full px-4 py-2 border rounded-lg bg-slate-50 focus:bg-white transition"
        />
        {clienteSugeridoPorTelefone && (
          <div className="flex flex-col gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
            <span>Cliente encontrado: {clienteSugeridoPorTelefone.nome}</span>
            <button
              type="button"
              onClick={usarDadosClienteSugerido}
              className="self-start rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] font-black uppercase text-emerald-700 transition hover:bg-emerald-100 sm:self-auto"
            >
              Usar dados deste cliente
            </button>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <input type="text" value={origem} onChange={(e) => setOrigem(e.target.value.toUpperCase())} placeholder="Origem (Ex: SSA)" maxLength={3} className="w-full px-4 py-2 border rounded-lg bg-slate-50 uppercase text-center" />
          <input type="text" value={destino} onChange={(e) => setDestino(e.target.value.toUpperCase())} placeholder="Destino (Ex: CGH)" maxLength={3} className="w-full px-4 py-2 border rounded-lg bg-slate-50 uppercase text-center" />
        </div>

        <div className="flex justify-center bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setTipoVoo('ida')} className={`w-1/2 py-1 text-sm font-bold rounded-md ${tipoVoo === 'ida' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}>Somente Ida</button>
          <button onClick={() => setTipoVoo('ida_volta')} className={`w-1/2 py-1 text-sm font-bold rounded-md ${tipoVoo === 'ida_volta' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}>Ida e Volta</button>
        </div>

        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-blue-800 block">VOO DE IDA</span>
            <button
              type="button"
              onClick={handleSmartPasteIda}
              className="bg-blue-100 text-blue-700 text-[11px] font-bold py-1 px-2 rounded-md hover:bg-blue-200 transition border border-blue-200"
            >
              Colar dados da ida
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input type="date" value={dataIda} onChange={(e) => setDataIda(e.target.value)} className="col-span-2 px-2 py-1 border rounded text-sm bg-white text-slate-700" />
            <input type="text" value={horaSaidaIda} onChange={(e) => setHoraSaidaIda(maskHora(e.target.value))} placeholder="Saída" className="px-2 py-1 border rounded text-sm bg-white text-center" />
            <input type="text" value={horaChegadaIda} onChange={(e) => setHoraChegadaIda(maskHora(e.target.value))} placeholder="Chegada" className="px-2 py-1 border rounded text-sm bg-white text-center" />
          </div>
          <select value={paradasIda} onChange={(e) => setParadasIda(e.target.value)} className="w-full px-2 py-1 border rounded text-sm bg-white text-slate-700"> 
            <option>Direto</option>
            <option>1 Parada</option>
            <option>2 Paradas</option>
          </select>
        </div>

        {tipoVoo === 'ida_volta' && (
          <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-orange-800 block">VOO DE VOLTA</span>
              <button
                type="button"
                onClick={handleSmartPasteVolta}
                className="bg-orange-100 text-orange-700 text-[11px] font-bold py-1 px-2 rounded-md hover:bg-orange-200 transition border border-orange-200"
              >
                Colar dados da volta
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input type="date" value={dataVolta} onChange={(e) => setDataVolta(e.target.value)} className="col-span-2 px-2 py-1 border rounded text-sm bg-white text-slate-700" />
              <input type="text" value={horaSaidaVolta} onChange={(e) => setHoraSaidaVolta(maskHora(e.target.value))} placeholder="Saída" className="px-2 py-1 border rounded text-sm bg-white text-center" />
              <input type="text" value={horaChegadaVolta} onChange={(e) => setHoraChegadaVolta(maskHora(e.target.value))} placeholder="Chegada" className="px-2 py-1 border rounded text-sm bg-white text-center" />
            </div>
            <select value={paradasVolta} onChange={(e) => setParadasVolta(e.target.value)} className="w-full px-2 py-1 border rounded text-sm bg-white text-slate-700">
              <option>Direto</option>
              <option>1 Parada</option>
              <option>2 Paradas</option>
            </select>
          </div>
        )}

        <select value={companhia} onChange={(e) => setCompanhia(e.target.value as Companhia)} className="w-full px-4 py-2 border rounded-lg bg-white font-semibold text-slate-700">
          <option value="Azul">Azul</option>
          <option value="GOL">GOL</option>
          <option value="Latam">Latam</option>
        </select>

        <div className="grid grid-cols-1 gap-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-500 uppercase mb-1 block">Companhia da ida</span>
            <select value={companhiaIda || companhia} onChange={(e) => setCompanhiaIda(e.target.value as Companhia)} className="w-full px-4 py-2 border rounded-lg bg-white font-semibold text-slate-700">
              <option value="Azul">Azul</option>
              <option value="GOL">GOL</option>
              <option value="Latam">Latam</option>
            </select>
          </label>

          {tipoVoo === 'ida_volta' && (
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase mb-1 block">Companhia da volta</span>
              <select value={companhiaVolta || companhia} onChange={(e) => setCompanhiaVolta(e.target.value as Companhia)} className="w-full px-4 py-2 border rounded-lg bg-white font-semibold text-slate-700">
                <option value="Azul">Azul</option>
                <option value="GOL">GOL</option>
                <option value="Latam">Latam</option>
              </select>
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-bold text-slate-500 uppercase mb-1 block">Pontos/Milhas da ida</span>
            <input type="text" value={pontosIda} onChange={(e) => setPontosIda(e.target.value)} placeholder="Ida" className="w-full px-4 py-2 border rounded-lg bg-slate-50 text-center" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-500 uppercase mb-1 block">Taxa da ida</span>
            <input type="text" value={taxaIda} onChange={(e) => setTaxaIda(e.target.value)} placeholder="Taxa ida" className="w-full px-4 py-2 border rounded-lg bg-slate-50 text-center" />
          </label>
        </div>

        {tipoVoo === 'ida_volta' && (
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase mb-1 block">Pontos/Milhas da volta</span>
              <input type="text" value={pontosVolta} onChange={(e) => setPontosVolta(e.target.value)} placeholder="Volta" className="w-full px-4 py-2 border rounded-lg bg-slate-50 text-center" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase mb-1 block">Taxa da volta</span>
              <input type="text" value={taxaVolta} onChange={(e) => setTaxaVolta(e.target.value)} placeholder="Taxa volta" className="w-full px-4 py-2 border rounded-lg bg-slate-50 text-center" />
            </label>
          </div>
        )}

        {mostrarResumoTrechos && (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500">Total de pontos/milhas</span>
              <p className="mt-1 text-lg font-black text-slate-900">{totalPontosTrechos}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500">Total de taxas</span>
              <p className="mt-1 text-lg font-black text-slate-900">{totalTaxasTrechos}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <input type="text" value={pontos} onChange={(e) => setPontos(e.target.value)} placeholder="Pontos" className="w-full px-4 py-2 border rounded-lg bg-slate-50 text-center" />
          <input type="text" value={taxaEmbarque} onChange={(e) => setTaxaEmbarque(e.target.value)} placeholder="Taxa" className="w-full px-4 py-2 border rounded-lg bg-slate-50 text-center" />
        </div>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-3 text-xs font-bold uppercase text-slate-500">Monitoramento comercial</p>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Status comercial</span>
            <select
              value={leadStatus}
              onChange={(e) => setLeadStatus(e.target.value as LeadStatus)}
              className="w-full rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              {LEAD_STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </label>

          <div className="mt-3">
            <span className="mb-2 block text-xs font-bold uppercase text-slate-500">Produtos ofertados</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PRODUTOS_OFERTADOS_OPTIONS.map((produto) => (
                <label key={produto.value} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={produtosOfertados.includes(produto.value)}
                    onChange={() => alternarProdutoOfertado(produto.value)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>{produto.label}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Observação comercial</span>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Observações internas sobre o acompanhamento"
              className="min-h-24 w-full rounded-lg border bg-white px-4 py-2 text-sm text-slate-700"
            />
          </label>
        </section>

        <button onClick={gerarCotacao} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-md">
          Calcular e salvar cotação
        </button>
      </div>
    </div>
  );
}
