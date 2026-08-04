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
 * Extensão exclusivamente em memória. O contrato persistido de Cotacao não
 * recebe itinerario neste ciclo, evitando gravação acidental no Firestore.
 */
export type ComItinerarioEmMemoria<T> = {
  cotacao: T;
  itinerario?: ItinerarioCotacao;
};
