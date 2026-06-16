'use client';

import { useState, useEffect, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import AuthGuard from '../../components/AuthGuard';
import EmptyState from '../../components/EmptyState';
import SearchInput from '../../components/SearchInput';
import { useAuth } from '../../context/AuthContext';
import { criarCliente, listarClientesDoUsuario } from '../../services/clientesService';
import {
  atualizarCotacao,
  excluirCotacao as excluirCotacaoFirestore,
  listarCotacoesDaAgencia,
  listarCotacoesDoUsuario,
} from '../../services/cotacoesService';
import { DEFAULT_AGENCY_ID } from '../../types';
import type { Cotacao } from '../../types';
import {
  LEAD_STATUS_OPTIONS,
  PRODUTOS_OFERTADOS_OPTIONS,
  formatarLeadStatus,
  formatarProdutoOfertado,
  type LeadStatus,
  type ProdutoOfertado,
} from '../../lib/leadUtils';
import { converterCotacaoFechadaEmCliente } from '../../utils/clienteConversionUtils';
import { filterBySearch, normalizeSearchText } from '../../utils/searchUtils';

type VisaoHistorico = 'minhas' | 'equipe';

export default function Historico() {
  return (
    <AuthGuard>
      <HistoricoContent />
    </AuthGuard>
  );
}

function HistoricoContent() {
  const { user, accessProfile, loading, profileLoading } = useAuth();
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [visaoSelecionada, setVisaoSelecionada] = useState<VisaoHistorico>('minhas');
  const [termoPesquisa, setTermoPesquisa] = useState('');

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

  const perfilPodeVerEquipe = !loading
    && !profileLoading
    && (accessProfile.role === 'supervisor' || accessProfile.role === 'admin')
    && Boolean(accessProfile.agencyId);
  const perfilGerencialSemAgencia = !loading
    && !profileLoading
    && (accessProfile.role === 'supervisor' || accessProfile.role === 'admin')
    && !accessProfile.agencyId;
  const visaoAtiva: VisaoHistorico = perfilPodeVerEquipe ? visaoSelecionada : 'minhas';
  const estaNaVisaoEquipe = visaoAtiva === 'equipe';
  const usuarioEhSupervisor = accessProfile.role === 'supervisor';
  const supervisorNaVisaoEquipe = estaNaVisaoEquipe && usuarioEhSupervisor;

  useEffect(() => {
    if (!user) {
      return;
    }

    let buscaAtiva = true;

    const buscarDados = async () => {
      setCarregando(true);
      setErroCarregamento('');

      try {
        const dados = visaoAtiva === 'equipe' && accessProfile.agencyId
          ? await listarCotacoesDaAgencia(accessProfile.agencyId)
          : await listarCotacoesDoUsuario(user.uid);

        if (buscaAtiva) {
          setCotacoes(dados);
        }
      } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        if (buscaAtiva) {
          setCotacoes([]);
          setErroCarregamento(
            visaoAtiva === 'equipe'
              ? 'Não foi possível carregar as cotações da equipe. Verifique se as regras e índices do Firestore já estão publicados.'
              : 'Não foi possível carregar suas cotações. Tente novamente.'
          );
        }
      } finally {
        if (buscaAtiva) {
          setCarregando(false);
        }
      }
    };

    buscarDados();

    return () => {
      buscaAtiva = false;
    };
  }, [accessProfile.agencyId, user, visaoAtiva]);

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
    if (!confirmar) {
      return;
    }

    try {
      const clientesExistentes = await listarClientesDoUsuario(user.uid);
      const resultado = await converterCotacaoFechadaEmCliente({
        cotacao: item,
        userId: user.uid,
        agencyId: accessProfile.agencyId ?? DEFAULT_AGENCY_ID,
        formatarData,
        clientesExistentes,
        criarCliente,
      });

      if (resultado.status === 'duplicate') {
        alert("Este cliente já existe na carteira.");
        return;
      }

      if (resultado.status === 'not_closed') {
        alert("Somente cotações marcadas como fechado podem virar cliente.");
        return;
      }

      if (resultado.status === 'missing_agency') {
        alert("Não foi possível identificar a agência do seu perfil. Aguarde o carregamento do perfil e tente novamente.");
        return;
      }

      alert("Cliente adicionado à carteira com sucesso.");
    } catch (error) {
      console.error("Erro ao adicionar cliente a partir da cotação:", error);
      alert("Erro ao adicionar cliente.");
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

  const getDerivedSalesStatus = (cotacao: Cotacao) => {
    if (!cotacao.leadStatus) {
      return cotacao.status || 'Novo 🆕';
    }

    switch (cotacao.leadStatus) {
      case 'fechado':
        return 'Fechado ✅';
      case 'perdido':
        return 'Desistiu ❌';
      case 'aguardando_cliente':
      case 'orcamento_enviado':
        return 'Retornar 📞';
      case 'em_monitoramento':
      case 'negociacao':
        return 'Monitorando 👀';
      default:
        return 'Novo 🆕';
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

  const formatarAgenteResponsavel = (item: Cotacao) => (
    item.ownerName || item.ownerEmail || 'Agente não identificado'
  );

  const isBusinessClosed = (cotacao: Cotacao) => (
    cotacao.leadStatus === 'fechado'
    || (!cotacao.leadStatus && cotacao.status === 'Fechado ✅')
  );

  const totalCotacoes = cotacoes.length;
  const negociosFechados = cotacoes.filter(isBusinessClosed).length;
  const volumeVendas = cotacoes
    .filter(isBusinessClosed)
    .reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);
  const termoPesquisaNormalizado = normalizeSearchText(termoPesquisa);
  const cotacoesPesquisadas = useMemo(() => (
    filterBySearch(cotacoes, termoPesquisa, (item) => [
      item.cliente,
      item.telefone,
      item.telefoneNormalizado,
      item.origem,
      item.destino,
      item.companhia,
      item.companhiaIda,
      item.companhiaVolta,
      item.ownerName,
      item.ownerEmail,
      item.leadStatus,
      item.status,
      ...(item.produtosOfertados ?? []),
      item.observacao,
      item.dataIda,
      item.dataVolta,
      item.valorTotal,
    ])
  ), [cotacoes, termoPesquisa]);

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

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Visão do histórico</p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Escolha entre suas cotações e a visão da equipe.
              </p>
            </div>

            <div className="flex rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setVisaoSelecionada('minhas')}
                className={`rounded-md px-3 py-2 text-xs font-black uppercase transition ${
                  visaoAtiva === 'minhas'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Minhas cotações
              </button>
              {perfilPodeVerEquipe && (
                <button
                  type="button"
                  onClick={() => setVisaoSelecionada('equipe')}
                  className={`rounded-md px-3 py-2 text-xs font-black uppercase transition ${
                    visaoAtiva === 'equipe'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Equipe
                </button>
              )}
            </div>
          </div>

          {perfilGerencialSemAgencia && (
            <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              A visão da equipe ficará disponível quando seu perfil tiver uma agência vinculada.
            </p>
          )}
          {erroCarregamento && (
            <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {erroCarregamento}
            </p>
          )}
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

        {!carregando && cotacoes.length > 0 && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <SearchInput
              value={termoPesquisa}
              onChange={setTermoPesquisa}
              placeholder="Pesquisar por cliente, telefone, rota, companhia ou status"
              ariaLabel="Pesquisar cotações"
            />
            <p className="mt-3 text-xs font-semibold text-slate-500">
              {termoPesquisaNormalizado
                ? `${cotacoesPesquisadas.length} ${cotacoesPesquisadas.length === 1 ? 'resultado encontrado' : 'resultados encontrados'} em ${cotacoes.length} ${cotacoes.length === 1 ? 'cotação' : 'cotações'}`
                : `${cotacoes.length} ${cotacoes.length === 1 ? 'cotação carregada' : 'cotações carregadas'}`}
            </p>
          </div>
        )}

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
        ) : cotacoesPesquisadas.length === 0 ? (
          <EmptyState
            title={`Nenhum resultado encontrado para "${termoPesquisa.trim()}".`}
            description="Tente pesquisar por cliente, telefone, rota, companhia ou status."
          />
        ) : (
          <>
          <div className="space-y-4 md:hidden">
            {cotacoesPesquisadas.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-black text-slate-900">{item.cliente}</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {item.telefone || 'Sem telefone'}
                    </p>
                    {estaNaVisaoEquipe && (
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Agente: {formatarAgenteResponsavel(item)}
                      </p>
                    )}
                    <p className="mt-1 text-sm font-bold text-slate-600">
                      {item.origem} → {item.destino}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-black ${item.companhia === 'GOL' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'}`}>
                    {item.companhia}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      {item.dataIda ? 'Viagem' : 'Registro'}
                    </p>
                    <p className="mt-1 font-bold text-slate-700">
                      {formatarData(item.dataIda || item.dataRegistro)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Valor total</p>
                    <p className="mt-1 font-black text-green-700">{item.valorTotal}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <div>
                    <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Status da venda</span>
                    <p className={`w-fit rounded-lg px-3 py-2 text-xs font-black ${getStatusColor(getDerivedSalesStatus(item))}`}>
                      {getDerivedSalesStatus(item)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Status comercial</p>
                    <p className="mt-1 w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">
                      {formatarLeadStatus(item.leadStatus)}
                    </p>
                  </div>
                </div>

                {item.produtosOfertados && item.produtosOfertados.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.produtosOfertados.map((produto) => (
                      <span key={produto} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                        {formatarProdutoOfertado(produto)}
                      </span>
                    ))}
                  </div>
                )}

                {item.observacao && (
                  <p className="mt-4 break-words rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-600">
                    {item.observacao}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {!supervisorNaVisaoEquipe && (
                    <button
                      type="button"
                      onClick={() => abrirModalEdicao(item)}
                      className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black uppercase text-blue-700 transition hover:bg-blue-100"
                    >
                      Editar cotação
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => abrirModalComercial(item)}
                    className={`rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase text-slate-700 transition hover:bg-slate-100 ${supervisorNaVisaoEquipe ? 'col-span-2' : ''}`}
                  >
                    Editar comercial
                  </button>
                  {!supervisorNaVisaoEquipe && item.leadStatus === 'fechado' && (
                    <button
                      type="button"
                      onClick={() => adicionarAosClientes(item)}
                      className="col-span-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-black uppercase text-green-700 transition hover:bg-green-100"
                    >
                      Adicionar aos clientes
                    </button>
                  )}
                  {!supervisorNaVisaoEquipe && (
                    <button
                      type="button"
                      onClick={() => excluirCotacao(item.id, item.cliente)}
                      className="col-span-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-black uppercase text-red-600 transition hover:bg-red-100"
                    >
                      Excluir cotação
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="-mx-4 hidden overflow-x-auto sm:mx-0 md:block">
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
                {cotacoesPesquisadas.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition duration-150">
                    <td className="px-4 py-4 md:px-6">
                      <div className="font-bold">{item.cliente}</div>
                      <div className="mt-1 text-xs font-medium text-slate-400">
                        {item.telefone || 'Sem telefone'}
                      </div>
                      {estaNaVisaoEquipe && (
                        <div className="mt-1 text-xs font-medium text-slate-400">
                          Agente: {formatarAgenteResponsavel(item)}
                        </div>
                      )}
                    </td>
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
                      <span className={`inline-block rounded-lg px-3 py-2 text-xs font-black ${getStatusColor(getDerivedSalesStatus(item))}`}>
                        {getDerivedSalesStatus(item)}
                      </span>
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
                      {!supervisorNaVisaoEquipe && item.leadStatus === 'fechado' && (
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
                      {!supervisorNaVisaoEquipe && (
                        <>
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
                        </>
                      )}
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
