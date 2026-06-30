'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Timestamp, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import AuthGuard from '../../components/AuthGuard';
import EmptyState from '../../components/EmptyState';
import SearchInput from '../../components/SearchInput';
import { useAuth } from '../../context/AuthContext';
import {
  atualizarCliente,
  criarCliente,
  excluirCliente as excluirClienteFirestore,
  listarClientesDoUsuario,
  listarPaginaClientesDoUsuario,
} from '../../services/clientesService';
import { DEFAULT_AGENCY_ID } from '../../types';
import type { Cliente, NovoCliente } from '../../types';
import { filterBySearch, normalizeSearchText } from '../../utils/searchUtils';

const DEBOUNCE_PESQUISA_CLIENTES_MS = 400;

interface EstadoListaClientes {
  userId: string;
  geracao: number;
  clientes: Cliente[];
  ultimoDocumento: QueryDocumentSnapshot<DocumentData> | null;
  temMais: boolean;
}

interface CachePesquisaClientes {
  userId: string;
  geracao: number;
  clientes: Cliente[];
}

interface PesquisaClientesEmAndamento {
  userId: string;
  geracao: number;
  promise: Promise<Cliente[]>;
  versaoMutacoes: number;
}

export type MutacaoCliente =
  | { tipo: 'criar'; cliente: Cliente }
  | { tipo: 'editar'; id: string; dados: Partial<Cliente> }
  | { tipo: 'excluir'; id: string };

export interface RegistroMutacoesClientes {
  userId: string;
  geracao: number;
  versao: number;
  mutacoes: Array<MutacaoCliente & { versao: number }>;
}

export interface IdentidadeSessaoClientes {
  userId: string | undefined;
  geracao: number;
}

export function concatenarClientesPorId(atuais: Cliente[], novos: Cliente[]) {
  const clientesPorId = new Map(atuais.map((cliente) => [cliente.id, cliente]));
  novos.forEach((cliente) => clientesPorId.set(cliente.id, cliente));
  return Array.from(clientesPorId.values());
}

export function inserirClienteNoInicio(clientes: Cliente[], novoCliente: Cliente) {
  return [novoCliente, ...clientes.filter((cliente) => cliente.id !== novoCliente.id)];
}

export function atualizarClientePorId(
  clientes: Cliente[],
  id: string,
  dados: Partial<Cliente>
) {
  return clientes.map((cliente) => (
    cliente.id === id ? { ...cliente, ...dados } : cliente
  ));
}

export function removerClientePorId(clientes: Cliente[], id: string) {
  return clientes.filter((cliente) => cliente.id !== id);
}

export function estadoPertenceAoUsuario(
  estadoUserId: string | undefined,
  userIdAtual: string | undefined
) {
  return Boolean(estadoUserId && userIdAtual && estadoUserId === userIdAtual);
}

export function identidadeSessaoCorresponde(
  atual: IdentidadeSessaoClientes,
  capturada: IdentidadeSessaoClientes
) {
  return atual.userId === capturada.userId && atual.geracao === capturada.geracao;
}

export function selecionarFonteClientes(
  clientesPaginados: Cliente[],
  cachePesquisa: CachePesquisaClientes | null,
  userId: string | undefined,
  geracao: number,
  pesquisaAtiva: boolean
) {
  if (
    pesquisaAtiva
    && estadoPertenceAoUsuario(cachePesquisa?.userId, userId)
    && cachePesquisa?.geracao === geracao
    && cachePesquisa
  ) {
    return cachePesquisa.clientes;
  }

  return clientesPaginados;
}

export function obterPesquisaClientesEmAndamento(
  pesquisaAtual: PesquisaClientesEmAndamento | null,
  userId: string,
  geracao: number,
  versaoMutacoes: number,
  carregar: (userId: string) => Promise<Cliente[]>
): PesquisaClientesEmAndamento {
  if (pesquisaAtual?.userId === userId && pesquisaAtual.geracao === geracao) {
    return pesquisaAtual;
  }

  return {
    userId,
    geracao,
    promise: carregar(userId),
    versaoMutacoes,
  };
}

export function registrarMutacaoCliente(
  registroAtual: RegistroMutacoesClientes | null,
  userId: string,
  geracao: number,
  mutacao: MutacaoCliente
): RegistroMutacoesClientes {
  const registroDoUsuario = registroAtual?.userId === userId
    && registroAtual.geracao === geracao
    ? registroAtual
    : { userId, geracao, versao: 0, mutacoes: [] };
  const novaVersao = registroDoUsuario.versao + 1;

  return {
    userId,
    geracao,
    versao: novaVersao,
    mutacoes: [
      ...registroDoUsuario.mutacoes,
      { ...mutacao, versao: novaVersao },
    ],
  };
}

export function reconciliarClientesComMutacoes(
  clientes: Cliente[],
  registro: RegistroMutacoesClientes | null,
  userId: string,
  geracao: number,
  versaoInicial: number
) {
  if (registro?.userId !== userId || registro.geracao !== geracao) {
    return clientes;
  }

  return registro.mutacoes
    .filter((mutacao) => mutacao.versao > versaoInicial)
    .reduce((clientesAtuais, mutacao) => {
      if (mutacao.tipo === 'criar') {
        return inserirClienteNoInicio(clientesAtuais, mutacao.cliente);
      }
      if (mutacao.tipo === 'editar') {
        return atualizarClientePorId(clientesAtuais, mutacao.id, mutacao.dados);
      }
      return removerClientePorId(clientesAtuais, mutacao.id);
    }, clientes);
}

export default function Clientes() {
  return (
    <AuthGuard>
      <ClientesContent />
    </AuthGuard>
  );
}

function ClientesContent() {
  const { user, accessProfile } = useAuth();
  const userId = user?.uid;
  const identidadeSessaoRef = useRef<IdentidadeSessaoClientes>({
    userId,
    geracao: 0,
  });
  const [geracaoSessao, setGeracaoSessao] = useState(0);

  const [estadoLista, setEstadoLista] = useState<EstadoListaClientes | null>(null);
  const [cachePesquisa, setCachePesquisa] = useState<CachePesquisaClientes | null>(null);
  const [carregandoInicialPara, setCarregandoInicialPara] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [carregandoPesquisa, setCarregandoPesquisa] = useState(false);
  const [erroInicial, setErroInicial] = useState('');
  const [erroMais, setErroMais] = useState('');
  const [erroPesquisa, setErroPesquisa] = useState('');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const pesquisaEmAndamentoRef = useRef<PesquisaClientesEmAndamento | null>(null);
  const registroMutacoesRef = useRef<RegistroMutacoesClientes | null>(null);
  
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
    const identidadeSessao: IdentidadeSessaoClientes = {
      userId,
      geracao: identidadeSessaoRef.current.geracao + 1,
    };
    identidadeSessaoRef.current = identidadeSessao;
    setGeracaoSessao(identidadeSessao.geracao);

    if (!userId) {
      queueMicrotask(() => {
        if (identidadeSessaoCorresponde(identidadeSessaoRef.current, identidadeSessao)) {
          setEstadoLista(null);
          setCachePesquisa(null);
          setTermoPesquisa('');
          setErroInicial('');
          setErroMais('');
          setErroPesquisa('');
        }
      });
      pesquisaEmAndamentoRef.current = null;
      registroMutacoesRef.current = null;
      return;
    }

    const userIdDaBusca = userId;
    registroMutacoesRef.current = {
      userId: userIdDaBusca,
      geracao: identidadeSessao.geracao,
      versao: 0,
      mutacoes: [],
    };
    const versaoMutacoesNoInicio = registroMutacoesRef.current.versao;
    let buscaAtiva = true;
    const buscarClientes = async () => {
      setEstadoLista(null);
      setTermoPesquisa('');
      setCarregandoInicialPara(userIdDaBusca);
      setCarregandoMais(false);
      setCarregandoPesquisa(false);
      setErroInicial('');
      setErroMais('');
      setErroPesquisa('');
      setCachePesquisa(null);
      pesquisaEmAndamentoRef.current = null;

      try {
        const pagina = await listarPaginaClientesDoUsuario(userIdDaBusca);
        if (
          buscaAtiva
          && identidadeSessaoCorresponde(identidadeSessaoRef.current, identidadeSessao)
        ) {
          const clientesReconciliados = reconciliarClientesComMutacoes(
            pagina.clientes,
            registroMutacoesRef.current,
            userIdDaBusca,
            identidadeSessao.geracao,
            versaoMutacoesNoInicio
          );
          setEstadoLista({
            userId: userIdDaBusca,
            geracao: identidadeSessao.geracao,
            clientes: clientesReconciliados,
            ultimoDocumento: pagina.ultimoDocumento,
            temMais: pagina.temMais,
          });
        }
      } catch (error) {
        console.error("Erro ao buscar clientes:", error);
        if (
          buscaAtiva
          && identidadeSessaoCorresponde(identidadeSessaoRef.current, identidadeSessao)
        ) {
          setEstadoLista({
            userId: userIdDaBusca,
            geracao: identidadeSessao.geracao,
            clientes: [],
            ultimoDocumento: null,
            temMais: false,
          });
          setErroInicial('Não foi possível carregar os clientes. Tente novamente.');
        }
      } finally {
        if (
          buscaAtiva
          && identidadeSessaoCorresponde(identidadeSessaoRef.current, identidadeSessao)
        ) {
          setCarregandoInicialPara(null);
        }
      }
    };

    buscarClientes();

    return () => {
      buscaAtiva = false;
    };
  }, [user, userId]);

  const listaAtual = estadoPertenceAoUsuario(estadoLista?.userId, userId)
    && estadoLista?.geracao === geracaoSessao
    ? estadoLista
    : null;
  const clientesPaginados = listaAtual?.clientes ?? [];
  const cachePesquisaAtual = estadoPertenceAoUsuario(cachePesquisa?.userId, userId)
    && cachePesquisa?.geracao === geracaoSessao
    ? cachePesquisa
    : null;
  const termoPesquisaNormalizado = normalizeSearchText(termoPesquisa);
  const pesquisaAtiva = Boolean(termoPesquisaNormalizado);
  const carregandoInicial = Boolean(userId && carregandoInicialPara === userId);

  useEffect(() => {
    if (!userId || !termoPesquisaNormalizado || cachePesquisaAtual) {
      return;
    }

    const userIdDaPesquisa = userId;
    const identidadePesquisa = identidadeSessaoRef.current;
    let pesquisaAtivaNesteEfeito = true;
    const timer = setTimeout(async () => {
      setCarregandoPesquisa(true);
      setErroPesquisa('');

      try {
        const pesquisaEmAndamento = obterPesquisaClientesEmAndamento(
          pesquisaEmAndamentoRef.current,
          userIdDaPesquisa,
          identidadePesquisa.geracao,
          registroMutacoesRef.current?.userId === userIdDaPesquisa
            && registroMutacoesRef.current.geracao === identidadePesquisa.geracao
            ? registroMutacoesRef.current.versao
            : 0,
          listarClientesDoUsuario
        );
        pesquisaEmAndamentoRef.current = pesquisaEmAndamento;

        const clientes = await pesquisaEmAndamento.promise;
        if (
          pesquisaAtivaNesteEfeito
          && identidadeSessaoCorresponde(identidadeSessaoRef.current, identidadePesquisa)
        ) {
          setCachePesquisa({
            userId: userIdDaPesquisa,
            geracao: identidadePesquisa.geracao,
            clientes: reconciliarClientesComMutacoes(
              clientes,
              registroMutacoesRef.current,
              userIdDaPesquisa,
              identidadePesquisa.geracao,
              pesquisaEmAndamento.versaoMutacoes
            ),
          });
        }
      } catch (error) {
        console.error('Erro ao carregar a pesquisa completa de clientes:', error);
        if (
          pesquisaEmAndamentoRef.current?.userId === userIdDaPesquisa
          && pesquisaEmAndamentoRef.current.geracao === identidadePesquisa.geracao
        ) {
          pesquisaEmAndamentoRef.current = null;
        }
        if (
          pesquisaAtivaNesteEfeito
          && identidadeSessaoCorresponde(identidadeSessaoRef.current, identidadePesquisa)
        ) {
          setErroPesquisa('Não foi possível pesquisar em toda a carteira. Tente novamente.');
        }
      } finally {
        if (
          pesquisaAtivaNesteEfeito
          && identidadeSessaoCorresponde(identidadeSessaoRef.current, identidadePesquisa)
        ) {
          setCarregandoPesquisa(false);
        }
      }
    }, DEBOUNCE_PESQUISA_CLIENTES_MS);

    return () => {
      pesquisaAtivaNesteEfeito = false;
      clearTimeout(timer);
    };
  }, [cachePesquisaAtual, geracaoSessao, termoPesquisaNormalizado, userId]);

  const carregarMaisClientes = async () => {
    if (
      !userId ||
      !listaAtual?.temMais ||
      !listaAtual.ultimoDocumento ||
      carregandoMais
    ) {
      return;
    }

    const userIdDaBusca = userId;
    const identidadeBusca = identidadeSessaoRef.current;
    const cursorDaBusca = listaAtual.ultimoDocumento;
    const versaoMutacoesNoInicio = registroMutacoesRef.current?.userId === userIdDaBusca
      && registroMutacoesRef.current.geracao === identidadeBusca.geracao
      ? registroMutacoesRef.current.versao
      : 0;
    setCarregandoMais(true);
    setErroMais('');

    try {
      const pagina = await listarPaginaClientesDoUsuario(userIdDaBusca, cursorDaBusca);
      if (!identidadeSessaoCorresponde(identidadeSessaoRef.current, identidadeBusca)) return;
      const clientesReconciliados = reconciliarClientesComMutacoes(
        pagina.clientes,
        registroMutacoesRef.current,
        userIdDaBusca,
        identidadeBusca.geracao,
        versaoMutacoesNoInicio
      );

      setEstadoLista((estadoAtual) => {
        if (
          !estadoPertenceAoUsuario(estadoAtual?.userId, userIdDaBusca)
          || estadoAtual?.geracao !== identidadeBusca.geracao
          || !estadoAtual
        ) {
          return estadoAtual;
        }

        return {
          ...estadoAtual,
          clientes: concatenarClientesPorId(estadoAtual.clientes, clientesReconciliados),
          ultimoDocumento: pagina.ultimoDocumento ?? estadoAtual.ultimoDocumento,
          temMais: pagina.clientes.length === 0 ? false : pagina.temMais,
        };
      });
    } catch (error) {
      console.error('Erro ao carregar mais clientes:', error);
      if (identidadeSessaoCorresponde(identidadeSessaoRef.current, identidadeBusca)) {
        setErroMais('Não foi possível carregar mais clientes. Tente novamente.');
      }
    } finally {
      if (identidadeSessaoCorresponde(identidadeSessaoRef.current, identidadeBusca)) {
        setCarregandoMais(false);
      }
    }
  };

  const adicionarClienteLegado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome) return alert("O nome é obrigatório!");
    if (!userId) return alert("Você precisa estar logado para salvar um cliente.");

    const identidadeMutacao = identidadeSessaoRef.current;
    try {
      const novoCliente: NovoCliente = {
        nome: novoNome,
        telefone: novoTelefone || 'Não informado',
        origemLead: "Legado (WhatsApp)",
        primeiraViagem: novaViagem || 'Não informada',
        ownerId: userId,
        agencyId: accessProfile.agencyId ?? DEFAULT_AGENCY_ID,
        dataCadastro: new Date()
      };

      const docRef = await criarCliente(novoCliente);
      const clienteCriado = { id: docRef.id, ...novoCliente };
      if (!identidadeSessaoCorresponde(identidadeSessaoRef.current, identidadeMutacao)) return;
      registroMutacoesRef.current = registrarMutacaoCliente(
        registroMutacoesRef.current,
        userId,
        identidadeMutacao.geracao,
        { tipo: 'criar', cliente: clienteCriado }
      );
      setEstadoLista((estadoAtual) => (
        estadoPertenceAoUsuario(estadoAtual?.userId, userId)
          && estadoAtual?.geracao === identidadeMutacao.geracao
          && estadoAtual
          ? {
              ...estadoAtual,
              clientes: inserirClienteNoInicio(estadoAtual.clientes, clienteCriado),
            }
          : estadoAtual
      ));
      setCachePesquisa((cacheAtual) => (
        estadoPertenceAoUsuario(cacheAtual?.userId, userId)
          && cacheAtual?.geracao === identidadeMutacao.geracao
          && cacheAtual
          ? {
              ...cacheAtual,
              clientes: inserirClienteNoInicio(cacheAtual.clientes, clienteCriado),
            }
          : cacheAtual
      ));
      
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

    const identidadeMutacao = identidadeSessaoRef.current;
    try {
      const dadosAtualizados = {
        nome: editNome,
        telefone: editTelefone || 'Não informado',
        primeiraViagem: editViagem
      };

      await atualizarCliente(clienteEmEdicao.id, dadosAtualizados);
      if (
        !userId
        || !identidadeSessaoCorresponde(identidadeSessaoRef.current, identidadeMutacao)
      ) return;
      registroMutacoesRef.current = registrarMutacaoCliente(
        registroMutacoesRef.current,
        userId,
        identidadeMutacao.geracao,
        { tipo: 'editar', id: clienteEmEdicao.id, dados: dadosAtualizados }
      );

      setEstadoLista((estadoAtual) => (
        estadoPertenceAoUsuario(estadoAtual?.userId, userId)
          && estadoAtual?.geracao === identidadeMutacao.geracao
          && estadoAtual
          ? {
              ...estadoAtual,
              clientes: atualizarClientePorId(
                estadoAtual.clientes,
                clienteEmEdicao.id,
                dadosAtualizados
              ),
            }
          : estadoAtual
      ));
      setCachePesquisa((cacheAtual) => (
        estadoPertenceAoUsuario(cacheAtual?.userId, userId)
          && cacheAtual?.geracao === identidadeMutacao.geracao
          && cacheAtual
          ? {
              ...cacheAtual,
              clientes: atualizarClientePorId(
                cacheAtual.clientes,
                clienteEmEdicao.id,
                dadosAtualizados
              ),
            }
          : cacheAtual
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
      const identidadeMutacao = identidadeSessaoRef.current;
      try {
        await excluirClienteFirestore(id);
        if (
          !userId
          || !identidadeSessaoCorresponde(identidadeSessaoRef.current, identidadeMutacao)
        ) return;
        registroMutacoesRef.current = registrarMutacaoCliente(
          registroMutacoesRef.current,
          userId,
          identidadeMutacao.geracao,
          { tipo: 'excluir', id }
        );
        setEstadoLista((estadoAtual) => (
          estadoPertenceAoUsuario(estadoAtual?.userId, userId)
            && estadoAtual?.geracao === identidadeMutacao.geracao
            && estadoAtual
            ? {
                ...estadoAtual,
                clientes: removerClientePorId(estadoAtual.clientes, id),
              }
            : estadoAtual
        ));
        setCachePesquisa((cacheAtual) => (
          estadoPertenceAoUsuario(cacheAtual?.userId, userId)
            && cacheAtual?.geracao === identidadeMutacao.geracao
            && cacheAtual
            ? {
                ...cacheAtual,
                clientes: removerClientePorId(cacheAtual.clientes, id),
              }
            : cacheAtual
        ));
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

  const fontePesquisa = selecionarFonteClientes(
    clientesPaginados,
    cachePesquisaAtual,
    userId,
    geracaoSessao,
    pesquisaAtiva
  );
  const clientesPesquisados = useMemo(() => (
    filterBySearch(fontePesquisa, termoPesquisa, (cliente) => [
      cliente.nome,
      cliente.telefone,
      cliente.telefoneNormalizado,
      cliente.origemLead,
      cliente.primeiraViagem,
      cliente.dataCadastro ? formatarData(cliente.dataCadastro) : undefined,
    ])
  ), [fontePesquisa, termoPesquisa]);
  const clientesExibidos = pesquisaAtiva ? clientesPesquisados : clientesPaginados;

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
          <h3 className="text-slate-500 text-sm font-semibold uppercase">
            {pesquisaAtiva ? 'Resultados encontrados' : 'Clientes carregados'}
          </h3>
          <p className="text-4xl font-black text-green-600 mt-1">
            {pesquisaAtiva ? clientesPesquisados.length : clientesPaginados.length}
          </p>
        </div>

        {!carregandoInicial && clientesPaginados.length > 0 && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <SearchInput
              value={termoPesquisa}
              onChange={setTermoPesquisa}
              placeholder="Pesquisar por nome, telefone, origem ou viagem"
              ariaLabel="Pesquisar clientes"
            />
            <p className="mt-3 text-xs font-semibold text-slate-500">
              {pesquisaAtiva
                ? carregandoPesquisa
                  ? 'Pesquisando em toda a carteira...'
                  : `${clientesPesquisados.length} ${clientesPesquisados.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}`
                : `${clientesPaginados.length} ${clientesPaginados.length === 1 ? 'cliente carregado' : 'clientes carregados'}`}
            </p>
            {erroPesquisa && (
              <p className="mt-2 text-xs font-semibold text-red-600">{erroPesquisa}</p>
            )}
          </div>
        )}

        {erroInicial ? (
          <EmptyState
            title="Não foi possível carregar os clientes"
            description={erroInicial}
          />
        ) : carregandoInicial ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : clientesPaginados.length === 0 ? (
          <EmptyState
            title="Nenhum cliente real na carteira"
            description="Clientes representam compradores reais. Depois que uma cotação for marcada como fechada no histórico, ela poderá ser adicionada manualmente à carteira."
            actions={[
              { href: '/historico', label: 'Ir para histórico' },
              { href: '/leads', label: 'Ver oportunidades', variant: 'secondary' },
            ]}
          />
        ) : pesquisaAtiva && carregandoPesquisa && !cachePesquisaAtual ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : clientesExibidos.length === 0 ? (
          <EmptyState
            title={`Nenhum resultado encontrado para "${termoPesquisa.trim()}".`}
            description="Tente pesquisar por nome, telefone, origem, primeira viagem ou data de cadastro."
          />
        ) : (
          <>
          <div className="space-y-4 md:hidden">
            {clientesExibidos.map((cliente) => (
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
                {clientesExibidos.map((cliente) => (
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
          {!pesquisaAtiva && listaAtual?.temMais && (
            <div className="mt-6 flex flex-col items-center gap-2">
              {erroMais && (
                <p className="text-sm font-semibold text-red-600">{erroMais}</p>
              )}
              <button
                type="button"
                onClick={carregarMaisClientes}
                disabled={carregandoMais}
                className="rounded-lg border border-green-200 bg-white px-5 py-2 text-sm font-black text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {carregandoMais ? 'Carregando...' : 'Carregar mais'}
              </button>
            </div>
          )}
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
