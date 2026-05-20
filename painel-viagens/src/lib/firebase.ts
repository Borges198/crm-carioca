import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // 1. Importa o serviço de autenticação

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Inicializa o Firebase apenas se não houver nenhuma inicialização prévia
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Inicializa os serviços
const db = getFirestore(app);
const auth = getAuth(app); // 2. Inicializa o Auth do Firebase

// 3. Exporta o auth (para o login) e o db (para o histórico e cotações)
export { auth };
export default db;