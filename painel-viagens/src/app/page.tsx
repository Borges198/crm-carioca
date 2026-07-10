'use client';

import { useState, useRef } from 'react';
import { toPng } from 'html-to-image';

// IMPORTANDO NOSSAS CAIXINHAS DE LEGO
import { calcularValorTotal, calcularValorTrecho, isHoraValida, normalizarDataParaCotacao } from '../utils/viagemUtils';
import FormularioCotacao, {
  obterClienteSelecionadoDaSessao,
  type ClienteSelecionadoPorUsuario,
  type IdentidadeSessaoCotacao,
} from '../components/FormularioCotacao';
import BilhetePreview from '../components/BilhetePreview';
import { useAuth } from '../context/AuthContext';
import { criarCotacao } from '../services/cotacoesService';
import type { Cliente, Companhia, NovaCotacao } from '../types';
import { extrairDadosSmartPaste } from '../utils/smartPasteUtils';
import { mapearSmartPasteParaTrecho } from '../utils/smartPasteTrechoUtils';
import { montarNovaCotacao } from '../utils/cotacaoMapper';
import { gerarMensagemWhatsApp } from '../utils/whatsappMessageUtils';
import { extrairCandidatosSmartPaste, type SmartPasteCandidate, type SmartPasteCandidatesResult } from '../lib/smartPasteCandidatesUtils';
import type { LeadStatus, ProdutoOfertado } from '../lib/leadUtils';
import { DEFAULT_AGENCY_ID } from '../types';

interface SmartPasteConferencia extends SmartPasteCandidatesResult {
  textoOrigemPreview: string;
}

function normalizarTelefone(telefone: string) {
  return telefone.replace(/\D/g, '');
}

export default function Home() {
  const { user, accessProfile } = useAuth();
  const [estadoSelecaoCliente, setEstadoSelecaoCliente] = useState<{
    identidade: IdentidadeSessaoCotacao;
    selecao: ClienteSelecionadoPorUsuario | null;
  }>({
    identidade: { userId: user?.uid, geracao: 0 },
    selecao: null,
  });
  const usuarioMudou = estadoSelecaoCliente.identidade.userId !== user?.uid;
  const identidadeSessao: IdentidadeSessaoCotacao = usuarioMudou
    ? {
        userId: user?.uid,
        geracao: estadoSelecaoCliente.identidade.geracao + 1,
      }
    : estadoSelecaoCliente.identidade;
  if (usuarioMudou) {
    setEstadoSelecaoCliente({
      identidade: identidadeSessao,
      selecao: null,
    });
  }
  const clienteSelecionado = obterClienteSelecionadoDaSessao(
    usuarioMudou ? null : estadoSelecaoCliente.selecao,
    identidadeSessao
  );
  const setClienteSelecionado = (clienteAtual: Cliente | null) => {
    setEstadoSelecaoCliente({
      identidade: identidadeSessao,
      selecao: clienteAtual && user
        ? {
            userId: user.uid,
            geracao: identidadeSessao.geracao,
            cliente: clienteAtual,
          }
        : null,
    });
  };
  const [cliente, setCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [origemVolta, setOrigemVolta] = useState('');
  const [destinoVolta, setDestinoVolta] = useState('');
  const [companhia, setCompanhia] = useState<Companhia>('Azul');
  const [companhiaIda, setCompanhiaIda] = useState('');
  const [companhiaVolta, setCompanhiaVolta] = useState('');
  const [tipoVoo, setTipoVoo] = useState('ida');

  // Campos de Ida
  const [dataIda, setDataIda] = useState('');
  const [horaSaidaIda, setHoraSaidaIda] = useState('');
  const [horaChegadaIda, setHoraChegadaIda] = useState('');
  const [paradasIda, setParadasIda] = useState('Direto');

  // Campos de Volta
  const [dataVolta, setDataVolta] = useState('');
  const [horaSaidaVolta, setHoraSaidaVolta] = useState('');
  const [horaChegadaVolta, setHoraChegadaVolta] = useState('');
  const [paradasVolta, setParadasVolta] = useState('Direto');

  const [pontos, setPontos] = useState('');
  const [taxaEmbarque, setTaxaEmbarque] = useState('');
  const [pontosIda, setPontosIda] = useState('');
  const [pontosVolta, setPontosVolta] = useState('');
  const [taxaIda, setTaxaIda] = useState('');
  const [taxaVolta, setTaxaVolta] = useState('');
  const [valorIda, setValorIda] = useState<number | null>(null);
  const [valorVolta, setValorVolta] = useState<number | null>(null);
  const [mensagemWhatsapp, setMensagemWhatsapp] = useState('');
  const [smartPasteConferencia, setSmartPasteConferencia] = useState<SmartPasteConferencia | null>(null);
  const [produtosOfertados, setProdutosOfertados] = useState<ProdutoOfertado[]>([]);
  const [observacao, setObservacao] = useState('');
  const [leadStatus, setLeadStatus] = useState<LeadStatus>('novo');

  const ticketRef = useRef<HTMLDivElement>(null);

  const sincronizarCompanhiasPorTrecho = (novaCompanhia: Companhia, novoTipoVoo: string) => {
    setCompanhiaIda(novaCompanhia);
    if (novoTipoVoo === 'ida_volta') {
      setCompanhiaVolta(novaCompanhia);
      return;
    }
    setCompanhiaVolta('');
  };

  const atualizarCompanhia = (novaCompanhia: Companhia, tipoVooAtual = tipoVoo) => {
    setCompanhia(novaCompanhia);
    sincronizarCompanhiasPorTrecho(novaCompanhia, tipoVooAtual);
  };

  const atualizarTipoVoo = (novoTipoVoo: string, companhiaAtual = companhia) => {
    setTipoVoo(novoTipoVoo);
    if (novoTipoVoo === 'ida_volta') {
      setCompanhiaIda(companhiaIda || companhiaAtual);
      setCompanhiaVolta(companhiaVolta || companhiaIda || companhiaAtual);
      setPontosIda(pontosIda || pontos);
      setTaxaIda(taxaIda || taxaEmbarque);
      if (!origemVolta.trim()) setOrigemVolta(destino);
      if (!destinoVolta.trim()) setDestinoVolta(origem);
      return;
    }

    setCompanhiaVolta('');
  };

  const lerDadosSmartPaste = async () => {
    const text = await navigator.clipboard.readText();
    if (!text) {
      alert("Sua área de transferência está vazia!");
      return null;
    }

    const candidatos = extrairCandidatosSmartPaste(text);
    setSmartPasteConferencia({
      ...candidatos,
      textoOrigemPreview: text.replace(/\s+/g, ' ').trim().slice(0, 140),
    });

    return extrairDadosSmartPaste(text);
  };

  const aplicarCandidatoSmartPaste = (candidate: SmartPasteCandidate) => {
    const pontosArredondados = typeof candidate.rounded.pontos === 'number'
      ? String(candidate.rounded.pontos)
      : null;
    const taxaArredondada = typeof candidate.rounded.taxa === 'number'
      ? String(candidate.rounded.taxa)
      : null;

    if (candidate.trecho === 'total') {
      if (pontosArredondados) setPontos(pontosArredondados);
      if (taxaArredondada) setTaxaEmbarque(taxaArredondada);
      return;
    }

    if (candidate.trecho === 'volta') {
      if (pontosArredondados) setPontosVolta(pontosArredondados);
      if (taxaArredondada) setTaxaVolta(taxaArredondada);
      return;
    }

    if (pontosArredondados) setPontosIda(pontosArredondados);
    if (taxaArredondada) setTaxaIda(taxaArredondada);
  };

  const handleSmartPaste = async () => {
    try {
      const dadosExtraidos = await lerDadosSmartPaste();
      if (!dadosExtraidos) return;
      const tipoVooAtualizado = dadosExtraidos.tipoVoo || tipoVoo;
      const companhiaAtualizada = dadosExtraidos.companhia || companhia;

      if (dadosExtraidos.tipoVoo) atualizarTipoVoo(dadosExtraidos.tipoVoo, companhiaAtualizada);
      if (dadosExtraidos.horaSaidaIda) setHoraSaidaIda(dadosExtraidos.horaSaidaIda);
      if (dadosExtraidos.origem) setOrigem(dadosExtraidos.origem);
      if (dadosExtraidos.horaChegadaIda) setHoraChegadaIda(dadosExtraidos.horaChegadaIda);
      if (dadosExtraidos.destino) setDestino(dadosExtraidos.destino);
      if (dadosExtraidos.horaSaidaVolta) setHoraSaidaVolta(dadosExtraidos.horaSaidaVolta);
      if (dadosExtraidos.horaChegadaVolta) setHoraChegadaVolta(dadosExtraidos.horaChegadaVolta);
      if (dadosExtraidos.dataIda) setDataIda(dadosExtraidos.dataIda);
      if (dadosExtraidos.dataVolta) setDataVolta(dadosExtraidos.dataVolta);
      else if (dadosExtraidos.limparDataVolta) setDataVolta('');
      if (dadosExtraidos.companhia) atualizarCompanhia(dadosExtraidos.companhia, tipoVooAtualizado);
      if (dadosExtraidos.paradasIda) setParadasIda(dadosExtraidos.paradasIda);
      if (dadosExtraidos.paradasVolta) setParadasVolta(dadosExtraidos.paradasVolta);
      if (dadosExtraidos.pontos) setPontos(dadosExtraidos.pontos);
      if (dadosExtraidos.taxaEmbarque) setTaxaEmbarque(dadosExtraidos.taxaEmbarque);

      alert("✨ Voo extraído e colado com sucesso!");
    } catch {
      alert("Não foi possível colar. Verifique a permissão da área de transferência.");
    }
  };

  const handleSmartPasteIda = async () => {
    try {
      const dadosExtraidos = await lerDadosSmartPaste();
      if (!dadosExtraidos) return;
      const updates = mapearSmartPasteParaTrecho('ida', dadosExtraidos);

      if (updates.companhiaIda) setCompanhiaIda(updates.companhiaIda);
      if (updates.pontosIda) setPontosIda(updates.pontosIda);
      if (updates.taxaIda) setTaxaIda(updates.taxaIda);
      if (updates.dataIda) setDataIda(updates.dataIda);
      if (updates.horaSaidaIda) setHoraSaidaIda(updates.horaSaidaIda);
      if (updates.horaChegadaIda) setHoraChegadaIda(updates.horaChegadaIda);
      if (updates.paradasIda) setParadasIda(updates.paradasIda);
      if (updates.origem) setOrigem(updates.origem);
      if (updates.destino) setDestino(updates.destino);

      alert("Dados da ida colados com sucesso!");
    } catch {
      alert("Não foi possível colar. Verifique a permissão da área de transferência.");
    }
  };

  const handleSmartPasteVolta = async () => {
    try {
      const dadosExtraidos = await lerDadosSmartPaste();
      if (!dadosExtraidos) return;
      const updates = mapearSmartPasteParaTrecho('volta', dadosExtraidos);

      setTipoVoo('ida_volta');
      if (updates.companhiaVolta) setCompanhiaVolta(updates.companhiaVolta);
      if (updates.pontosVolta) setPontosVolta(updates.pontosVolta);
      if (updates.taxaVolta) setTaxaVolta(updates.taxaVolta);
      if (updates.dataVolta) setDataVolta(updates.dataVolta);
      if (updates.horaSaidaVolta) setHoraSaidaVolta(updates.horaSaidaVolta);
      if (updates.horaChegadaVolta) setHoraChegadaVolta(updates.horaChegadaVolta);
      if (updates.paradasVolta) setParadasVolta(updates.paradasVolta);
      if (updates.origemVolta) setOrigemVolta(updates.origemVolta);
      if (updates.destinoVolta) setDestinoVolta(updates.destinoVolta);

      alert("Dados da volta colados com sucesso!");
    } catch {
      alert("Não foi possível colar. Verifique a permissão da área de transferência.");
    }
  };

  const gerarCotacao = async () => {
    try {
      if (!user) {
        alert("Você precisa estar logado para salvar uma cotação.");
        return;
      }

      if (!isHoraValida(horaSaidaIda) || !isHoraValida(horaChegadaIda)) {
        alert("Atenção: Os horários do voo de IDA estão inválidos."); return;
      }
      if (tipoVoo === 'ida_volta' && (!isHoraValida(horaSaidaVolta) || !isHoraValida(horaChegadaVolta))) {
        alert("Atenção: Os horários do voo de VOLTA estão inválidos."); return;
      }
      if (!origem.trim() || !destino.trim()) {
        alert("Atenção: Preencha a origem e o destino da ida."); return;
      }
      if (tipoVoo === 'ida_volta' && (!origemVolta.trim() || !destinoVolta.trim())) {
        alert("Atenção: Preencha a origem e o destino da volta."); return;
      }

      const extrairNumero = (valor: string) => {
        const apenasNumeros = valor.replace(/\D/g, '');
        return parseInt(apenasNumeros, 10);
      };

      const temCalculoPorTrecho = Boolean(
        pontosIda.trim() ||
        taxaIda.trim() ||
        (tipoVoo === 'ida_volta' && (pontosVolta.trim() || taxaVolta.trim()))
      );

      const apenasNumerosMilhas = pontos.replace(/\D/g, '');
      const apenasNumerosTaxa = taxaEmbarque.replace(/\D/g, '');
      
      let qtdPontos = parseInt(apenasNumerosMilhas, 10);
      let taxa = parseInt(apenasNumerosTaxa, 10);
      let valorIdaCalculado = valorIda;
      let valorVoltaCalculado = valorVolta;
      let valorTotal: number;
      const companhiaTrechoIda = companhiaIda || companhia;
      const companhiaTrechoVolta = companhiaVolta || companhiaIda || companhia;
      let camposPorTrecho: Partial<Pick<NovaCotacao, 'companhiaIda' | 'companhiaVolta' | 'pontosIda' | 'pontosVolta' | 'taxaIda' | 'taxaVolta' | 'valorIda' | 'valorVolta'>> = {};

      if (temCalculoPorTrecho) {
        const pontosIdaParaCalculo = pontosIda.trim() || pontos;
        const taxaIdaParaCalculo = taxaIda.trim() || taxaEmbarque;
        const qtdPontosIda = extrairNumero(pontosIdaParaCalculo);
        const taxaIdaCalculada = extrairNumero(taxaIdaParaCalculo);
        const qtdPontosVolta = extrairNumero(pontosVolta);
        const taxaVoltaCalculada = extrairNumero(taxaVolta);

        if (isNaN(qtdPontosIda) || isNaN(taxaIdaCalculada)) {
          alert("Por favor, preencha os Pontos/Milhas e a Taxa da ida corretamente."); return;
        }
        if (tipoVoo === 'ida_volta' && (isNaN(qtdPontosVolta) || isNaN(taxaVoltaCalculada))) {
          alert("Por favor, preencha os Pontos/Milhas e a Taxa da volta corretamente."); return;
        }

        qtdPontos = qtdPontosIda;
        taxa = taxaIdaCalculada;
        valorIdaCalculado = calcularValorTrecho(qtdPontosIda, taxaIdaCalculada, companhiaTrechoIda);
        valorVoltaCalculado = tipoVoo === 'ida_volta'
          ? calcularValorTrecho(qtdPontosVolta, taxaVoltaCalculada, companhiaTrechoVolta)
          : null;
        valorTotal = valorIdaCalculado + (valorVoltaCalculado ?? 0);
        camposPorTrecho = {
          companhiaIda: companhiaTrechoIda,
          companhiaVolta: tipoVoo === 'ida_volta' ? companhiaTrechoVolta : null,
          pontosIda: qtdPontosIda,
          pontosVolta: tipoVoo === 'ida_volta' ? qtdPontosVolta : null,
          taxaIda: taxaIdaCalculada,
          taxaVolta: tipoVoo === 'ida_volta' ? taxaVoltaCalculada : null,
          valorIda: valorIdaCalculado,
          valorVolta: valorVoltaCalculado
        };
      } else {
        if (isNaN(qtdPontos) || isNaN(taxa)) {
          alert("Por favor, preencha os Pontos e a Taxa corretamente."); return;
        }

        valorIdaCalculado = null;
        valorVoltaCalculado = null;
        valorTotal = calcularValorTotal(qtdPontos, taxa, companhia);
      }

      setValorIda(valorIdaCalculado);
      setValorVolta(valorVoltaCalculado);
      
      const dataIdaFormatada = normalizarDataParaCotacao(dataIda);
      const dataVoltaFormatada = normalizarDataParaCotacao(dataVolta);
      const telefoneCotacao = telefone.trim();
      const telefoneNormalizado = normalizarTelefone(telefoneCotacao);
      const camposRotasPorTrecho: Partial<Pick<NovaCotacao, 'origemIda' | 'destinoIda' | 'origemVolta' | 'destinoVolta'>> = {
        origemIda: origem,
        destinoIda: destino,
      };

      if (tipoVoo === 'ida_volta') {
        camposRotasPorTrecho.origemVolta = origemVolta;
        camposRotasPorTrecho.destinoVolta = destinoVolta;
      }

      const novaCotacao: NovaCotacao = montarNovaCotacao({
        ownerId: user.uid,
        ownerName: user.displayName ?? undefined,
        ownerEmail: user.email ?? undefined,
        agencyId: accessProfile.agencyId ?? DEFAULT_AGENCY_ID,
        clienteId: clienteSelecionado?.id,
        cliente,
        telefone: telefoneCotacao,
        telefoneNormalizado,
        origem,
        destino,
        companhia,
        tipoVoo,
        dataIda: dataIdaFormatada,
        dataVolta: dataVoltaFormatada,
        horaSaidaIda,
        horaChegadaIda,
        horaSaidaVolta,
        horaChegadaVolta,
        paradasIda,
        paradasVolta,
        qtdPontos,
        taxaEmbarque: taxa,
        valorTotal,
        produtosOfertados,
        observacao,
        leadStatus,
        ...camposRotasPorTrecho,
        ...camposPorTrecho
      });

      await criarCotacao(novaCotacao);
      
      const textoMensagem = gerarMensagemWhatsApp({ cliente, valorTotal });
      setMensagemWhatsapp(textoMensagem);

    } catch (erro) {
      console.error("Erro ao salvar: ", erro);
      if (erro instanceof Error && erro.message.includes('Missing or insufficient permissions')) {
        alert("⚠️ Ocorreu um erro ao salvar! Verifique se você está logado no sistema.");
      } else {
        alert("Erro ao salvar a cotação. Tente novamente.");
      }
    }
  };

  const baixarPrint = async () => {
    if (ticketRef.current) {
      const dataUrl = await toPng(ticketRef.current, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Voo_${cliente}.png`;
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-8 flex justify-center">
      <div className="max-w-md w-full space-y-6">
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h1 className="text-xl font-bold text-blue-900">Nova Cotação de Viagem</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Crie uma cotação e acompanhe o status comercial depois.
          </p>
        </div>

        {/* INVOCANDO O FORMULÁRIO */}
        <FormularioCotacao 
          userId={user?.uid}
          clienteSelecionado={clienteSelecionado}
          setClienteSelecionado={setClienteSelecionado}
          cliente={cliente} setCliente={setCliente}
          telefone={telefone} setTelefone={setTelefone}
          origem={origem} setOrigem={setOrigem}
          destino={destino} setDestino={setDestino}
          origemVolta={origemVolta} setOrigemVolta={setOrigemVolta}
          destinoVolta={destinoVolta} setDestinoVolta={setDestinoVolta}
          companhia={companhia} setCompanhia={atualizarCompanhia}
          companhiaIda={companhiaIda} setCompanhiaIda={setCompanhiaIda}
          companhiaVolta={companhiaVolta} setCompanhiaVolta={setCompanhiaVolta}
          tipoVoo={tipoVoo} setTipoVoo={atualizarTipoVoo}
          dataIda={dataIda} setDataIda={setDataIda}
          horaSaidaIda={horaSaidaIda} setHoraSaidaIda={setHoraSaidaIda}
          horaChegadaIda={horaChegadaIda} setHoraChegadaIda={setHoraChegadaIda}
          paradasIda={paradasIda} setParadasIda={setParadasIda}
          dataVolta={dataVolta} setDataVolta={setDataVolta}
          horaSaidaVolta={horaSaidaVolta} setHoraSaidaVolta={setHoraSaidaVolta}
          horaChegadaVolta={horaChegadaVolta} setHoraChegadaVolta={setHoraChegadaVolta}
          paradasVolta={paradasVolta} setParadasVolta={setParadasVolta}
          pontosIda={pontosIda} setPontosIda={setPontosIda}
          pontosVolta={pontosVolta} setPontosVolta={setPontosVolta}
          taxaIda={taxaIda} setTaxaIda={setTaxaIda}
          taxaVolta={taxaVolta} setTaxaVolta={setTaxaVolta}
          pontos={pontos} setPontos={setPontos}
          taxaEmbarque={taxaEmbarque} setTaxaEmbarque={setTaxaEmbarque}
          produtosOfertados={produtosOfertados} setProdutosOfertados={setProdutosOfertados}
          observacao={observacao} setObservacao={setObservacao}
          leadStatus={leadStatus} setLeadStatus={setLeadStatus}
          handleSmartPaste={handleSmartPaste}
          handleSmartPasteIda={handleSmartPasteIda}
          handleSmartPasteVolta={handleSmartPasteVolta}
          smartPasteConferencia={smartPasteConferencia}
          onAplicarCandidatoSmartPaste={aplicarCandidatoSmartPaste}
          gerarCotacao={gerarCotacao}
        />

        {mensagemWhatsapp && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl">
              <p className="text-xs text-green-800 font-bold mb-2">Mensagem gerada (Copie abaixo):</p>
              <textarea readOnly value={mensagemWhatsapp} className="w-full bg-white border border-green-300 rounded p-2 text-sm h-24 focus:outline-none" />
            </div>

            {/* INVOCANDO O BILHETE */}
            <BilhetePreview 
              ticketRef={ticketRef}
              companhia={companhia}
              companhiaIda={companhiaIda || undefined}
              companhiaVolta={companhiaVolta || undefined}
              origem={origem}
              destino={destino}
              origemIda={origem}
              destinoIda={destino}
              origemVolta={origemVolta}
              destinoVolta={destinoVolta}
              tipoVoo={tipoVoo} dataIda={dataIda} horaSaidaIda={horaSaidaIda} horaChegadaIda={horaChegadaIda} paradasIda={paradasIda}
              dataVolta={dataVolta} horaSaidaVolta={horaSaidaVolta} horaChegadaVolta={horaChegadaVolta} paradasVolta={paradasVolta}
            />

            <button onClick={baixarPrint} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition shadow-md flex justify-center items-center gap-2">
              📸 Baixar Print da Passagem (PNG)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
