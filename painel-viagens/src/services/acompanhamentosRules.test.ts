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
  invalidFields: Record<string, string>
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
        proximaAcaoEm: agora,
        createdAt: agora,
        updatedAt: agora,
      });
      transaction.update(cotacaoARef, { acompanhamentoId });
      transaction.update(cotacaoBRef, { acompanhamentoId });
    }));

    await assertSucceeds(getDoc(acompanhamentoRef));
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
