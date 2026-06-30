import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(() => ({ path: 'clientes' })),
  getDocs: vi.fn(),
  limit: vi.fn((value) => ({ type: 'limit', value })),
  orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  query: vi.fn((reference, ...constraints) => ({ reference, constraints })),
  startAfter: vi.fn((snapshot) => ({ type: 'startAfter', snapshot })),
  where: vi.fn((field, operator, value) => ({ type: 'where', field, operator, value })),
}));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: firestore.collection,
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDocs: firestore.getDocs,
  limit: firestore.limit,
  orderBy: firestore.orderBy,
  query: firestore.query,
  startAfter: firestore.startAfter,
  updateDoc: vi.fn(),
  where: firestore.where,
}));

vi.mock('../lib/firebase', () => ({
  default: {},
}));

import {
  LIMITE_PAGINA_CLIENTES,
  listarPaginaClientesDoUsuario,
} from './clientesService';

function criarDocumento(id: string, nome = id) {
  return {
    id,
    data: () => ({
      nome,
      origemLead: 'Legado',
      primeiraViagem: 'AJU → GRU',
      dataCadastro: '2026-06-29',
    }),
  };
}

describe('listarPaginaClientesDoUsuario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa ownerId, dataCadastro desc e limite 20 na primeira página', async () => {
    firestore.getDocs.mockResolvedValue({ docs: [] });

    await listarPaginaClientesDoUsuario('usuario-1');

    expect(firestore.where).toHaveBeenCalledWith('ownerId', '==', 'usuario-1');
    expect(firestore.orderBy).toHaveBeenCalledWith('dataCadastro', 'desc');
    expect(firestore.limit).toHaveBeenCalledWith(LIMITE_PAGINA_CLIENTES);
    expect(firestore.startAfter).not.toHaveBeenCalled();
  });

  it('usa startAfter na página seguinte', async () => {
    const cursor = criarDocumento('cursor');
    firestore.getDocs.mockResolvedValue({ docs: [] });

    await listarPaginaClientesDoUsuario('usuario-1', cursor as never);

    expect(firestore.startAfter).toHaveBeenCalledWith(cursor);
  });

  it('retorna o último snapshot como cursor e preserva IDs', async () => {
    const primeiro = criarDocumento('cliente-1', 'Maria');
    const ultimo = criarDocumento('cliente-2', 'João');
    firestore.getDocs.mockResolvedValue({ docs: [primeiro, ultimo] });

    const pagina = await listarPaginaClientesDoUsuario('usuario-1');

    expect(pagina.ultimoDocumento).toBe(ultimo);
    expect(pagina.clientes.map((cliente) => cliente.id)).toEqual(['cliente-1', 'cliente-2']);
  });

  it('página cheia mantém temMais', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: Array.from(
        { length: LIMITE_PAGINA_CLIENTES },
        (_, index) => criarDocumento(`cliente-${index}`)
      ),
    });

    const pagina = await listarPaginaClientesDoUsuario('usuario-1');

    expect(pagina.temMais).toBe(true);
  });

  it('página menor encerra a paginação', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [criarDocumento('cliente-1')],
    });

    const pagina = await listarPaginaClientesDoUsuario('usuario-1');

    expect(pagina.temMais).toBe(false);
  });

  it('página vazia encerra e não retorna cursor', async () => {
    firestore.getDocs.mockResolvedValue({ docs: [] });

    const pagina = await listarPaginaClientesDoUsuario('usuario-1');

    expect(pagina).toEqual({
      clientes: [],
      ultimoDocumento: null,
      temMais: false,
    });
  });
});
