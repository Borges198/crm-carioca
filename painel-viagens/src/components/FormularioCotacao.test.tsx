import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cliente } from '../types';
import { montarNovaCotacao } from '../utils/cotacaoMapper';

const { listarClientesDoUsuario } = vi.hoisted(() => ({
  listarClientesDoUsuario: vi.fn(),
}));

vi.mock('../services/clientesService', () => ({
  buscarClientePorTelefoneDoUsuario: vi.fn(),
  listarClientesDoUsuario,
}));

import {
  agendarBuscaClientePorTelefone,
  carregarClientesDoAutocomplete,
  DEBOUNCE_PESQUISA_TELEFONE_MS,
  filtrarClientesPorNome,
  manterClienteSelecionadoAposAlteracaoNome,
  manterClienteSelecionadoAposAlteracaoTelefone,
  obterClienteSelecionadoDaSessao,
  obterClienteSugeridoPorTelefone,
  obterTelefonePreenchivel,
  selecionarClienteDoAutocomplete,
  type SugestaoPorTelefone,
} from './FormularioCotacao';

const clientes: Cliente[] = [
  {
    id: 'cliente-1',
    nome: 'Ana Souza',
    telefone: '(79) 99999-1111',
    telefoneNormalizado: '79999991111',
  },
  {
    id: 'cliente-2',
    nome: 'Bruno Lima',
  },
  {
    id: 'cliente-3',
    nome: 'Ana Souza',
    telefone: '(79) 98888-2222',
    telefoneNormalizado: '79988882222',
  },
] as Cliente[];

const sugestaoPorTelefone: SugestaoPorTelefone = {
  userId: 'usuario-1',
  telefoneNormalizado: '79999991111',
  cliente: clientes[0],
};

describe('FormularioCotacao - autocomplete de clientes', () => {
  beforeEach(() => {
    listarClientesDoUsuario.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('carrega clientes quando userId existe', async () => {
    listarClientesDoUsuario.mockResolvedValue(clientes);

    await expect(carregarClientesDoAutocomplete('usuario-1')).resolves.toEqual(clientes);
    expect(listarClientesDoUsuario).toHaveBeenCalledOnce();
    expect(listarClientesDoUsuario).toHaveBeenCalledWith('usuario-1');
  });

  it('não consulta clientes sem userId', async () => {
    await expect(carregarClientesDoAutocomplete()).resolves.toEqual([]);
    expect(listarClientesDoUsuario).not.toHaveBeenCalled();
  });

  it('filtra opções ao digitar parte do nome', () => {
    expect(filtrarClientesPorNome(clientes, 'Brun')).toEqual([clientes[1]]);
  });

  it('filtra nomes sem diferenciar maiúsculas e minúsculas', () => {
    expect(filtrarClientesPorNome(clientes, 'aNa')).toEqual([clientes[0], clientes[2]]);
  });

  it('seleciona uma sugestão preenchendo nome e telefone', () => {
    const setCliente = vi.fn();
    const setTelefone = vi.fn();
    const setClienteSelecionado = vi.fn();

    selecionarClienteDoAutocomplete(
      clientes[0],
      setCliente,
      setTelefone,
      setClienteSelecionado
    );

    expect(setCliente).toHaveBeenCalledWith('Ana Souza');
    expect(setTelefone).toHaveBeenCalledWith('(79) 99999-1111');
    expect(setClienteSelecionado).toHaveBeenCalledWith(clientes[0]);
  });

  it('seleciona cliente sem telefone deixando o telefone vazio', () => {
    const setCliente = vi.fn();
    const setTelefone = vi.fn();
    const setClienteSelecionado = vi.fn();

    selecionarClienteDoAutocomplete(
      clientes[1],
      setCliente,
      setTelefone,
      setClienteSelecionado
    );

    expect(setCliente).toHaveBeenCalledWith('Bruno Lima');
    expect(setTelefone).toHaveBeenCalledWith('');
    expect(setClienteSelecionado).toHaveBeenCalledWith(clientes[1]);
    expect(obterTelefonePreenchivel(clientes[1])).toBe('');
  });

  it('alterar nome depois da seleção invalida o cliente selecionado', () => {
    expect(
      manterClienteSelecionadoAposAlteracaoNome(clientes[0], 'Cliente B')
    ).toBeNull();
  });

  it('alterar telefone depois da seleção invalida o cliente selecionado', () => {
    expect(
      manterClienteSelecionadoAposAlteracaoTelefone(clientes[0], '(79) 97777-3333')
    ).toBeNull();
  });

  it('digitação manual sem seleção não propaga cliente', () => {
    expect(
      manterClienteSelecionadoAposAlteracaoNome(null, 'Cliente Manual')
    ).toBeNull();
    expect(
      manterClienteSelecionadoAposAlteracaoTelefone(null, '(79) 96666-4444')
    ).toBeNull();
  });

  it('invalida cliente selecionado quando a sessão muda de A para B', () => {
    const selecaoDoUsuarioA = {
      userId: 'usuario-a',
      geracao: 0,
      cliente: clientes[0],
    };

    expect(obterClienteSelecionadoDaSessao(
      selecaoDoUsuarioA,
      { userId: 'usuario-a', geracao: 0 }
    ))
      .toBe(clientes[0]);
    expect(obterClienteSelecionadoDaSessao(
      selecaoDoUsuarioA,
      { userId: 'usuario-b', geracao: 1 }
    ))
      .toBeNull();
    expect(obterClienteSelecionadoDaSessao(
      selecaoDoUsuarioA,
      { userId: undefined, geracao: 1 }
    ))
      .toBeNull();
    expect(obterClienteSelecionadoDaSessao(
      selecaoDoUsuarioA,
      { userId: 'usuario-a', geracao: 2 }
    ))
      .toBeNull();
  });

  it('não envia clienteId antigo ao payload depois da troca de usuário', () => {
    const selecaoDoUsuarioA = {
      userId: 'usuario-a',
      geracao: 0,
      cliente: clientes[0],
    };
    const clienteSelecionadoPeloUsuarioB = obterClienteSelecionadoDaSessao(
      selecaoDoUsuarioA,
      { userId: 'usuario-b', geracao: 1 }
    );
    const payload = montarNovaCotacao({
      ownerId: 'usuario-b',
      agencyId: 'agencia-1',
      clienteId: clienteSelecionadoPeloUsuarioB?.id,
      cliente: 'Cliente Manual',
      origem: 'AJU',
      destino: 'GRU',
      companhia: 'Latam',
      tipoVoo: 'ida',
      dataIda: '10-07-2026',
      dataVolta: '',
      horaSaidaIda: '10:00',
      horaChegadaIda: '12:00',
      horaSaidaVolta: '',
      horaChegadaVolta: '',
      paradasIda: 'Direto',
      paradasVolta: '',
      qtdPontos: 10,
      taxaEmbarque: 20,
      valorTotal: 500,
    });

    expect(payload.ownerId).toBe('usuario-b');
    expect(payload).not.toHaveProperty('clienteId');
  });

  it('mantém clientes homônimos como opções distintas', () => {
    const sugestoes = filtrarClientesPorNome(clientes, 'Ana Souza');

    expect(sugestoes).toHaveLength(2);
    expect(sugestoes.map((cliente) => cliente.id)).toEqual(['cliente-1', 'cliente-3']);
    expect(sugestoes.map(obterTelefonePreenchivel)).toEqual([
      '(79) 99999-1111',
      '(79) 98888-2222',
    ]);
  });

  it('nome inexistente não produz sugestão', () => {
    expect(filtrarClientesPorNome(clientes, 'Cliente Novo')).toEqual([]);
  });

  it('erro ao carregar clientes retorna lista vazia', async () => {
    const erro = new Error('Firestore indisponível');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    listarClientesDoUsuario.mockRejectedValue(erro);

    await expect(carregarClientesDoAutocomplete('usuario-1')).resolves.toEqual([]);

    expect(consoleError).toHaveBeenCalledWith('Erro ao buscar clientes:', erro);
    consoleError.mockRestore();
  });

  it('aceita sugestão do mesmo usuário e telefone', () => {
    expect(
      obterClienteSugeridoPorTelefone(sugestaoPorTelefone, 'usuario-1', '(79) 99999-1111')
    ).toBe(clientes[0]);
  });

  it('rejeita sugestão de outro usuário', () => {
    expect(
      obterClienteSugeridoPorTelefone(sugestaoPorTelefone, 'usuario-2', '(79) 99999-1111')
    ).toBeNull();
  });

  it('rejeita sugestão de telefone antigo', () => {
    expect(
      obterClienteSugeridoPorTelefone(sugestaoPorTelefone, 'usuario-1', '(79) 98888-2222')
    ).toBeNull();
  });

  it('rejeita sugestão sem usuário autenticado', () => {
    expect(
      obterClienteSugeridoPorTelefone(sugestaoPorTelefone, undefined, '(79) 99999-1111')
    ).toBeNull();
  });

  it('rejeita sugestão sem cliente encontrado', () => {
    expect(
      obterClienteSugeridoPorTelefone(
        { ...sugestaoPorTelefone, cliente: null },
        'usuario-1',
        '(79) 99999-1111'
      )
    ).toBeNull();
  });

  it('telefone vazio invalida sugestão anterior', () => {
    expect(
      obterClienteSugeridoPorTelefone(sugestaoPorTelefone, 'usuario-1', '')
    ).toBeNull();
  });

  it('troca de usuário não reutiliza cliente anterior', () => {
    const clienteDoUsuarioAnterior = obterClienteSugeridoPorTelefone(
      sugestaoPorTelefone,
      'usuario-2',
      '(79) 99999-1111'
    );

    expect(clienteDoUsuarioAnterior).toBeNull();
  });

  it('digitação rápida consulta somente o último telefone após o debounce', async () => {
    vi.useFakeTimers();
    const buscarCliente = vi.fn().mockResolvedValue(clientes[0]);
    const aoConcluir = vi.fn();

    const cancelarPrimeira = agendarBuscaClientePorTelefone({
      userId: 'usuario-1',
      telefone: '8',
      aoConcluir,
      buscarCliente,
    });
    cancelarPrimeira();
    const cancelarSegunda = agendarBuscaClientePorTelefone({
      userId: 'usuario-1',
      telefone: '82',
      aoConcluir,
      buscarCliente,
    });
    cancelarSegunda();
    agendarBuscaClientePorTelefone({
      userId: 'usuario-1',
      telefone: '82999',
      aoConcluir,
      buscarCliente,
    });

    await vi.advanceTimersByTimeAsync(DEBOUNCE_PESQUISA_TELEFONE_MS);

    expect(buscarCliente).toHaveBeenCalledOnce();
    expect(buscarCliente).toHaveBeenCalledWith('usuario-1', '82999');
  });

  it('consulta o telefone atual somente após a estabilização', async () => {
    vi.useFakeTimers();
    const buscarCliente = vi.fn().mockResolvedValue(clientes[0]);
    const aoConcluir = vi.fn();

    agendarBuscaClientePorTelefone({
      userId: 'usuario-1',
      telefone: '(79) 99999-1111',
      aoConcluir,
      buscarCliente,
    });

    await vi.advanceTimersByTimeAsync(DEBOUNCE_PESQUISA_TELEFONE_MS - 1);
    expect(buscarCliente).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(buscarCliente).toHaveBeenCalledWith('usuario-1', '79999991111');
    expect(aoConcluir).toHaveBeenCalledWith(sugestaoPorTelefone);
  });

  it('campo vazio não agenda consulta e invalida a sugestão anterior', async () => {
    vi.useFakeTimers();
    const buscarCliente = vi.fn();
    const aoConcluir = vi.fn();

    const cancelarBuscaPendente = agendarBuscaClientePorTelefone({
      userId: 'usuario-1',
      telefone: '(79) 99999-1111',
      aoConcluir,
      buscarCliente,
    });
    cancelarBuscaPendente();
    agendarBuscaClientePorTelefone({
      userId: 'usuario-1',
      telefone: '',
      aoConcluir,
      buscarCliente,
    });

    await vi.runAllTimersAsync();

    expect(buscarCliente).not.toHaveBeenCalled();
    expect(aoConcluir).not.toHaveBeenCalled();
    expect(obterClienteSugeridoPorTelefone(sugestaoPorTelefone, 'usuario-1', '')).toBeNull();
  });

  it('resposta de telefone antigo não substitui o telefone atual', async () => {
    vi.useFakeTimers();
    let resolverBuscaAntiga: ((cliente: Cliente | null) => void) | undefined;
    const buscarClienteAntigo = vi.fn(() => new Promise<Cliente | null>((resolve) => {
      resolverBuscaAntiga = resolve;
    }));
    const aoConcluir = vi.fn();

    const cancelarBuscaAntiga = agendarBuscaClientePorTelefone({
      userId: 'usuario-1',
      telefone: '(79) 99999-1111',
      aoConcluir,
      buscarCliente: buscarClienteAntigo,
    });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_PESQUISA_TELEFONE_MS);
    cancelarBuscaAntiga();

    agendarBuscaClientePorTelefone({
      userId: 'usuario-1',
      telefone: '(79) 98888-2222',
      aoConcluir,
      buscarCliente: vi.fn().mockResolvedValue(clientes[2]),
    });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_PESQUISA_TELEFONE_MS);
    resolverBuscaAntiga?.(clientes[0]);
    await Promise.resolve();

    expect(aoConcluir).toHaveBeenCalledOnce();
    expect(aoConcluir).toHaveBeenCalledWith({
      userId: 'usuario-1',
      telefoneNormalizado: '79988882222',
      cliente: clientes[2],
    });
  });

  it('troca de usuário cancela resultado pendente do usuário anterior', async () => {
    vi.useFakeTimers();
    let resolverBuscaAnterior: ((cliente: Cliente | null) => void) | undefined;
    const buscarCliente = vi.fn(() => new Promise<Cliente | null>((resolve) => {
      resolverBuscaAnterior = resolve;
    }));
    const aoConcluir = vi.fn();

    const cancelarBuscaAnterior = agendarBuscaClientePorTelefone({
      userId: 'usuario-1',
      telefone: '(79) 99999-1111',
      aoConcluir,
      buscarCliente,
    });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_PESQUISA_TELEFONE_MS);
    cancelarBuscaAnterior();
    resolverBuscaAnterior?.(clientes[0]);
    await Promise.resolve();

    expect(aoConcluir).not.toHaveBeenCalled();
    expect(
      obterClienteSugeridoPorTelefone(sugestaoPorTelefone, 'usuario-2', '(79) 99999-1111')
    ).toBeNull();
  });

  it('logout cancela o debounce antes da consulta', async () => {
    vi.useFakeTimers();
    const buscarCliente = vi.fn();
    const cancelarBusca = agendarBuscaClientePorTelefone({
      userId: 'usuario-1',
      telefone: '(79) 99999-1111',
      aoConcluir: vi.fn(),
      buscarCliente,
    });

    cancelarBusca();
    await vi.runAllTimersAsync();

    expect(buscarCliente).not.toHaveBeenCalled();
  });
});
