import type {
  ComItinerarioEmMemoria,
  ItinerarioCotacao,
  PernaVoo,
  SentidoItinerario,
  TipoSentidoItinerario,
} from '../types';

export interface CotacaoLegadaParaItinerario {
  origem: string;
  destino: string;
  companhia: string;
  tipoVoo?: string | null;
  origemIda?: string | null;
  destinoIda?: string | null;
  origemVolta?: string | null;
  destinoVolta?: string | null;
  companhiaIda?: string | null;
  companhiaVolta?: string | null;
  dataIda?: string | null;
  dataVolta?: string | null;
  horaSaidaIda?: string | null;
  horaChegadaIda?: string | null;
  horaSaidaVolta?: string | null;
  horaChegadaVolta?: string | null;
  duracaoIda?: string | null;
  duracaoVolta?: string | null;
  paradasIda?: string | null;
  paradasVolta?: string | null;
}

export interface ResumoSentidoItinerario {
  origem?: string;
  destino?: string;
  dataSaida?: string;
  horaSaida?: string;
  dataChegada?: string;
  horaChegada?: string;
  duracaoTotal?: string;
  quantidadeParadas: number;
  companhias: string[];
}

function textoPreenchido(valor?: string | null): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const texto = valor.trim();
  return texto || undefined;
}

function primeiroPreenchido(...valores: Array<string | null | undefined>) {
  for (const valor of valores) {
    const texto = textoPreenchido(valor);
    if (texto) return texto;
  }
  return undefined;
}

function extrairQuantidadeParadas(paradas?: string | null) {
  const texto = textoPreenchido(paradas);
  if (!texto) return undefined;
  if (/direto/i.test(texto)) return 0;

  const quantidade = texto.match(/\d+/)?.[0];
  return quantidade ? Number(quantidade) : undefined;
}

function montarPernaLegada({
  origem,
  destino,
  companhia,
  dataSaida,
  horaSaida,
  horaChegada,
}: {
  origem?: string;
  destino?: string;
  companhia?: string;
  dataSaida?: string;
  horaSaida?: string;
  horaChegada?: string;
}): PernaVoo {
  return {
    ...(origem ? { origem } : {}),
    ...(destino ? { destino } : {}),
    ...(companhia ? { companhia } : {}),
    ...(dataSaida ? { dataSaida } : {}),
    ...(horaSaida ? { horaSaida } : {}),
    ...(horaChegada ? { horaChegada } : {}),
  };
}

function montarSentidoLegado(
  tipo: 'ida',
  perna: PernaVoo,
  duracaoTotal?: string,
  paradas?: string
): SentidoItinerario<'ida'>;
function montarSentidoLegado(
  tipo: 'volta',
  perna: PernaVoo,
  duracaoTotal?: string,
  paradas?: string
): SentidoItinerario<'volta'>;
function montarSentidoLegado<TTipo extends TipoSentidoItinerario>(
  tipo: TTipo,
  perna: PernaVoo,
  duracaoTotal?: string,
  paradas?: string
): SentidoItinerario<TTipo> {
  return {
    tipo,
    pernas: [perna],
    fonte: 'legado',
    ...(duracaoTotal ? { duracaoTotal } : {}),
    ...(paradas ? { paradas } : {}),
  };
}

function possuiSinalDeVolta(cotacao: CotacaoLegadaParaItinerario) {
  if (cotacao.tipoVoo === 'ida') return false;
  if (cotacao.tipoVoo === 'ida_volta') return true;

  return Boolean(primeiroPreenchido(
    cotacao.origemVolta,
    cotacao.destinoVolta,
    cotacao.dataVolta,
    cotacao.horaSaidaVolta,
    cotacao.horaChegadaVolta
  ));
}

/**
 * Cria uma visão estruturada e não persistida de uma cotação antiga. Como os
 * documentos legados não guardam as conexões, cada sentido vira uma única
 * perna sintética que resume o primeiro embarque e o destino final.
 */
export function derivarItinerarioDeCotacaoLegada(
  cotacao: CotacaoLegadaParaItinerario
): ItinerarioCotacao {
  const origemIda = primeiroPreenchido(cotacao.origemIda, cotacao.origem);
  const destinoIda = primeiroPreenchido(cotacao.destinoIda, cotacao.destino);
  const companhiaIda = primeiroPreenchido(cotacao.companhiaIda, cotacao.companhia);
  const ida = montarSentidoLegado(
    'ida',
    montarPernaLegada({
      origem: origemIda,
      destino: destinoIda,
      companhia: companhiaIda,
      dataSaida: textoPreenchido(cotacao.dataIda),
      horaSaida: textoPreenchido(cotacao.horaSaidaIda),
      horaChegada: textoPreenchido(cotacao.horaChegadaIda),
    }),
    textoPreenchido(cotacao.duracaoIda),
    textoPreenchido(cotacao.paradasIda)
  );

  const itinerario: ItinerarioCotacao = { versao: 1, ida };
  if (!possuiSinalDeVolta(cotacao)) return itinerario;

  itinerario.volta = montarSentidoLegado(
    'volta',
    montarPernaLegada({
      origem: primeiroPreenchido(cotacao.origemVolta, destinoIda, cotacao.destino),
      destino: primeiroPreenchido(cotacao.destinoVolta, origemIda, cotacao.origem),
      companhia: primeiroPreenchido(cotacao.companhiaVolta, companhiaIda, cotacao.companhia),
      dataSaida: textoPreenchido(cotacao.dataVolta),
      horaSaida: textoPreenchido(cotacao.horaSaidaVolta),
      horaChegada: textoPreenchido(cotacao.horaChegadaVolta),
    }),
    textoPreenchido(cotacao.duracaoVolta),
    textoPreenchido(cotacao.paradasVolta)
  );

  return itinerario;
}

/** Retorna o itinerário novo quando presente ou deriva um fallback legado. */
export function obterItinerarioEfetivo<T extends CotacaoLegadaParaItinerario>(
  estado: ComItinerarioEmMemoria<T>
): ItinerarioCotacao {
  return estado.itinerario ?? derivarItinerarioDeCotacaoLegada(estado.cotacao);
}

/** Resume um sentido sem descartar as pernas que permanecem no objeto original. */
export function resumirSentidoItinerario(
  sentido: SentidoItinerario
): ResumoSentidoItinerario {
  const primeiraPerna = sentido.pernas[0];
  const ultimaPerna = sentido.pernas[sentido.pernas.length - 1];
  const origem = textoPreenchido(primeiraPerna?.origem);
  const destino = textoPreenchido(ultimaPerna?.destino);
  const dataSaida = textoPreenchido(primeiraPerna?.dataSaida);
  const horaSaida = textoPreenchido(primeiraPerna?.horaSaida);
  const dataChegada = textoPreenchido(ultimaPerna?.dataChegada);
  const horaChegada = textoPreenchido(ultimaPerna?.horaChegada);
  const duracaoTotal = textoPreenchido(sentido.duracaoTotal);
  const paradasPelasPernas = Math.max(sentido.pernas.length - 1, 0);
  const paradasLegadas = sentido.fonte === 'legado'
    ? extrairQuantidadeParadas(sentido.paradas)
    : undefined;
  const companhias = Array.from(new Set(
    sentido.pernas
      .map((perna) => textoPreenchido(perna.companhia))
      .filter((companhia): companhia is string => Boolean(companhia))
  ));

  return {
    ...(origem ? { origem } : {}),
    ...(destino ? { destino } : {}),
    ...(dataSaida ? { dataSaida } : {}),
    ...(horaSaida ? { horaSaida } : {}),
    ...(dataChegada ? { dataChegada } : {}),
    ...(horaChegada ? { horaChegada } : {}),
    ...(duracaoTotal ? { duracaoTotal } : {}),
    quantidadeParadas: paradasPelasPernas > 0
      ? paradasPelasPernas
      : paradasLegadas ?? 0,
    companhias,
  };
}
