import { describe, expect, it, vi } from 'vitest';
import {
  clienteJaExiste,
  converterCotacaoFechadaEmCliente,
  montarClienteDeCotacaoFechada,
  montarResumoViagem,
  normalizarNomeCliente,
  normalizarTelefoneCliente,
} from './clienteConversionUtils';
import type { Cliente, Cotacao } from '../types';

const clienteBase: Cliente = {
  id: 'cliente-1',
  nome: 'Maria Silva',
  telefone: '(79) 99999-9999',
  origemLead: 'Cotação fechada',
  primeiraViagem: 'AJU → GRU',
  dataCadastro: '2026-06-16',
};

const cotacaoFechada = {
  id: 'cotacao-1',
  cliente: 'Maria Silva',
  telefone: '(79) 99999-9999',
  origem: 'AJU',
  destino: 'GRU',
  dataIda: '2026-07-25',
  valorTotal: 1000,
  companhia: 'Azul',
  dataRegistro: '2026-06-16',
  leadStatus: 'fechado',
} as Cotacao;

describe('clienteConversionUtils', () => {
  it('normaliza nome do cliente', () => {
    expect(normalizarNomeCliente('  Maria   SILVA  ')).toBe('maria silva');
  });

  it('normaliza telefone do cliente', () => {
    expect(normalizarTelefoneCliente('(79) 99999-9999')).toBe('79999999999');
  });

  it('identifica cliente duplicado por nome normalizado', () => {
    expect(clienteJaExiste([clienteBase], ' maria  silva ')).toBe(true);
  });

  it('identifica cliente duplicado por telefone normalizado', () => {
    expect(clienteJaExiste([clienteBase], 'Outro Nome', '79999999999')).toBe(true);
  });

  it('telefone vazio nao gera duplicidade falsa', () => {
    const clienteSemTelefone = {
      ...clienteBase,
      nome: 'Outro Cliente',
      telefone: '',
      telefoneNormalizado: '',
    };

    expect(clienteJaExiste([clienteSemTelefone], 'Maria Silva', '')).toBe(false);
  });

  it('telefone "Nao informado" nao gera duplicidade falsa', () => {
    const clienteSemTelefone = {
      ...clienteBase,
      nome: 'Outro Cliente',
      telefone: 'Não informado',
      telefoneNormalizado: '',
    };

    expect(clienteJaExiste([clienteSemTelefone], 'Maria Silva', 'Não informado')).toBe(false);
  });

  it('monta resumo da viagem com rota e data formatada', () => {
    const cotacao = {
      origem: 'AJU',
      destino: 'GRU',
      dataIda: '2026-07-25',
    } as Pick<Cotacao, 'origem' | 'destino' | 'dataIda'>;

    expect(montarResumoViagem(cotacao, () => '25/07/2026')).toBe('AJU → GRU | 25/07/2026');
  });

  it('usa a cotacao mais recente recebida como fonte do resumo', () => {
    const cotacaoMaisRecente = {
      origem: 'SSA',
      destino: 'REC',
      dataIda: '',
    } as Pick<Cotacao, 'origem' | 'destino' | 'dataIda'>;

    expect(montarResumoViagem(cotacaoMaisRecente, () => 'ignorado')).toBe('SSA → REC');
  });

  it('monta payload com ownerId correto e sem campos undefined', () => {
    const cliente = montarClienteDeCotacaoFechada({
      cotacao: { ...cotacaoFechada, telefone: undefined, telefoneNormalizado: undefined },
      userId: 'user-123',
      agencyId: 'agencia-1',
      formatarData: () => '25/07/2026',
      dataCadastro: new Date('2026-06-16T00:00:00.000Z'),
    });

    expect(cliente).toMatchObject({
      nome: 'Maria Silva',
      telefone: 'Não informado',
      origemLead: 'Cotação fechada',
      primeiraViagem: 'AJU → GRU | 25/07/2026',
      ownerId: 'user-123',
      agencyId: 'agencia-1',
    });
    expect(Object.values(cliente ?? {}).some((value) => value === undefined)).toBe(false);
    expect(cliente).not.toHaveProperty('telefoneNormalizado');
  });

  it('retorna missing_agency sem tentar criar cliente', async () => {
    const criarCliente = vi.fn();

    const resultado = await converterCotacaoFechadaEmCliente({
      cotacao: cotacaoFechada,
      userId: 'user-123',
      agencyId: '',
      formatarData: () => '25/07/2026',
      clientesExistentes: [],
      criarCliente,
    });

    expect(resultado.status).toBe('missing_agency');
    expect(criarCliente).not.toHaveBeenCalled();
  });

  it('so retorna sucesso depois da criacao concluir', async () => {
    const criarCliente = vi.fn().mockResolvedValue({ id: 'cliente-1' });

    const resultado = await converterCotacaoFechadaEmCliente({
      cotacao: cotacaoFechada,
      userId: 'user-123',
      agencyId: 'agencia-1',
      formatarData: () => '25/07/2026',
      clientesExistentes: [],
      criarCliente,
    });

    expect(criarCliente).toHaveBeenCalledTimes(1);
    expect(resultado.status).toBe('created');
  });

  it('erro de criacao nao marca cliente como criado', async () => {
    const criarCliente = vi.fn().mockRejectedValue(new Error('permission-denied'));

    await expect(converterCotacaoFechadaEmCliente({
      cotacao: cotacaoFechada,
      userId: 'user-123',
      agencyId: 'agencia-1',
      formatarData: () => '25/07/2026',
      clientesExistentes: [],
      criarCliente,
    })).rejects.toThrow('permission-denied');
  });
});
