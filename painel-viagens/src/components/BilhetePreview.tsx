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
  return (
    <div ref={ticketRef} className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm relative">
      <div className="p-4 border-b border-dashed border-slate-300">
        <div className="flex justify-between items-center mb-4">
          <div className={`font-bold text-xl ${companhia === 'GOL' ? 'text-orange-500' : companhia === 'Latam' ? 'text-red-600' : 'text-blue-900'}`}>
            {companhia} ✈️
          </div>
          <div className="text-right flex-1">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detalhes do Voo</span>
          </div>
        </div>

        <div className="flex justify-between items-center text-center">
          <div>
            <div className="text-3xl font-black text-slate-800">{horaSaidaIda || '--:--'}</div>
            <div className="text-sm font-bold text-slate-500">{origem || '---'}</div>
            <div className="text-[10px] text-slate-400 mt-1">{dataIda ? dataIda.split('-').reverse().join('/') : '--/--/----'}</div>
          </div>
          <div className="flex-1 px-4 relative">
            <div className="text-[10px] font-bold text-slate-400 mb-1">{calcularDuracao(horaSaidaIda, horaChegadaIda)}</div>
            <div className="border-t-2 border-slate-200 w-full relative">
               <div className={`absolute -top-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full ${companhia === 'GOL' ? 'bg-orange-500' : companhia === 'Latam' ? 'bg-red-600' : 'bg-blue-600'}`}></div>
            </div>
            <div className="text-[10px] font-bold text-blue-500 mt-1">{paradasIda}</div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-800">{horaChegadaIda || '--:--'}</div>
            <div className="text-sm font-bold text-slate-500">{destino || '---'}</div>
          </div>
        </div>

        {tipoVoo === 'ida_volta' && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-center">
            <div>
              <div className="text-3xl font-black text-slate-800">{horaSaidaVolta || '--:--'}</div>
              <div className="text-sm font-bold text-slate-500">{destino || '---'}</div>
              <div className="text-[10px] text-slate-400 mt-1">{dataVolta ? dataVolta.split('-').reverse().join('/') : '--/--/----'}</div>
            </div>
            <div className="flex-1 px-4 relative">
              <div className="text-[10px] font-bold text-slate-400 mb-1">{calcularDuracao(horaSaidaVolta, horaChegadaVolta)}</div>
              <div className="border-t-2 border-slate-200 w-full relative">
                 <div className={`absolute -top-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full ${companhia === 'GOL' ? 'bg-orange-500' : companhia === 'Latam' ? 'bg-red-600' : 'bg-blue-600'}`}></div>
              </div>
              <div className="text-[10px] font-bold text-blue-500 mt-1">{paradasVolta}</div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-800">{horaChegadaVolta || '--:--'}</div>
              <div className="text-sm font-bold text-slate-500">{origem || '---'}</div>
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-slate-50 p-2 text-right">
        <span className="text-[10px] font-semibold text-slate-400">Agência Voo Singular</span>
      </div>
    </div>
  );
}
