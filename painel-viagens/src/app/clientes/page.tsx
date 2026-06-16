'use client';

import { useState, useEffect, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import AuthGuard from '../../components/AuthGuard';
import EmptyState from '../../components/EmptyState';
import SearchInput from '../../components/SearchInput';
import { useAuth } from '../../context/AuthContext';
import { atualizarCliente, criarCliente, excluirCliente as excluirClienteFirestore, listarClientesDoUsuario } from '../../services/clientesService';
import { DEFAULT_AGENCY_ID } from '../../types';
import type { Cliente, NovoCliente } from '../../types';
import { filterBySearch, normalizeSearchText } from '../../utils/searchUtils';

export default function Clientes() {
  return (
    <AuthGuard>
      <ClientesContent />
    </AuthGuard>
  );
}

function ClientesContent() {
  const { user, accessProfile } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [termoPesquisa, setTermoPesquisa] = useState('');
  
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
        agencyId: accessProfile.agencyId ?? DEFAULT_AGENCY_ID,
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

  const termoPesquisaNormalizado = normalizeSearchText(termoPesquisa);
  const clientesPesquisados = useMemo(() => (
    filterBySearch(clientes, termoPesquisa, (cliente) => [
      cliente.nome,
      cliente.telefone,
      cliente.telefoneNormalizado,
      cliente.origemLead,
      cliente.primeiraViagem,
      cliente.dataCadastro ? formatarData(cliente.dataCadastro) : undefined,
    ])
  ), [clientes, termoPesquisa]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-8">
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

        {!carregando && clientes.length > 0 && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <SearchInput
              value={termoPesquisa}
              onChange={setTermoPesquisa}
              placeholder="Pesquisar por nome, telefone, origem ou viagem"
              ariaLabel="Pesquisar clientes"
            />
            <p className="mt-3 text-xs font-semibold text-slate-500">
              {termoPesquisaNormalizado
                ? `${clientesPesquisados.length} ${clientesPesquisados.length === 1 ? 'resultado encontrado' : 'resultados encontrados'} em ${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'}`
                : `${clientes.length} ${clientes.length === 1 ? 'cliente carregado' : 'clientes carregados'}`}
            </p>
          </div>
        )}

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
        ) : clientesPesquisados.length === 0 ? (
          <EmptyState
            title={`Nenhum resultado encontrado para "${termoPesquisa.trim()}".`}
            description="Tente pesquisar por nome, telefone, origem, primeira viagem ou data de cadastro."
          />
        ) : (
          <>
          <div className="space-y-4 md:hidden">
            {clientesPesquisados.map((cliente) => (
              <article key={cliente.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-black text-slate-900">{cliente.nome}</h2>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-500">
                      {cliente.telefone || 'Sem telefone'}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-black ${
                    origemLeadNormalizada(cliente.origemLead) === 'cotação fechada' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {formatarOrigemLead(cliente.origemLead)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Primeira viagem</p>
                    <p className="mt-1 break-words font-bold text-slate-700">{cliente.primeiraViagem}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Data de cadastro</p>
                    <p className="mt-1 font-bold text-slate-700">{formatarData(cliente.dataCadastro)}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => abrirModalEdicao(cliente)}
                    className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black uppercase text-blue-700 transition hover:bg-blue-100"
                  >
                    Editar cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => excluirCliente(cliente.id, cliente.nome)}
                    className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-black uppercase text-red-600 transition hover:bg-red-100"
                  >
                    Remover cliente
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 md:block">
            <div className="min-w-[860px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 md:px-6">Nome do cliente</th>
                  <th className="px-4 py-4 md:px-6">Contato</th>
                  <th className="px-4 py-4 md:px-6">Origem</th>
                  <th className="px-4 py-4 md:px-6">Última viagem</th>
                  <th className="px-4 py-4 md:px-6">Data de cadastro</th>
                  <th className="px-4 py-4 text-center md:px-6">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientesPesquisados.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-slate-50 transition duration-150">
                    <td className="px-4 py-4 font-bold text-slate-800 text-lg md:px-6">{cliente.nome}</td>
                    <td className="px-4 py-4 text-slate-600 md:px-6">{cliente.telefone}</td>
                    <td className="px-4 py-4 md:px-6">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        origemLeadNormalizada(cliente.origemLead) === 'cotação fechada' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {formatarOrigemLead(cliente.origemLead)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-700 font-medium md:px-6">{cliente.primeiraViagem}</td>
                    <td className="px-4 py-4 text-slate-400 text-sm md:px-6">{formatarData(cliente.dataCadastro)}</td>
                    <td className="px-4 py-4 text-center flex items-center justify-center gap-2 md:px-6">
                      <button onClick={() => abrirModalEdicao(cliente)} className="text-blue-500 hover:text-blue-700 p-2" title="Editar cliente">✏️</button>
                      <button onClick={() => excluirCliente(cliente.id, cliente.nome)} className="text-red-400 hover:text-red-600 p-2" title="Remover cliente">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          </>
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
