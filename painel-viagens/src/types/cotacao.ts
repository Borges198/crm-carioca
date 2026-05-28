import type { Timestamp } from 'firebase/firestore';

export type Companhia = 'Azul' | 'GOL' | 'Latam';

export type StatusCotacao =
  | 'Novo 🆕'
  | 'Monitorando 👀'
  | 'Retornar 📞'
  | 'Fechado ✅'
  | 'Desistiu ❌';

export type FirestoreDate = Timestamp | string | number | Date;

export interface Cotacao {
  id: string;
  cliente: string;
  origem: string;
  destino: string;
  companhia: Companhia | string;
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
