import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type UpdateData,
} from 'firebase/firestore';
import db from '../lib/firebase';
import type { Cliente, NovoCliente } from '../types';

const clientesCollection = collection(db, 'clientes');

export const LIMITE_PAGINA_CLIENTES = 20;

export interface PaginaClientes {
  clientes: Cliente[];
  ultimoDocumento: QueryDocumentSnapshot<DocumentData> | null;
  temMais: boolean;
}

export async function criarCliente(cliente: NovoCliente) {
  return addDoc(clientesCollection, cliente);
}

export async function listarPaginaClientesDoUsuario(
  userId: string,
  ultimoDocumento: QueryDocumentSnapshot<DocumentData> | null = null,
  limitePagina = LIMITE_PAGINA_CLIENTES
): Promise<PaginaClientes> {
  const restricoes: QueryConstraint[] = [
    where('ownerId', '==', userId),
    orderBy('dataCadastro', 'desc'),
  ];

  if (ultimoDocumento) {
    restricoes.push(startAfter(ultimoDocumento));
  }

  restricoes.push(limit(limitePagina));

  const querySnapshot = await getDocs(query(clientesCollection, ...restricoes));
  const documentos = querySnapshot.docs;

  return {
    clientes: documentos.map((documento) => ({
      id: documento.id,
      ...documento.data(),
    })) as Cliente[],
    ultimoDocumento: documentos[documentos.length - 1] ?? null,
    temMais: documentos.length === limitePagina,
  };
}

export async function listarClientesDoUsuario(userId: string) {
  const q = query(
    clientesCollection,
    where('ownerId', '==', userId),
    orderBy('dataCadastro', 'desc')
  );
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Cliente[];
}

export async function listarClientesDaAgencia(agencyId: string) {
  if (!agencyId) return [];

  const q = query(
    clientesCollection,
    where('agencyId', '==', agencyId),
    orderBy('dataCadastro', 'desc')
  );
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Cliente[];
}

export async function buscarClientePorTelefoneDoUsuario(
  userId: string,
  telefoneNormalizado: string
) {
  if (!userId || !telefoneNormalizado) return null;

  const q = query(
    clientesCollection,
    where('ownerId', '==', userId),
    where('telefoneNormalizado', '==', telefoneNormalizado),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  const clienteDoc = querySnapshot.docs[0];

  if (!clienteDoc) return null;

  return {
    id: clienteDoc.id,
    ...clienteDoc.data(),
  } as Cliente;
}

export async function atualizarCliente(id: string, dados: UpdateData<Cliente>) {
  const docRef = doc(db, 'clientes', id);
  return updateDoc(docRef, dados);
}

export async function excluirCliente(id: string) {
  return deleteDoc(doc(db, 'clientes', id));
}
