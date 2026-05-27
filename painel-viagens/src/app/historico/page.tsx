'use client';

import { useState, useEffect } from 'react';
import db from '../../lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import Link from 'next/link';
import AuthGuard from '../../components/AuthGuard';
import { useAuth } from '../../context/AuthContext';

interface Cotacao {
  id: string;
  cliente: string;
  origem: string;
  destino: string;
  companhia: string;
  valorTotal: number;
  dataIda: string;
  dataRegistro: Timestamp | string | number | Date;
  status?: string;
}

export default function Historico() {
  return (
    <AuthGuard>
      <HistoricoContent />
    </AuthGuard>
  );
}

function HistoricoContent() {
  const { user } = useAuth();
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estados para o Modal de Edição de Cotação
  const [modalEditAberto, setModalEditAberto] = useState(false);
  const [cotacaoEmEdicao, setCotacaoEmEdicao] = useState<Cotacao | null>(null);
  const [editCliente, setEditCliente] = useState('');
  const [editOrigem, setEditOrigem] = useState('');
  const [editDestino, setEditDestino] = useState('');
  const [editCompanhia, setEditCompanhia] = useState('');
  const [editValorTotal, setEditValorTotal] = useState<number>(0);
  const [editDataIda, setEditDataIda] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    const buscarDados = async () => {
      try {
        const q = query(
          collection(db, "cotacoes"),
          where("ownerId", "==", user.uid),
          orderBy("dataRegistro", "desc")
        );
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
  }, [user]);

  const abrirModalEdicao = (item: Cotacao) => {
    setCotacaoEmEdicao(item);
    setEditCliente(item.cliente);
    setEditOrigem(item.origem);
    setEditDestino(item.destino);
    setEditCompanhia(item.companhia);
    setEditValorTotal(item.valorTotal || 0);
    setEditDataIda(item.dataIda);
    setModalEditAberto(true);
  };

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cotacaoEmEdicao) return;

    try {
      const docRef = doc(db, "cotacoes", cotacaoEmEdicao.id);
      const dadosAtualizados = {
        cliente: editCliente,
        origem: editOrigem,
        destino: editDestino,
        companhia: editCompanhia,
        valorTotal: Number(editValorTotal),
        dataIda: editDataIda,
      };

      await updateDoc(docRef, dadosAtualizados);

      // Atualiza o estado local imediatamente
      setCotacoes(prev => prev.map(item => 
        item.id === cotacaoEmEdicao.id ? { ...item, ...dadosAtualizados } : item
      ));

      setModalEditAberto(false);
      setCotacaoEmEdicao(null);
    } catch (error) {
      console.error("Erro ao salvar edição da cotação:", error);
      alert("Erro ao salvar modificações.");
    }
  };

  const alterarStatus = async (id: string, novoStatus: string) => {
    try {
      const docRef = doc(db, "cotacoes", id);
      await updateDoc(docRef, { status: novoStatus });
      
      setCotacoes(prev => prev.map(item => 
        item.id === id ? { ...item, status: novoStatus } : item
      ));
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  const excluirCotacao = async (id: string, nomeCliente: string) => {
    const confirmar = window.confirm(`Tem certeza que deseja excluir a cotação do(a) ${nomeCliente}?`);
    if (confirmar) {
      try {
        await deleteDoc(doc(db, "cotacoes", id));
        setCotacoes(prev => prev.filter(item => item.id !== id));
      } catch (error) {
        console.error("Erro ao excluir cotação:", error);
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

  const formatarData = (data: Timestamp | string | number | Date | undefined | null) => {
    if (!data) return 'Data não informada';
    if (typeof (data as Timestamp).toDate === 'function') {
      return (data as Timestamp).toDate().toLocaleDateString('pt-BR');
    }
    return new Date(data as string | number | Date).toLocaleDateString('pt-BR');
  };

  const totalCotacoes = cotacoes.length;
  const negociosFechados = cotacoes.filter(c => c.status === 'Fechado ✅').length;
  const volumeVendas = cotacoes
    .filter(c => c.status === 'Fechado ✅')
    .reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900 border-l-4 border-blue-600 pl-4">
            Gestão de Cotações 📋
          </h1>
          <div className="flex gap-4">
            <Link href="/clientes" className="bg-white text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-100 border font-bold shadow-sm">
              Carteira de Clientes 💼
            </Link>
            <Link href="/" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-bold shadow-md">
              + Nova Cotação
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
            <h3 className="text-gray-500 text-sm font-semibold uppercase">Total de Cotações</h3>
            <p className="text-3xl font-bold text-gray-800 mt-2">{totalCotacoes}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
            <h3 className="text-gray-500 text-sm font-semibold uppercase">Negócios Fechados</h3>
            <p className="text-3xl font-bold text-gray-800 mt-2">{negociosFechados}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-orange-500">
            <h3 className="text-gray-500 text-sm font-semibold uppercase">Volume de Vendas</h3>
            <p className="text-3xl font-bold text-gray-800 mt-2">
              {volumeVendas}
            </p>
          </div>
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
                    {/* Alterado para o número puro conforme a Regra de Negócio */}
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
                      {formatarData(item.dataRegistro)}
                    </td>
                    <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                      <button 
                        onClick={() => abrirModalEdicao(item)}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition duration-200"
                        title="Editar Cotação"
                      >
                        ✏️
                      </button>
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
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edição de Cotação */}
      {modalEditAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Editar Dados da Cotação ✏️</h2>
            <form onSubmit={salvarEdicao} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-600">Nome do Cliente</label>
                <input type="text" value={editCliente} onChange={(e) => setEditCliente(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-600">Origem</label>
                  <input type="text" value={editOrigem} onChange={(e) => setEditOrigem(e.target.value.toUpperCase())} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-600">Destino</label>
                  <input type="text" value={editDestino} onChange={(e) => setEditDestino(e.target.value.toUpperCase())} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600">Companhia</label>
                <select value={editCompanhia} onChange={(e) => setEditCompanhia(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="Azul">Azul</option>
                  <option value="GOL">GOL</option>
                  <option value="Latam">Latam</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-600">Valor Final</label>
                  <input type="number" step="0.01" value={editValorTotal} onChange={(e) => setEditValorTotal(Number(e.target.value))} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-600">Data Ida</label>
                  <input type="text" value={editDataIda} onChange={(e) => setEditDataIda(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="DD-MM-YYYY" required />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setModalEditAberto(false)} className="px-4 py-2 text-slate-500 font-semibold hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
