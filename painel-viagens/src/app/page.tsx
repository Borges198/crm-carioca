'use client';

import { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import Link from 'next/link';

// IMPORTANDO NOSSAS CAIXINHAS DE LEGO
import { calcularValorTotal, calcularValorTrecho, isHoraValida, normalizarDataParaCotacao } from '../utils/viagemUtils';
import FormularioCotacao from '../components/FormularioCotacao';
import BilhetePreview from '../components/BilhetePreview';
import { useAuth } from '../context/AuthContext';
import { criarCotacao } from '../services/cotacoesService';
import type { Companhia, NovaCotacao } from '../types';
import { extrairDadosSmartPaste } from '../utils/smartPasteUtils';
import { montarNovaCotacao } from '../utils/cotacaoMapper';
import { gerarMensagemWhatsApp } from '../utils/whatsappMessageUtils';

export default function Home() {
  const { user } = useAuth();
  const [cliente, setCliente] = useState('');
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
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

    return extrairDadosSmartPaste(text);
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

      if (dadosExtraidos.companhia) setCompanhiaIda(dadosExtraidos.companhia);
      if (dadosExtraidos.pontos) {
        setPontosIda(dadosExtraidos.pontos);
        setPontos(dadosExtraidos.pontos);
      }
      if (dadosExtraidos.taxaEmbarque) {
        setTaxaIda(dadosExtraidos.taxaEmbarque);
        setTaxaEmbarque(dadosExtraidos.taxaEmbarque);
      }
      if (dadosExtraidos.dataIda) setDataIda(dadosExtraidos.dataIda);
      if (dadosExtraidos.horaSaidaIda) setHoraSaidaIda(dadosExtraidos.horaSaidaIda);
      if (dadosExtraidos.horaChegadaIda) setHoraChegadaIda(dadosExtraidos.horaChegadaIda);
      if (dadosExtraidos.paradasIda) setParadasIda(dadosExtraidos.paradasIda);
      if (dadosExtraidos.origem) setOrigem(dadosExtraidos.origem);
      if (dadosExtraidos.destino) setDestino(dadosExtraidos.destino);

      alert("Dados da ida colados com sucesso!");
    } catch {
      alert("Não foi possível colar. Verifique a permissão da área de transferência.");
    }
  };

  const handleSmartPasteVolta = async () => {
    try {
      const dadosExtraidos = await lerDadosSmartPaste();
      if (!dadosExtraidos) return;

      setTipoVoo('ida_volta');
      if (dadosExtraidos.companhia) setCompanhiaVolta(dadosExtraidos.companhia);
      if (dadosExtraidos.pontos) setPontosVolta(dadosExtraidos.pontos);
      if (dadosExtraidos.taxaEmbarque) setTaxaVolta(dadosExtraidos.taxaEmbarque);
      if (dadosExtraidos.dataVolta) setDataVolta(dadosExtraidos.dataVolta);
      else if (dadosExtraidos.dataIda) setDataVolta(dadosExtraidos.dataIda);
      if (dadosExtraidos.horaSaidaVolta) setHoraSaidaVolta(dadosExtraidos.horaSaidaVolta);
      else if (dadosExtraidos.horaSaidaIda) setHoraSaidaVolta(dadosExtraidos.horaSaidaIda);
      if (dadosExtraidos.horaChegadaVolta) setHoraChegadaVolta(dadosExtraidos.horaChegadaVolta);
      else if (dadosExtraidos.horaChegadaIda) setHoraChegadaVolta(dadosExtraidos.horaChegadaIda);
      if (dadosExtraidos.paradasVolta) setParadasVolta(dadosExtraidos.paradasVolta);
      else if (dadosExtraidos.paradasIda) setParadasVolta(dadosExtraidos.paradasIda);
      if (!origem && dadosExtraidos.origem) setOrigem(dadosExtraidos.origem);
      if (!destino && dadosExtraidos.destino) setDestino(dadosExtraidos.destino);

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

      const novaCotacao: NovaCotacao = montarNovaCotacao({
        ownerId: user.uid,
        cliente,
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
    <div className="min-h-screen bg-slate-100 p-8 flex justify-center">
      <div className="max-w-md w-full space-y-6">
        
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h1 className="text-xl font-bold text-blue-900">Nova Cotação de Viagem ✈️</h1>
          <Link href="/historico" className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition">
            Ver Histórico ➔
          </Link>
        </div>

        {/* INVOCANDO O FORMULÁRIO */}
        <FormularioCotacao 
          userId={user?.uid}
          cliente={cliente} setCliente={setCliente}
          origem={origem} setOrigem={setOrigem}
          destino={destino} setDestino={setDestino}
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
          handleSmartPaste={handleSmartPaste}
          handleSmartPasteIda={handleSmartPasteIda}
          handleSmartPasteVolta={handleSmartPasteVolta}
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
