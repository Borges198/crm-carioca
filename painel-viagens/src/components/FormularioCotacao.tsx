import { useEffect, useState } from 'react';
import { listarNomesClientesDasCotacoes } from '../services/cotacoesService';
import type { Companhia } from '../types';

// Função auxiliar para garantir que a máscara de hora funcione perfeitamente
const maskHora = (value: string) => {
  return value
    .replace(/\D/g, '') // Remove tudo o que não é número
    .replace(/(\d{2})(\d)/, '$1:$2') // Coloca os dois pontos
    .slice(0, 5); // Limita a 5 caracteres (Ex: 14:30)
};

interface FormularioCotacaoProps {
  userId?: string;
  cliente: string; setCliente: (v: string) => void;
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
  handleSmartPaste: () => void;
  gerarCotacao: () => void;
}

export default function FormularioCotacao({
  userId,
  cliente, setCliente, origem, setOrigem, destino, setDestino,
  companhia, setCompanhia, companhiaIda, setCompanhiaIda, companhiaVolta, setCompanhiaVolta, tipoVoo, setTipoVoo,
  dataIda, setDataIda, horaSaidaIda, setHoraSaidaIda, horaChegadaIda, setHoraChegadaIda, paradasIda, setParadasIda,
  dataVolta, setDataVolta, horaSaidaVolta, setHoraSaidaVolta, horaChegadaVolta, setHoraChegadaVolta, paradasVolta, setParadasVolta,
  pontosIda, setPontosIda, pontosVolta, setPontosVolta, taxaIda, setTaxaIda, taxaVolta, setTaxaVolta,
  pontos, setPontos, taxaEmbarque, setTaxaEmbarque,
  handleSmartPaste, gerarCotacao
}: FormularioCotacaoProps) {
  
  // 🧠 ESTADOS DA MEMÓRIA DE CLIENTES
  const [clientesAntigos, setClientesAntigos] = useState<string[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

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

  // 🧠 FILTRAR NOMES CONFORME DIGITAÇÃO
  const clientesSugeridos = userId
    ? clientesAntigos.filter(nome => 
        nome.toLowerCase().includes(cliente.toLowerCase()) && cliente.length > 0
      )
    : [];

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
        
        <div className="grid grid-cols-2 gap-4">
          <input type="text" value={origem} onChange={(e) => setOrigem(e.target.value.toUpperCase())} placeholder="Origem (Ex: SSA)" maxLength={3} className="w-full px-4 py-2 border rounded-lg bg-slate-50 uppercase text-center" />
          <input type="text" value={destino} onChange={(e) => setDestino(e.target.value.toUpperCase())} placeholder="Destino (Ex: CGH)" maxLength={3} className="w-full px-4 py-2 border rounded-lg bg-slate-50 uppercase text-center" />
        </div>

        <div className="flex justify-center bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setTipoVoo('ida')} className={`w-1/2 py-1 text-sm font-bold rounded-md ${tipoVoo === 'ida' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}>Somente Ida</button>
          <button onClick={() => setTipoVoo('ida_volta')} className={`w-1/2 py-1 text-sm font-bold rounded-md ${tipoVoo === 'ida_volta' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}>Ida e Volta</button>
        </div>

        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
          <span className="text-xs font-bold text-blue-800 mb-2 block">VOO DE IDA</span>
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
            <span className="text-xs font-bold text-orange-800 mb-2 block">VOO DE VOLTA</span>
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

        <div className="grid grid-cols-2 gap-4">
          <input type="text" value={pontos} onChange={(e) => setPontos(e.target.value)} placeholder="Pontos" className="w-full px-4 py-2 border rounded-lg bg-slate-50 text-center" />
          <input type="text" value={taxaEmbarque} onChange={(e) => setTaxaEmbarque(e.target.value)} placeholder="Taxa" className="w-full px-4 py-2 border rounded-lg bg-slate-50 text-center" />
        </div>

        <button onClick={gerarCotacao} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-md">
          Calcular e Salvar Cotação
        </button>
      </div>
    </div>
  );
}
