import type { Companhia, NovaCotacao } from '../types';
import type { LeadStatus, ProdutoOfertado } from '../lib/leadUtils';
import { calcularDuracao } from './viagemUtils';
import {
  projetarItinerarioParaCamposLegados,
  validarENormalizarItinerario,
  type ItinerarioCotacaoValidado,
} from './itinerarioUtils';

interface MontarNovaCotacaoInput {
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  agencyId: string;
  clienteId?: string | null;
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
  itinerario?: ItinerarioCotacaoValidado;
}

function campoTextoPreenchido(valor?: string | null) {
  return typeof valor === 'string' && valor.trim() !== '';
}

export function montarNovaCotacao(input: MontarNovaCotacaoInput): NovaCotacao {
  const itinerario = input.itinerario
    ? validarENormalizarItinerario(input.itinerario)
    : undefined;
  const projecao = itinerario
    ? projetarItinerarioParaCamposLegados(itinerario)
    : undefined;
  const tipoVoo = projecao?.tipoVoo ?? input.tipoVoo;
  const ehSomenteIdaEstruturada = Boolean(projecao && tipoVoo === 'ida');
  const horaSaidaIda = projecao?.horaSaidaIda ?? input.horaSaidaIda;
  const horaChegadaIda = projecao?.horaChegadaIda ?? input.horaChegadaIda;
  const duracaoIda = projecao
    ? projecao.duracaoIda
    : calcularDuracao(horaSaidaIda, horaChegadaIda);
  let valorTotal = input.valorTotal;

  if (ehSomenteIdaEstruturada) {
    if (typeof input.valorIda === 'number') {
      valorTotal = input.valorIda;
    } else if (typeof input.valorVolta === 'number') {
      throw new Error(
        'Cotação estruturada somente ida inválida: valorVolta informado sem valorIda'
      );
    }
  }

  const novaCotacao: NovaCotacao = {
    cliente: input.cliente,
    origem: projecao?.origem ?? input.origem,
    destino: projecao?.destino ?? input.destino,
    companhia: input.companhia,
    tipoVoo,
    ownerId: input.ownerId,
    agencyId: input.agencyId,
    dataIda: projecao?.dataIda ?? input.dataIda,
    horaSaidaIda,
    horaChegadaIda,
    ...(duracaoIda ? { duracaoIda } : {}),
    paradasIda: projecao?.paradasIda ?? input.paradasIda,
    ...(!ehSomenteIdaEstruturada ? {
      dataVolta: tipoVoo === 'ida_volta'
        ? projecao?.dataVolta ?? input.dataVolta
        : null,
    } : {}),
    valorTotal,
    dataRegistro: new Date(),
    status: 'Novo 🆕',
    produtosOfertados: input.produtosOfertados ?? [],
    observacao: input.observacao?.trim() ?? '',
    leadStatus: input.leadStatus ?? 'novo',
    ...(itinerario ? { itinerario } : {}),
  };

  const companhiaIda = input.companhiaIda;
  if (typeof companhiaIda !== 'undefined') {
    novaCotacao.companhiaIda = companhiaIda;
  }
  const origemIda = projecao?.origemIda ?? input.origemIda;
  if (campoTextoPreenchido(origemIda)) {
    novaCotacao.origemIda = origemIda;
  }
  const destinoIda = projecao?.destinoIda ?? input.destinoIda;
  if (campoTextoPreenchido(destinoIda)) {
    novaCotacao.destinoIda = destinoIda;
  }
  const origemVolta = projecao ? projecao.origemVolta : input.origemVolta;
  const destinoVolta = projecao ? projecao.destinoVolta : input.destinoVolta;
  if (campoTextoPreenchido(origemVolta)) {
    novaCotacao.origemVolta = origemVolta;
  }
  if (campoTextoPreenchido(destinoVolta)) {
    novaCotacao.destinoVolta = destinoVolta;
  }
  const companhiaVolta = ehSomenteIdaEstruturada
    ? undefined
    : input.companhiaVolta;
  if (typeof companhiaVolta !== 'undefined') {
    novaCotacao.companhiaVolta = companhiaVolta;
  }
  if (projecao && tipoVoo === 'ida_volta') {
    const horaSaidaVolta = projecao?.horaSaidaVolta ?? input.horaSaidaVolta;
    const horaChegadaVolta = projecao?.horaChegadaVolta ?? input.horaChegadaVolta;
    const paradasVolta = projecao?.paradasVolta ?? input.paradasVolta;
    if (campoTextoPreenchido(horaSaidaVolta)) {
      novaCotacao.horaSaidaVolta = horaSaidaVolta;
    }
    if (campoTextoPreenchido(horaChegadaVolta)) {
      novaCotacao.horaChegadaVolta = horaChegadaVolta;
    }
    if (projecao?.duracaoVolta) {
      novaCotacao.duracaoVolta = projecao.duracaoVolta;
    }
    if (campoTextoPreenchido(paradasVolta)) {
      novaCotacao.paradasVolta = paradasVolta;
    }
  }
  if (typeof input.pontosIda !== 'undefined') {
    novaCotacao.pontosIda = input.pontosIda;
  }
  if (!ehSomenteIdaEstruturada && typeof input.pontosVolta !== 'undefined') {
    novaCotacao.pontosVolta = input.pontosVolta;
  }
  if (typeof input.taxaIda !== 'undefined') {
    novaCotacao.taxaIda = input.taxaIda;
  }
  if (!ehSomenteIdaEstruturada && typeof input.taxaVolta !== 'undefined') {
    novaCotacao.taxaVolta = input.taxaVolta;
  }
  if (typeof input.valorIda !== 'undefined') {
    novaCotacao.valorIda = input.valorIda;
  }
  if (!ehSomenteIdaEstruturada && typeof input.valorVolta !== 'undefined') {
    novaCotacao.valorVolta = input.valorVolta;
  }
  if (input.clienteId?.trim()) {
    novaCotacao.clienteId = input.clienteId.trim();
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
