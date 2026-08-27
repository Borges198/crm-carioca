import { describe, expect, it } from 'vitest';
import type { Acompanhamento, Cotacao } from '../types';
import {
  classificarProximaAcao,
  formatarDataComercial,
  formatarDataComercialParaInput,
  montarAcompanhamentoId,
  normalizarDataComercialParaTimestamp,
  obterClienteIdConsistente,
  ordenarPorProximaAcao,
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

describe('ordenação pela próxima ação', () => {
  const hoje = new Date('2026-08-28T18:30:00.000Z');
  const criarItem = (id: string, data: string | null) => ({
    id,
    proximaAcaoEm: data ? normalizarDataComercialParaTimestamp(data) : null,
  });
  const ordenar = (itens: ReturnType<typeof criarItem>[]) => ordenarPorProximaAcao(
    itens,
    (item) => item.proximaAcaoEm,
    hoje
  );

  it('coloca atrasada antes de hoje', () => {
    expect(ordenar([
      criarItem('hoje', '2026-08-28'),
      criarItem('atrasada', '2026-08-27'),
    ]).map((item) => item.id)).toEqual(['atrasada', 'hoje']);
  });

  it('coloca hoje antes de futura', () => {
    expect(ordenar([
      criarItem('futura', '2026-08-29'),
      criarItem('hoje', '2026-08-28'),
    ]).map((item) => item.id)).toEqual(['hoje', 'futura']);
  });

  it('coloca futura antes de sem data', () => {
    expect(ordenar([
      criarItem('sem-data', null),
      criarItem('futura', '2026-08-29'),
    ]).map((item) => item.id)).toEqual(['futura', 'sem-data']);
  });

  it('ordena duas futuras pela mais próxima primeiro', () => {
    expect(ordenar([
      criarItem('mais-distante', '2026-09-10'),
      criarItem('mais-proxima', '2026-08-29'),
    ]).map((item) => item.id)).toEqual(['mais-proxima', 'mais-distante']);
  });

  it('ordena duas atrasadas pela mais antiga primeiro', () => {
    expect(ordenar([
      criarItem('mais-recente', '2026-08-27'),
      criarItem('mais-antiga', '2026-08-20'),
    ]).map((item) => item.id)).toEqual(['mais-antiga', 'mais-recente']);
  });

  it('preserva a ordem relativa dos itens sem data', () => {
    const primeiro = criarItem('primeiro', null);
    const segundo = criarItem('segundo', null);

    expect(ordenar([primeiro, segundo])).toEqual([primeiro, segundo]);
  });

  it('preserva a ordem relativa dos itens de hoje', () => {
    const primeiro = criarItem('primeiro', '2026-08-28');
    const segundo = criarItem('segundo', '2026-08-28');

    expect(ordenar([primeiro, segundo])).toEqual([primeiro, segundo]);
  });

  it('não altera a lista original', () => {
    const itens = [
      criarItem('sem-data', null),
      criarItem('atrasada', '2026-08-27'),
    ];

    ordenar(itens);

    expect(itens.map((item) => item.id)).toEqual(['sem-data', 'atrasada']);
  });
});
