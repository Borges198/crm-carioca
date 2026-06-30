import { describe, expect, it, vi } from 'vitest';
import type { Cliente } from '../../types';

vi.mock('../../services/clientesService', () => ({
  atualizarCliente: vi.fn(),
  criarCliente: vi.fn(),
  excluirCliente: vi.fn(),
  listarClientesDoUsuario: vi.fn(),
  listarPaginaClientesDoUsuario: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../components/AuthGuard', () => ({
  default: ({ children }: { children: unknown }) => children,
}));

vi.mock('../../components/EmptyState', () => ({
  default: vi.fn(),
}));

vi.mock('../../components/SearchInput', () => ({
  default: vi.fn(),
}));

import {
  atualizarClientePorId,
  concatenarClientesPorId,
  estadoPertenceAoUsuario,
  identidadeSessaoCorresponde,
  inserirClienteNoInicio,
  obterPesquisaClientesEmAndamento,
  reconciliarClientesComMutacoes,
  registrarMutacaoCliente,
  removerClientePorId,
  selecionarFonteClientes,
} from './page';

const maria1 = { id: 'maria-1', nome: 'Maria Silva' } as Cliente;
const maria2 = { id: 'maria-2', nome: 'Maria Silva' } as Cliente;
const joao = { id: 'joao-1', nome: 'João Souza' } as Cliente;

function criarCargaControlada() {
  let resolver: ((clientes: Cliente[]) => void) | undefined;
  const promise = new Promise<Cliente[]>((resolve) => {
    resolver = resolve;
  });

  return {
    promise,
    resolver: (clientes: Cliente[]) => resolver?.(clientes),
  };
}

describe('estado paginado de clientes', () => {
  it('concatena páginas sem duplicar IDs', () => {
    expect(concatenarClientesPorId([maria1, joao], [joao, maria2])).toEqual([
      maria1,
      joao,
      maria2,
    ]);
  });

  it('preserva homônimos com IDs diferentes', () => {
    expect(concatenarClientesPorId([maria1], [maria2])).toEqual([maria1, maria2]);
  });

  it('resposta antiga é rejeitada depois da troca de usuário', () => {
    expect(estadoPertenceAoUsuario('usuario-1', 'usuario-2')).toBe(false);
  });

  it('logout invalida lista e cache vinculados ao usuário', () => {
    expect(estadoPertenceAoUsuario('usuario-1', undefined)).toBe(false);
  });

  it('criação insere no início e evita duplicidade', () => {
    expect(inserirClienteNoInicio([maria1, joao], maria1)).toEqual([maria1, joao]);
  });

  it('edição atualiza somente o ID selecionado', () => {
    expect(atualizarClientePorId([maria1, maria2], 'maria-2', { telefone: '123' })).toEqual([
      maria1,
      { ...maria2, telefone: '123' },
    ]);
  });

  it('exclusão remove por ID sem afetar homônimo', () => {
    expect(removerClientePorId([maria1, maria2], 'maria-1')).toEqual([maria2]);
  });

  it('pesquisa global encontra cliente fora da primeira página', () => {
    const fonte = selecionarFonteClientes(
      [maria1],
      { userId: 'usuario-1', geracao: 1, clientes: [maria1, joao] },
      'usuario-1',
      1,
      true
    );

    expect(fonte).toContain(joao);
  });

  it('limpar a pesquisa restaura a listagem paginada', () => {
    const fonte = selecionarFonteClientes(
      [maria1],
      { userId: 'usuario-1', geracao: 1, clientes: [maria1, joao] },
      'usuario-1',
      1,
      false
    );

    expect(fonte).toEqual([maria1]);
  });

  it('cache de outro usuário nunca é reutilizado', () => {
    const fonte = selecionarFonteClientes(
      [maria2],
      { userId: 'usuario-1', geracao: 1, clientes: [maria1, joao] },
      'usuario-2',
      2,
      true
    );

    expect(fonte).toEqual([maria2]);
  });

  it('digitações seguintes reutilizam uma única consulta integral por usuário', () => {
    const carregar = vi.fn().mockResolvedValue([maria1, joao]);
    const primeira = obterPesquisaClientesEmAndamento(null, 'usuario-1', 1, 0, carregar);
    const segunda = obterPesquisaClientesEmAndamento(primeira, 'usuario-1', 1, 1, carregar);

    expect(segunda).toBe(primeira);
    expect(carregar).toHaveBeenCalledOnce();
    expect(carregar).toHaveBeenCalledWith('usuario-1');
  });

  it('troca de usuário cria uma nova consulta integral', () => {
    const carregar = vi.fn().mockResolvedValue([maria1]);
    const primeira = obterPesquisaClientesEmAndamento(null, 'usuario-1', 1, 0, carregar);
    const segunda = obterPesquisaClientesEmAndamento(primeira, 'usuario-2', 2, 0, carregar);

    expect(segunda).not.toBe(primeira);
    expect(carregar).toHaveBeenCalledTimes(2);
    expect(carregar).toHaveBeenLastCalledWith('usuario-2');
  });

  it('preserva criação concluída durante a carga inicial', async () => {
    let resolverCarga: ((clientes: Cliente[]) => void) | undefined;
    const carga = new Promise<Cliente[]>((resolve) => {
      resolverCarga = resolve;
    });
    const versaoInicial = 0;
    const novo = { id: 'novo-1', nome: 'Cliente Novo' } as Cliente;
    const registro = registrarMutacaoCliente(null, 'usuario-1', 1, {
      tipo: 'criar',
      cliente: novo,
    });

    resolverCarga?.([maria1]);
    const respostaAntiga = await carga;

    expect(
      reconciliarClientesComMutacoes(respostaAntiga, registro, 'usuario-1', 1, versaoInicial)
    ).toEqual([novo, maria1]);
  });

  it('preserva edição concluída durante a carga inicial', async () => {
    const carga = criarCargaControlada();
    const registro = registrarMutacaoCliente(null, 'usuario-1', 1, {
      tipo: 'editar',
      id: 'maria-1',
      dados: { telefone: '999' },
    });
    carga.resolver([maria1]);

    expect(
      reconciliarClientesComMutacoes(await carga.promise, registro, 'usuario-1', 1, 0)
    ).toEqual([{ ...maria1, telefone: '999' }]);
  });

  it('preserva exclusão concluída durante a carga inicial', async () => {
    const carga = criarCargaControlada();
    const registro = registrarMutacaoCliente(null, 'usuario-1', 1, {
      tipo: 'excluir',
      id: 'maria-1',
    });
    carga.resolver([maria1, joao]);

    expect(
      reconciliarClientesComMutacoes(await carga.promise, registro, 'usuario-1', 1, 0)
    ).toEqual([joao]);
  });

  it('preserva criação concluída durante a carga integral', async () => {
    let resolverCarga: ((clientes: Cliente[]) => void) | undefined;
    const carga = new Promise<Cliente[]>((resolve) => {
      resolverCarga = resolve;
    });
    const novo = { id: 'novo-1', nome: 'Cliente Novo' } as Cliente;
    const registro = registrarMutacaoCliente(null, 'usuario-1', 1, {
      tipo: 'criar',
      cliente: novo,
    });

    resolverCarga?.([maria1]);

    expect(
      reconciliarClientesComMutacoes(await carga, registro, 'usuario-1', 1, 0)
    ).toEqual([novo, maria1]);
  });

  it('preserva edição concluída durante a carga integral', async () => {
    const carga = criarCargaControlada();
    const registro = registrarMutacaoCliente(null, 'usuario-1', 1, {
      tipo: 'editar',
      id: 'maria-1',
      dados: { nome: 'Maria Atualizada' },
    });
    carga.resolver([maria1]);

    expect(
      reconciliarClientesComMutacoes(await carga.promise, registro, 'usuario-1', 1, 0)
    ).toEqual([{ ...maria1, nome: 'Maria Atualizada' }]);
  });

  it('preserva exclusão concluída durante a carga integral', async () => {
    const carga = criarCargaControlada();
    const registro = registrarMutacaoCliente(null, 'usuario-1', 1, {
      tipo: 'excluir',
      id: 'maria-1',
    });
    carga.resolver([maria1]);

    expect(
      reconciliarClientesComMutacoes(await carga.promise, registro, 'usuario-1', 1, 0)
    ).toEqual([]);
  });

  it('não aplica mutações de outro usuário', () => {
    const registro = registrarMutacaoCliente(null, 'usuario-1', 1, {
      tipo: 'excluir',
      id: 'maria-1',
    });

    expect(
      reconciliarClientesComMutacoes([maria1], registro, 'usuario-2', 2, 0)
    ).toEqual([maria1]);
  });

  it('reconcilia múltiplas mutações na ordem de conclusão', () => {
    const novo = { id: 'novo-1', nome: 'Cliente Novo' } as Cliente;
    let registro = registrarMutacaoCliente(null, 'usuario-1', 1, {
      tipo: 'criar',
      cliente: novo,
    });
    registro = registrarMutacaoCliente(registro, 'usuario-1', 1, {
      tipo: 'editar',
      id: 'maria-1',
      dados: { telefone: '999' },
    });
    registro = registrarMutacaoCliente(registro, 'usuario-1', 1, {
      tipo: 'excluir',
      id: 'joao-1',
    });

    expect(
      reconciliarClientesComMutacoes([maria1, joao], registro, 'usuario-1', 1, 0)
    ).toEqual([novo, { ...maria1, telefone: '999' }]);
  });

  it('descarta Carregar mais antigo após A → B → A sem alterar estado da sessão A2', async () => {
    const sessaoA1 = { userId: 'usuario-a', geracao: 1 };
    const sessaoA2 = { userId: 'usuario-a', geracao: 3 };
    const cargaAntiga = criarCargaControlada();
    const estadoA2 = {
      clientes: [maria2],
      cursor: 'cursor-a2',
      temMais: false,
      carregando: true,
      erro: 'erro-a2',
    };
    let estadoAtual = estadoA2;

    cargaAntiga.resolver([joao]);
    const paginaAntiga = await cargaAntiga.promise;
    if (identidadeSessaoCorresponde(sessaoA2, sessaoA1)) {
      estadoAtual = {
        clientes: concatenarClientesPorId(estadoAtual.clientes, paginaAntiga),
        cursor: 'cursor-a1',
        temMais: true,
        carregando: false,
        erro: '',
      };
    }

    expect(estadoAtual).toBe(estadoA2);
    expect(estadoAtual).toEqual({
      clientes: [maria2],
      cursor: 'cursor-a2',
      temMais: false,
      carregando: true,
      erro: 'erro-a2',
    });
  });

  it('descarta primeira carga antiga da sessão A1 depois de instalar A2', async () => {
    const sessaoA1 = { userId: 'usuario-a', geracao: 1 };
    const sessaoA2 = { userId: 'usuario-a', geracao: 3 };
    const cargaAntiga = criarCargaControlada();
    let listaAtual = [maria2];

    cargaAntiga.resolver([maria1]);
    const respostaA1 = await cargaAntiga.promise;
    if (identidadeSessaoCorresponde(sessaoA2, sessaoA1)) {
      listaAtual = respostaA1;
    }

    expect(listaAtual).toEqual([maria2]);
  });

  it('descarta pesquisa integral antiga da sessão A1 depois de instalar A2', async () => {
    const sessaoA1 = { userId: 'usuario-a', geracao: 1 };
    const sessaoA2 = { userId: 'usuario-a', geracao: 3 };
    const cargaAntiga = criarCargaControlada();
    let cacheA2 = [maria2];

    cargaAntiga.resolver([maria1, joao]);
    const cacheA1 = await cargaAntiga.promise;
    if (identidadeSessaoCorresponde(sessaoA2, sessaoA1)) {
      cacheA2 = cacheA1;
    }

    expect(cacheA2).toEqual([maria2]);
  });

  it('descarta mutação tardia iniciada em A1 e concluída em A2', async () => {
    const sessaoA1 = { userId: 'usuario-a', geracao: 1 };
    const sessaoA2 = { userId: 'usuario-a', geracao: 3 };
    const mutacaoAntiga = criarCargaControlada();
    let listaA2 = [maria2];

    mutacaoAntiga.resolver([{ ...maria1, telefone: '999' }]);
    const resultadoA1 = await mutacaoAntiga.promise;
    if (identidadeSessaoCorresponde(sessaoA2, sessaoA1)) {
      listaA2 = resultadoA1;
    }

    expect(listaA2).toEqual([maria2]);
  });

  it('aceita operações normais dentro da mesma geração', () => {
    const sessao = { userId: 'usuario-a', geracao: 4 };

    expect(identidadeSessaoCorresponde(sessao, sessao)).toBe(true);
  });

  it('não aplica diário de mutações da sessão A1 na sessão A2 do mesmo usuário', () => {
    const registroA1 = registrarMutacaoCliente(null, 'usuario-a', 1, {
      tipo: 'excluir',
      id: 'maria-1',
    });

    expect(
      reconciliarClientesComMutacoes([maria1], registroA1, 'usuario-a', 3, 0)
    ).toEqual([maria1]);
  });
});
