'use client';

import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import Link from 'next/link';

interface Cotacao {
  id: string;
  cliente: string;
  origem: string;
  destino: string;
  companhia: string;
  valorTotal: number;
  dataIda: string;
  dataRegistro: Timestamp;
  status?: string;
}

export default function Historico() {
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // 1. SOLUÇÃO DO ERRO: A função de busca agora vive DENTRO do useEffect.
    // O React adora isso, pois garante que não haverá "cascading renders" (renderização em cascata).
    const buscarDados = async () => {
      try {
        const q = query(collection(db, "cotacoes"), orderBy("dataRegistro", "desc"));
        const querySnapshot = await getDocs(q);
        const dados = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })) as Cotacao[];
        setCotacoes(dados);
      } catch (error) {
        console.error("Erro ao buscar histórico:", error);
      } finally {
        setCarregando(false);
      }
    };

    buscarDados();
  }, []); // Array vazio: Roda apenas 1 vez quando a tela abre!

  // UPDATE: Atualizar Status (Muito mais rápido agora)
  const alterarStatus = async (id: string, novoStatus: string) => {
    try {
      // 1. Atualiza no banco de dados
      const docRef = doc(db, "cotacoes", id);
      await updateDoc(docRef, { status: novoStatus });
      
      // 2. Atualiza apenas a linha específica direto na tela (Sem precisar baixar tudo de novo!)
      setCotacoes(prev => prev.map(item => 
        item.id === id ? { ...item, status: novoStatus } : item
      ));
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro ao atualizar. Verifique se você está logado.");
    }
  };

  // DELETE: Excluir Cotação (Muito mais rápido agora)
  const excluirCotacao = async (id: string, nomeCliente: string) => {
    const confirmar = window.confirm(`Tem certeza que deseja excluir a cotação do(a) ${nomeCliente}?`);
    if (confirmar) {
      try {
        // 1. Deleta do banco de dados
        await deleteDoc(doc(db, "cotacoes", id));
        
        // 2. Some com a linha da tela imediatamente
        setCotacoes(prev => prev.filter(item => item.id !== id));
      } catch (error) {
        console.error("Erro ao excluir cotação:", error);
        alert("Erro ao excluir. Verifique se você está logado e tem permissão.");
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Fechado ✅': return 'bg-green-100 text-green-700';
      case 'Monitorando 👀': return 'bg-yellow-100 text-yellow-700';
      case 'Retornar 📞': return 'bg-blue-100 text-blue-700';
      case 'Desistiu ❌': return 'bg-gray-100 text-gray-700';
      default: return 'bg-purple-100 text-purple-700 border border-purple-200';
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900 border-l-4 border-blue-600 pl-4">
            Gestão de Cotações 📋
          </h1>
          <Link href="/" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-bold shadow-md">
            + Nova Cotação
          </Link>
        </div>

        {carregando ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100 text-gray-800">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold border-b">
                <tr>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Rota / Cia</th>
                  <th className="px-6 py-4">Valor Total</th>
                  <th className="px-6 py-4">Status da Venda</th>
                  <th className="px-6 py-4">Data Registro</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cotacoes.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition duration-150">
                    <td className="px-6 py-4 font-bold">{item.cliente}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium">{item.origem} ➔ {item.destino}</div>
                      <div className={`text-[10px] font-black mt-1 inline-block px-1.5 py-0.5 rounded shadow-sm ${
                        item.companhia === 'GOL' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {item.companhia}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-black text-green-700 text-lg">
                      {item.valorTotal}
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={item.status || 'Novo 🆕'} 
                        onChange={(e) => alterarStatus(item.id, e.target.value)}
                        className={`text-xs font-black p-2 rounded-lg border-none cursor-pointer focus:ring-2 focus:ring-blue-300 shadow-sm outline-none ${getStatusColor(item.status || 'Novo 🆕')}`}
                      >
                        <option value="Novo 🆕">Novo 🆕</option>
                        <option value="Monitorando 👀">Monitorando 👀</option>
                        <option value="Retornar 📞">Retornar 📞</option>
                        <option value="Fechado ✅">Fechado ✅</option>
                        <option value="Desistiu ❌">Desistiu ❌</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-[11px] font-medium">
                      {item.dataRegistro?.toDate().toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => excluirCotacao(item.id, item.cliente)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition duration-200"
                        title="Excluir Cotação"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {cotacoes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                      Nenhuma cotação encontrada no sistema.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}