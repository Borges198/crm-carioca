import type { Timestamp } from 'firebase/firestore';
import type { Acompanhamento, Cotacao } from '../types';

interface PersistirProximaAcaoCartelaInput {
  acompanhamentoExistente?: Acompanhamento;
  ownerId: string;
  agencyId: string;
  cotacoes: Cotacao[];
  proximaAcaoEm: Timestamp;
  confirmarMaterializacao: (quantidadeCotacoes: number) => boolean;
  materializar: (input: {
    ownerId: string;
    agencyId: string;
    cotacoes: Cotacao[];
    proximaAcaoEm: Timestamp;
  }) => Promise<Acompanhamento>;
  atualizar: (input: {
    acompanhamentoId: string;
    ownerId: string;
    proximaAcaoEm: Timestamp;
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
  proximaAcaoEm,
  confirmarMaterializacao,
  materializar,
  atualizar,
}: PersistirProximaAcaoCartelaInput): Promise<ResultadoPersistenciaProximaAcao> {
  if (acompanhamentoExistente) {
    const acompanhamento = await atualizar({
      acompanhamentoId: acompanhamentoExistente.id,
      ownerId,
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
    proximaAcaoEm,
  });
  return { status: 'materialized', acompanhamento };
}
