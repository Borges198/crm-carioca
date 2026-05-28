import type { Companhia } from '../types';

export interface SmartPasteResultado {
  tipoVoo?: string;
  origem?: string;
  destino?: string;
  horaSaidaIda?: string;
  horaChegadaIda?: string;
  horaSaidaVolta?: string;
  horaChegadaVolta?: string;
  dataIda?: string;
  dataVolta?: string;
  limparDataVolta?: boolean;
  companhia?: Companhia;
  paradasIda?: string;
  paradasVolta?: string;
  pontos?: string;
  taxaEmbarque?: string;
}

export function extrairDadosSmartPaste(texto: string): SmartPasteResultado {
  const resultado: SmartPasteResultado = {};

  let matches: Array<{hora: string, aeroporto: string}> = [];
  const timeAirportRegex = /(\d{1,2}:\d{2})\s*([A-Z]{3})/g; 
  const timeAirportMatches = [...texto.matchAll(timeAirportRegex)];
  
  if (timeAirportMatches.length > 0) {
    matches = timeAirportMatches.map(m => ({ hora: m[1].padStart(5, '0'), aeroporto: m[2] }));
  } else {
    const smilesRegex = /([A-Z]{3})\s*(\d{2})h(\d{2})/g;
    const smilesMatches = [...texto.matchAll(smilesRegex)];
    matches = smilesMatches.map(m => ({ hora: `${m[2]}:${m[3]}`, aeroporto: m[1] }));
  }

  if (matches.length >= 4) {
    resultado.tipoVoo = 'ida_volta';
    resultado.horaSaidaIda = matches[0].hora;
    resultado.origem = matches[0].aeroporto;
    resultado.horaChegadaIda = matches[1].hora;
    resultado.destino = matches[1].aeroporto;
    resultado.horaSaidaVolta = matches[2].hora;
    resultado.horaChegadaVolta = matches[3].hora;
  } else if (matches.length >= 2) {
    resultado.tipoVoo = 'ida';
    resultado.horaSaidaIda = matches[0].hora;
    resultado.origem = matches[0].aeroporto;
    resultado.horaChegadaIda = matches[1].hora;
    resultado.destino = matches[1].aeroporto;
  }

  let datasEncontradas: string[] = [];
  const dateRegex1 = /(\d{2})\/(\d{2})\/(\d{4})/g;
  const matchDates1 = [...texto.matchAll(dateRegex1)];
  
  if (matchDates1.length > 0) {
    datasEncontradas = matchDates1.map(m => `${m[3]}-${m[2]}-${m[1]}`);
  } else {
    const meses: Record<string, string> = {
        janeiro: '01', jan: '01', fevereiro: '02', fev: '02', março: '03', marco: '03', mar: '03', abril: '04', abr: '04',
        maio: '05', mai: '05', junho: '06', jun: '06', julho: '07', jul: '07', agosto: '08', ago: '08', setembro: '09', set: '09',
        outubro: '10', out: '10', novembro: '11', nov: '11', dezembro: '12', dez: '12'
    };
    
    const dateRegexText = /(\d{1,2})\s*de\s*([a-zA-Zç]+)\.?(?:\s*de\s*(\d{4}))?/gi;
    const matchDatesText = [...texto.matchAll(dateRegexText)];
    
    matchDatesText.forEach(m => {
        const mesTexto = m[2].toLowerCase();
        if (meses[mesTexto]) {
            const dia = m[1].padStart(2, '0');
            const mes = meses[mesTexto];
            const ano = m[3] || new Date().getFullYear().toString();
            datasEncontradas.push(`${ano}-${mes}-${dia}`);
        }
    });

    if (datasEncontradas.length === 0) {
        const dateRegexCurto = /(\d{2})\/(\d{2})(?!\/\d{4})/g;
        const matchDatesCurto = [...texto.matchAll(dateRegexCurto)];
        matchDatesCurto.forEach(m => {
            datasEncontradas.push(`${new Date().getFullYear()}-${m[2]}-${m[1]}`);
        });
    }
  }

  datasEncontradas = Array.from(new Set(datasEncontradas));

  if (datasEncontradas.length >= 2) {
     resultado.dataIda = datasEncontradas[0];
     resultado.dataVolta = datasEncontradas[1];
  } else if (datasEncontradas.length === 1) {
     resultado.dataIda = datasEncontradas[0];
     resultado.limparDataVolta = true;
  }

  if (/azul/i.test(texto)) resultado.companhia = "Azul";
  else if (/smiles|gol/i.test(texto)) resultado.companhia = "GOL";
  else if (/latam/i.test(texto)) resultado.companhia = "Latam";

  const paradasMatches = [...texto.matchAll(/(direto|1\s*conexão|1\s*conexao|1\s*parada|2\s*conexões|2\s*conexoes|2\s*paradas)/gi)];
  const formatParada = (p: string) => {
     if (/direto/i.test(p)) return "Direto";
     if (/1/i.test(p)) return "1 Parada";
     if (/2/i.test(p)) return "2 Paradas";
     return "Direto";
  };

  if (paradasMatches.length >= 2) {
     resultado.paradasIda = formatParada(paradasMatches[0][0]);
     resultado.paradasVolta = formatParada(paradasMatches[1][0]);
  } else if (paradasMatches.length === 1) {
     resultado.paradasIda = formatParada(paradasMatches[0][0]);
  }

  const pontosRegex = /(\d{1,3}[.,]?\d{3}|\d{4,6})(?=\s*pts|\s*pontos|\s*milhas)/gi;
  const pontosMatches = [...texto.matchAll(pontosRegex)];
  if (pontosMatches.length > 0) {
     let maiorPonto = 0;
     pontosMatches.forEach(m => {
         const valorLimpo = parseInt(m[1].replace(/[.,]/g, ''), 10);
         if (valorLimpo > maiorPonto) maiorPonto = valorLimpo;
     });
     if (maiorPonto > 0) resultado.pontos = Math.ceil(maiorPonto / 1000).toString();
  }

  const taxaRegex = /(?:R\$|BRL)\s*(\d+[,.]\d{2})/gi;
  const taxaMatches = [...texto.matchAll(taxaRegex)];
  if (taxaMatches.length > 0) {
     let maiorTaxa = 0;
     taxaMatches.forEach(m => {
         const valorTaxaFloat = parseFloat(m[1].replace(',', '.'));
         if (valorTaxaFloat > maiorTaxa) maiorTaxa = valorTaxaFloat;
     });
     if (maiorTaxa > 0) resultado.taxaEmbarque = Math.ceil(maiorTaxa).toString();
  }

  return resultado;
}
