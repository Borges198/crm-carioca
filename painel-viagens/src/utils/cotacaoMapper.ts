import type { Companhia, NovaCotacao } from '../types';
import type { LeadStatus, ProdutoOfertado } from '../lib/leadUtils';
import { calcularDuracao } from './viagemUtils';

interface MontarNovaCotacaoInput {
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  agencyId: string;
  cliente: string;
  telefone?: string;
  telefoneNormalizado?: string;
  origem: string;
  destino: string;
  origemIda?: string;
  destinoIda?: string;
  origemVolta?: string;
  destinoVolta?: string;
  companhia: Companhia;
  tipoVoo: string;
  dataIda: string;
  dataVolta: string;
  horaSaidaIda: string;
  horaChegadaIda: string;
  horaSaidaVolta: string;
  horaChegadaVolta: string;
  paradasIda: string;
  paradasVolta: string;
  qtdPontos: number;
  taxaEmbarque: number;
  valorTotal: number;
  companhiaIda?: Companhia | string;
  companhiaVolta?: Companhia | string | null;
  pontosIda?: number;
  pontosVolta?: number | null;
  taxaIda?: number;
  taxaVolta?: number | null;
  valorIda?: number;
  valorVolta?: number | null;
  mensagem?: string;
  produtosOfertados?: ProdutoOfertado[] | string[];
  observacao?: string;
  leadStatus?: LeadStatus;
}

function campoTextoPreenchido(valor?: string | null) {
  return typeof valor === 'string' && valor.trim() !== '';
}

export function montarNovaCotacao(input: MontarNovaCotacaoInput): NovaCotacao {
  const novaCotacao: NovaCotacao = {
    cliente: input.cliente,
    origem: input.origem,
    destino: input.destino,
    companhia: input.companhia,
    tipoVoo: input.tipoVoo,
    ownerId: input.ownerId,
    agencyId: input.agencyId,
    dataIda: input.dataIda,
    horaSaidaIda: input.horaSaidaIda,
    horaChegadaIda: input.horaChegadaIda,
    duracaoIda: calcularDuracao(input.horaSaidaIda, input.horaChegadaIda),
    paradasIda: input.paradasIda,
    dataVolta: input.tipoVoo === 'ida_volta' ? input.dataVolta : null,
    valorTotal: input.valorTotal,
    dataRegistro: new Date(),
    status: 'Novo 🆕',
    produtosOfertados: input.produtosOfertados ?? [],
    observacao: input.observacao?.trim() ?? '',
    leadStatus: input.leadStatus ?? 'novo'
  };

  if (typeof input.companhiaIda !== 'undefined') {
    novaCotacao.companhiaIda = input.companhiaIda;
  }
  if (campoTextoPreenchido(input.origemIda)) {
    novaCotacao.origemIda = input.origemIda;
  }
  if (campoTextoPreenchido(input.destinoIda)) {
    novaCotacao.destinoIda = input.destinoIda;
  }
  if (campoTextoPreenchido(input.origemVolta)) {
    novaCotacao.origemVolta = input.origemVolta;
  }
  if (campoTextoPreenchido(input.destinoVolta)) {
    novaCotacao.destinoVolta = input.destinoVolta;
  }
  if (typeof input.companhiaVolta !== 'undefined') {
    novaCotacao.companhiaVolta = input.companhiaVolta;
  }
  if (typeof input.pontosIda !== 'undefined') {
    novaCotacao.pontosIda = input.pontosIda;
  }
  if (typeof input.pontosVolta !== 'undefined') {
    novaCotacao.pontosVolta = input.pontosVolta;
  }
  if (typeof input.taxaIda !== 'undefined') {
    novaCotacao.taxaIda = input.taxaIda;
  }
  if (typeof input.taxaVolta !== 'undefined') {
    novaCotacao.taxaVolta = input.taxaVolta;
  }
  if (typeof input.valorIda !== 'undefined') {
    novaCotacao.valorIda = input.valorIda;
  }
  if (typeof input.valorVolta !== 'undefined') {
    novaCotacao.valorVolta = input.valorVolta;
  }
  if (input.telefone) {
    novaCotacao.telefone = input.telefone;
  }
  if (input.telefoneNormalizado) {
    novaCotacao.telefoneNormalizado = input.telefoneNormalizado;
  }
  if (input.ownerName) {
    novaCotacao.ownerName = input.ownerName;
  }
  if (input.ownerEmail) {
    novaCotacao.ownerEmail = input.ownerEmail;
  }

  return novaCotacao;
}
