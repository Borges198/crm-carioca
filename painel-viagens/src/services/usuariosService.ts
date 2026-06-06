import {
  collection,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import db from '../lib/firebase';
import { DEFAULT_AGENCY_ID, type UsuarioPerfil } from '../types';

const usuariosCollection = collection(db, 'usuarios');

export async function listarUsuarios() {
  const querySnapshot = await getDocs(usuariosCollection);

  return querySnapshot.docs.map(doc => ({
    uid: doc.id,
    ...doc.data(),
  })) as UsuarioPerfil[];
}

export async function aprovarUsuarioComoAgente(uid: string) {
  const usuarioRef = doc(db, 'usuarios', uid);

  return updateDoc(usuarioRef, {
    status: 'aprovado',
    role: 'agent',
    agencyId: DEFAULT_AGENCY_ID,
  });
}

export async function promoverUsuarioParaSupervisor(uid: string) {
  const usuarioRef = doc(db, 'usuarios', uid);

  return updateDoc(usuarioRef, {
    role: 'supervisor',
  });
}
