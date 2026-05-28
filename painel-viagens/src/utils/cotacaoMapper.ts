import type { Companhia, NovaCotacao } from '../types';
import { calcularDuracao } from './viagemUtils';

interface MontarNovaCotacaoInput {
  ownerId: string;
  cliente: string;
  origem: string;
  destino: string;
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
  mensagem?: string;
}

export function montarNovaCotacao(input: MontarNovaCotacaoInput): NovaCotacao {
  return {
    cliente: input.cliente,
    origem: input.origem,
    destino: input.destino,
    companhia: input.companhia,
    tipoVoo: input.tipoVoo,
    ownerId: input.ownerId,
    dataIda: input.dataIda,
    horaSaidaIda: input.horaSaidaIda,
    horaChegadaIda: input.horaChegadaIda,
    duracaoIda: calcularDuracao(input.horaSaidaIda, input.horaChegadaIda),
    paradasIda: input.paradasIda,
    dataVolta: input.tipoVoo === 'ida_volta' ? input.dataVolta : null,
    valorTotal: input.valorTotal,
    dataRegistro: new Date(),
    status: 'Novo 🆕'
  };
}
