'use client';

import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import AuthGuard from '../../components/AuthGuard';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { criarCliente, listarClientesDoUsuario } from '../../services/clientesService';
import { atualizarCotacao, excluirCotacao as excluirCotacaoFirestore, listarCotacoesDoUsuario } from '../../services/cotacoesService';
import type { Cotacao, NovoCliente } from '../../types';
import {
  LEAD_STATUS_OPTIONS,
  PRODUTOS_OFERTADOS_OPTIONS,
  formatarLeadStatus,
  formatarProdutoOfertado,
  type LeadStatus,
  type ProdutoOfertado,
} from '../../lib/leadUtils';

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
  const [modalComercialAberto, setModalComercialAberto] = useState(false);
  const [cotacaoComercialEmEdicao, setCotacaoComercialEmEdicao] = useState<Cotacao | null>(null);
  const [editLeadStatus, setEditLeadStatus] = useState<LeadStatus>('novo');
  const [editProdutosOfertados, setEditProdutosOfertados] = useState<ProdutoOfertado[]>([]);
  const [editObservacao, setEditObservacao] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    const buscarDados = async () => {
      try {
        const dados = await listarCotacoesDoUsuario(user.uid);
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
      const dadosAtualizados = {
        cliente: editCliente,
        origem: editOrigem,
        destino: editDestino,
        companhia: editCompanhia,
        valorTotal: Number(editValorTotal),
        dataIda: editDataIda,
      };

      await atualizarCotacao(cotacaoEmEdicao.id, dadosAtualizados);

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

  const normalizarLeadStatus = (status?: string): LeadStatus => {
    const statusEncontrado = LEAD_STATUS_OPTIONS.find((option) => option.value === status);
    return statusEncontrado?.value ?? 'novo';
  };

  const normalizarProdutosOfertados = (produtos?: string[]): ProdutoOfertado[] => (
    (produtos ?? []).filter((produto): produto is ProdutoOfertado =>
      PRODUTOS_OFERTADOS_OPTIONS.some((option) => option.value === produto)
    )
  );

  const abrirModalComercial = (item: Cotacao) => {
    setCotacaoComercialEmEdicao(item);
    setEditLeadStatus(normalizarLeadStatus(item.leadStatus));
    setEditProdutosOfertados(normalizarProdutosOfertados(item.produtosOfertados));
    setEditObservacao(item.observacao ?? '');
    setModalComercialAberto(true);
  };

  const alternarProdutoOfertado = (produto: ProdutoOfertado) => {
    setEditProdutosOfertados((produtosAtuais) => (
      produtosAtuais.includes(produto)
        ? produtosAtuais.filter((item) => item !== produto)
        : [...produtosAtuais, produto]
    ));
  };

  const salvarEdicaoComercial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cotacaoComercialEmEdicao) return;

    const dadosComerciais = {
      leadStatus: editLeadStatus,
      produtosOfertados: editProdutosOfertados,
      observacao: editObservacao.trim(),
    };

    try {
      await atualizarCotacao(cotacaoComercialEmEdicao.id, dadosComerciais);

      setCotacoes(prev => prev.map(item =>
        item.id === cotacaoComercialEmEdicao.id ? { ...item, ...dadosComerciais } : item
      ));

      setModalComercialAberto(false);
      setCotacaoComercialEmEdicao(null);
    } catch (error) {
      console.error("Erro ao salvar dados comerciais:", error);
      alert("Erro ao salvar dados comerciais.");
    }
  };

  const normalizarNomeCliente = (nome: string) => (
    nome.trim().toLowerCase().replace(/\s+/g, ' ')
  );

  const montarResumoViagem = (item: Cotacao) => {
    const rota = `${item.origem} → ${item.destino}`;
    if (!item.dataIda) return rota;
    return `${rota} | ${formatarData(item.dataIda)}`;
  };

  const adicionarAosClientes = async (item: Cotacao) => {
    if (!user) {
      alert("Você precisa estar logado para adicionar um cliente.");
      return;
    }

    if (item.leadStatus !== 'fechado') {
      alert("Somente cotações marcadas como fechado podem virar cliente.");
      return;
    }

    const nomeCliente = item.cliente?.trim() || 'Cliente sem nome';
    const confirmar = window.confirm(`Adicionar ${nomeCliente} à carteira de clientes?`);
    if (!confirmar) return;

    try {
      const clientesExistentes = await listarClientesDoUsuario(user.uid);
      const nomeNormalizado = normalizarNomeCliente(nomeCliente);
      const clienteDuplicado = clientesExistentes.some((cliente) => (
        normalizarNomeCliente(cliente.nome) === nomeNormalizado
      ));

      if (clienteDuplicado) {
        alert("Este cliente já existe na carteira.");
        return;
      }

      const novoCliente: NovoCliente = {
        nome: nomeCliente,
        origemLead: 'Cotação fechada',
        primeiraViagem: montarResumoViagem(item),
        ownerId: user.uid,
        dataCadastro: new Date(),
      };

      await criarCliente(novoCliente);
      alert("Cliente adicionado à carteira com sucesso.");
    } catch (error) {
      console.error("Erro ao adicionar cliente a partir da cotação:", error);
      alert("Erro ao adicionar cliente.");
    }
  };

  const alterarStatus = async (id: string, novoStatus: string) => {
    try {
      await atualizarCotacao(id, { status: novoStatus });
      
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
        await excluirCotacaoFirestore(id);
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
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-900 border-l-4 border-blue-600 pl-4">
            Gestão de Cotações
          </h1>
          <p className="mt-2 pl-5 text-sm font-medium text-slate-500">
            Memória das cotações e ponto de ação comercial.
          </p>
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
        ) : cotacoes.length === 0 ? (
          <EmptyState
            title="Nenhuma cotação registrada ainda"
            description="As cotações salvas aparecerão aqui como memória comercial da agência. Comece criando uma nova cotação para acompanhar valores, status e próximos passos."
            actions={[
              { href: '/', label: 'Criar nova cotação' },
              { href: '/leads', label: 'Ver leads', variant: 'secondary' },
            ]}
          />
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div className="min-w-[980px] overflow-hidden rounded-2xl border border-gray-100 bg-white text-gray-800 shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold border-b">
                <tr>
                  <th className="px-4 py-4 md:px-6">Cliente</th>
                  <th className="px-4 py-4 md:px-6">Rota / Cia</th>
                  <th className="px-4 py-4 md:px-6">Valor Total</th>
                  <th className="px-4 py-4 md:px-6">Status da Venda</th>
                  <th className="px-4 py-4 md:px-6">Comercial</th>
                  <th className="px-4 py-4 md:px-6">Data de registro</th>
                  <th className="px-4 py-4 text-center md:px-6">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cotacoes.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition duration-150">
                    <td className="px-4 py-4 font-bold md:px-6">{item.cliente}</td>
                    <td className="px-4 py-4 text-sm md:px-6">
                      <div className="font-medium">{item.origem} ➔ {item.destino}</div>
                      <div className={`text-[10px] font-black mt-1 inline-block px-1.5 py-0.5 rounded shadow-sm ${
                        item.companhia === 'GOL' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {item.companhia}
                      </div>
                    </td>
                    {/* Alterado para o número puro conforme a Regra de Negócio */}
                    <td className="px-4 py-4 font-black text-green-700 text-lg md:px-6">
                      {item.valorTotal}
                    </td>
                    <td className="px-4 py-4 md:px-6">
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
                    <td className="px-4 py-4 text-xs md:px-6">
                      <div className="font-black uppercase text-slate-700">
                        {formatarLeadStatus(item.leadStatus)}
                      </div>
                      {item.produtosOfertados && item.produtosOfertados.length > 0 && (
                        <div className="mt-1 flex max-w-48 flex-wrap gap-1">
                          {item.produtosOfertados.map((produto) => (
                            <span key={produto} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              {formatarProdutoOfertado(produto)}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.observacao && (
                        <p className="mt-1 max-w-48 truncate text-[11px] font-medium text-slate-500" title={item.observacao}>
                          {item.observacao}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => abrirModalComercial(item)}
                        className="mt-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-600 transition hover:bg-slate-100"
                      >
                        Editar comercial
                      </button>
                      {item.leadStatus === 'fechado' && (
                        <button
                          type="button"
                          onClick={() => adicionarAosClientes(item)}
                          className="mt-2 block rounded-md border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-black uppercase text-green-700 transition hover:bg-green-100"
                        >
                          Adicionar aos clientes
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-400 text-[11px] font-medium md:px-6">
                      {formatarData(item.dataRegistro)}
                    </td>
                    <td className="px-4 py-4 text-center flex items-center justify-center gap-2 md:px-6">
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
          </div>
        )}
      </div>

      {/* Modal de Edição de Cotação */}
      {modalEditAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Editar dados da cotação</h2>
            <form onSubmit={salvarEdicao} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-600">Nome do cliente</label>
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
                  <label className="text-sm font-semibold text-slate-600">Valor final</label>
                  <input type="number" step="0.01" value={editValorTotal} onChange={(e) => setEditValorTotal(Number(e.target.value))} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-600">Data da ida</label>
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

      {modalComercialAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-lg">
            <h2 className="text-xl font-bold text-slate-800 mb-1">Editar comercial</h2>
            <p className="mb-5 text-sm font-medium text-slate-500">
              {cotacaoComercialEmEdicao?.cliente}
            </p>

            <form onSubmit={salvarEdicaoComercial} className="flex flex-col gap-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-600">Status comercial</span>
                <select
                  value={editLeadStatus}
                  onChange={(e) => setEditLeadStatus(e.target.value as LeadStatus)}
                  className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {LEAD_STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </label>

              <div>
                <span className="text-sm font-semibold text-slate-600">Produtos ofertados</span>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PRODUTOS_OFERTADOS_OPTIONS.map((produto) => (
                    <label key={produto.value} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={editProdutosOfertados.includes(produto.value)}
                        onChange={() => alternarProdutoOfertado(produto.value)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      <span>{produto.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-600">Observação comercial</span>
                <textarea
                  value={editObservacao}
                  onChange={(e) => setEditObservacao(e.target.value)}
                  className="w-full mt-1 min-h-28 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Observações internas sobre o acompanhamento"
                />
              </label>

              <div className="flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setModalComercialAberto(false)} className="px-4 py-2 text-slate-500 font-semibold hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md">Salvar comercial</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
