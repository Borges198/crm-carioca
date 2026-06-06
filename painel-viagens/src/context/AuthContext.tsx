'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import db, { auth } from '../lib/firebase';
import {
  DEFAULT_ACCESS_PROFILE,
  buildAccessProfileFromUsuario,
  type AccessProfile,
} from '../types';

interface AuthContextType {
  user: User | null;
  accessProfile: AccessProfile;
  isAdmin: boolean;
  loading: boolean;
  profileLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessProfile, setAccessProfile] = useState<AccessProfile>(DEFAULT_ACCESS_PROFILE);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // Agora buscamos o UID de forma segura das variáveis de ambiente
  const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID;

  useEffect(() => {
    let activeProfileRequest = 0;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const profileRequestId = activeProfileRequest + 1;
      activeProfileRequest = profileRequestId;

      setUser(user);
      setAccessProfile(DEFAULT_ACCESS_PROFILE);
      setProfileLoading(false);
      setLoading(false);

      if (!user) {
        return;
      }

      setProfileLoading(true);

      const buscarPerfilDeAcesso = async () => {
        try {
          const usuarioRef = doc(db, 'usuarios', user.uid);
          const usuarioSnapshot = await getDoc(usuarioRef);

          if (!usuarioSnapshot.exists()) {
            await setDoc(usuarioRef, { status: 'pendente' });
            return;
          }

          if (activeProfileRequest === profileRequestId) {
            setAccessProfile(buildAccessProfileFromUsuario(usuarioSnapshot.data()));
          }
        } catch (error) {
          console.error('Erro ao buscar perfil de acesso:', error);
          if (activeProfileRequest === profileRequestId) {
            setAccessProfile(DEFAULT_ACCESS_PROFILE);
          }
        } finally {
          if (activeProfileRequest === profileRequestId) {
            setProfileLoading(false);
          }
        }
      };

      buscarPerfilDeAcesso();
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user,
      accessProfile,
      // Client-side compatibility flag only. Real authorization must use Firebase custom claims/rules.
      isAdmin: user !== null && user.uid === ADMIN_UID, 
      loading,
      profileLoading
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return context;
};
