'use client';

import { useState } from 'react';
import { auth } from '../../lib/firebase';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  // Função para Login com E-mail e Senha
  const fazerLoginEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro('');
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      router.push('/historico'); // Redireciona para o histórico após logar
    } catch (error) {
      console.error(error);
      setErro('Credenciais inválidas. Verifique seu e-mail e senha.');
      setCarregando(false);
    }
  };

  // Função para Login com o Google
  const fazerLoginGoogle = async () => {
    setCarregando(true);
    setErro('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push('/historico'); // Redireciona para o histórico após logar
    } catch (error) {
      console.error(error);
      setErro('Erro ao tentar fazer login com o Google.');
      setCarregando(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* Cabeçalho */}
        <div className="bg-blue-900 px-8 py-10 text-center">
          <h1 className="text-3xl font-black text-white mb-2">Voo Singular ✈️</h1>
          <p className="text-blue-200 text-sm">Painel do Agente de Viagens</p>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Acesse sua conta</h2>

          {erro && (
            <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium">
              {erro}
            </div>
          )}

          {/* Login com Google */}
          <button 
            onClick={fazerLoginGoogle}
            disabled={carregando}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-50 transition duration-200 mb-6 shadow-sm"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            Entrar com o Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="text-xs text-gray-400 font-medium uppercase">Ou use seu e-mail</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          {/* Login com E-mail */}
          <form onSubmit={fazerLoginEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail Corporativo</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agente@voosingular.com" 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input 
                type="password" 
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••" 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={carregando}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 shadow-md flex justify-center items-center mt-2"
            >
              {carregando ? 'Acessando...' : 'Entrar no Painel'}
            </button>
          </form>
        </div>
      </div>
      
      <p className="text-gray-400 text-xs mt-8">
        Sistema de Cotações Exclusivo • Segurança Firebase
      </p>
    </main>
  );
}