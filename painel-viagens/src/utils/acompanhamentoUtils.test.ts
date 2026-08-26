import { describe, expect, it } from 'vitest';
import type { Acompanhamento, Cotacao } from '../types';
import {
  classificarProximaAcao,
  formatarDataComercial,
  formatarDataComercialParaInput,
  montarAcompanhamentoId,
  normalizarDataComercialParaTimestamp,
  obterClienteIdConsistente,
  selecionarCotacaoAncoraId,
  vincularCotacoesLocalmente,
} from './acompanhamentoUtils';

function cotacao(id: string, overrides: Partial<Cotacao> = {}): Cotacao {
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
    ...overrides,
  };
}

describe('identidade persistente do acompanhamento', () => {
  it('escolhe a mesma âncora pela ordenação binária dos IDs', () => {
    expect(selecionarCotacaoAncoraId([
      cotacao('cotacao-c'),
      cotacao('cotacao-a'),
      cotacao('cotacao-b'),
    ])).toBe('cotacao-a');
    expect(selecionarCotacaoAncoraId([
      cotacao('cotacao-b'),
      cotacao('cotacao-c'),
      cotacao('cotacao-a'),
    ])).toBe('cotacao-a');
  });

  it('gera o mesmo ID para a mesma âncora e IDs diferentes para oportunidades distintas', () => {
    expect(montarAcompanhamentoId('owner-1', 'cotacao-a')).toBe(
      montarAcompanhamentoId('owner-1', 'cotacao-a')
    );
    expect(montarAcompanhamentoId('owner-1', 'cotacao-a')).not.toBe(
      montarAcompanhamentoId('owner-1', 'cotacao-b')
    );
  });

  it('só persiste clienteId quando todas as cotações possuem o mesmo vínculo', () => {
    expect(obterClienteIdConsistente([
      cotacao('a', { clienteId: 'cliente-1' }),
      cotacao('b', { clienteId: 'cliente-1' }),
    ])).toBe('cliente-1');
    expect(obterClienteIdConsistente([
      cotacao('a', { clienteId: 'cliente-1' }),
      cotacao('b'),
    ])).toBeUndefined();
  });

  it('preserva exatamente 28/08/2026 sem deslocamento de dia', () => {
    const timestamp = normalizarDataComercialParaTimestamp('2026-08-28');
    expect(formatarDataComercialParaInput(timestamp)).toBe('2026-08-28');
    expect(formatarDataComercial(timestamp)).toBe('28/08/2026');
    expect(timestamp.toDate().toISOString()).toBe('2026-08-28T12:00:00.000Z');
  });

  it('mantém o acompanhamento após editar telefone ou adicionar clienteId', () => {
    const vinculada = vincularCotacoesLocalmente(
      [cotacao('a')],
      ['a'],
      'acompanhamento-1'
    )[0];
    const alterada = {
      ...vinculada,
      telefone: '79999999999',
      clienteId: 'cliente-1',
    };
    expect(alterada.acompanhamentoId).toBe('acompanhamento-1');
  });

  it('não vincula nova cotação automaticamente e rejeita troca incompatível', () => {
    const resultado = vincularCotacoesLocalmente(
      [cotacao('existente'), cotacao('nova')],
      ['existente'],
      'acompanhamento-1'
    );
    expect(resultado[0].acompanhamentoId).toBe('acompanhamento-1');
    expect(resultado[1].acompanhamentoId).toBeUndefined();

    expect(() => vincularCotacoesLocalmente(
      [cotacao('existente', { acompanhamentoId: 'outro' })],
      ['existente'],
      'acompanhamento-1'
    )).toThrow('outro acompanhamento');
  });

  it('mantém a lista de acompanhamentos tipada sem campos especulativos', () => {
    const acompanhamento: Acompanhamento = {
      id: 'a',
      ownerId: 'owner-1',
      agencyId: 'agencia-1',
      cotacaoAncoraId: 'cotacao-a',
      proximaAcaoEm: normalizarDataComercialParaTimestamp('2026-08-28'),
      createdAt: normalizarDataComercialParaTimestamp('2026-08-27'),
      updatedAt: normalizarDataComercialParaTimestamp('2026-08-27'),
    };
    expect(acompanhamento).not.toHaveProperty('status');
    expect(acompanhamento).not.toHaveProperty('tipoAcao');
  });
});

describe('classificação da próxima ação', () => {
  const hoje = new Date('2026-08-28T18:30:00.000Z');

  it.each([
    ['2026-08-27', 'ATRASADA'],
    ['2026-08-28', 'HOJE'],
    ['2026-08-29', 'PRÓXIMA'],
  ] as const)('classifica %s como %s', (data, classificacao) => {
    expect(classificarProximaAcao(
      normalizarDataComercialParaTimestamp(data),
      hoje
    )).toBe(classificacao);
  });

  it('classifica data ausente como NÃO DEFINIDA', () => {
    expect(classificarProximaAcao(null, hoje)).toBe('NÃO DEFINIDA');
  });

  it('usa o dia UTC mesmo quando a referência possui outro timezone', () => {
    const referenciaComFuso = new Date('2026-08-28T00:30:00+14:00');

    expect(classificarProximaAcao(
      normalizarDataComercialParaTimestamp('2026-08-27'),
      referenciaComFuso
    )).toBe('HOJE');
  });
});
