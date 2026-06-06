'use client';

import { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import AuthGuard from '../../components/AuthGuard';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { listarCotacoesDoUsuario } from '../../services/cotacoesService';
import type { Cotacao } from '../../types';
import {
  LEAD_STATUS_OPTIONS,
  formatarLeadStatus,
  formatarProdutoOfertado,
  isLeadStatusAberto,
  type LeadStatus,
} from '../../lib/leadUtils';

type FiltroStatus = 'abertos' | 'sem_status' | LeadStatus;

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

function LeadsContent() {
  const { user } = useAuth();
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('abertos');

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

  const totalAbertos = cotacoes.filter((cotacao) => isLeadStatusAberto(cotacao.leadStatus)).length;
  const totalPerdidos = cotacoes.filter((cotacao) => cotacao.leadStatus === 'perdido').length;
  const totalFechados = cotacoes.filter((cotacao) => cotacao.leadStatus === 'fechado').length;

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
          <label className="block max-w-xs">
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
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {cotacoesFiltradas.map((cotacao) => (
              <article key={cotacao.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{cotacao.cliente}</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {cotacao.telefone || 'Sem telefone'}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {cotacao.origem} &rarr; {cotacao.destino}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">
                    {formatarLeadStatus(cotacao.leadStatus)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Viagem</p>
                    <p className="mt-1 font-bold text-slate-700">{formatarData(cotacao.dataIda)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Registro</p>
                    <p className="mt-1 font-bold text-slate-700">{formatarData(cotacao.dataRegistro)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Valor</p>
                    <p className="mt-1 font-black text-green-700">{formatarValor(cotacao.valorTotal)}</p>
                  </div>
                </div>

                {cotacao.produtosOfertados && cotacao.produtosOfertados.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {cotacao.produtosOfertados.map((produto) => (
                      <span key={produto} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                        {formatarProdutoOfertado(produto)}
                      </span>
                    ))}
                  </div>
                )}

                {cotacao.observacao && (
                  <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-600">
                    {cotacao.observacao}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
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
