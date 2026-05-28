import { RefObject } from 'react';
import { calcularDuracao } from '../utils/viagemUtils';
import type { Companhia } from '../types';

interface BilhetePreviewProps {
  ticketRef: RefObject<HTMLDivElement | null>;
  companhia: Companhia;
  origem: string;
  destino: string;
  tipoVoo: string;
  dataIda: string;
  horaSaidaIda: string;
  horaChegadaIda: string;
  paradasIda: string;
  dataVolta: string;
  horaSaidaVolta: string;
  horaChegadaVolta: string;
  paradasVolta: string;
}

interface TemaCompanhia {
  text: string;
  bg: string;
  soft: string;
  border: string;
  line: string;
}

interface TrechoCardProps {
  label: string;
  data: string;
  origemTrecho: string;
  destinoTrecho: string;
  horaSaida: string;
  horaChegada: string;
  paradas: string;
  companhia: Companhia;
  tema: TemaCompanhia;
}

function getTemaCompanhia(companhia: Companhia): TemaCompanhia {
  const companhiaKey = companhia.toLowerCase();

  if (companhiaKey === 'gol') {
    return {
      text: 'text-orange-700',
      bg: 'bg-orange-600',
      soft: 'bg-orange-50',
      border: 'border-orange-200',
      line: 'bg-orange-600',
    };
  }

  if (companhiaKey === 'latam') {
    return {
      text: 'text-indigo-900',
      bg: 'bg-indigo-950',
      soft: 'bg-indigo-50',
      border: 'border-indigo-200',
      line: 'bg-indigo-950',
    };
  }

  if (companhiaKey === 'azul') {
    return {
      text: 'text-blue-800',
      bg: 'bg-blue-600',
      soft: 'bg-blue-50',
      border: 'border-blue-200',
      line: 'bg-blue-600',
    };
  }

  return {
    text: 'text-slate-700',
    bg: 'bg-slate-600',
    soft: 'bg-slate-50',
    border: 'border-slate-200',
    line: 'bg-slate-600',
  };
}

function formatarData(data: string) {
  if (!data) {
    return '--/--';
  }

  const [ano, mes, dia] = data.split('-');

  if (ano && mes && dia) {
    return `${dia}/${mes}`;
  }

  return data;
}

function TrechoCard({
  label,
  data,
  origemTrecho,
  destinoTrecho,
  horaSaida,
  horaChegada,
  paradas,
  companhia,
  tema,
}: TrechoCardProps) {
  return (
    <section className={`overflow-hidden rounded-lg border ${tema.border} bg-white`}>
      <div className={`${tema.bg} flex items-center justify-between px-4 py-2 text-white`}>
        <p className="text-[10px] font-black uppercase tracking-[0.22em]">{label}</p>
        <p className="text-[10px] font-black uppercase tracking-widest">{companhia}</p>
      </div>

      <div className={`${tema.soft} px-4 py-4`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data</p>
            <p className="mt-0.5 text-base font-black text-slate-900">{formatarData(data)}</p>
          </div>
          <div className={`rounded-full border ${tema.border} bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest ${tema.text}`}>
            Operacional
          </div>
        </div>

        <div className="grid grid-cols-[1fr_104px_1fr] items-center gap-3">
          <div className="min-w-0">
            <p className="text-3xl font-black leading-none text-slate-950">{origemTrecho || '---'}</p>
            <p className="mt-2 text-2xl font-black leading-none text-slate-900">{horaSaida || '--:--'}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Saida</p>
          </div>

          <div className="text-center">
            <p className="mb-2 text-[10px] font-bold text-slate-500">{calcularDuracao(horaSaida, horaChegada)}</p>
            <div className="flex items-center justify-center">
              <span className={`h-2.5 w-2.5 rounded-full ${tema.line}`} />
              <span className="h-0.5 w-6 bg-slate-300" />
              <span className="text-base leading-none text-slate-500">✈</span>
              <span className="h-0.5 w-6 bg-slate-300" />
              <span className={`h-2.5 w-2.5 rounded-full ${tema.line}`} />
            </div>
            <p className={`mt-2 text-[10px] font-black uppercase ${tema.text}`}>{paradas || 'Direto'}</p>
          </div>

          <div className="min-w-0 text-right">
            <p className="text-3xl font-black leading-none text-slate-950">{destinoTrecho || '---'}</p>
            <p className="mt-2 text-2xl font-black leading-none text-slate-900">{horaChegada || '--:--'}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Chegada</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function BilhetePreview({
  ticketRef,
  companhia,
  origem,
  destino,
  tipoVoo,
  dataIda,
  horaSaidaIda,
  horaChegadaIda,
  paradasIda,
  dataVolta,
  horaSaidaVolta,
  horaChegadaVolta,
  paradasVolta
}: BilhetePreviewProps) {
  const tema = getTemaCompanhia(companhia);

  return (
    <div ref={ticketRef} className="w-[420px] max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      <header className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tema.bg} text-lg font-black`}>
              ✈
            </div>
            <div>
              <h2 className="text-xl font-black leading-tight">Resumo da Cotação Singular</h2>
              <p className="mt-1 text-[11px] font-semibold text-slate-300">Voo Singular | Agência de Viagens</p>
            </div>
          </div>
          <div className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-200">
            Gerado via CRM
          </div>
        </div>
      </header>

      <div className="space-y-4 bg-slate-100 p-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Passageiro</p>
          <div className="mt-2 flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-black uppercase text-slate-900">Passageiro Singular</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                {tipoVoo === 'ida_volta' ? 'Cotação de ida e volta' : 'Cotação de somente ida'}
              </p>
            </div>
            <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white ${tema.bg}`}>
              {companhia}
            </div>
          </div>
        </section>

        <TrechoCard
          label="Trecho ida"
          data={dataIda}
          origemTrecho={origem}
          destinoTrecho={destino}
          horaSaida={horaSaidaIda}
          horaChegada={horaChegadaIda}
          paradas={paradasIda}
          companhia={companhia}
          tema={tema}
        />

        {tipoVoo === 'ida_volta' && (
          <TrechoCard
            label="Trecho volta"
            data={dataVolta}
            origemTrecho={destino}
            destinoTrecho={origem}
            horaSaida={horaSaidaVolta}
            horaChegada={horaChegadaVolta}
            paradas={paradasVolta}
            companhia={companhia}
            tema={tema}
          />
        )}
      </div>

      <footer className="space-y-1 border-t border-slate-200 bg-white px-5 py-4 text-[10px] font-semibold leading-relaxed text-slate-500">
        <p>Este documento é um resumo de custos e não garante a reserva.</p>
        <p>Sujeito a alteração de valores e disponibilidade pela companhia aérea.</p>
      </footer>
    </div>
  );
}
