import type {
  ItinerarioCotacaoValidado,
  SentidoItinerarioValidado,
} from '../utils/itinerarioUtils';

interface RevisaoItinerarioProps {
  itinerario: ItinerarioCotacaoValidado;
  confirmado: boolean;
  onConfirmar: () => void;
  onDescartar: () => void;
}

function formatarData(data?: string) {
  const partes = data?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : data;
}

function LinhaTemporal({ rotulo, data, hora }: {
  rotulo: string;
  data?: string;
  hora?: string;
}) {
  if (!data && !hora) return null;
  return (
    <p className="text-xs text-slate-600">
      <span className="font-semibold text-slate-700">{rotulo}:</span>{' '}
      {[formatarData(data), hora].filter(Boolean).join(' às ')}
    </p>
  );
}

function RevisaoSentido({ sentido }: {
  sentido: SentidoItinerarioValidado<'ida'> | SentidoItinerarioValidado<'volta'>;
}) {
  const conexoes = sentido.pernas.length - 1;
  return (
    <section aria-labelledby={`revisao-${sentido.tipo}`} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3
          id={`revisao-${sentido.tipo}`}
          className="text-xs font-black uppercase tracking-widest text-indigo-900"
        >
          {sentido.tipo}
        </h3>
        <span className="text-[11px] font-semibold text-slate-500">
          {conexoes === 0
            ? 'Voo direto'
            : `${conexoes} ${conexoes === 1 ? 'conexão' : 'conexões'}`}
        </span>
      </div>

      <ol className="space-y-2">
        {sentido.pernas.map((perna, indice) => (
          <li
            key={`${sentido.tipo}-${indice}-${perna.origem}-${perna.destino}`}
            className="rounded-lg border border-indigo-100 bg-white p-3"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Perna {indice + 1}
            </p>
            <p className="mt-1 text-sm font-black text-slate-900">
              {perna.origem} <span aria-hidden="true" className="text-indigo-500">→</span>{' '}
              {perna.destino}
            </p>
            <div className="mt-2 space-y-1">
              <LinhaTemporal rotulo="Saída" data={perna.dataSaida} hora={perna.horaSaida} />
              <LinhaTemporal rotulo="Chegada" data={perna.dataChegada} hora={perna.horaChegada} />
              {perna.companhia && (
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Companhia:</span>{' '}
                  {perna.companhia}
                </p>
              )}
              {perna.numeroVoo && (
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Voo:</span>{' '}
                  {perna.numeroVoo}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function RevisaoItinerario({
  itinerario,
  confirmado,
  onConfirmar,
  onDescartar,
}: RevisaoItinerarioProps) {
  return (
    <aside
      aria-label="Revisão do itinerário estruturado"
      className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-indigo-950">Itinerário identificado</h2>
            <p className="mt-1 text-xs text-indigo-800">
              Confira a estrutura antes de autorizar sua inclusão na cotação.
            </p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
            confirmado
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-800'
          }`}>
            {confirmado ? 'Confirmado' : 'Aguardando revisão'}
          </span>
        </div>
      </div>

      <RevisaoSentido sentido={itinerario.ida} />
      {itinerario.volta && <RevisaoSentido sentido={itinerario.volta} />}

      <p className="text-xs text-slate-600">
        {confirmado
          ? 'Estrutura autorizada para acompanhar a cotação.'
          : 'Sem confirmação, a cotação será salva somente com os dados do formulário.'}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onConfirmar}
          disabled={confirmado}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:cursor-default disabled:bg-emerald-600"
        >
          Confirmar itinerário
        </button>
        <button
          type="button"
          onClick={onDescartar}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Descartar itinerário estruturado
        </button>
      </div>
    </aside>
  );
}
