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
import type { Cotacao, NovaCotacao } from '../types';

const cotacoesCollection = collection(db, 'cotacoes');

export async function criarCotacao(cotacao: NovaCotacao) {
  return addDoc(cotacoesCollection, cotacao);
}

export async function listarCotacoesDoUsuario(userId: string) {
  const q = query(
    cotacoesCollection,
    where('ownerId', '==', userId),
    orderBy('dataRegistro', 'desc')
  );
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Cotacao[];
}

export async function listarNomesClientesDasCotacoes(userId: string) {
  const q = query(
    cotacoesCollection,
    where('ownerId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  const nomes = new Set<string>();

  querySnapshot.forEach((doc) => {
    const nomeCliente = doc.data().cliente;
    if (nomeCliente) nomes.add(nomeCliente);
  });

  return Array.from(nomes);
}

export async function atualizarCotacao(id: string, dados: UpdateData<Cotacao>) {
  const docRef = doc(db, 'cotacoes', id);
  return updateDoc(docRef, dados);
}

export async function excluirCotacao(id: string) {
  return deleteDoc(doc(db, 'cotacoes', id));
}
