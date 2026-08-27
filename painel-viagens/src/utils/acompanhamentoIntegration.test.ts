import { describe, expect, it, vi } from 'vitest';
import type { Acompanhamento, Cotacao } from '../types';
import {
  normalizarDataComercialParaTimestamp,
  vincularCotacoesLocalmente,
} from './acompanhamentoUtils';
import { persistirProximaAcaoCartela } from './acompanhamentoIntegration';

const data = normalizarDataComercialParaTimestamp('2026-08-28');

function cotacao(id: string): Cotacao {
  return {
    id,
    cliente: 'Cliente',
    origem: 'AJU',
    destino: 'GRU',
    companhia: 'Azul',
    valorTotal: 1000,
    dataIda: '2026-08-28',
    dataRegistro: '2026-08-01',
    ownerId: 'owner-1',
  };
}

function acompanhamento(): Acompanhamento {
  return {
    id: 'acompanhamento-1',
    ownerId: 'owner-1',
    agencyId: 'agencia-1',
    cotacaoAncoraId: 'a',
    proximaAcaoEm: data,
    createdAt: data,
    updatedAt: data,
  };
}

describe('persistência da próxima ação da cartela', () => {
  it('cancelar a primeira confirmação não executa nenhuma escrita', async () => {
    const materializar = vi.fn();
    const atualizar = vi.fn();
    const cotacoesGlobais = [cotacao('a'), cotacao('b'), cotacao('c')];

    const resultado = await persistirProximaAcaoCartela({
      ownerId: 'owner-1',
      agencyId: 'agencia-1',
      cotacoes: cotacoesGlobais.slice(0, 2),
      proximaAcaoEm: data,
      confirmarMaterializacao: () => false,
      materializar,
      atualizar,
    });

    expect(resultado).toEqual({ status: 'cancelled' });
    expect(materializar).not.toHaveBeenCalled();
    expect(atualizar).not.toHaveBeenCalled();
    expect(cotacoesGlobais.every((item) => item.acompanhamentoId === undefined)).toBe(true);
  });

  it('mantém iguais a quantidade confirmada, enviada e atualizada localmente', async () => {
    const criado = acompanhamento();
    const materializar = vi.fn().mockResolvedValue(criado);
    const confirmar = vi.fn(() => true);
    const cotacoesGlobais = [cotacao('a'), cotacao('b'), cotacao('c')];
    const cotacoesVisiveis = cotacoesGlobais.slice(0, 2);

    const resultado = await persistirProximaAcaoCartela({
      ownerId: 'owner-1',
      agencyId: 'agencia-1',
      cotacoes: cotacoesVisiveis,
      proximaAcaoEm: data,
      confirmarMaterializacao: confirmar,
      materializar,
      atualizar: vi.fn(),
    });

    expect(resultado).toEqual({ status: 'materialized', acompanhamento: criado });
    expect(confirmar).toHaveBeenCalledWith(2);
    expect(materializar).toHaveBeenCalledWith(expect.objectContaining({
      cotacoes: cotacoesVisiveis,
    }));
    expect(materializar).toHaveBeenCalledTimes(1);

    const cotacoesAtualizadas = vincularCotacoesLocalmente(
      cotacoesGlobais,
      cotacoesVisiveis.map((item) => item.id),
      criado.id
    );
    expect(cotacoesAtualizadas.map(({ id, acompanhamentoId }) => ({ id, acompanhamentoId })))
      .toEqual([
        { id: 'a', acompanhamentoId: criado.id },
        { id: 'b', acompanhamentoId: criado.id },
        { id: 'c', acompanhamentoId: undefined },
      ]);
  });

  it('edita acompanhamento existente sem confirmar membership novamente', async () => {
    const existente = acompanhamento();
    const confirmar = vi.fn();
    const atualizar = vi.fn().mockResolvedValue({
      ...existente,
      proximaAcaoEm: normalizarDataComercialParaTimestamp('2026-08-29'),
    });

    const resultado = await persistirProximaAcaoCartela({
      acompanhamentoExistente: existente,
      ownerId: 'owner-1',
      agencyId: 'agencia-1',
      cotacoes: [cotacao('a')],
      proximaAcaoEm: normalizarDataComercialParaTimestamp('2026-08-29'),
      confirmarMaterializacao: confirmar,
      materializar: vi.fn(),
      atualizar,
    });

    expect(resultado.status).toBe('updated');
    expect(confirmar).not.toHaveBeenCalled();
    expect(atualizar).toHaveBeenCalledTimes(1);
  });
});
