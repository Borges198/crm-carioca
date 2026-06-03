'use client';

import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import AuthGuard from '../../components/AuthGuard';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { atualizarCliente, criarCliente, excluirCliente as excluirClienteFirestore, listarClientesDoUsuario } from '../../services/clientesService';
import type { Cliente, NovoCliente } from '../../types';

export default function Clientes() {
  return (
    <AuthGuard>
      <ClientesContent />
    </AuthGuard>
  );
}

function ClientesContent() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  
  // Estados para o Modal de Criação (Legados)
  const [modalAberto, setModalAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novaViagem, setNovaViagem] = useState('');

  // Estados para o Modal de Edição
  const [modalEditAberto, setModalEditAberto] = useState(false);
  const [clienteEmEdicao, setClienteEmEdicao] = useState<Cliente | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editViagem, setEditViagem] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    const buscarClientes = async () => {
      try {
        const dados = await listarClientesDoUsuario(user.uid);
        setClientes(dados);
      } catch (error) {
        console.error("Erro ao buscar clientes:", error);
      } finally {
        setCarregando(false);
      }
    };

    buscarClientes();
  }, [user]);

  const adicionarClienteLegado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome) return alert("O nome é obrigatório!");
    if (!user) return alert("Você precisa estar logado para salvar um cliente.");

    try {
      const novoCliente: NovoCliente = {
        nome: novoNome,
        telefone: novoTelefone || 'Não informado',
        origemLead: "Legado (WhatsApp)",
        primeiraViagem: novaViagem || 'Não informada',
        ownerId: user.uid,
        dataCadastro: new Date()
      };

      const docRef = await criarCliente(novoCliente);
      setClientes([{ id: docRef.id, ...novoCliente }, ...clientes]);
      
      setNovoNome('');
      setNovoTelefone('');
      setNovaViagem('');
      setModalAberto(false);
    } catch (error) {
      console.error("Erro ao adicionar cliente:", error);
    }
  };

  const abrirModalEdicao = (cliente: Cliente) => {
    setClienteEmEdicao(cliente);
    setEditNome(cliente.nome);
    setEditTelefone(cliente.telefone || '');
    setEditViagem(cliente.primeiraViagem);
    setModalEditAberto(true);
  };

  const salvarEdicaoCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteEmEdicao) return;

    try {
      const dadosAtualizados = {
        nome: editNome,
        telefone: editTelefone || 'Não informado',
        primeiraViagem: editViagem
      };

      await atualizarCliente(clienteEmEdicao.id, dadosAtualizados);

      setClientes(prev => prev.map(c => 
        c.id === clienteEmEdicao.id ? { ...c, ...dadosAtualizados } : c
      ));

      setModalEditAberto(false);
      setClienteEmEdicao(null);
    } catch (error) {
      console.error("Erro ao atualizar cliente:", error);
      alert("Erro ao salvar alterações.");
    }
  };

  const excluirCliente = async (id: string, nomeCliente: string) => {
    if (window.confirm(`Tem a certeza que deseja remover ${nomeCliente}?`)) {
      try {
        await excluirClienteFirestore(id);
        setClientes(prev => prev.filter(item => item.id !== id));
      } catch (error) {
        console.error("Erro ao excluir cliente:", error);
      }
    }
  };

  const formatarData = (data: Timestamp | string | number | Date | undefined | null) => {
    if (!data) return 'Sem data';
    if (typeof (data as Timestamp).toDate === 'function') {
      return (data as Timestamp).toDate().toLocaleDateString('pt-BR');
    }
    return new Date(data as string | number | Date).toLocaleDateString('pt-BR');
  };

  const origemLeadNormalizada = (origemLead: string) => (
    origemLead.trim().toLowerCase()
  );

  const formatarOrigemLead = (origemLead: string) => {
    if (origemLeadNormalizada(origemLead) === 'cotação fechada') {
      return 'Cotação fechada';
    }

    return origemLead;
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Carteira de clientes</h1>
            <p className="text-slate-500 mt-1">Compradores reais para relacionamento e recompra</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setModalAberto(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-bold shadow-md">
              Adicionar cliente legado
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 mb-8 inline-block">
          <h3 className="text-slate-500 text-sm font-semibold uppercase">Total de clientes</h3>
          <p className="text-4xl font-black text-green-600 mt-1">{clientes.length}</p>
        </div>

        {carregando ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : clientes.length === 0 ? (
          <EmptyState
            title="Nenhum cliente real na carteira"
            description="Clientes representam compradores reais. Depois que uma cotação for marcada como fechada no histórico, ela poderá ser adicionada manualmente à carteira."
            actions={[
              { href: '/historico', label: 'Ir para histórico' },
              { href: '/leads', label: 'Ver oportunidades', variant: 'secondary' },
            ]}
          />
        ) : (
          <div className="bg-white shadow-md rounded-2xl overflow-hidden border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Nome do cliente</th>
                  <th className="px-6 py-4">Contato</th>
                  <th className="px-6 py-4">Origem</th>
                  <th className="px-6 py-4">Última viagem</th>
                  <th className="px-6 py-4">Data de cadastro</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-slate-50 transition duration-150">
                    <td className="px-6 py-4 font-bold text-slate-800 text-lg">{cliente.nome}</td>
                    <td className="px-6 py-4 text-slate-600">{cliente.telefone}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        origemLeadNormalizada(cliente.origemLead) === 'cotação fechada' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {formatarOrigemLead(cliente.origemLead)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-medium">{cliente.primeiraViagem}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">{formatarData(cliente.dataCadastro)}</td>
                    <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                      <button onClick={() => abrirModalEdicao(cliente)} className="text-blue-500 hover:text-blue-700 p-2" title="Editar cliente">✏️</button>
                      <button onClick={() => excluirCliente(cliente.id, cliente.nome)} className="text-red-400 hover:text-red-600 p-2" title="Remover cliente">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Criar Legado */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Novo cliente legado</h2>
            <form onSubmit={adicionarClienteLegado} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-600">Nome completo</label>
                <input type="text" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500" required />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600">Telefone / WhatsApp</label>
                <input type="text" value={novoTelefone} onChange={(e) => setNovoTelefone(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500" placeholder="Ex: (11) 99999-9999" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600">Viagem vendida</label>
                <input type="text" value={novaViagem} onChange={(e) => setNovaViagem(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500" placeholder="Ex: GRU ➔ SSA" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setModalAberto(false)} className="px-4 py-2 text-slate-500 font-semibold hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Cliente */}
      {modalEditAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Editar cadastro do cliente</h2>
            <form onSubmit={salvarEdicaoCliente} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-600">Nome completo</label>
                <input type="text" value={editNome} onChange={(e) => setEditNome(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600">Telefone / WhatsApp</label>
                <input type="text" value={editTelefone} onChange={(e) => setEditTelefone(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600">Última viagem</label>
                <input type="text" value={editViagem} onChange={(e) => setEditViagem(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
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
