import type { FirestoreDate } from './cotacao';

export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  origemLead: string;
  primeiraViagem: string;
  dataCadastro: FirestoreDate;
  ownerId?: string;
}

export type NovoCliente = Omit<Cliente, 'id'> & {
  ownerId: string;
};
