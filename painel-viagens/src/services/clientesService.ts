import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
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

export async function atualizarCliente(id: string, dados: UpdateData<Cliente>) {
  const docRef = doc(db, 'clientes', id);
  return updateDoc(docRef, dados);
}

export async function excluirCliente(id: string) {
  return deleteDoc(doc(db, 'clientes', id));
}
