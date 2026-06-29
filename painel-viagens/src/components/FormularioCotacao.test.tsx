import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cliente } from '../types';

const { listarClientesDoUsuario } = vi.hoisted(() => ({
  listarClientesDoUsuario: vi.fn(),
}));

vi.mock('../services/clientesService', () => ({
  buscarClientePorTelefoneDoUsuario: vi.fn(),
  listarClientesDoUsuario,
}));

import {
  carregarClientesDoAutocomplete,
  filtrarClientesPorNome,
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

    selecionarClienteDoAutocomplete(clientes[0], setCliente, setTelefone);

    expect(setCliente).toHaveBeenCalledWith('Ana Souza');
    expect(setTelefone).toHaveBeenCalledWith('(79) 99999-1111');
  });

  it('seleciona cliente sem telefone deixando o telefone vazio', () => {
    const setCliente = vi.fn();
    const setTelefone = vi.fn();

    selecionarClienteDoAutocomplete(clientes[1], setCliente, setTelefone);

    expect(setCliente).toHaveBeenCalledWith('Bruno Lima');
    expect(setTelefone).toHaveBeenCalledWith('');
    expect(obterTelefonePreenchivel(clientes[1])).toBe('');
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
});
