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
  criarFormularioCriacaoCliente,
  criarSelecaoCliente,
  estadoPertenceAoUsuario,
  identidadeSessaoCorresponde,
  inserirClienteNoInicio,
  montarTelefoneCliente,
  obterPesquisaClientesEmAndamento,
  operacaoClientePertenceASessao,
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

  it('bloqueia seleção residual após troca direta de usuário, inclusive admin da agência', () => {
    const sessaoA = {
      userId: 'usuario-a',
      geracao: 1,
      agencyId: 'agencia-1',
      role: 'admin',
    };
    const selecaoA = criarSelecaoCliente(maria1, sessaoA, 'editar');

    expect(operacaoClientePertenceASessao(
      { ...sessaoA, userId: 'usuario-b', geracao: 2 },
      selecaoA.identidade,
      'usuario-b',
      [maria1],
      selecaoA.cliente.id
    )).toBe(false);
  });

  it('submit e conclusão antigos não chamam service nem alteram lista, mensagens ou loading de B', async () => {
    const sessaoA = { userId: 'usuario-a', geracao: 1 };
    const sessaoB = { userId: 'usuario-b', geracao: 2 };
    const selecaoA = criarSelecaoCliente(maria1, sessaoA, 'editar');
    const atualizar = vi.fn();
    const estadoB = {
      clientes: [maria2],
      cache: [maria2],
      diario: ['mutacao-b'],
      sucesso: 'sucesso-b',
      erro: 'erro-b',
      loading: true,
    };
    let estadoAtual = estadoB;

    if (operacaoClientePertenceASessao(
      sessaoB, selecaoA.identidade, 'usuario-b', [maria2], selecaoA.cliente.id
    )) {
      await atualizar('maria-1');
      estadoAtual = {
        clientes: [maria1],
        cache: [maria1],
        diario: ['mutacao-a'],
        sucesso: 'sucesso-a',
        erro: '',
        loading: false,
      };
    }

    expect(atualizar).not.toHaveBeenCalled();
    expect(estadoAtual).toBe(estadoB);
  });

  it('bloqueia edição e exclusão quando o ID selecionado não pertence à fonte atual', () => {
    const sessao = { userId: 'usuario-a', geracao: 4 };

    const selecaoEdicao = criarSelecaoCliente(maria1, sessao, 'editar');
    const selecaoExclusao = criarSelecaoCliente(maria1, sessao, 'excluir');
    expect(operacaoClientePertenceASessao(
      sessao,
      selecaoEdicao.identidade,
      'usuario-a',
      [maria2],
      'maria-1'
    )).toBe(false);
    expect(operacaoClientePertenceASessao(
      sessao,
      selecaoExclusao.identidade,
      'usuario-a',
      [maria2],
      'maria-1'
    )).toBe(false);
  });

  it('aceita criação na sessão atual sem exigir ID', () => {
    const sessao = { userId: 'usuario-a', geracao: 4 };

    const formulario = criarFormularioCriacaoCliente(sessao);
    expect(operacaoClientePertenceASessao(
      sessao,
      formulario.identidade,
      'usuario-a',
      [],
    )).toBe(true);
  });

  it('aceita operação válida somente sobre o ID explicitamente selecionado', () => {
    const sessao = { userId: 'usuario-a', geracao: 4 };

    const selecao = criarSelecaoCliente(maria2, sessao, 'editar');
    expect(operacaoClientePertenceASessao(
      sessao,
      selecao.identidade,
      'usuario-a',
      [maria1, maria2],
      'maria-2'
    )).toBe(true);
    expect(operacaoClientePertenceASessao(
      sessao,
      selecao.identidade,
      'usuario-a',
      [maria1, maria2],
      'maria-1'
    )).toBe(false);
  });

  it('criação e edição mantêm telefone visual e recalculam o normalizado', () => {
    expect(montarTelefoneCliente('(82) 99999-9999')).toEqual({
      telefone: '(82) 99999-9999',
      telefoneNormalizado: '82999999999',
    });
    expect(montarTelefoneCliente('(82) 98888-1111')).toEqual({
      telefone: '(82) 98888-1111',
      telefoneNormalizado: '82988881111',
    });
  });

  it('telefone vazio limpa conjuntamente os dois campos', () => {
    expect(montarTelefoneCliente('')).toEqual({
      telefone: '',
      telefoneNormalizado: '',
    });
  });

  it('captura a identidade na origem de criação, edição e exclusão', () => {
    const sessao = {
      userId: 'usuario-a',
      geracao: 7,
      agencyId: 'agencia-1',
      role: 'admin',
    };
    const formulario = criarFormularioCriacaoCliente(sessao);
    const edicao = criarSelecaoCliente(maria1, sessao, 'editar');
    const exclusao = criarSelecaoCliente(maria2, sessao, 'excluir');

    expect(formulario.identidade).toEqual({ ...sessao, operacao: 'criar' });
    expect(edicao).toEqual({
      cliente: maria1,
      identidade: { ...sessao, operacao: 'editar', clienteId: 'maria-1' },
    });
    expect(exclusao).toEqual({
      cliente: maria2,
      identidade: { ...sessao, operacao: 'excluir', clienteId: 'maria-2' },
    });
  });

  it('rejeita A1 em A2 com mesmo UID, agência, perfil e referência de usuário', () => {
    const usuarioReutilizado = { uid: 'usuario-a' };
    const sessaoA1 = {
      userId: usuarioReutilizado.uid,
      geracao: 1,
      agencyId: 'agencia-1',
      role: 'admin',
    };
    const selecaoA1 = criarSelecaoCliente(maria1, sessaoA1, 'editar');
    const sessaoA2 = { ...sessaoA1, userId: usuarioReutilizado.uid, geracao: 3 };

    expect(operacaoClientePertenceASessao(
      sessaoA2,
      selecaoA1.identidade,
      usuarioReutilizado.uid,
      [maria1],
      selecaoA1.cliente.id
    )).toBe(false);
  });

  it('não chama services de criação, edição ou exclusão com origens residuais de A1', async () => {
    const sessaoA1 = {
      userId: 'usuario-a',
      geracao: 1,
      agencyId: 'agencia-1',
      role: 'admin',
    };
    const sessaoA2 = { ...sessaoA1, geracao: 3 };
    const formularioA1 = criarFormularioCriacaoCliente(sessaoA1);
    const edicaoA1 = criarSelecaoCliente(maria1, sessaoA1, 'editar');
    const exclusaoA1 = criarSelecaoCliente(maria1, sessaoA1, 'excluir');
    const criar = vi.fn();
    const atualizar = vi.fn();
    const excluir = vi.fn();

    if (operacaoClientePertenceASessao(
      sessaoA2, formularioA1.identidade, 'usuario-a', [maria1]
    )) await criar();
    if (operacaoClientePertenceASessao(
      sessaoA2, edicaoA1.identidade, 'usuario-a', [maria1], edicaoA1.cliente.id
    )) await atualizar();
    if (operacaoClientePertenceASessao(
      sessaoA2, exclusaoA1.identidade, 'usuario-a', [maria1], exclusaoA1.cliente.id
    )) await excluir();

    expect(criar).not.toHaveBeenCalled();
    expect(atualizar).not.toHaveBeenCalled();
    expect(excluir).not.toHaveBeenCalled();
  });
});
