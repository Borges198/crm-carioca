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

export interface ProjecaoLegadaItinerario {
  tipoVoo: 'ida' | 'ida_volta';
  origem: string;
  destino: string;
  origemIda: string;
  destinoIda: string;
  origemVolta?: string;
  destinoVolta?: string;
  companhia?: string;
  companhiaIda?: string;
  companhiaVolta?: string;
  dataIda?: string;
  dataVolta?: string;
  horaSaidaIda?: string;
  horaChegadaIda?: string;
  horaSaidaVolta?: string;
  horaChegadaVolta?: string;
  duracaoIda?: string;
  duracaoVolta?: string;
  paradasIda: string;
  paradasVolta?: string;
}

type ObjetoDesconhecido = Record<string, unknown>;

export type PernaVooValidada = PernaVoo & {
  origem: string;
  destino: string;
};

export type SentidoItinerarioValidado<
  TTipo extends TipoSentidoItinerario
> = Omit<SentidoItinerario<TTipo>, 'pernas'> & {
  pernas: [PernaVooValidada, ...PernaVooValidada[]];
};

export interface ItinerarioCotacaoValidado extends ItinerarioCotacao {
  ida: SentidoItinerarioValidado<'ida'>;
  volta?: SentidoItinerarioValidado<'volta'>;
}

function falharValidacao(caminho: string, motivo: string): never {
  throw new Error(`Itinerário inválido em ${caminho}: ${motivo}`);
}

function ehObjetoSimples(valor: unknown): valor is ObjetoDesconhecido {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return false;
  const prototype = Object.getPrototypeOf(valor);
  return prototype === Object.prototype || prototype === null;
}

function normalizarTextoDesconhecido(
  valor: unknown,
  caminho: string
): string | undefined {
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor !== 'string') falharValidacao(caminho, 'deve ser texto');
  const texto = valor.trim();
  return texto || undefined;
}

function normalizarAeroporto(valor: unknown, caminho: string) {
  const aeroporto = normalizarTextoDesconhecido(valor, caminho);
  if (!aeroporto) falharValidacao(caminho, 'é obrigatório');
  return /^[a-z]{3}$/i.test(aeroporto) ? aeroporto.toUpperCase() : aeroporto;
}

function dataExiste(ano: number, mes: number, dia: number) {
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano
    && data.getUTCMonth() === mes - 1
    && data.getUTCDate() === dia;
}

function normalizarDataDesconhecida(valor: unknown, caminho: string) {
  const texto = normalizarTextoDesconhecido(valor, caminho);
  if (!texto) return undefined;

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const legada = texto.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  const partes = iso
    ? { ano: Number(iso[1]), mes: Number(iso[2]), dia: Number(iso[3]) }
    : legada
      ? { ano: Number(legada[3]), mes: Number(legada[2]), dia: Number(legada[1]) }
      : undefined;

  if (!partes || !dataExiste(partes.ano, partes.mes, partes.dia)) {
    falharValidacao(caminho, 'deve conter uma data válida');
  }

  return [
    partes.ano.toString().padStart(4, '0'),
    partes.mes.toString().padStart(2, '0'),
    partes.dia.toString().padStart(2, '0'),
  ].join('-');
}

function normalizarHoraDesconhecida(valor: unknown, caminho: string) {
  const texto = normalizarTextoDesconhecido(valor, caminho);
  if (!texto) return undefined;

  const match = texto.match(/^(\d{1,2}):(\d{2})$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    falharValidacao(caminho, 'deve conter um horário válido');
  }

  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function montarInstanteComparavel(data?: string, hora?: string) {
  return data && hora ? `${data}T${hora}` : undefined;
}

function normalizarPernaDesconhecida(valor: unknown, caminho: string): PernaVooValidada {
  if (!ehObjetoSimples(valor)) falharValidacao(caminho, 'deve ser um objeto');

  const origem = normalizarAeroporto(valor.origem, `${caminho}.origem`);
  const destino = normalizarAeroporto(valor.destino, `${caminho}.destino`);
  const companhia = normalizarTextoDesconhecido(valor.companhia, `${caminho}.companhia`);
  const numeroVoo = normalizarTextoDesconhecido(valor.numeroVoo, `${caminho}.numeroVoo`);
  const dataSaida = normalizarDataDesconhecida(valor.dataSaida, `${caminho}.dataSaida`);
  const horaSaida = normalizarHoraDesconhecida(valor.horaSaida, `${caminho}.horaSaida`);
  const dataChegada = normalizarDataDesconhecida(valor.dataChegada, `${caminho}.dataChegada`);
  const horaChegada = normalizarHoraDesconhecida(valor.horaChegada, `${caminho}.horaChegada`);
  const duracao = normalizarTextoDesconhecido(valor.duracao, `${caminho}.duracao`);
  const instanteSaida = montarInstanteComparavel(dataSaida, horaSaida);
  const instanteChegada = montarInstanteComparavel(dataChegada, horaChegada);

  if (instanteSaida && instanteChegada && instanteChegada < instanteSaida) {
    falharValidacao(
      `${caminho}.dataChegada`,
      'a chegada não pode ser anterior à saída da mesma perna'
    );
  }

  return {
    origem,
    destino,
    ...(companhia ? { companhia } : {}),
    ...(numeroVoo ? { numeroVoo } : {}),
    ...(dataSaida ? { dataSaida } : {}),
    ...(horaSaida ? { horaSaida } : {}),
    ...(dataChegada ? { dataChegada } : {}),
    ...(horaChegada ? { horaChegada } : {}),
    ...(duracao ? { duracao } : {}),
  };
}

function normalizarSentidoDesconhecido<TTipo extends TipoSentidoItinerario>(
  valor: unknown,
  tipoEsperado: TTipo,
  caminho: string
): SentidoItinerarioValidado<TTipo> {
  if (!ehObjetoSimples(valor)) falharValidacao(caminho, 'deve ser um objeto');
  if (valor.tipo !== tipoEsperado) {
    falharValidacao(`${caminho}.tipo`, `deve ser '${tipoEsperado}'`);
  }
  if (!Array.isArray(valor.pernas) || valor.pernas.length === 0) {
    falharValidacao(`${caminho}.pernas`, 'deve conter ao menos uma perna');
  }

  const pernas = valor.pernas.map((perna, indice) => (
    normalizarPernaDesconhecida(perna, `${caminho}.pernas[${indice}]`)
  )) as [PernaVooValidada, ...PernaVooValidada[]];

  for (let indice = 1; indice < pernas.length; indice += 1) {
    const pernaAnterior = pernas[indice - 1];
    const pernaAtual = pernas[indice];
    const destinoAnterior = pernaAnterior.destino;
    const origemAtual = pernaAtual.origem;
    if (destinoAnterior?.toLocaleUpperCase() !== origemAtual?.toLocaleUpperCase()) {
      falharValidacao(
        `${caminho}.pernas[${indice}].origem`,
        'deve coincidir com o destino da perna anterior'
      );
    }

    const chegadaAnterior = montarInstanteComparavel(
      pernaAnterior.dataChegada,
      pernaAnterior.horaChegada
    );
    const saidaAtual = montarInstanteComparavel(pernaAtual.dataSaida, pernaAtual.horaSaida);
    if (chegadaAnterior && saidaAtual && saidaAtual < chegadaAnterior) {
      falharValidacao(
        `${caminho}.pernas[${indice}].dataSaida`,
        'a saída não pode ser anterior à chegada da perna anterior'
      );
    }
  }

  const fonte = normalizarTextoDesconhecido(valor.fonte, `${caminho}.fonte`);
  if (fonte && fonte !== 'estruturado' && fonte !== 'legado') {
    falharValidacao(`${caminho}.fonte`, 'deve ser estruturado ou legado');
  }
  const fonteNormalizada = fonte === 'estruturado' || fonte === 'legado'
    ? fonte
    : undefined;
  const duracaoTotal = normalizarTextoDesconhecido(
    valor.duracaoTotal,
    `${caminho}.duracaoTotal`
  );
  const paradas = normalizarTextoDesconhecido(valor.paradas, `${caminho}.paradas`);

  return {
    tipo: tipoEsperado,
    pernas,
    ...(fonteNormalizada ? { fonte: fonteNormalizada } : {}),
    ...(duracaoTotal ? { duracaoTotal } : {}),
    ...(paradas ? { paradas } : {}),
  };
}

/**
 * Valida dados externos e devolve uma nova estrutura canônica, sem manter
 * chaves desconhecidas, strings vazias ou valores undefined.
 */
export function validarENormalizarItinerario(valor: unknown): ItinerarioCotacaoValidado {
  if (!ehObjetoSimples(valor)) falharValidacao('itinerario', 'deve ser um objeto');
  if (valor.versao !== 1) falharValidacao('itinerario.versao', 'deve ser 1');

  const ida = normalizarSentidoDesconhecido(valor.ida, 'ida', 'itinerario.ida');
  const volta = valor.volta === undefined || valor.volta === null
    ? undefined
    : normalizarSentidoDesconhecido(valor.volta, 'volta', 'itinerario.volta');

  return {
    versao: 1,
    ida,
    ...(volta ? { volta } : {}),
  };
}

function formatarQuantidadeParadas(quantidade: number) {
  if (quantidade === 0) return 'Direto';
  if (quantidade === 1) return '1 Parada';
  return `${quantidade} Paradas`;
}

function formatarDataLegada(data?: string) {
  const match = data?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : data;
}

function projetarSentido(sentido: SentidoItinerarioValidado<TipoSentidoItinerario>) {
  const primeiraPerna = sentido.pernas[0];
  const ultimaPerna = sentido.pernas[sentido.pernas.length - 1];
  return {
    origem: primeiraPerna.origem,
    destino: ultimaPerna.destino,
    companhia: primeiraPerna.companhia,
    dataSaida: formatarDataLegada(primeiraPerna.dataSaida),
    horaSaida: primeiraPerna.horaSaida,
    horaChegada: ultimaPerna.horaChegada,
    duracao: sentido.duracaoTotal
      ?? (sentido.pernas.length === 1 ? primeiraPerna.duracao : undefined),
    paradas: sentido.fonte === 'legado' && sentido.paradas
      ? sentido.paradas
      : formatarQuantidadeParadas(sentido.pernas.length - 1),
  };
}

/** Projeta apenas campos achatados; o itinerário recebido permanece intacto. */
export function projetarItinerarioParaCamposLegados(
  itinerario: ItinerarioCotacaoValidado
): ProjecaoLegadaItinerario {
  const ida = projetarSentido(itinerario.ida);
  const volta = itinerario.volta ? projetarSentido(itinerario.volta) : undefined;

  return {
    tipoVoo: volta ? 'ida_volta' : 'ida',
    origem: ida.origem,
    destino: ida.destino,
    origemIda: ida.origem,
    destinoIda: ida.destino,
    ...(volta ? { origemVolta: volta.origem, destinoVolta: volta.destino } : {}),
    ...(ida.companhia ? { companhia: ida.companhia, companhiaIda: ida.companhia } : {}),
    ...(volta?.companhia ? { companhiaVolta: volta.companhia } : {}),
    ...(ida.dataSaida ? { dataIda: ida.dataSaida } : {}),
    ...(volta?.dataSaida ? { dataVolta: volta.dataSaida } : {}),
    ...(ida.horaSaida ? { horaSaidaIda: ida.horaSaida } : {}),
    ...(ida.horaChegada ? { horaChegadaIda: ida.horaChegada } : {}),
    ...(volta?.horaSaida ? { horaSaidaVolta: volta.horaSaida } : {}),
    ...(volta?.horaChegada ? { horaChegadaVolta: volta.horaChegada } : {}),
    ...(ida.duracao ? { duracaoIda: ida.duracao } : {}),
    ...(volta?.duracao ? { duracaoVolta: volta.duracao } : {}),
    paradasIda: ida.paradas,
    ...(volta ? { paradasVolta: volta.paradas } : {}),
  };
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
