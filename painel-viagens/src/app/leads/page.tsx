'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import AuthGuard from '../../components/AuthGuard';
import EmptyState from '../../components/EmptyState';
import SearchInput from '../../components/SearchInput';
import { useAuth } from '../../context/AuthContext';
import { criarCliente, listarClientesDoUsuario } from '../../services/clientesService';
import { atualizarCotacao, listarCotacoesDoUsuario } from '../../services/cotacoesService';
import { DEFAULT_AGENCY_ID } from '../../types';
import type { Cotacao } from '../../types';
import {
  LEAD_STATUS_OPTIONS,
  PRODUTOS_OFERTADOS_OPTIONS,
  formatarLeadStatus,
  formatarProdutoOfertado,
  isLeadStatusAberto,
  type LeadStatus,
  type ProdutoOfertado,
} from '../../lib/leadUtils';
import {
  converterCotacaoFechadaEmCliente,
  normalizarTelefoneCliente,
} from '../../utils/clienteConversionUtils';
import { filterBySearch, normalizeSearchText } from '../../utils/searchUtils';

type FiltroStatus = 'abertos' | 'sem_status' | LeadStatus;
type CotacaoComHorariosVolta = Cotacao & {
  horaSaidaVolta?: string;
  horaChegadaVolta?: string;
};

export interface LeadOpportunity {
  id: string;
  cotacoes: Cotacao[];
  cliente: string;
  telefone?: string;
  origem: string;
  destino: string;
  dataIda?: string;
  dataVolta?: string | null;
  menorValor?: number;
  maiorValor?: number;
  cotacaoMaisRecente: Cotacao;
  produtosOfertados: string[];
  observacao?: string;
}

function formatarData(data: Timestamp | string | number | Date | undefined | null) {
  if (!data) return 'Data não informada';
  if (typeof (data as Timestamp).toDate === 'function') {
    return (data as Timestamp).toDate().toLocaleDateString('pt-BR');
  }
  return new Date(data as string | number | Date).toLocaleDateString('pt-BR');
}

function formatarValor(valor?: number | null) {
  if (typeof valor !== 'number') return '-';
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function normalizarTexto(valor?: string | null) {
  return (valor ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getTime(data: Cotacao['dataRegistro']) {
  if (!data) return 0;
  if (typeof (data as Timestamp).toDate === 'function') {
    return (data as Timestamp).toDate().getTime();
  }
  const time = new Date(data as string | number | Date).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function montarChaveOportunidade(cotacao: Cotacao) {
  const ownerId = cotacao.ownerId?.trim() || 'sem_owner';
  const clienteId = cotacao.clienteId?.trim();
  if (clienteId) return `owner:${ownerId}|cliente:${clienteId}`;

  const telefoneNormalizado = normalizarTelefoneCliente(cotacao.telefoneNormalizado)
    || normalizarTelefoneCliente(cotacao.telefone);
  if (telefoneNormalizado) {
    return `owner:${ownerId}|telefone:${telefoneNormalizado}`;
  }

  const cotacaoLegada = cotacao as Cotacao & {
    nomeCliente?: string;
    nome?: string;
  };
  const nomeNormalizado = [
    cotacao.cliente,
    cotacaoLegada.nomeCliente,
    cotacaoLegada.nome,
  ].map(normalizarTexto).find(Boolean) ?? '';
  if (nomeNormalizado) return `owner:${ownerId}|nome:${nomeNormalizado}`;

  return `owner:${ownerId}|cotacao:${cotacao.id}`;
}

export function montarDadosViagemCotacao(
  cotacao: Pick<Cotacao, 'origem' | 'destino' | 'dataIda' | 'dataVolta'>
) {
  return {
    rota: `${cotacao.origem} → ${cotacao.destino}`,
    dataIda: cotacao.dataIda,
    dataVolta: cotacao.dataVolta,
  };
}

function ordenarPorRegistroMaisRecente(a: Cotacao, b: Cotacao) {
  return getTime(b.dataRegistro) - getTime(a.dataRegistro);
}

export function agruparCotacoesEmOportunidades(cotacoes: Cotacao[]): LeadOpportunity[] {
  const grupos = new Map<string, Cotacao[]>();

  cotacoes.forEach((cotacao) => {
    const chave = montarChaveOportunidade(cotacao);
    const grupoAtual = grupos.get(chave) ?? [];
    grupoAtual.push(cotacao);
    grupos.set(chave, grupoAtual);
  });

  return Array.from(grupos.entries())
    .map(([id, itens]) => {
      const cotacoesOrdenadas = [...itens].sort(ordenarPorRegistroMaisRecente);
      const cotacaoMaisRecente = cotacoesOrdenadas[0];
      const valores = cotacoesOrdenadas
        .map((cotacao) => cotacao.valorTotal)
        .filter((valor): valor is number => typeof valor === 'number');
      const produtosOfertados = Array.from(new Set(
        cotacoesOrdenadas.flatMap((cotacao) => cotacao.produtosOfertados ?? [])
      ));
      const cotacaoComObservacao = cotacoesOrdenadas.find((cotacao) => cotacao.observacao?.trim());

      return {
        id,
        cotacoes: cotacoesOrdenadas,
        cliente: cotacaoMaisRecente.cliente,
        telefone: cotacaoMaisRecente.telefone,
        origem: cotacaoMaisRecente.origem,
        destino: cotacaoMaisRecente.destino,
        dataIda: cotacaoMaisRecente.dataIda,
        dataVolta: cotacaoMaisRecente.dataVolta,
        menorValor: valores.length > 0 ? Math.min(...valores) : undefined,
        maiorValor: valores.length > 0 ? Math.max(...valores) : undefined,
        cotacaoMaisRecente,
        produtosOfertados,
        observacao: cotacaoComObservacao?.observacao,
      };
    })
    .sort((a, b) => ordenarPorRegistroMaisRecente(a.cotacaoMaisRecente, b.cotacaoMaisRecente));
}

export function montarCamposPesquisaOportunidade(oportunidade: LeadOpportunity) {
  return [
    oportunidade.cliente,
    oportunidade.telefone,
    oportunidade.origem,
    oportunidade.destino,
    oportunidade.dataIda,
    oportunidade.dataVolta,
    oportunidade.cotacaoMaisRecente.leadStatus,
    oportunidade.menorValor,
    oportunidade.maiorValor,
    ...oportunidade.produtosOfertados,
    oportunidade.observacao,
    ...oportunidade.cotacoes.flatMap((cotacao) => [
      cotacao.telefone,
      cotacao.telefoneNormalizado,
      cotacao.companhia,
      cotacao.companhiaIda,
      cotacao.companhiaVolta,
      ...(cotacao.produtosOfertados ?? []),
      cotacao.observacao,
      cotacao.leadStatus,
      cotacao.valorTotal,
    ]),
  ];
}

export function montarPayloadTelefoneCotacao(telefone: string) {
  return {
    telefone,
    telefoneNormalizado: normalizarTelefoneCliente(telefone),
  };
}

export function atualizarTelefoneCotacaoPorId(
  cotacoes: Cotacao[],
  cotacaoId: string,
  telefone: string
) {
  const dadosAtualizados = montarPayloadTelefoneCotacao(telefone);
  return cotacoes.map((cotacao) => (
    cotacao.id === cotacaoId ? { ...cotacao, ...dadosAtualizados } : cotacao
  ));
}

export async function persistirTelefoneCotacao(
  cotacaoId: string,
  telefone: string,
  atualizar: typeof atualizarCotacao = atualizarCotacao
) {
  const dadosAtualizados = montarPayloadTelefoneCotacao(telefone);
  await atualizar(cotacaoId, dadosAtualizados);
  return dadosAtualizados;
}

export interface IdentidadeSessaoLeads {
  userId: string | undefined;
  geracao: number;
}

export interface SessaoInteracaoLeads {
  identidade: IdentidadeSessaoLeads;
  usuario: { uid: string };
}

interface SessaoPodeMutarLeadsParams {
  userAtual: { uid: string } | null | undefined;
  sessaoInstalada: SessaoInteracaoLeads | null;
  identidadePublicada: IdentidadeSessaoLeads;
  identidadeRefAtual: IdentidadeSessaoLeads;
  identidadeCapturada?: IdentidadeSessaoLeads;
  ownerId?: string;
  cotacaoAindaValida?: boolean;
}

export function identidadeSessaoLeadsCorresponde(
  atual: IdentidadeSessaoLeads,
  capturada: IdentidadeSessaoLeads
) {
  return atual.userId === capturada.userId
    && atual.geracao === capturada.geracao;
}

export function avancarIdentidadeSessaoLeads(
  atual: IdentidadeSessaoLeads,
  userId: string | undefined
): IdentidadeSessaoLeads {
  return {
    userId,
    geracao: atual.geracao + 1,
  };
}

export function sessaoLeadsProntaParaInteracao(
  usuario: { uid: string } | null | undefined,
  sessaoInstalada: SessaoInteracaoLeads | null,
  identidadePublicada: IdentidadeSessaoLeads,
  identidadeRefAtual: IdentidadeSessaoLeads
) {
  return sessaoPodeMutarLeads({
    userAtual: usuario,
    sessaoInstalada,
    identidadePublicada,
    identidadeRefAtual,
  });
}

export function sessaoPodeMutarLeads({
  userAtual,
  sessaoInstalada,
  identidadePublicada,
  identidadeRefAtual,
  identidadeCapturada,
  ownerId,
  cotacaoAindaValida = true,
}: SessaoPodeMutarLeadsParams) {
  return Boolean(
    userAtual
    && sessaoInstalada
    && sessaoInstalada.usuario === userAtual
    && sessaoInstalada.identidade.userId === userAtual.uid
    && identidadeSessaoLeadsCorresponde(
      sessaoInstalada.identidade,
      identidadePublicada
    )
    && identidadeSessaoLeadsCorresponde(
      sessaoInstalada.identidade,
      identidadeRefAtual
    )
    && (
      !identidadeCapturada
      || identidadeSessaoLeadsCorresponde(
        identidadeCapturada,
        identidadeRefAtual
      )
    )
    && (ownerId === undefined || ownerId === userAtual.uid)
    && cotacaoAindaValida
  );
}

export function podeIniciarMutacaoCotacao(
  cotacao: Cotacao,
  usuario: { uid: string } | null | undefined,
  sessaoInstalada: SessaoInteracaoLeads | null,
  identidadePublicada: IdentidadeSessaoLeads,
  identidadeRefAtual: IdentidadeSessaoLeads,
  cotacaoAindaValida = true
) {
  return sessaoPodeMutarLeads({
    userAtual: usuario,
    sessaoInstalada,
    identidadePublicada,
    identidadeRefAtual,
    ownerId: cotacao.ownerId,
    cotacaoAindaValida,
  });
}

export const podeIniciarEdicaoTelefone = podeIniciarMutacaoCotacao;

export function montarPayloadEdicaoComercial(
  leadStatus: LeadStatus,
  produtosOfertados: ProdutoOfertado[],
  observacao: string
) {
  return {
    leadStatus,
    produtosOfertados,
    observacao: observacao.trim(),
  };
}

export function atualizarCotacaoComercialPorId(
  cotacoes: Cotacao[],
  cotacaoId: string,
  dadosComerciais: ReturnType<typeof montarPayloadEdicaoComercial>
) {
  return cotacoes.map((item) => (
    item.id === cotacaoId ? { ...item, ...dadosComerciais } : item
  ));
}

function formatarCompanhias(cotacao: Cotacao) {
  if (cotacao.companhiaIda || cotacao.companhiaVolta) {
    const ida = cotacao.companhiaIda || cotacao.companhia;
    const volta = cotacao.companhiaVolta;
    return volta ? `Ida: ${ida} / Volta: ${volta}` : `Ida: ${ida}`;
  }

  return cotacao.companhia;
}

function formatarHorario(label: string, saida?: string, chegada?: string) {
  if (!saida && !chegada) return null;
  return `${label}: ${saida || '-'} → ${chegada || '-'}`;
}

function getHorariosVolta(cotacao: Cotacao) {
  const cotacaoComVolta = cotacao as CotacaoComHorariosVolta;
  return {
    saida: cotacaoComVolta.horaSaidaVolta,
    chegada: cotacaoComVolta.horaChegadaVolta,
  };
}

function normalizarLeadStatus(status?: string): LeadStatus {
  const statusEncontrado = LEAD_STATUS_OPTIONS.find((option) => option.value === status);
  return statusEncontrado?.value ?? 'novo';
}

function normalizarProdutosOfertados(produtos?: string[]): ProdutoOfertado[] {
  return (produtos ?? []).filter((produto): produto is ProdutoOfertado =>
    PRODUTOS_OFERTADOS_OPTIONS.some((option) => option.value === produto)
  );
}

function LeadsContent() {
  const { user, accessProfile, profileLoading } = useAuth();
  const userId = user?.uid;
  const identidadeSessaoRef = useRef<IdentidadeSessaoLeads>({
    userId: undefined,
    geracao: 0,
  });
  const [identidadeSessaoAtual, setIdentidadeSessaoAtual] = useState<IdentidadeSessaoLeads>({
    userId: undefined,
    geracao: 0,
  });
  const [identidadeRefAtualVisual, setIdentidadeRefAtualVisual] = useState<IdentidadeSessaoLeads>({
    userId: undefined,
    geracao: 0,
  });
  const [sessaoInteracao, setSessaoInteracao] = useState<SessaoInteracaoLeads | null>(null);
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('abertos');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [oportunidadeEmConversaoId, setOportunidadeEmConversaoId] = useState<string | null>(null);
  const [clientesAdicionadosIds, setClientesAdicionadosIds] = useState<string[]>([]);
  const [modalComercialAberto, setModalComercialAberto] = useState(false);
  const [cotacaoComercialEmEdicao, setCotacaoComercialEmEdicao] = useState<Cotacao | null>(null);
  const [editLeadStatus, setEditLeadStatus] = useState<LeadStatus>('novo');
  const [editProdutosOfertados, setEditProdutosOfertados] = useState<ProdutoOfertado[]>([]);
  const [editObservacao, setEditObservacao] = useState('');
  const [modalTelefoneAberto, setModalTelefoneAberto] = useState(false);
  const [cotacaoTelefoneEmEdicao, setCotacaoTelefoneEmEdicao] = useState<Cotacao | null>(null);
  const [editTelefone, setEditTelefone] = useState('');
  const [salvandoTelefone, setSalvandoTelefone] = useState(false);
  const [salvandoComercial, setSalvandoComercial] = useState(false);
  const sessaoProntaParaInteracao = sessaoLeadsProntaParaInteracao(
    user ?? undefined,
    sessaoInteracao,
    identidadeSessaoAtual,
    identidadeRefAtualVisual
  );

  useLayoutEffect(() => {
    const identidadeSessao = avancarIdentidadeSessaoLeads(
      identidadeSessaoRef.current,
      userId
    );
    identidadeSessaoRef.current = identidadeSessao;
    setIdentidadeRefAtualVisual(identidadeSessao);

    return () => {
      if (identidadeSessaoLeadsCorresponde(
        identidadeSessaoRef.current,
        identidadeSessao
      )) {
        identidadeSessaoRef.current = avancarIdentidadeSessaoLeads(
          identidadeSessao,
          undefined
        );
        setIdentidadeRefAtualVisual(identidadeSessaoRef.current);
      }
    };
  }, [user, userId]);

  useEffect(() => {
    const identidadeSessao = identidadeSessaoRef.current;
    let instalacaoAtiva = true;

    queueMicrotask(() => {
      if (
        instalacaoAtiva
        && user
        && identidadeSessaoLeadsCorresponde(
          identidadeSessaoRef.current,
          identidadeSessao
        )
      ) {
        setIdentidadeSessaoAtual(identidadeSessao);
        setSessaoInteracao({
          identidade: identidadeSessao,
          usuario: user,
        });
        setModalTelefoneAberto(false);
        setCotacaoTelefoneEmEdicao(null);
        setEditTelefone('');
        setSalvandoTelefone(false);
        setModalComercialAberto(false);
        setCotacaoComercialEmEdicao(null);
        setEditLeadStatus('novo');
        setEditProdutosOfertados([]);
        setEditObservacao('');
        setSalvandoComercial(false);
        setOportunidadeEmConversaoId(null);
        setClientesAdicionadosIds([]);
      }
    });

    return () => {
      instalacaoAtiva = false;
      queueMicrotask(() => {
        setIdentidadeSessaoAtual((identidadeAtual) => (
          identidadeSessaoLeadsCorresponde(identidadeAtual, identidadeSessao)
            ? identidadeSessaoRef.current
            : identidadeAtual
        ));
        setSessaoInteracao((sessaoAtual) => (
          sessaoAtual
          && identidadeSessaoLeadsCorresponde(
            sessaoAtual.identidade,
            identidadeSessao
          )
            ? null
            : sessaoAtual
        ));
        setModalTelefoneAberto(false);
        setCotacaoTelefoneEmEdicao(null);
        setEditTelefone('');
        setSalvandoTelefone(false);
        setModalComercialAberto(false);
        setCotacaoComercialEmEdicao(null);
        setEditLeadStatus('novo');
        setEditProdutosOfertados([]);
        setEditObservacao('');
        setSalvandoComercial(false);
        setOportunidadeEmConversaoId(null);
        setClientesAdicionadosIds([]);
      });
    };
  }, [user, userId]);

  useEffect(() => {
    if (!user) return;

    let buscaAtiva = true;

    const buscarDados = async () => {
      setCarregando(true);

      try {
        const dados = await listarCotacoesDoUsuario(user.uid);

        if (buscaAtiva) {
          setCotacoes(dados);
        }
      } catch (error) {
        console.error('Erro ao buscar leads:', error);
        if (buscaAtiva) {
          setCotacoes([]);
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
  }, [user]);

  const cotacoesFiltradas = useMemo(() => (
    cotacoes.filter((cotacao) => {
      if (filtroStatus === 'abertos') {
        return isLeadStatusAberto(cotacao.leadStatus);
      }

      if (filtroStatus === 'sem_status') {
        return !cotacao.leadStatus;
      }

      return cotacao.leadStatus === filtroStatus;
    })
  ), [cotacoes, filtroStatus]);

  const oportunidades = useMemo(() => (
    agruparCotacoesEmOportunidades(cotacoesFiltradas)
  ), [cotacoesFiltradas]);

  const termoPesquisaNormalizado = normalizeSearchText(termoPesquisa);
  const oportunidadesPesquisadas = useMemo(() => (
    filterBySearch(oportunidades, termoPesquisa, montarCamposPesquisaOportunidade)
  ), [oportunidades, termoPesquisa]);

  const totalAbertos = cotacoes.filter((cotacao) => isLeadStatusAberto(cotacao.leadStatus)).length;
  const totalPerdidos = cotacoes.filter((cotacao) => cotacao.leadStatus === 'perdido').length;
  const totalFechados = cotacoes.filter((cotacao) => cotacao.leadStatus === 'fechado').length;

  const abrirModalTelefone = (cotacao: Cotacao) => {
    if (!podeIniciarEdicaoTelefone(
      cotacao,
      user ?? undefined,
      sessaoInteracao,
      identidadeSessaoAtual,
      identidadeSessaoRef.current,
      cotacoes.some((item) => item.id === cotacao.id)
    )) return;

    setCotacaoTelefoneEmEdicao(cotacao);
    setEditTelefone(cotacao.telefone ?? '');
    setModalTelefoneAberto(true);
  };

  const fecharModalTelefone = () => {
    if (salvandoTelefone) return;
    setModalTelefoneAberto(false);
    setCotacaoTelefoneEmEdicao(null);
  };

  const salvarTelefone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !cotacaoTelefoneEmEdicao
      || !podeIniciarEdicaoTelefone(
        cotacaoTelefoneEmEdicao,
        user ?? undefined,
        sessaoInteracao,
        identidadeSessaoAtual,
        identidadeSessaoRef.current,
        cotacoes.some((item) => item.id === cotacaoTelefoneEmEdicao.id)
      )
    ) return;

    const cotacaoId = cotacaoTelefoneEmEdicao.id;
    const ownerId = cotacaoTelefoneEmEdicao.ownerId;
    const identidadeMutacao = { ...identidadeSessaoRef.current };
    setSalvandoTelefone(true);

    try {
      await persistirTelefoneCotacao(cotacaoId, editTelefone);
      if (!sessaoPodeMutarLeads({
        userAtual: user,
        sessaoInstalada: sessaoInteracao,
        identidadePublicada: identidadeSessaoAtual,
        identidadeRefAtual: identidadeSessaoRef.current,
        identidadeCapturada: identidadeMutacao,
        ownerId,
        cotacaoAindaValida: cotacoes.some((item) => item.id === cotacaoId),
      })) return;

      setCotacoes((cotacoesAtuais) => (
        cotacoesAtuais.some((item) => item.id === cotacaoId && item.ownerId === userId)
          ? atualizarTelefoneCotacaoPorId(cotacoesAtuais, cotacaoId, editTelefone)
          : cotacoesAtuais
      ));
      setModalTelefoneAberto(false);
      setCotacaoTelefoneEmEdicao(null);
      setEditTelefone('');
    } catch (error) {
      if (!sessaoPodeMutarLeads({
        userAtual: user,
        sessaoInstalada: sessaoInteracao,
        identidadePublicada: identidadeSessaoAtual,
        identidadeRefAtual: identidadeSessaoRef.current,
        identidadeCapturada: identidadeMutacao,
        ownerId,
        cotacaoAindaValida: cotacoes.some((item) => item.id === cotacaoId),
      })) return;

      console.error('Erro ao salvar telefone da cotação:', error);
      alert('Erro ao salvar telefone.');
    } finally {
      if (sessaoPodeMutarLeads({
        userAtual: user,
        sessaoInstalada: sessaoInteracao,
        identidadePublicada: identidadeSessaoAtual,
        identidadeRefAtual: identidadeSessaoRef.current,
        identidadeCapturada: identidadeMutacao,
        ownerId,
        cotacaoAindaValida: cotacoes.some((item) => item.id === cotacaoId),
      })) {
        setSalvandoTelefone(false);
      }
    }
  };

  const abrirModalComercial = (item: Cotacao) => {
    if (!podeIniciarMutacaoCotacao(
      item,
      user,
      sessaoInteracao,
      identidadeSessaoAtual,
      identidadeSessaoRef.current,
      cotacoes.some((cotacao) => cotacao.id === item.id)
    )) return;

    setCotacaoComercialEmEdicao(item);
    setEditLeadStatus(normalizarLeadStatus(item.leadStatus));
    setEditProdutosOfertados(normalizarProdutosOfertados(item.produtosOfertados));
    setEditObservacao(item.observacao ?? '');
    setModalComercialAberto(true);
  };

  const fecharModalComercial = () => {
    if (salvandoComercial) return;
    setModalComercialAberto(false);
    setCotacaoComercialEmEdicao(null);
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
    if (
      !cotacaoComercialEmEdicao
      || !podeIniciarMutacaoCotacao(
        cotacaoComercialEmEdicao,
        user,
        sessaoInteracao,
        identidadeSessaoAtual,
        identidadeSessaoRef.current,
        cotacoes.some((item) => item.id === cotacaoComercialEmEdicao.id)
      )
    ) return;

    const cotacaoId = cotacaoComercialEmEdicao.id;
    const ownerId = cotacaoComercialEmEdicao.ownerId;
    const identidadeMutacao = { ...identidadeSessaoRef.current };
    const dadosComerciais = montarPayloadEdicaoComercial(
      editLeadStatus,
      editProdutosOfertados,
      editObservacao
    );
    setSalvandoComercial(true);

    try {
      await atualizarCotacao(cotacaoId, dadosComerciais);
      if (!sessaoPodeMutarLeads({
        userAtual: user,
        sessaoInstalada: sessaoInteracao,
        identidadePublicada: identidadeSessaoAtual,
        identidadeRefAtual: identidadeSessaoRef.current,
        identidadeCapturada: identidadeMutacao,
        ownerId,
        cotacaoAindaValida: cotacoes.some((item) => item.id === cotacaoId),
      })) return;

      setCotacoes((cotacoesAtuais) => (
        cotacoesAtuais.some((item) => item.id === cotacaoId && item.ownerId === userId)
          ? atualizarCotacaoComercialPorId(cotacoesAtuais, cotacaoId, dadosComerciais)
          : cotacoesAtuais
      ));

      setModalComercialAberto(false);
      setCotacaoComercialEmEdicao(null);
    } catch (error) {
      if (!sessaoPodeMutarLeads({
        userAtual: user,
        sessaoInstalada: sessaoInteracao,
        identidadePublicada: identidadeSessaoAtual,
        identidadeRefAtual: identidadeSessaoRef.current,
        identidadeCapturada: identidadeMutacao,
        ownerId,
        cotacaoAindaValida: cotacoes.some((item) => item.id === cotacaoId),
      })) return;

      console.error('Erro ao salvar dados comerciais:', error);
      alert('Erro ao salvar dados comerciais.');
    } finally {
      if (sessaoPodeMutarLeads({
        userAtual: user,
        sessaoInstalada: sessaoInteracao,
        identidadePublicada: identidadeSessaoAtual,
        identidadeRefAtual: identidadeSessaoRef.current,
        identidadeCapturada: identidadeMutacao,
        ownerId,
        cotacaoAindaValida: cotacoes.some((item) => item.id === cotacaoId),
      })) {
        setSalvandoComercial(false);
      }
    }
  };

  const adicionarOportunidadeAosClientes = async (oportunidade: LeadOpportunity) => {
    if (!user) return;

    const cotacaoReferencia = oportunidade.cotacaoMaisRecente;
    if (!podeIniciarMutacaoCotacao(
      cotacaoReferencia,
      user,
      sessaoInteracao,
      identidadeSessaoAtual,
      identidadeSessaoRef.current,
      cotacoes.some((item) => item.id === cotacaoReferencia.id)
    )) return;

    if (cotacaoReferencia.leadStatus !== 'fechado') {
      alert('Somente oportunidades marcadas como fechado podem virar cliente.');
      return;
    }

    const nomeCliente = cotacaoReferencia.cliente?.trim() || 'Cliente sem nome';
    const confirmar = window.confirm(`Adicionar ${nomeCliente} à carteira de clientes?`);
    if (!confirmar) {
      return;
    }

    const identidadeMutacao = { ...identidadeSessaoRef.current };
    const userIdMutacao = user.uid;
    const operacaoAindaValida = () => sessaoPodeMutarLeads({
      userAtual: user,
      sessaoInstalada: sessaoInteracao,
      identidadePublicada: identidadeSessaoAtual,
      identidadeRefAtual: identidadeSessaoRef.current,
      identidadeCapturada: identidadeMutacao,
      ownerId: cotacaoReferencia.ownerId,
      cotacaoAindaValida: cotacoes.some((item) => item.id === cotacaoReferencia.id),
    });
    if (!operacaoAindaValida()) return;
    setOportunidadeEmConversaoId(oportunidade.id);

    try {
      const clientesExistentes = await listarClientesDoUsuario(userIdMutacao);
      if (!operacaoAindaValida()) return;
      const agencyIdParaCriacao = profileLoading
        ? ''
        : accessProfile.agencyId ?? DEFAULT_AGENCY_ID;
      const resultado = await converterCotacaoFechadaEmCliente({
        cotacao: cotacaoReferencia,
        userId: userIdMutacao,
        agencyId: agencyIdParaCriacao,
        formatarData,
        clientesExistentes,
        criarCliente,
      });
      if (!operacaoAindaValida()) return;

      if (resultado.status === 'duplicate') {
        alert('Este cliente já existe na carteira.');
        return;
      }

      if (resultado.status === 'not_closed') {
        alert('Somente oportunidades marcadas como fechado podem virar cliente.');
        return;
      }

      if (resultado.status === 'missing_agency') {
        alert('Não foi possível identificar a agência do seu perfil. Aguarde o carregamento do perfil e tente novamente.');
        return;
      }

      setClientesAdicionadosIds((ids) => [...ids, oportunidade.id]);
      alert('Cliente adicionado à carteira com sucesso.');
    } catch (error) {
      if (!operacaoAindaValida()) return;
      console.error('Erro ao adicionar cliente a partir da oportunidade:', error);
      alert('Erro ao adicionar cliente.');
    } finally {
      if (operacaoAindaValida()) {
        setOportunidadeEmConversaoId(null);
      }
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <div>
            <h1 className="border-l-4 border-blue-600 pl-4 text-3xl font-bold text-blue-900">
              Leads comerciais
            </h1>
            <p className="mt-2 pl-5 text-sm font-medium text-slate-500">
              Acompanhamento comercial de cotações ainda abertas.
            </p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border-l-4 border-blue-500 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase text-gray-500">Abertos</h3>
            <p className="mt-2 text-3xl font-bold text-gray-800">{totalAbertos}</p>
          </div>
          <div className="rounded-xl border-l-4 border-green-500 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase text-gray-500">Fechados</h3>
            <p className="mt-2 text-3xl font-bold text-gray-800">{totalFechados}</p>
          </div>
          <div className="rounded-xl border-l-4 border-slate-400 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase text-gray-500">Perdidos</h3>
            <p className="mt-2 text-3xl font-bold text-gray-800">{totalPerdidos}</p>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(220px,280px)_1fr]">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Filtro de status</span>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="abertos">Leads abertos</option>
                {LEAD_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
                <option value="sem_status">Sem status comercial</option>
              </select>
            </label>
            <div>
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Pesquisa</span>
              <SearchInput
                value={termoPesquisa}
                onChange={setTermoPesquisa}
                placeholder="Pesquisar por cliente, telefone, rota, companhia ou produto"
                ariaLabel="Pesquisar oportunidades"
              />
            </div>
          </div>
          {!carregando && cotacoesFiltradas.length > 0 && (
            <p className="mt-3 text-xs font-semibold text-slate-500">
              {termoPesquisaNormalizado
                ? `${oportunidadesPesquisadas.length} ${oportunidadesPesquisadas.length === 1 ? 'oportunidade encontrada' : 'oportunidades encontradas'} em ${oportunidades.length} ${oportunidades.length === 1 ? 'oportunidade' : 'oportunidades'}`
                : `${oportunidades.length} ${oportunidades.length === 1 ? 'oportunidade carregada' : 'oportunidades carregadas'}`}
            </p>
          )}
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-600"></div>
          </div>
        ) : cotacoesFiltradas.length === 0 ? (
          <EmptyState
            title="Nenhuma oportunidade encontrada"
            description="Não há leads para o filtro selecionado. Revise os status comerciais no histórico ou crie uma nova cotação para iniciar um acompanhamento."
            actions={[
              { href: '/historico', label: 'Revisar histórico' },
              { href: '/', label: 'Criar nova cotação', variant: 'secondary' },
            ]}
          />
        ) : oportunidadesPesquisadas.length === 0 ? (
          <EmptyState
            title={`Nenhum resultado encontrado para "${termoPesquisa.trim()}".`}
            description="Tente pesquisar por cliente, telefone, rota, companhia, produto ou status."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {oportunidadesPesquisadas.map((oportunidade) => (
              <article key={oportunidade.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{oportunidade.cliente}</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {oportunidade.telefone || 'Sem telefone'}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {oportunidade.origem} &rarr; {oportunidade.destino}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">
                    {formatarLeadStatus(oportunidade.cotacaoMaisRecente.leadStatus)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Ida</p>
                    <p className="mt-1 font-bold text-slate-700">{formatarData(oportunidade.dataIda)}</p>
                    {oportunidade.dataVolta && (
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Volta: {formatarData(oportunidade.dataVolta)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Registro recente</p>
                    <p className="mt-1 font-bold text-slate-700">{formatarData(oportunidade.cotacaoMaisRecente.dataRegistro)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Valores</p>
                    <p className="mt-1 font-black text-green-700">
                      {formatarValor(oportunidade.menorValor)}
                      {typeof oportunidade.maiorValor === 'number' && oportunidade.maiorValor !== oportunidade.menorValor
                        ? ` a ${formatarValor(oportunidade.maiorValor)}`
                        : ''}
                    </p>
                  </div>
                </div>

                <p className="mt-4 w-fit rounded-lg bg-slate-50 px-3 py-2 text-xs font-black uppercase text-slate-600">
                  {oportunidade.cotacoes.length} {oportunidade.cotacoes.length === 1 ? 'cotação relacionada' : 'cotações relacionadas'}
                </p>

                {sessaoProntaParaInteracao
                  && oportunidade.cotacaoMaisRecente.leadStatus === 'fechado' && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => adicionarOportunidadeAosClientes(oportunidade)}
                      disabled={profileLoading || oportunidadeEmConversaoId === oportunidade.id || clientesAdicionadosIds.includes(oportunidade.id)}
                      className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-black uppercase text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {clientesAdicionadosIds.includes(oportunidade.id)
                        ? 'Cliente já adicionado'
                        : oportunidadeEmConversaoId === oportunidade.id
                          ? 'Adicionando...'
                          : profileLoading
                            ? 'Carregando perfil...'
                            : 'Adicionar aos clientes'}
                    </button>
                  </div>
                )}

                {oportunidade.produtosOfertados.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {oportunidade.produtosOfertados.map((produto) => (
                      <span key={produto} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                        {formatarProdutoOfertado(produto)}
                      </span>
                    ))}
                  </div>
                )}

                {oportunidade.observacao && (
                  <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-600">
                    {oportunidade.observacao}
                  </p>
                )}

                <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                  {oportunidade.cotacoes.map((cotacao) => {
                    const viagem = montarDadosViagemCotacao(cotacao);
                    const horarioIda = formatarHorario('Ida', cotacao.horaSaidaIda, cotacao.horaChegadaIda);
                    const horariosVolta = getHorariosVolta(cotacao);
                    const horarioVolta = formatarHorario(
                      'Volta',
                      horariosVolta.saida,
                      horariosVolta.chegada
                    );

                    return (
                      <div key={cotacao.id} className="rounded-lg border border-slate-100 bg-white p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-black text-slate-800">{formatarCompanhias(cotacao)}</p>
                            <div className="mt-1 space-y-0.5 text-xs font-semibold text-slate-500">
                              <p>Rota: {viagem.rota}</p>
                              <p>Ida: {formatarData(viagem.dataIda)}</p>
                              {viagem.dataVolta && (
                                <p>Volta: {formatarData(viagem.dataVolta)}</p>
                              )}
                              <p>Telefone: {cotacao.telefone || 'Sem telefone'}</p>
                              {horarioIda && <p>{horarioIda}</p>}
                              {horarioVolta && <p>{horarioVolta}</p>}
                              {!horarioIda && !horarioVolta && <p>Horários não informados</p>}
                            </div>
                          </div>
                          <div className="sm:text-right">
                            <p className="text-sm font-black text-green-700">{formatarValor(cotacao.valorTotal)}</p>
                            <p className="mt-1 text-[11px] font-black uppercase text-blue-700">
                              {formatarLeadStatus(cotacao.leadStatus)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {podeIniciarMutacaoCotacao(
                            cotacao,
                            user,
                            sessaoInteracao,
                            identidadeSessaoAtual,
                            identidadeRefAtualVisual
                          ) && (
                            <button
                              type="button"
                              onClick={() => abrirModalComercial(cotacao)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase text-slate-700 transition hover:bg-slate-100"
                            >
                              Editar comercial
                            </button>
                          )}
                          {podeIniciarMutacaoCotacao(
                            cotacao,
                            user,
                            sessaoInteracao,
                            identidadeSessaoAtual,
                            identidadeRefAtualVisual
                          ) && (
                            <button
                              type="button"
                              onClick={() => abrirModalTelefone(cotacao)}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black uppercase text-blue-700 transition hover:bg-blue-100"
                            >
                              Editar telefone
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {sessaoProntaParaInteracao
        && modalTelefoneAberto
        && cotacaoTelefoneEmEdicao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-800">Editar telefone da cotação</h2>
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <p className="font-black text-slate-800">{formatarCompanhias(cotacaoTelefoneEmEdicao)}</p>
              <p className="mt-1 font-semibold">
                {cotacaoTelefoneEmEdicao.origem} → {cotacaoTelefoneEmEdicao.destino}
              </p>
              <p className="mt-1">
                {formatarData(cotacaoTelefoneEmEdicao.dataIda)}
                {' · '}
                {formatarValor(cotacaoTelefoneEmEdicao.valorTotal)}
              </p>
              <p className="mt-1 text-xs font-semibold">
                {formatarHorario(
                  'Ida',
                  cotacaoTelefoneEmEdicao.horaSaidaIda,
                  cotacaoTelefoneEmEdicao.horaChegadaIda
                ) || 'Horário não informado'}
              </p>
              {oportunidades.some(
                (oportunidade) => oportunidade.cotacaoMaisRecente.id === cotacaoTelefoneEmEdicao.id
              ) && (
                <p className="mt-2 text-xs font-black uppercase text-blue-700">Cotação mais recente</p>
              )}
            </div>

            <form onSubmit={salvarTelefone} className="mt-5 flex flex-col gap-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-600">Telefone / WhatsApp</span>
                <input
                  type="tel"
                  value={editTelefone}
                  onChange={(e) => setEditTelefone(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={salvandoTelefone || !sessaoProntaParaInteracao}
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={fecharModalTelefone}
                  disabled={salvandoTelefone || !sessaoProntaParaInteracao}
                  className="rounded-lg px-4 py-2 font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoTelefone || !sessaoProntaParaInteracao}
                  className="rounded-lg bg-blue-600 px-6 py-2 font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-60"
                >
                  {salvandoTelefone ? 'Salvando...' : 'Salvar telefone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sessaoProntaParaInteracao && modalComercialAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-1 text-xl font-bold text-slate-800">Editar comercial</h2>
            <p className="mb-5 text-sm font-medium text-slate-500">
              {cotacaoComercialEmEdicao?.cliente}
            </p>

            <form onSubmit={salvarEdicaoComercial} className="flex flex-col gap-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-600">Status comercial</span>
                <select
                  value={editLeadStatus}
                  onChange={(e) => setEditLeadStatus(e.target.value as LeadStatus)}
                  disabled={salvandoComercial || !sessaoProntaParaInteracao}
                  className="mt-1 w-full rounded-lg border bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
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
                        disabled={salvandoComercial || !sessaoProntaParaInteracao}
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
                  disabled={salvandoComercial || !sessaoProntaParaInteracao}
                  className="mt-1 min-h-28 w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Observações internas sobre o acompanhamento"
                />
              </label>

              <div className="mt-2 flex justify-end gap-3">
                <button type="button" onClick={fecharModalComercial} disabled={salvandoComercial || !sessaoProntaParaInteracao} className="rounded-lg px-4 py-2 font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-60">
                  Cancelar
                </button>
                <button type="submit" disabled={salvandoComercial || !sessaoProntaParaInteracao} className="rounded-lg bg-blue-600 px-6 py-2 font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-60">
                  {salvandoComercial ? 'Salvando...' : 'Salvar comercial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Leads() {
  return (
    <AuthGuard>
      <LeadsContent />
    </AuthGuard>
  );
}
