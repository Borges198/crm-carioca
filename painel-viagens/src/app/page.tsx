'use client';

import { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import Link from 'next/link';

// IMPORTANDO NOSSAS CAIXINHAS DE LEGO
import { calcularValorTotal, isHoraValida, normalizarDataParaCotacao } from '../utils/viagemUtils';
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
    sincronizarCompanhiasPorTrecho(companhiaAtual, novoTipoVoo);
  };

  const handleSmartPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        alert("Sua área de transferência está vazia!");
        return;
      }

      const dadosExtraidos = extrairDadosSmartPaste(text);
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

      const apenasNumerosMilhas = pontos.replace(/\D/g, '');
      const apenasNumerosTaxa = taxaEmbarque.replace(/\D/g, '');
      
      const qtdPontos = parseInt(apenasNumerosMilhas, 10);
      const taxa = parseInt(apenasNumerosTaxa, 10);

      if (isNaN(qtdPontos) || isNaN(taxa)) {
        alert("Por favor, preencha os Pontos e a Taxa corretamente."); return;
      }

      const valorTotal = calcularValorTotal(qtdPontos, taxa, companhia);
      
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
        valorTotal
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
          pontos={pontos} setPontos={setPontos}
          taxaEmbarque={taxaEmbarque} setTaxaEmbarque={setTaxaEmbarque}
          handleSmartPaste={handleSmartPaste}
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
