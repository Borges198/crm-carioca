import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const projectId = 'demo-crm-carioca-acompanhamentos-rules';
const rules = readFileSync(
  new URL('../../../firestore.rules', import.meta.url),
  'utf8'
);

let testEnv: RulesTestEnvironment;

function firestoreAs(uid: string) {
  return testEnv.authenticatedContext(uid).firestore();
}

async function seedBase() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'usuarios', 'owner-1'), {
        status: 'aprovado',
        role: 'agent',
        agencyId: 'agency-1',
      }),
      setDoc(doc(db, 'usuarios', 'owner-2'), {
        status: 'aprovado',
        role: 'agent',
        agencyId: 'agency-1',
      }),
      setDoc(doc(db, 'usuarios', 'pending-1'), {
        status: 'pendente',
      }),
      setDoc(doc(db, 'cotacoes', 'cotacao-a'), {
        ownerId: 'owner-1',
        agencyId: 'agency-1',
      }),
      setDoc(doc(db, 'cotacoes', 'cotacao-b'), {
        ownerId: 'owner-1',
        agencyId: 'agency-1',
      }),
      setDoc(doc(db, 'acompanhamentos', 'existente-owner-1'), {
        ownerId: 'owner-1',
        agencyId: 'agency-1',
        cotacaoAncoraId: 'cotacao-existente',
        proximaAcaoEm: Timestamp.fromMillis(1_800_000_000_000),
        createdAt: Timestamp.fromMillis(1_700_000_000_000),
        updatedAt: Timestamp.fromMillis(1_700_000_000_000),
      }),
    ]);
  });
}

async function attemptInvalidMaterialization(
  id: string,
  invalidFields: Record<string, unknown>
) {
  const db = firestoreAs('owner-1');
  const agora = Timestamp.fromMillis(1_800_000_000_000);

  return runTransaction(db, async (transaction) => {
    const acompanhamentoRef = doc(db, 'acompanhamentos', id);
    const cotacaoRef = doc(db, 'cotacoes', 'cotacao-a');
    await transaction.get(acompanhamentoRef);
    await transaction.get(cotacaoRef);
    transaction.set(acompanhamentoRef, {
      ownerId: 'owner-1',
      agencyId: 'agency-1',
      cotacaoAncoraId: 'cotacao-a',
      proximaAcaoEm: agora,
      createdAt: agora,
      updatedAt: agora,
      ...invalidFields,
    });
    transaction.update(cotacaoRef, { acompanhamentoId: id });
  });
}

async function attemptMaterialization(
  id: string,
  tipoProximaAcao: 'DATA' | 'DIARIA' | 'SEM_DATA',
  proximaAcaoEm: Timestamp | null,
  uid = 'owner-1'
) {
  const db = firestoreAs(uid);
  const agora = Timestamp.fromMillis(1_800_000_000_000);

  return runTransaction(db, async (transaction) => {
    const acompanhamentoRef = doc(db, 'acompanhamentos', id);
    const cotacaoRef = doc(db, 'cotacoes', 'cotacao-a');
    await transaction.get(acompanhamentoRef);
    await transaction.get(cotacaoRef);
    transaction.set(acompanhamentoRef, {
      ownerId: uid,
      agencyId: 'agency-1',
      cotacaoAncoraId: 'cotacao-a',
      tipoProximaAcao,
      proximaAcaoEm,
      createdAt: agora,
      updatedAt: agora,
    });
    transaction.update(cotacaoRef, { acompanhamentoId: id });
  });
}

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Rules executáveis de acompanhamentos', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: { rules },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedBase();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('permite que owner aprovado consulte acompanhamento inexistente', async () => {
    const db = firestoreAs('owner-1');
    await assertSucceeds(getDoc(doc(db, 'acompanhamentos', 'ainda-inexistente')));
  });

  it('permite leitura existente própria e consulta owner-only', async () => {
    const db = firestoreAs('owner-1');
    await assertSucceeds(getDoc(doc(db, 'acompanhamentos', 'existente-owner-1')));
    await assertSucceeds(getDocs(query(
      collection(db, 'acompanhamentos'),
      where('ownerId', '==', 'owner-1')
    )));
  });

  it('nega a outro owner o acompanhamento existente e sua consulta', async () => {
    const db = firestoreAs('owner-2');
    await assertFails(getDoc(doc(db, 'acompanhamentos', 'existente-owner-1')));
    await assertFails(getDocs(query(
      collection(db, 'acompanhamentos'),
      where('ownerId', '==', 'owner-1')
    )));
  });

  it('nega consulta a usuário não aprovado', async () => {
    const db = firestoreAs('pending-1');
    await assertFails(getDoc(doc(db, 'acompanhamentos', 'ainda-inexistente')));
  });

  it('permite a primeira materialização transacional e preserva os vínculos', async () => {
    const db = firestoreAs('owner-1');
    const acompanhamentoId = 'acompanhamento-novo';
    const acompanhamentoRef = doc(db, 'acompanhamentos', acompanhamentoId);
    const cotacaoARef = doc(db, 'cotacoes', 'cotacao-a');
    const cotacaoBRef = doc(db, 'cotacoes', 'cotacao-b');
    const agora = Timestamp.fromMillis(1_800_000_000_000);

    await assertSucceeds(runTransaction(db, async (transaction) => {
      await transaction.get(acompanhamentoRef);
      await transaction.get(cotacaoARef);
      await transaction.get(cotacaoBRef);

      transaction.set(acompanhamentoRef, {
        ownerId: 'owner-1',
        agencyId: 'agency-1',
        cotacaoAncoraId: 'cotacao-a',
        tipoProximaAcao: 'DATA',
        proximaAcaoEm: agora,
        createdAt: agora,
        updatedAt: agora,
      });
      transaction.update(cotacaoARef, { acompanhamentoId });
      transaction.update(cotacaoBRef, { acompanhamentoId });
    }));

    await assertSucceeds(getDoc(acompanhamentoRef));
  });

  it.each([
    ['DATA', Timestamp.fromMillis(1_800_000_000_000)],
    ['DIARIA', null],
    ['SEM_DATA', null],
  ] as const)('permite criar %s válida', async (tipoProximaAcao, proximaAcaoEm) => {
    await assertSucceeds(attemptMaterialization(
      `valido-${tipoProximaAcao}`,
      tipoProximaAcao,
      proximaAcaoEm
    ));
  });

  it.each([
    ['DATA', null],
    ['DIARIA', Timestamp.fromMillis(1_800_000_000_000)],
    ['SEM_DATA', Timestamp.fromMillis(1_800_000_000_000)],
  ] as const)('nega criar %s com data incompatível', async (
    tipoProximaAcao,
    proximaAcaoEm
  ) => {
    await assertFails(attemptMaterialization(
      `invalido-${tipoProximaAcao}`,
      tipoProximaAcao,
      proximaAcaoEm
    ));
  });

  it('permite atualizar entre modos válidos', async () => {
    const db = firestoreAs('owner-1');
    const referencia = doc(db, 'acompanhamentos', 'existente-owner-1');
    const agora = Timestamp.fromMillis(1_900_000_000_000);

    await assertSucceeds(updateDoc(referencia, {
      tipoProximaAcao: 'DIARIA',
      proximaAcaoEm: null,
      updatedAt: agora,
    }));
    await assertSucceeds(updateDoc(referencia, {
      tipoProximaAcao: 'SEM_DATA',
      proximaAcaoEm: null,
      updatedAt: agora,
    }));
    await assertSucceeds(updateDoc(referencia, {
      tipoProximaAcao: 'DATA',
      proximaAcaoEm: agora,
      updatedAt: agora,
    }));
  });

  it('nega atualização por outro owner', async () => {
    const db = firestoreAs('owner-2');
    await assertFails(updateDoc(doc(db, 'acompanhamentos', 'existente-owner-1'), {
      tipoProximaAcao: 'DIARIA',
      proximaAcaoEm: null,
      updatedAt: Timestamp.fromMillis(1_900_000_000_000),
    }));
  });

  it('nega materialização por usuário não aprovado', async () => {
    await assertFails(attemptMaterialization(
      'pending-invalido',
      'SEM_DATA',
      null,
      'pending-1'
    ));
  });

  it('nega violações de ownerId, agencyId, cotacaoAncoraId ou acompanhamentoId', async () => {
    await assertFails(attemptInvalidMaterialization(
      'owner-invalido',
      { ownerId: 'owner-2' }
    ));
    await assertFails(attemptInvalidMaterialization(
      'agency-invalida',
      { agencyId: 'agency-2' }
    ));
    await assertFails(attemptInvalidMaterialization(
      'ancora-invalida',
      { cotacaoAncoraId: 'cotacao-inexistente' }
    ));

    const db = firestoreAs('owner-1');
    const agora = Timestamp.fromMillis(1_800_000_000_000);
    await assertFails(runTransaction(db, async (transaction) => {
      const acompanhamentoRef = doc(db, 'acompanhamentos', 'id-esperado');
      const cotacaoRef = doc(db, 'cotacoes', 'cotacao-a');
      await transaction.get(acompanhamentoRef);
      await transaction.get(cotacaoRef);
      transaction.set(acompanhamentoRef, {
        ownerId: 'owner-1',
        agencyId: 'agency-1',
        cotacaoAncoraId: 'cotacao-a',
        proximaAcaoEm: agora,
        createdAt: agora,
        updatedAt: agora,
      });
      transaction.update(cotacaoRef, { acompanhamentoId: 'id-diferente' });
    }));
  });
});
