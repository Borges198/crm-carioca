import { Timestamp } from 'firebase/firestore';
import type { Acompanhamento, Cotacao } from '../types';

function compararIds(a: string, b: string) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function selecionarCotacaoAncoraId(cotacoes: Pick<Cotacao, 'id'>[]) {
  const ids = cotacoes
    .map((cotacao) => cotacao.id.trim())
    .filter(Boolean)
    .sort(compararIds);

  if (ids.length === 0) {
    throw new Error('Não há cotação válida para ancorar o acompanhamento.');
  }

  return ids[0];
}

export function montarAcompanhamentoId(ownerId: string, cotacaoAncoraId: string) {
  const owner = ownerId.trim();
  const ancora = cotacaoAncoraId.trim();

  if (!owner || !ancora) {
    throw new Error('Owner e cotação-âncora são obrigatórios.');
  }

  return `owner_${encodeURIComponent(owner)}__cotacao_${encodeURIComponent(ancora)}`;
}

export function obterClienteIdConsistente(
  cotacoes: Pick<Cotacao, 'clienteId'>[]
) {
  if (cotacoes.length === 0) return undefined;

  const ids = cotacoes.map((cotacao) => cotacao.clienteId?.trim()).filter(Boolean);
  if (ids.length !== cotacoes.length) return undefined;

  const idsUnicos = new Set(ids);
  return idsUnicos.size === 1 ? ids[0] : undefined;
}

export function normalizarDataComercialParaTimestamp(data: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!match) {
    throw new Error('Data comercial inválida.');
  }

  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const instante = new Date(Date.UTC(ano, mes - 1, dia, 12));

  if (
    instante.getUTCFullYear() !== ano
    || instante.getUTCMonth() !== mes - 1
    || instante.getUTCDate() !== dia
  ) {
    throw new Error('Data comercial inválida.');
  }

  return Timestamp.fromDate(instante);
}

export function formatarDataComercialParaInput(data: Timestamp | null) {
  if (!data) return '';
  const valor = data.toDate();
  const ano = valor.getUTCFullYear();
  const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(valor.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function formatarDataComercial(data: Timestamp | null) {
  const valor = formatarDataComercialParaInput(data);
  if (!valor) return 'Não definida';
  const [ano, mes, dia] = valor.split('-');
  return `${dia}/${mes}/${ano}`;
}

export type ClassificacaoProximaAcao =
  | 'NÃO DEFINIDA'
  | 'ATRASADA'
  | 'HOJE'
  | 'PRÓXIMA';

const PRIORIDADE_PROXIMA_ACAO: Record<ClassificacaoProximaAcao, number> = {
  ATRASADA: 0,
  HOJE: 1,
  'PRÓXIMA': 2,
  'NÃO DEFINIDA': 3,
};

function obterDiaUtc(data: Date) {
  return Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
}

export function classificarProximaAcao(
  proximaAcaoEm: Timestamp | null,
  hoje = new Date()
): ClassificacaoProximaAcao {
  if (!proximaAcaoEm) return 'NÃO DEFINIDA';

  const diaProximaAcao = obterDiaUtc(proximaAcaoEm.toDate());
  const diaHoje = obterDiaUtc(hoje);

  if (diaProximaAcao < diaHoje) return 'ATRASADA';
  if (diaProximaAcao === diaHoje) return 'HOJE';
  return 'PRÓXIMA';
}

export function ordenarPorProximaAcao<T>(
  itens: T[],
  obterProximaAcaoEm: (item: T) => Timestamp | null,
  hoje = new Date()
) {
  return itens
    .map((item, indiceOriginal) => ({ item, indiceOriginal }))
    .sort((a, b) => {
      const dataA = obterProximaAcaoEm(a.item);
      const dataB = obterProximaAcaoEm(b.item);
      const classificacaoA = classificarProximaAcao(dataA, hoje);
      const classificacaoB = classificarProximaAcao(dataB, hoje);
      const diferencaPrioridade = PRIORIDADE_PROXIMA_ACAO[classificacaoA]
        - PRIORIDADE_PROXIMA_ACAO[classificacaoB];

      if (diferencaPrioridade !== 0) return diferencaPrioridade;

      if (
        classificacaoA === 'ATRASADA'
        || classificacaoA === 'PRÓXIMA'
      ) {
        const diferencaData = obterDiaUtc(dataA!.toDate()) - obterDiaUtc(dataB!.toDate());
        if (diferencaData !== 0) return diferencaData;
      }

      return a.indiceOriginal - b.indiceOriginal;
    })
    .map(({ item }) => item);
}

export function vincularCotacoesLocalmente(
  cotacoes: Cotacao[],
  cotacaoIds: string[],
  acompanhamentoId: string
) {
  const ids = new Set(cotacaoIds);
  return cotacoes.map((cotacao) => {
    if (!ids.has(cotacao.id)) return cotacao;
    if (cotacao.acompanhamentoId && cotacao.acompanhamentoId !== acompanhamentoId) {
      throw new Error('Cotação já vinculada a outro acompanhamento.');
    }
    return { ...cotacao, acompanhamentoId };
  });
}

export function atualizarAcompanhamentoLocalmente(
  acompanhamentos: Acompanhamento[],
  acompanhamentoAtualizado: Acompanhamento
) {
  const existe = acompanhamentos.some((item) => item.id === acompanhamentoAtualizado.id);
  return existe
    ? acompanhamentos.map((item) => (
        item.id === acompanhamentoAtualizado.id ? acompanhamentoAtualizado : item
      ))
    : [...acompanhamentos, acompanhamentoAtualizado];
}
