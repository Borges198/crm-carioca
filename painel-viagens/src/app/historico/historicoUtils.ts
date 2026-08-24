import type { Cotacao } from '../../types';
import type { LeadStatus, ProdutoOfertado } from '../../lib/leadUtils';
import { atualizarCotacao } from '../../services/cotacoesService';
import { normalizarTelefoneCliente } from '../../utils/clienteConversionUtils';

type VisaoHistorico = 'minhas' | 'equipe';

export interface IdentidadeSessaoHistorico {
  userId: string | undefined;
  geracao: number;
  visao: VisaoHistorico;
  agencyId?: string;
  role?: string;
}

export interface IdentidadeOperacaoHistorico extends IdentidadeSessaoHistorico {
  cotacaoId: string;
  ownerId?: string;
  operacao: 'editar' | 'comercial';
  tipoModal: 'completo' | 'comercial';
}

export interface SelecaoCotacaoComSessao {
  cotacao: Cotacao;
  identidade: IdentidadeOperacaoHistorico;
  tipoModal: 'completo' | 'comercial';
}

export const CAMPOS_OPERACIONAIS_PROTEGIDOS = [
  'tipoVoo',
  'origem',
  'destino',
  'origemIda',
  'destinoIda',
  'dataIda',
  'horaSaidaIda',
  'horaChegadaIda',
  'duracaoIda',
  'paradasIda',
  'origemVolta',
  'destinoVolta',
  'dataVolta',
  'horaSaidaVolta',
  'horaChegadaVolta',
  'duracaoVolta',
  'paradasVolta',
] as const satisfies readonly (keyof Cotacao)[];

const camposOperacionaisProtegidos = new Set<keyof Cotacao>(
  CAMPOS_OPERACIONAIS_PROTEGIDOS
);

export function cotacaoPossuiItinerarioProtegido(cotacao: Cotacao) {
  return Object.prototype.hasOwnProperty.call(cotacao, 'itinerario');
}

export function protegerPayloadEdicaoCotacao(
  cotacaoAtual: Cotacao,
  alteracoesSolicitadas: Partial<Cotacao>
): Partial<Cotacao> {
  const payload: Partial<Cotacao> = {};
  const protegeOperacionais = cotacaoPossuiItinerarioProtegido(cotacaoAtual);

  for (const [campo, valor] of Object.entries(alteracoesSolicitadas)) {
    const campoCotacao = campo as keyof Cotacao;
    if (
      campoCotacao === 'itinerario'
      || protegeOperacionais && camposOperacionaisProtegidos.has(campoCotacao)
    ) continue;

    Object.assign(payload, { [campoCotacao]: valor });
  }

  return payload;
}

export function criarSelecaoCotacao(
  cotacao: Cotacao,
  sessao: IdentidadeSessaoHistorico,
  tipoModal: 'completo' | 'comercial'
): SelecaoCotacaoComSessao {
  return {
    cotacao,
    tipoModal,
    identidade: {
      ...sessao,
      cotacaoId: cotacao.id,
      ownerId: cotacao.ownerId,
      operacao: tipoModal === 'completo' ? 'editar' : 'comercial',
      tipoModal,
    },
  };
}

export interface CamposEdicaoCotacao {
  cliente: string;
  telefone: string;
  origem: string;
  destino: string;
  companhia: string;
  valorTotal: number;
  dataIda: string;
}

export function criarCamposEdicaoCotacao(cotacao: Cotacao): CamposEdicaoCotacao {
  return {
    cliente: cotacao.cliente,
    telefone: cotacao.telefone ?? '',
    origem: cotacao.origem,
    destino: cotacao.destino,
    companhia: cotacao.companhia,
    valorTotal: cotacao.valorTotal || 0,
    dataIda: cotacao.dataIda,
  };
}

export function montarPayloadEdicaoCotacao(
  cotacaoAtual: Cotacao,
  campos: CamposEdicaoCotacao
) {
  return protegerPayloadEdicaoCotacao(cotacaoAtual, {
    cliente: campos.cliente,
    telefone: campos.telefone,
    telefoneNormalizado: normalizarTelefoneCliente(campos.telefone),
    origem: campos.origem,
    destino: campos.destino,
    companhia: campos.companhia,
    valorTotal: Number(campos.valorTotal),
    dataIda: campos.dataIda,
  });
}

export function atualizarCotacaoLocalPorId(
  cotacoes: Cotacao[],
  cotacaoId: string,
  dadosAtualizados: ReturnType<typeof montarPayloadEdicaoCotacao>
) {
  return cotacoes.map((item) => (
    item.id === cotacaoId ? { ...item, ...dadosAtualizados } : item
  ));
}

export async function persistirEdicaoCotacao(
  cotacaoId: string,
  cotacaoAtual: Cotacao,
  campos: CamposEdicaoCotacao,
  atualizar: typeof atualizarCotacao = atualizarCotacao
) {
  const dadosAtualizados = montarPayloadEdicaoCotacao(cotacaoAtual, campos);
  await atualizar(cotacaoId, dadosAtualizados);
  return dadosAtualizados;
}

export function podeEditarCotacaoCompleta(
  role: string | undefined,
  estaNaVisaoEquipe: boolean
) {
  return !(estaNaVisaoEquipe && role === 'supervisor');
}

export function operacaoHistoricoPertenceASessao(
  atual: IdentidadeSessaoHistorico,
  capturada: IdentidadeOperacaoHistorico,
  userIdAtual: string | undefined,
  cotacoesAtuais: Cotacao[],
  cotacaoSelecionadaId: string | undefined,
  role: string | undefined
) {
  if (
    !userIdAtual
    || atual.userId !== userIdAtual
    || atual.userId !== capturada.userId
    || atual.geracao !== capturada.geracao
    || atual.visao !== capturada.visao
    || atual.agencyId !== capturada.agencyId
    || atual.role !== capturada.role
    || cotacaoSelecionadaId !== capturada.cotacaoId
    || capturada.tipoModal === 'completo' && capturada.operacao !== 'editar'
    || capturada.tipoModal === 'comercial' && capturada.operacao !== 'comercial'
  ) {
    return false;
  }

  const cotacao = cotacoesAtuais.find((item) => item.id === capturada.cotacaoId);
  if (!cotacao) return false;
  if (cotacao.ownerId !== capturada.ownerId) return false;

  if (atual.visao === 'equipe') {
    return Boolean(
      (role === 'admin' || role === 'supervisor')
      && atual.agencyId
      && (!cotacao.agencyId || cotacao.agencyId === atual.agencyId)
    );
  }

  return !cotacao.ownerId || cotacao.ownerId === userIdAtual;
}

export function montarPayloadEdicaoComercial(
  leadStatus: LeadStatus,
  produtosOfertados: ProdutoOfertado[],
  observacao: string
) {
  return {
    leadStatus,
    produtosOfertados,
    observacao: observacao.trim(),
  };
}
