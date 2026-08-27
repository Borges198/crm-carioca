import type { Timestamp } from 'firebase/firestore';

export interface Acompanhamento {
  id: string;
  ownerId: string;
  agencyId: string;
  cotacaoAncoraId: string;
  clienteId?: string;
  proximaAcaoEm: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type NovoAcompanhamento = Omit<Acompanhamento, 'id'>;
