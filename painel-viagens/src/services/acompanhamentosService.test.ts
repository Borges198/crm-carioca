import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(() => ({ kind: 'collection', path: 'acompanhamentos' })),
  doc: vi.fn((...args: unknown[]) => {
    if (args.length === 2) {
      return { kind: 'acompanhamento', id: args[1] };
    }
    return { kind: 'cotacao', id: args[2] };
  }),
  getDocs: vi.fn(),
  query: vi.fn((reference, ...constraints) => ({ reference, constraints })),
  runTransaction: vi.fn(),
  where: vi.fn((field, operator, value) => ({ field, operator, value })),
  now: vi.fn(() => ({ seconds: 1, nanoseconds: 0 })),
}));

vi.mock('firebase/firestore', () => ({
  Timestamp: class Timestamp {
    static now = firestore.now;
  },
  collection: firestore.collection,
  doc: firestore.doc,
  getDocs: firestore.getDocs,
  query: firestore.query,
  runTransaction: firestore.runTransaction,
  where: firestore.where,
}));

vi.mock('../lib/firebase', () => ({
  default: { kind: 'db' },
}));

import {
  atualizarProximaAcao,
  listarAcompanhamentosDoUsuario,
  materializarAcompanhamento,
} from './acompanhamentosService';

function transacaoComCotacoes(
  dadosCotacoes: Record<string, Record<string, unknown>>,
  acompanhamentoExiste = false
) {
  const set = vi.fn();
  const update = vi.fn();
  const get = vi.fn(async (referencia: { kind: string; id: string }) => {
    if (referencia.kind === 'acompanhamento') {
      return {
        exists: () => acompanhamentoExiste,
        data: () => ({}),
      };
    }
    const dados = dadosCotacoes[referencia.id];
    return {
      exists: () => Boolean(dados),
      data: () => dados,
    };
  });
  return { get, set, update };
}

describe('acompanhamentosService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consulta acompanhamentos somente por ownerId', async () => {
    firestore.getDocs.mockResolvedValue({ docs: [] });

    await listarAcompanhamentosDoUsuario('owner-1');

    expect(firestore.where).toHaveBeenCalledWith('ownerId', '==', 'owner-1');
  });

  it('cria um acompanhamento e vincula três cotações na mesma transação', async () => {
    const transaction = transacaoComCotacoes({
      a: { ownerId: 'owner-1' },
      b: { ownerId: 'owner-1' },
      c: { ownerId: 'owner-1' },
    });
    firestore.runTransaction.mockImplementation(async (_db, executar) => executar(transaction));

    const resultado = await materializarAcompanhamento({
      ownerId: 'owner-1',
      agencyId: 'agencia-1',
      cotacoes: [
        { id: 'c', ownerId: 'owner-1' },
        { id: 'a', ownerId: 'owner-1' },
        { id: 'b', ownerId: 'owner-1' },
      ],
      tipoProximaAcao: 'DATA',
      proximaAcaoEm: { seconds: 2, nanoseconds: 0 } as never,
    });

    expect(resultado.cotacaoAncoraId).toBe('a');
    expect(resultado.tipoProximaAcao).toBe('DATA');
    expect(transaction.set).toHaveBeenCalledTimes(1);
    expect(transaction.update).toHaveBeenCalledTimes(3);
    expect(new Set(
      transaction.update.mock.calls.map(([, payload]) => payload.acompanhamentoId)
    ).size).toBe(1);
  });

  it.each([
    ['DIARIA', null],
    ['SEM_DATA', null],
  ] as const)('materializa o modo %s sem data', async (tipoProximaAcao, proximaAcaoEm) => {
    const transaction = transacaoComCotacoes({ a: { ownerId: 'owner-1' } });
    firestore.runTransaction.mockImplementation(async (_db, executar) => executar(transaction));

    const resultado = await materializarAcompanhamento({
      ownerId: 'owner-1',
      agencyId: 'agencia-1',
      cotacoes: [{ id: 'a', ownerId: 'owner-1' }],
      tipoProximaAcao,
      proximaAcaoEm,
    });

    expect(resultado).toEqual(expect.objectContaining({
      tipoProximaAcao,
      proximaAcaoEm: null,
    }));
    expect(transaction.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tipoProximaAcao, proximaAcaoEm: null })
    );
  });

  it.each([
    ['DATA', null],
    ['DIARIA', { seconds: 2, nanoseconds: 0 }],
    ['SEM_DATA', { seconds: 2, nanoseconds: 0 }],
  ] as const)('rejeita %s com combinação inválida antes da transação', async (
    tipoProximaAcao,
    proximaAcaoEm
  ) => {
    await expect(materializarAcompanhamento({
      ownerId: 'owner-1',
      agencyId: 'agencia-1',
      cotacoes: [{ id: 'a', ownerId: 'owner-1' }],
      tipoProximaAcao,
      proximaAcaoEm: proximaAcaoEm as never,
    })).rejects.toThrow('Próxima ação');

    expect(firestore.runTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['DATA', { seconds: 2, nanoseconds: 0 }],
    ['DIARIA', null],
    ['SEM_DATA', null],
  ] as const)('atualiza acompanhamento para o modo %s', async (
    tipoProximaAcao,
    proximaAcaoEm
  ) => {
    const transaction = transacaoComCotacoes({}, true);
    transaction.get.mockResolvedValue({
      exists: () => true,
      data: () => ({
        ownerId: 'owner-1',
        agencyId: 'agencia-1',
        cotacaoAncoraId: 'a',
        proximaAcaoEm: null,
        createdAt: { seconds: 1, nanoseconds: 0 },
        updatedAt: { seconds: 1, nanoseconds: 0 },
      }),
    });
    firestore.runTransaction.mockImplementation(async (_db, executar) => executar(transaction));

    const resultado = await atualizarProximaAcao({
      acompanhamentoId: 'acompanhamento-1',
      ownerId: 'owner-1',
      tipoProximaAcao,
      proximaAcaoEm: proximaAcaoEm as never,
    });

    expect(transaction.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tipoProximaAcao, proximaAcaoEm })
    );
    expect(resultado).toEqual(expect.objectContaining({ tipoProximaAcao, proximaAcaoEm }));
  });

  it('normaliza escrita legada com data para DATA', async () => {
    const transaction = transacaoComCotacoes({ a: { ownerId: 'owner-1' } });
    firestore.runTransaction.mockImplementation(async (_db, executar) => executar(transaction));

    const resultado = await materializarAcompanhamento({
      ownerId: 'owner-1',
      agencyId: 'agencia-1',
      cotacoes: [{ id: 'a', ownerId: 'owner-1' }],
      proximaAcaoEm: { seconds: 2, nanoseconds: 0 } as never,
    });

    expect(resultado.tipoProximaAcao).toBe('DATA');
  });

  it('escolhe a âncora e atualiza documentos somente entre as cotações confirmadas', async () => {
    const transaction = transacaoComCotacoes({
      a: { ownerId: 'owner-1' },
      b: { ownerId: 'owner-1' },
      '0-oculta': { ownerId: 'owner-1' },
    });
    firestore.runTransaction.mockImplementation(async (_db, executar) => executar(transaction));

    const resultado = await materializarAcompanhamento({
      ownerId: 'owner-1',
      agencyId: 'agencia-1',
      cotacoes: [
        { id: 'b', ownerId: 'owner-1' },
        { id: 'a', ownerId: 'owner-1' },
      ],
      proximaAcaoEm: { seconds: 2, nanoseconds: 0 } as never,
    });

    expect(resultado.cotacaoAncoraId).toBe('a');
    expect(transaction.update).toHaveBeenCalledTimes(2);
    expect(transaction.update.mock.calls.map(([referencia]) => referencia.id).sort())
      .toEqual(['a', 'b']);
    expect(transaction.update.mock.calls.some(([referencia]) => referencia.id === '0-oculta'))
      .toBe(false);
  });

  it('não escreve nada quando uma cotação possui vínculo incompatível', async () => {
    const transaction = transacaoComCotacoes({
      a: { ownerId: 'owner-1' },
      b: { ownerId: 'owner-1', acompanhamentoId: 'outro' },
    });
    firestore.runTransaction.mockImplementation(async (_db, executar) => executar(transaction));

    await expect(materializarAcompanhamento({
      ownerId: 'owner-1',
      agencyId: 'agencia-1',
      cotacoes: [
        { id: 'a', ownerId: 'owner-1' },
        { id: 'b', ownerId: 'owner-1' },
      ],
      proximaAcaoEm: { seconds: 2, nanoseconds: 0 } as never,
    })).rejects.toThrow('outro acompanhamento');

    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it('uma segunda aba não cria outro documento para a mesma âncora', async () => {
    const transaction = transacaoComCotacoes(
      { a: { ownerId: 'owner-1' } },
      true
    );
    firestore.runTransaction.mockImplementation(async (_db, executar) => executar(transaction));

    await expect(materializarAcompanhamento({
      ownerId: 'owner-1',
      agencyId: 'agencia-1',
      cotacoes: [{ id: 'a', ownerId: 'owner-1' }],
      proximaAcaoEm: { seconds: 2, nanoseconds: 0 } as never,
    })).rejects.toThrow('já possui acompanhamento');

    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });
});
