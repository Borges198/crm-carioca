import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // 1. Adicione este import [cite: 34, 566]

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Garante que o Firebase não inicialize duas vezes no Next.js [cite: 36, 106]
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Exportações para usar em todo o projeto
export const db = getFirestore(app);
export const auth = getAuth(app); // 2. Adicione esta linha de exportação [cite: 566]