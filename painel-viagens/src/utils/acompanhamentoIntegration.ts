import type { Timestamp } from 'firebase/firestore';
import type { Acompanhamento, Cotacao, TipoProximaAcao } from '../types';

interface PersistirProximaAcaoCartelaInput {
  acompanhamentoExistente?: Acompanhamento;
  ownerId: string;
  agencyId: string;
  cotacoes: Cotacao[];
  tipoProximaAcao?: TipoProximaAcao;
  proximaAcaoEm: Timestamp | null;
  confirmarMaterializacao: (quantidadeCotacoes: number) => boolean;
  materializar: (input: {
    ownerId: string;
    agencyId: string;
    cotacoes: Cotacao[];
    tipoProximaAcao?: TipoProximaAcao;
    proximaAcaoEm: Timestamp | null;
  }) => Promise<Acompanhamento>;
  atualizar: (input: {
    acompanhamentoId: string;
    ownerId: string;
    tipoProximaAcao?: TipoProximaAcao;
    proximaAcaoEm: Timestamp | null;
  }) => Promise<Acompanhamento>;
}

export type ResultadoPersistenciaProximaAcao =
  | { status: 'cancelled' }
  | { status: 'materialized'; acompanhamento: Acompanhamento }
  | { status: 'updated'; acompanhamento: Acompanhamento };

export async function persistirProximaAcaoCartela({
  acompanhamentoExistente,
  ownerId,
  agencyId,
  cotacoes,
  tipoProximaAcao,
  proximaAcaoEm,
  confirmarMaterializacao,
  materializar,
  atualizar,
}: PersistirProximaAcaoCartelaInput): Promise<ResultadoPersistenciaProximaAcao> {
  if (acompanhamentoExistente) {
    const acompanhamento = await atualizar({
      acompanhamentoId: acompanhamentoExistente.id,
      ownerId,
      tipoProximaAcao,
      proximaAcaoEm,
    });
    return { status: 'updated', acompanhamento };
  }

  if (!confirmarMaterializacao(cotacoes.length)) {
    return { status: 'cancelled' };
  }

  const acompanhamento = await materializar({
    ownerId,
    agencyId,
    cotacoes,
    tipoProximaAcao,
    proximaAcaoEm,
  });
  return { status: 'materialized', acompanhamento };
}
