import type { FirestoreDate } from './cotacao';

export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  telefoneNormalizado?: string;
  origemLead: string;
  primeiraViagem: string;
  dataCadastro: FirestoreDate;
  ownerId?: string;
  agencyId?: string;
}

export type NovoCliente = Omit<Cliente, 'id'> & {
  ownerId: string;
  agencyId: string;
};
