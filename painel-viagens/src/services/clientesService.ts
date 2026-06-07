import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  type UpdateData,
} from 'firebase/firestore';
import db from '../lib/firebase';
import type { Cliente, NovoCliente } from '../types';

const clientesCollection = collection(db, 'clientes');

export async function criarCliente(cliente: NovoCliente) {
  return addDoc(clientesCollection, cliente);
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
