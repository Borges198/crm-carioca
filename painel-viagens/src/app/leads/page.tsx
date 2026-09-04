'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import AuthGuard from '../../components/AuthGuard';
import EmptyState from '../../components/EmptyState';
import SearchInput from '../../components/SearchInput';
import { useAuth } from '../../context/AuthContext';
import { criarCliente, listarClientesDoUsuario } from '../../services/clientesService';
import { atualizarCotacao, listarCotacoesDoUsuario } from '../../services/cotacoesService';
import {
  atualizarProximaAcao,
  listarAcompanhamentosDoUsuario,
  materializarAcompanhamento,
} from '../../services/acompanhamentosService';
import { DEFAULT_AGENCY_ID } from '../../types';
import type { Acompanhamento, Cotacao, TipoProximaAcao } from '../../types';
import {
  LEAD_STATUS_OPTIONS,
  formatarLeadStatus,
  formatarProdutoOfertado,
  isLeadStatusAberto,
  type LeadStatus,
} from '../../lib/leadUtils';
import {
  converterCotacaoFechadaEmCliente,
  normalizarTelefoneCliente,
} from '../../utils/clienteConversionUtils';
import { filterBySearch, normalizeSearchText } from '../../utils/searchUtils';
import {
  atualizarAcompanhamentoLocalmente,
  classificarProximaAcao,
  formatarDataComercial,
  formatarDataComercialParaInput,
  normalizarDataComercialParaTimestamp,
  ordenarPorProximaAcao,
  resolverTipoProximaAcao,
  vincularCotacoesLocalmente,
  type ClassificacaoRecorrenciaProximaAcao,
} from '../../utils/acompanhamentoUtils';
import { persistirProximaAcaoCartela } from '../../utils/acompanhamentoIntegration';

type FiltroStatus = 'abertos' | 'sem_status' | LeadStatus;
export const TEXTO_ORIENTATIVO_LEADS_LEITURA_COMERCIAL = 'Leads é uma visão de acompanhamento por cliente. Para alterar status, produtos ou observações de uma cotação, use o Histórico.';

export const OPCOES_TIPO_PROXIMA_ACAO = [
  { value: 'DATA', label: 'Escolher uma data' },
  { value: 'DIARIA', label: 'Diariamente' },
  { value: 'SEM_DATA', label: 'Sem próxima ação no momento' },
] as const satisfies ReadonlyArray<{ value: TipoProximaAcao; label: string }>;

export const CLASSIFICACAO_PROXIMA_ACAO_CLASSES: Record<
  ClassificacaoRecorrenciaProximaAcao,
  string
> = {
  'NÃO DEFINIDA': 'border-slate-200 bg-slate-100 text-slate-600',
  ATRASADA: 'border-red-200 bg-red-100 text-red-700',
  HOJE: 'border-amber-300 bg-amber-100 text-amber-800',
  'DIÁRIA': 'border-violet-200 bg-violet-100 text-violet-700',
  'PRÓXIMA': 'border-blue-200 bg-blue-100 text-blue-700',
  'SEM PRÓXIMA AÇÃO': 'border-slate-200 bg-white text-slate-600',
};

export function montarDadosPersistenciaProximaAcao(
  tipoProximaAcao: TipoProximaAcao,
  data: string
) {
  return {
    tipoProximaAcao,
    proximaAcaoEm: tipoProximaAcao === 'DATA'
      ? normalizarDataComercialParaTimestamp(data)
      : null,
  };
}

export function formatarProximaAcaoNoCard(
  acompanhamento?: Pick<Acompanhamento, 'tipoProximaAcao' | 'proximaAcaoEm'>
) {
  if (!acompanhamento) return formatarDataComercial(null);
  const classificacao = classificarProximaAcao(acompanhamento);
  if (classificacao === 'DIÁRIA' || classificacao === 'SEM PRÓXIMA AÇÃO') {
    return classificacao;
  }
  return formatarDataComercial(acompanhamento.proximaAcaoEm);
}

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
  const acompanhamentoId = cotacao.acompanhamentoId?.trim();
  if (acompanhamentoId) {
    return `owner:${ownerId}|acompanhamento:${acompanhamentoId}`;
  }

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

export function obterCotacoesDaCartela(
  oportunidade: LeadOpportunity
) {
  return [...oportunidade.cotacoes];
}

export function obterAcompanhamentoDaOportunidade(
  oportunidade: LeadOpportunity,
  acompanhamentos: Acompanhamento[]
) {
  const acompanhamentoId = oportunidade.cotacoes[0]?.acompanhamentoId?.trim();
  return acompanhamentoId
    ? acompanhamentos.find((item) => item.id === acompanhamentoId)
    : undefined;
}

export function ordenarOportunidadesPorProximaAcao(
  oportunidades: LeadOpportunity[],
  acompanhamentos: Acompanhamento[],
  hoje?: Date
) {
  return ordenarPorProximaAcao(
    oportunidades,
    (oportunidade) => {
      const acompanhamento = obterAcompanhamentoDaOportunidade(
        oportunidade,
        acompanhamentos
      );
      return {
        tipoProximaAcao: acompanhamento?.tipoProximaAcao,
        proximaAcaoEm: acompanhamento?.proximaAcaoEm ?? null,
      };
    },
    hoje
  );
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
  const [acompanhamentos, setAcompanhamentos] = useState<Acompanhamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('abertos');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [oportunidadeEmConversaoId, setOportunidadeEmConversaoId] = useState<string | null>(null);
  const [clientesAdicionadosIds, setClientesAdicionadosIds] = useState<string[]>([]);
  const [modalTelefoneAberto, setModalTelefoneAberto] = useState(false);
  const [cotacaoTelefoneEmEdicao, setCotacaoTelefoneEmEdicao] = useState<Cotacao | null>(null);
  const [editTelefone, setEditTelefone] = useState('');
  const [salvandoTelefone, setSalvandoTelefone] = useState(false);
  const [modalProximaAcaoAberto, setModalProximaAcaoAberto] = useState(false);
  const [oportunidadeProximaAcao, setOportunidadeProximaAcao] = useState<LeadOpportunity | null>(null);
  const [editTipoProximaAcao, setEditTipoProximaAcao] = useState<TipoProximaAcao>('DATA');
  const [editProximaAcaoEm, setEditProximaAcaoEm] = useState('');
  const [salvandoProximaAcao, setSalvandoProximaAcao] = useState(false);
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
        setModalProximaAcaoAberto(false);
        setOportunidadeProximaAcao(null);
        setEditTipoProximaAcao('DATA');
        setEditProximaAcaoEm('');
        setSalvandoProximaAcao(false);
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
        setModalProximaAcaoAberto(false);
        setOportunidadeProximaAcao(null);
        setEditTipoProximaAcao('DATA');
        setEditProximaAcaoEm('');
        setSalvandoProximaAcao(false);
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
        const [dadosCotacoes, dadosAcompanhamentos] = await Promise.all([
          listarCotacoesDoUsuario(user.uid),
          listarAcompanhamentosDoUsuario(user.uid),
        ]);

        if (buscaAtiva) {
          setCotacoes(dadosCotacoes);
          setAcompanhamentos(dadosAcompanhamentos);
        }
      } catch (error) {
        console.error('Erro ao buscar leads:', error);
        if (buscaAtiva) {
          setCotacoes([]);
          setAcompanhamentos([]);
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

  const oportunidadesOrdenadas = useMemo(() => ordenarOportunidadesPorProximaAcao(
    oportunidadesPesquisadas,
    acompanhamentos
  ), [acompanhamentos, oportunidadesPesquisadas]);

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

  const abrirModalProximaAcao = (oportunidade: LeadOpportunity) => {
    if (!sessaoProntaParaInteracao || !user) return;

    const cotacoesCartela = obterCotacoesDaCartela(oportunidade);
    if (
      cotacoesCartela.length === 0
      || cotacoesCartela.some((cotacao) => cotacao.ownerId !== user.uid)
    ) return;

    const acompanhamentoId = oportunidade.cotacoes[0]?.acompanhamentoId;
    const acompanhamento = obterAcompanhamentoDaOportunidade(
      oportunidade,
      acompanhamentos
    );
    if (acompanhamentoId && !acompanhamento) {
      alert('O acompanhamento vinculado não pôde ser carregado. Recarregue a página.');
      return;
    }

    setOportunidadeProximaAcao({
      ...oportunidade,
      cotacoes: cotacoesCartela,
    });
    setEditTipoProximaAcao(
      acompanhamento ? resolverTipoProximaAcao(acompanhamento) ?? 'DATA' : 'DATA'
    );
    setEditProximaAcaoEm(
      formatarDataComercialParaInput(acompanhamento?.proximaAcaoEm ?? null)
    );
    setModalProximaAcaoAberto(true);
  };

  const fecharModalProximaAcao = () => {
    if (salvandoProximaAcao) return;
    setModalProximaAcaoAberto(false);
    setOportunidadeProximaAcao(null);
    setEditTipoProximaAcao('DATA');
    setEditProximaAcaoEm('');
  };

  const salvarProximaAcao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !oportunidadeProximaAcao || !sessaoProntaParaInteracao) return;

    const cotacoesCartela = oportunidadeProximaAcao.cotacoes;
    const cotacaoIds = cotacoesCartela.map((cotacao) => cotacao.id);
    if (
      cotacoesCartela.length === 0
      || cotacoesCartela.some((cotacao) => cotacao.ownerId !== user.uid)
    ) return;

    const acompanhamentoExistente = obterAcompanhamentoDaOportunidade(
      oportunidadeProximaAcao,
      acompanhamentos
    );
    const acompanhamentoIdVinculado =
      oportunidadeProximaAcao.cotacoes[0]?.acompanhamentoId;
    if (acompanhamentoIdVinculado && !acompanhamentoExistente) {
      alert('O acompanhamento vinculado não pôde ser carregado. Recarregue a página.');
      return;
    }

    const agencyId = profileLoading ? '' : accessProfile.agencyId?.trim() ?? '';
    if (!acompanhamentoExistente && !agencyId) {
      alert('Não foi possível identificar a agência do seu perfil.');
      return;
    }

    let proximaAcao;
    try {
      proximaAcao = montarDadosPersistenciaProximaAcao(
        editTipoProximaAcao,
        editProximaAcaoEm
      );
    } catch {
      alert('Informe uma data válida para a próxima ação.');
      return;
    }

    const identidadeMutacao = { ...identidadeSessaoRef.current };
    const operacaoAindaValida = () => sessaoPodeMutarLeads({
      userAtual: user,
      sessaoInstalada: sessaoInteracao,
      identidadePublicada: identidadeSessaoAtual,
      identidadeRefAtual: identidadeSessaoRef.current,
      identidadeCapturada: identidadeMutacao,
      ownerId: user.uid,
      cotacaoAindaValida: cotacaoIds.every((id) => (
        cotacoes.some((cotacao) => cotacao.id === id && cotacao.ownerId === user.uid)
      )),
    });
    if (!operacaoAindaValida()) return;

    setSalvandoProximaAcao(true);
    try {
      const resultado = await persistirProximaAcaoCartela({
        acompanhamentoExistente,
        ownerId: user.uid,
        agencyId,
        cotacoes: cotacoesCartela,
        ...proximaAcao,
        confirmarMaterializacao: (quantidade) => window.confirm(
          `Criar acompanhamento para esta cartela?\n\n${quantidade} ${quantidade === 1 ? 'cotação atual será vinculada' : 'cotações atuais serão vinculadas'}.`
        ),
        materializar: materializarAcompanhamento,
        atualizar: atualizarProximaAcao,
      });

      if (resultado.status === 'cancelled' || !operacaoAindaValida()) return;

      setAcompanhamentos((atuais) => atualizarAcompanhamentoLocalmente(
        atuais,
        resultado.acompanhamento
      ));
      if (resultado.status === 'materialized') {
        setCotacoes((atuais) => vincularCotacoesLocalmente(
          atuais,
          cotacaoIds,
          resultado.acompanhamento.id
        ));
      }
      setModalProximaAcaoAberto(false);
      setOportunidadeProximaAcao(null);
      setEditTipoProximaAcao('DATA');
      setEditProximaAcaoEm('');
    } catch (error) {
      if (!operacaoAindaValida()) return;
      console.error('Erro ao salvar próxima ação:', error);
      alert(error instanceof Error ? error.message : 'Erro ao salvar próxima ação.');
    } finally {
      if (operacaoAindaValida()) {
        setSalvandoProximaAcao(false);
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
            <p className="mt-3 max-w-3xl rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
              {TEXTO_ORIENTATIVO_LEADS_LEITURA_COMERCIAL}
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
            {oportunidadesOrdenadas.map((oportunidade) => (
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

                {(() => {
                  const acompanhamentoId = oportunidade.cotacoes[0]?.acompanhamentoId;
                  const acompanhamento = obterAcompanhamentoDaOportunidade(
                    oportunidade,
                    acompanhamentos
                  );
                  const vinculoIndisponivel = Boolean(acompanhamentoId && !acompanhamento);
                  const classificacaoProximaAcao = vinculoIndisponivel
                    ? null
                    : classificarProximaAcao({
                      tipoProximaAcao: acompanhamento?.tipoProximaAcao,
                      proximaAcaoEm: acompanhamento?.proximaAcaoEm ?? null,
                    });

                  return (
                    <section className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[10px] font-black uppercase text-amber-700">Próxima ação</p>
                        {classificacaoProximaAcao && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${CLASSIFICACAO_PROXIMA_ACAO_CLASSES[classificacaoProximaAcao]}`}>
                            {classificacaoProximaAcao}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-black text-slate-800">
                        {vinculoIndisponivel
                          ? 'Acompanhamento indisponível'
                          : formatarProximaAcaoNoCard(acompanhamento)}
                      </p>
                      {sessaoProntaParaInteracao && (
                        <button
                          type="button"
                          onClick={() => abrirModalProximaAcao(oportunidade)}
                          disabled={vinculoIndisponivel || salvandoProximaAcao}
                          className="mt-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-black uppercase text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {acompanhamento ? 'Editar acompanhamento' : 'Definir acompanhamento'}
                        </button>
                      )}
                    </section>
                  );
                })()}

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
        && modalProximaAcaoAberto
        && oportunidadeProximaAcao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-800">Próxima ação</h2>
            {!obterAcompanhamentoDaOportunidade(
              oportunidadeProximaAcao,
              acompanhamentos
            ) && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                Este é o primeiro acompanhamento da cartela. Ao confirmar, todas as cotações
                que atualmente a compõem serão vinculadas ao acompanhamento.
              </p>
            )}

            <form onSubmit={salvarProximaAcao} className="mt-5 flex flex-col gap-4">
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-slate-600">Próxima ação</legend>
                {OPCOES_TIPO_PROXIMA_ACAO.map((opcao) => (
                  <label key={opcao.value} className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="tipoProximaAcao"
                      value={opcao.value}
                      checked={editTipoProximaAcao === opcao.value}
                      onChange={() => setEditTipoProximaAcao(opcao.value)}
                      disabled={salvandoProximaAcao || !sessaoProntaParaInteracao}
                    />
                    {opcao.label}
                  </label>
                ))}
              </fieldset>

              {editTipoProximaAcao === 'DATA' && (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-600">Data</span>
                  <input
                    type="date"
                    value={editProximaAcaoEm}
                    onChange={(e) => setEditProximaAcaoEm(e.target.value)}
                    required
                    disabled={salvandoProximaAcao || !sessaoProntaParaInteracao}
                    className="mt-1 w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </label>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={fecharModalProximaAcao}
                  disabled={salvandoProximaAcao || !sessaoProntaParaInteracao}
                  className="rounded-lg px-4 py-2 font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoProximaAcao || !sessaoProntaParaInteracao}
                  className="rounded-lg bg-amber-600 px-6 py-2 font-bold text-white shadow-md hover:bg-amber-700 disabled:opacity-60"
                >
                  {salvandoProximaAcao ? 'Salvando...' : 'Salvar acompanhamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
