import {
  Timestamp,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';
import db from '../lib/firebase';
import type { Acompanhamento, Cotacao, NovoAcompanhamento } from '../types';
import {
  montarAcompanhamentoId,
  obterClienteIdConsistente,
  selecionarCotacaoAncoraId,
} from '../utils/acompanhamentoUtils';

const acompanhamentosCollection = collection(db, 'acompanhamentos');

type CotacaoParaMaterializacao = Pick<
  Cotacao,
  'id' | 'ownerId' | 'clienteId' | 'acompanhamentoId'
>;

interface MaterializarAcompanhamentoInput {
  ownerId: string;
  agencyId: string;
  cotacoes: CotacaoParaMaterializacao[];
  proximaAcaoEm: Timestamp;
}

interface AtualizarProximaAcaoInput {
  acompanhamentoId: string;
  ownerId: string;
  proximaAcaoEm: Timestamp;
}

export async function listarAcompanhamentosDoUsuario(ownerId: string) {
  const consulta = query(
    acompanhamentosCollection,
    where('ownerId', '==', ownerId)
  );
  const snapshot = await getDocs(consulta);

  return snapshot.docs.map((documento) => ({
    id: documento.id,
    ...documento.data(),
  })) as Acompanhamento[];
}

export async function materializarAcompanhamento({
  ownerId,
  agencyId,
  cotacoes,
  proximaAcaoEm,
}: MaterializarAcompanhamentoInput) {
  const owner = ownerId.trim();
  const agency = agencyId.trim();
  const cotacoesUnicas = Array.from(
    new Map(cotacoes.map((cotacao) => [cotacao.id, cotacao])).values()
  );

  if (!owner || !agency || cotacoesUnicas.length === 0) {
    throw new Error('Dados insuficientes para criar o acompanhamento.');
  }
  if (cotacoesUnicas.some((cotacao) => cotacao.ownerId !== owner)) {
    throw new Error('A cartela contém cotação de outro proprietário.');
  }

  const cotacaoAncoraId = selecionarCotacaoAncoraId(cotacoesUnicas);
  const acompanhamentoId = montarAcompanhamentoId(owner, cotacaoAncoraId);
  const clienteId = obterClienteIdConsistente(cotacoesUnicas);
  const acompanhamentoRef = doc(acompanhamentosCollection, acompanhamentoId);
  const cotacaoRefs = cotacoesUnicas.map((cotacao) => doc(db, 'cotacoes', cotacao.id));

  return runTransaction(db, async (transaction) => {
    const acompanhamentoSnapshot = await transaction.get(acompanhamentoRef);
    const cotacaoSnapshots = await Promise.all(
      cotacaoRefs.map((referencia) => transaction.get(referencia))
    );

    if (acompanhamentoSnapshot.exists()) {
      throw new Error('Esta oportunidade já possui acompanhamento persistente.');
    }

    cotacaoSnapshots.forEach((snapshot) => {
      if (!snapshot.exists()) {
        throw new Error('Uma das cotações da cartela não existe mais.');
      }
      const dados = snapshot.data() as Partial<Cotacao>;
      if (dados.ownerId !== owner) {
        throw new Error('Uma das cotações pertence a outro proprietário.');
      }
      if (dados.acompanhamentoId && dados.acompanhamentoId !== acompanhamentoId) {
        throw new Error('Uma das cotações já pertence a outro acompanhamento.');
      }
    });

    const agora = Timestamp.now();
    const dadosAcompanhamento: NovoAcompanhamento = {
      ownerId: owner,
      agencyId: agency,
      cotacaoAncoraId,
      ...(clienteId ? { clienteId } : {}),
      proximaAcaoEm,
      createdAt: agora,
      updatedAt: agora,
    };

    transaction.set(acompanhamentoRef, dadosAcompanhamento);
    cotacaoRefs.forEach((referencia) => {
      transaction.update(referencia, { acompanhamentoId });
    });

    return {
      id: acompanhamentoId,
      ...dadosAcompanhamento,
    } satisfies Acompanhamento;
  });
}

export async function atualizarProximaAcao({
  acompanhamentoId,
  ownerId,
  proximaAcaoEm,
}: AtualizarProximaAcaoInput) {
  const acompanhamentoRef = doc(acompanhamentosCollection, acompanhamentoId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(acompanhamentoRef);
    if (!snapshot.exists()) {
      throw new Error('Acompanhamento não encontrado.');
    }

    const atual = snapshot.data() as Omit<Acompanhamento, 'id'>;
    if (atual.ownerId !== ownerId) {
      throw new Error('Acompanhamento pertence a outro proprietário.');
    }

    const updatedAt = Timestamp.now();
    transaction.update(acompanhamentoRef, { proximaAcaoEm, updatedAt });

    return {
      id: acompanhamentoId,
      ...atual,
      proximaAcaoEm,
      updatedAt,
    } satisfies Acompanhamento;
  });
}
