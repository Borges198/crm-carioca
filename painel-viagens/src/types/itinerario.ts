export type TipoSentidoItinerario = 'ida' | 'volta';
export type FonteSentidoItinerario = 'estruturado' | 'legado';

export interface PernaVoo {
  origem?: string;
  destino?: string;
  companhia?: string;
  numeroVoo?: string;
  dataSaida?: string;
  horaSaida?: string;
  dataChegada?: string;
  horaChegada?: string;
  duracao?: string;
}

export interface SentidoItinerario<
  TTipo extends TipoSentidoItinerario = TipoSentidoItinerario
> {
  tipo: TTipo;
  pernas: [PernaVoo, ...PernaVoo[]];
  fonte?: FonteSentidoItinerario;
  duracaoTotal?: string;
  paradas?: string;
}

export interface ItinerarioCotacao {
  versao: 1;
  ida: SentidoItinerario<'ida'>;
  volta?: SentidoItinerario<'volta'>;
}

/**
 * Cotacao admite itinerario opcional, e este wrapper continua útil para
 * composição e leitura sem mutar a cotação. A interface atual ainda não envia
 * itinerario ao mapper; a ativação segue bloqueada até a proteção do Histórico.
 */
export type ComItinerarioEmMemoria<T> = {
  cotacao: T;
  itinerario?: ItinerarioCotacao;
};
