import type { Companhia } from '../types';
import type { SmartPasteResultado } from './smartPasteUtils';

type SmartPasteTrecho = 'ida' | 'volta';

export interface SmartPasteTrechoUpdates {
  origem?: string;
  destino?: string;
  origemVolta?: string;
  destinoVolta?: string;
  companhiaIda?: Companhia;
  companhiaVolta?: Companhia;
  pontosIda?: string;
  pontosVolta?: string;
  taxaIda?: string;
  taxaVolta?: string;
  dataIda?: string;
  dataVolta?: string;
  horaSaidaIda?: string;
  horaChegadaIda?: string;
  horaSaidaVolta?: string;
  horaChegadaVolta?: string;
  paradasIda?: string;
  paradasVolta?: string;
}

export function mapearSmartPasteParaTrecho(
  trecho: SmartPasteTrecho,
  dados: SmartPasteResultado
): SmartPasteTrechoUpdates {
  if (trecho === 'ida') {
    return {
      ...(dados.origem ? { origem: dados.origem } : {}),
      ...(dados.destino ? { destino: dados.destino } : {}),
      ...(dados.companhia ? { companhiaIda: dados.companhia } : {}),
      ...(dados.pontos ? { pontosIda: dados.pontos } : {}),
      ...(dados.taxaEmbarque ? { taxaIda: dados.taxaEmbarque } : {}),
      ...(dados.dataIda ? { dataIda: dados.dataIda } : {}),
      ...(dados.horaSaidaIda ? { horaSaidaIda: dados.horaSaidaIda } : {}),
      ...(dados.horaChegadaIda ? { horaChegadaIda: dados.horaChegadaIda } : {}),
      ...(dados.paradasIda ? { paradasIda: dados.paradasIda } : {}),
    };
  }

  return {
    ...(dados.origem ? { origemVolta: dados.origem } : {}),
    ...(dados.destino ? { destinoVolta: dados.destino } : {}),
    ...(dados.companhia ? { companhiaVolta: dados.companhia } : {}),
    ...(dados.pontos ? { pontosVolta: dados.pontos } : {}),
    ...(dados.taxaEmbarque ? { taxaVolta: dados.taxaEmbarque } : {}),
    ...(dados.dataVolta ? { dataVolta: dados.dataVolta } : dados.dataIda ? { dataVolta: dados.dataIda } : {}),
    ...(dados.horaSaidaVolta ? { horaSaidaVolta: dados.horaSaidaVolta } : dados.horaSaidaIda ? { horaSaidaVolta: dados.horaSaidaIda } : {}),
    ...(dados.horaChegadaVolta ? { horaChegadaVolta: dados.horaChegadaVolta } : dados.horaChegadaIda ? { horaChegadaVolta: dados.horaChegadaIda } : {}),
    ...(dados.paradasVolta ? { paradasVolta: dados.paradasVolta } : dados.paradasIda ? { paradasVolta: dados.paradasIda } : {}),
  };
}
