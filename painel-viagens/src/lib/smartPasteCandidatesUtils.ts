import type { Companhia } from '../types';

export type SmartPasteCandidateTrecho = 'ida' | 'volta' | 'total';

export interface SmartPasteCandidate {
  trecho: SmartPasteCandidateTrecho;
  raw: {
    pontos?: number;
    taxa?: number;
  };
  rounded: {
    pontos?: number;
    taxa?: number;
  };
}

export interface SmartPasteCandidatesResult {
  companhia?: Companhia;
  candidates: SmartPasteCandidate[];
}

interface PairValue {
  pontos: number;
  taxa: number;
}

function normalizarInteiro(valor: string) {
  return parseInt(valor.replace(/[.,]/g, ''), 10);
}

function normalizarDecimal(valor: string) {
  return parseFloat(valor.replace(/\./g, '').replace(',', '.'));
}

function arredondarCandidato(trecho: SmartPasteCandidateTrecho, raw: SmartPasteCandidate['raw']): SmartPasteCandidate {
  return {
    trecho,
    raw,
    rounded: {
      pontos: typeof raw.pontos === 'number' ? Math.ceil(raw.pontos / 1000) : undefined,
      taxa: typeof raw.taxa === 'number' ? Math.ceil(raw.taxa) : undefined,
    },
  };
}

function detectarCompanhia(texto: string): Companhia | undefined {
  if (/azul/i.test(texto)) return 'Azul';
  if (/smiles|gol/i.test(texto)) return 'GOL';
  if (/latam/i.test(texto)) return 'Latam';
  return undefined;
}

function dedupePairs(pairs: PairValue[]) {
  const seen = new Set<string>();

  return pairs.filter((pair) => {
    const key = `${pair.pontos}:${pair.taxa}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extrairParesAzul(texto: string) {
  const pairs = [...texto.matchAll(/(\d{1,3}(?:[.,]\d{3})*)[ \t]*pontos[ \t]*\+[ \t]*R\$[ \t]*(\d+[,.]\d{2})/gi)];

  return dedupePairs(pairs.map((match) => ({
    pontos: normalizarInteiro(match[1]),
    taxa: normalizarDecimal(match[2]),
  })));
}

function extrairParesLatam(texto: string) {
  const pairs = [...texto.matchAll(/(\d{1,3}(?:\.\d{3})*|\d+)\s*milhas\s*\+\s*BRL\s*(\d+[,.]\d{2})/gi)];

  return dedupePairs(pairs.map((match) => ({
    pontos: normalizarInteiro(match[1]),
    taxa: normalizarDecimal(match[2]),
  })));
}

function extrairParesSmiles(texto: string) {
  const pairs = [...texto.matchAll(/(\d{1,3}(?:\.\d{3})*|\d+)\s*milhas\s*\+\s*R\$\s*(\d+[,.]\d{2})/gi)]
    .map((match) => ({
      pontos: normalizarInteiro(match[1]),
      taxa: normalizarDecimal(match[2]),
    }));

  return dedupePairs(pairs).sort((a, b) => b.pontos - a.pontos);
}

function extrairMilhasPorViajanteSmiles(texto: string) {
  const pontos = [...texto.matchAll(/(\d{1,3}(?:\.\d{3})*|\d+)\s*milhas\s+por viajante/gi)]
    .map((match) => normalizarInteiro(match[1]));

  return Array.from(new Set(pontos));
}

function detectarTrechoUnico(texto: string): SmartPasteCandidateTrecho {
  if (
    /Aracaju[\s\S]{0,120}São Paulo/i.test(texto) ||
    /\bAJU\s+\d{1,2}h?\d{2}[\s\S]{0,120}(?:SAO|GRU|VCP|CGH)\b/i.test(texto)
  ) {
    return 'volta';
  }

  return 'ida';
}

function mapearParesPorTrecho(
  pairs: PairValue[],
  incluiVolta: boolean,
  trechoUnico: SmartPasteCandidateTrecho = 'ida'
) {
  if (pairs.length === 0) return [];

  if (incluiVolta) {
    return pairs.map((pair, index) => {
      const trecho: SmartPasteCandidateTrecho = index === 0 ? 'ida' : index === 1 ? 'volta' : 'total';
      return arredondarCandidato(trecho, pair);
    });
  }

  return [arredondarCandidato(trechoUnico, pairs[0])];
}

function extrairCandidatosAzul(texto: string) {
  const pares = extrairParesAzul(texto);

  return mapearParesPorTrecho(
    pares,
    pares.length > 1,
    detectarTrechoUnico(texto)
  );
}

function extrairCandidatosLatam(texto: string) {
  return mapearParesPorTrecho(
    extrairParesLatam(texto),
    /Voo de volta|Modificar voo de volta/i.test(texto),
    detectarTrechoUnico(texto)
  );
}

function extrairCandidatosSmiles(texto: string) {
  const incluiVolta = /Passagem de volta/i.test(texto);
  const pontosPorViajante = extrairMilhasPorViajanteSmiles(texto);
  const pares = extrairParesSmiles(texto);
  const candidates: SmartPasteCandidate[] = [];

  if (incluiVolta && pontosPorViajante.length >= 2) {
    candidates.push(arredondarCandidato('ida', { pontos: pontosPorViajante[0] }));
    candidates.push(arredondarCandidato('volta', { pontos: pontosPorViajante[1] }));
  }

  if (pares.length > 0) {
    const totalTrecho: SmartPasteCandidateTrecho = incluiVolta ? 'total' : detectarTrechoUnico(texto);
    candidates.push(arredondarCandidato(totalTrecho, pares[0]));
  }

  return candidates;
}

export function extrairCandidatosSmartPaste(texto: string): SmartPasteCandidatesResult {
  const companhia = detectarCompanhia(texto);

  if (companhia === 'Azul') {
    return { companhia, candidates: extrairCandidatosAzul(texto) };
  }

  if (companhia === 'Latam') {
    return { companhia, candidates: extrairCandidatosLatam(texto) };
  }

  if (companhia === 'GOL') {
    return { companhia, candidates: extrairCandidatosSmiles(texto) };
  }

  return { companhia, candidates: [] };
}
