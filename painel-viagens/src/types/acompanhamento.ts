import type { Timestamp } from 'firebase/firestore';

export type TipoProximaAcao = 'DATA' | 'DIARIA' | 'SEM_DATA';

export interface Acompanhamento {
  id: string;
  ownerId: string;
  agencyId: string;
  cotacaoAncoraId: string;
  clienteId?: string;
  tipoProximaAcao?: TipoProximaAcao;
  proximaAcaoEm: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type NovoAcompanhamento = Omit<Acompanhamento, 'id'>;
