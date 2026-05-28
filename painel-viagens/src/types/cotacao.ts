import type { Timestamp } from 'firebase/firestore';

export type Companhia = 'Azul' | 'GOL' | 'Latam';

export type StatusCotacao =
  | 'Novo 🆕'
  | 'Monitorando 👀'
  | 'Retornar 📞'
  | 'Fechado ✅'
  | 'Desistiu ❌';

export type FirestoreDate = Timestamp | string | number | Date;

export type TipoTrecho = 'ida' | 'volta';

export interface TrechoCotacao {
  tipo: TipoTrecho;
  companhia?: Companhia | string | null;
  pontos?: number | null;
  taxa?: number | null;
  valor?: number | null;
}

export type TrechoCotacaoInput = Omit<TrechoCotacao, 'tipo'>;

export interface Cotacao {
  id: string;
  cliente: string;
  origem: string;
  destino: string;
  companhia: Companhia | string;
  companhiaIda?: Companhia | string;
  companhiaVolta?: Companhia | string | null;
  pontosIda?: number;
  pontosVolta?: number | null;
  taxaIda?: number;
  taxaVolta?: number | null;
  valorIda?: number;
  valorVolta?: number | null;
  valorTotal: number;
  dataIda: string;
  dataRegistro: FirestoreDate;
  ownerId?: string;
  tipoVoo?: string;
  horaSaidaIda?: string;
  horaChegadaIda?: string;
  duracaoIda?: string;
  paradasIda?: string;
  dataVolta?: string | null;
  status?: StatusCotacao | string;
}

export type NovaCotacao = Omit<Cotacao, 'id'> & {
  ownerId: string;
};
