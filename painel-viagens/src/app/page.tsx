'use client';

import { useState, useRef } from 'react';
import db from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { toPng } from 'html-to-image';
import Link from 'next/link';

// IMPORTANDO NOSSAS CAIXINHAS DE LEGO
import { VALOR_MILHEIRO, isHoraValida, calcularDuracao } from '../utils/viagemUtils';
import FormularioCotacao from '../components/FormularioCotacao';
import BilhetePreview from '../components/BilhetePreview';

export default function Home() {
  const [cliente, setCliente] = useState('');
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [companhia, setCompanhia] = useState('Azul');
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

  const handleSmartPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        alert("Sua área de transferência está vazia!");
        return;
      }

      // Lógica do Smart Paste Manteve-se intacta aqui no "Maestro"
      let matches: Array<{hora: string, aeroporto: string}> = [];
      const timeAirportRegex = /(\d{1,2}:\d{2})\s*([A-Z]{3})/g; 
      const timeAirportMatches = [...text.matchAll(timeAirportRegex)];
      
      if (timeAirportMatches.length > 0) {
        matches = timeAirportMatches.map(m => ({ hora: m[1].padStart(5, '0'), aeroporto: m[2] }));
      } else {
        const smilesRegex = /([A-Z]{3})\s*(\d{2})h(\d{2})/g;
        const smilesMatches = [...text.matchAll(smilesRegex)];
        matches = smilesMatches.map(m => ({ hora: `${m[2]}:${m[3]}`, aeroporto: m[1] }));
      }

      if (matches.length >= 4) {
        setTipoVoo('ida_volta');
        setHoraSaidaIda(matches[0].hora); setOrigem(matches[0].aeroporto);
        setHoraChegadaIda(matches[1].hora); setDestino(matches[1].aeroporto);
        setHoraSaidaVolta(matches[2].hora); setHoraChegadaVolta(matches[3].hora);
      } else if (matches.length >= 2) {
        setTipoVoo('ida');
        setHoraSaidaIda(matches[0].hora); setOrigem(matches[0].aeroporto);
        setHoraChegadaIda(matches[1].hora); setDestino(matches[1].aeroporto);
      }

      let datasEncontradas: string[] = [];
      const dateRegex1 = /(\d{2})\/(\d{2})\/(\d{4})/g;
      const matchDates1 = [...text.matchAll(dateRegex1)];
      
      if (matchDates1.length > 0) {
        datasEncontradas = matchDates1.map(m => `${m[3]}-${m[2]}-${m[1]}`);
      } else {
        const meses: Record<string, string> = {
            janeiro: '01', fevereiro: '02', março: '03', marco: '03', abril: '04',
            maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09',
            outubro: '10', novembro: '11', dezembro: '12', jul: '07'
        };
        const dateRegexFull = /(\d{1,2})\s*de\s*([a-zA-Zç]+)\s*de\s*(\d{4})/gi;
        const matchDatesFull = [...text.matchAll(dateRegexFull)];
        
        if (matchDatesFull.length > 0) {
            datasEncontradas = matchDatesFull.map(m => {
                const dia = m[1].padStart(2, '0');
                const mes = meses[m[2].toLowerCase()] || '01';
                return `${m[3]}-${mes}-${dia}`;
            });
        } else {
            const dateRegexShort = /(\d{1,2})\s*de\s*([a-zA-Zç]+)/gi;
            const matchDatesShort = [...text.matchAll(dateRegexShort)];
            if (matchDatesShort.length > 0) {
                datasEncontradas = matchDatesShort.map(m => {
                    const dia = m[1].padStart(2, '0');
                    const mes = meses[m[2].toLowerCase()] || '01';
                    return `${new Date().getFullYear()}-${mes}-${dia}`;
                });
            }
        }
      }

      datasEncontradas = Array.from(new Set(datasEncontradas));

      if (datasEncontradas.length >= 2) {
         setDataIda(datasEncontradas[0]); setDataVolta(datasEncontradas[1]);
      } else if (datasEncontradas.length === 1) {
         setDataIda(datasEncontradas[0]);
      }

      if (/azul/i.test(text)) setCompanhia("Azul");
      else if (/smiles|gol/i.test(text)) setCompanhia("GOL");
      else if (/latam/i.test(text)) setCompanhia("Latam");

      const paradasMatches = [...text.matchAll(/(direto|1\s*conexão|1\s*conexao|1\s*parada|2\s*conexões|2\s*conexoes|2\s*paradas)/gi)];
      const formatParada = (p: string) => {
         if (/direto/i.test(p)) return "Direto";
         if (/1/i.test(p)) return "1 Parada";
         if (/2/i.test(p)) return "2 Paradas";
         return "Direto";
      };

      if (paradasMatches.length >= 2) {
         setParadasIda(formatParada(paradasMatches[0][0])); setParadasVolta(formatParada(paradasMatches[1][0]));
      } else if (paradasMatches.length === 1) {
         setParadasIda(formatParada(paradasMatches[0][0]));
      }

      const pontosRegex = /(\d{1,3}[.,]?\d{3}|\d{4,6})(?=\s*pts|\s*pontos|\s*milhas)/gi;
      const pontosMatches = [...text.matchAll(pontosRegex)];
      if (pontosMatches.length > 0) {
         let maiorPonto = 0;
         pontosMatches.forEach(m => {
             const valorLimpo = parseInt(m[1].replace(/[.,]/g, ''), 10);
             if (valorLimpo > maiorPonto) maiorPonto = valorLimpo;
         });
         if (maiorPonto > 0) setPontos(Math.ceil(maiorPonto / 1000).toString());
      }

      const taxaRegex = /(?:R\$|BRL)\s*(\d+[,.]\d{2})/gi;
      const taxaMatches = [...text.matchAll(taxaRegex)];
      if (taxaMatches.length > 0) {
         let maiorTaxa = 0;
         taxaMatches.forEach(m => {
             const valorTaxaFloat = parseFloat(m[1].replace(',', '.'));
             if (valorTaxaFloat > maiorTaxa) maiorTaxa = valorTaxaFloat;
         });
         if (maiorTaxa > 0) setTaxaEmbarque(Math.ceil(maiorTaxa).toString());
      }

      alert("✨ Voo extraído e colado com sucesso!");
    } catch (err) {
      alert("Não foi possível colar. Verifique a permissão da área de transferência.");
    }
  };

  const gerarCotacao = async () => {
    try {
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

      const valorTotal = (qtdPontos * VALOR_MILHEIRO[companhia]) + taxa;
      
      const dataIdaFormatada = dataIda ? dataIda.split('-').reverse().join('-') : '';
      const dataVoltaFormatada = dataVolta ? dataVolta.split('-').reverse().join('-') : '';

      const novaCotacao = {
        cliente, origem, destino, companhia, tipoVoo,
        dataIda: dataIdaFormatada, horaSaidaIda, horaChegadaIda, duracaoIda: calcularDuracao(horaSaidaIda, horaChegadaIda), paradasIda,
        dataVolta: tipoVoo === 'ida_volta' ? dataVoltaFormatada : null,
        valorTotal,
        dataRegistro: new Date(),
        status: 'Novo 🆕'
      };

      await addDoc(collection(db, "cotacoes"), novaCotacao);
      
      const textoMensagem = `Cotação ${cliente}\n${valorTotal}\n\nAgência Voo Singular`;
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
          cliente={cliente} setCliente={setCliente}
          origem={origem} setOrigem={setOrigem}
          destino={destino} setDestino={setDestino}
          companhia={companhia} setCompanhia={setCompanhia}
          tipoVoo={tipoVoo} setTipoVoo={setTipoVoo}
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
              ticketRef={ticketRef} companhia={companhia} origem={origem} destino={destino}
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