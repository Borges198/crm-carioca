import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ItinerarioCotacao, SentidoItinerario } from '../types';
import {
  derivarItinerarioDeCotacaoLegada,
  obterItinerarioEfetivo,
  resumirSentidoItinerario,
} from './itinerarioUtils';

describe('fundacao do modelo de itinerario', () => {
  it('fixa a direcao de ida e volta no contrato TypeScript', () => {
    expectTypeOf<ItinerarioCotacao['ida']['tipo']>().toEqualTypeOf<'ida'>();
    expectTypeOf<NonNullable<ItinerarioCotacao['volta']>['tipo']>()
      .toEqualTypeOf<'volta'>();
    expectTypeOf<[]>().not.toMatchTypeOf<ItinerarioCotacao['ida']['pernas']>();
  });

  it('representa voo direto com datas diferentes de saida e chegada', () => {
    const ida: SentidoItinerario = {
      tipo: 'ida',
      pernas: [{
        origem: 'AJU',
        destino: 'BSB',
        companhia: 'Latam',
        numeroVoo: 'LA 3701',
        dataSaida: '2026-09-03',
        horaSaida: '23:30',
        dataChegada: '2026-09-04',
        horaChegada: '00:20',
        duracao: '0h 50m',
      }],
      duracaoTotal: '0h 50m',
    };

    expect(resumirSentidoItinerario(ida)).toEqual({
      origem: 'AJU',
      destino: 'BSB',
      dataSaida: '2026-09-03',
      horaSaida: '23:30',
      dataChegada: '2026-09-04',
      horaChegada: '00:20',
      duracaoTotal: '0h 50m',
      quantidadeParadas: 0,
      companhias: ['Latam'],
    });
  });

  it('resume multiplas pernas sem perder aeroportos, companhias ou voos', () => {
    const ida: SentidoItinerario = {
      tipo: 'ida',
      pernas: [
        {
          origem: 'GIG',
          destino: 'VCP',
          companhia: 'Azul',
          numeroVoo: 'AD 4101',
          dataSaida: '2026-08-23',
          horaSaida: '20:40',
          dataChegada: '2026-08-23',
          horaChegada: '21:50',
        },
        {
          origem: 'VCP',
          destino: 'AJU',
          companhia: 'GOL',
          numeroVoo: 'G3 1902',
          dataSaida: '2026-08-24',
          horaSaida: '12:20',
          dataChegada: '2026-08-24',
          horaChegada: '14:15',
        },
      ],
      duracaoTotal: '17h 35m',
    };

    expect(resumirSentidoItinerario(ida)).toEqual({
      origem: 'GIG',
      destino: 'AJU',
      dataSaida: '2026-08-23',
      horaSaida: '20:40',
      dataChegada: '2026-08-24',
      horaChegada: '14:15',
      duracaoTotal: '17h 35m',
      quantidadeParadas: 1,
      companhias: ['Azul', 'GOL'],
    });
    expect(ida.pernas).toHaveLength(2);
    expect(ida.pernas.map((perna) => perna.destino)).toEqual(['VCP', 'AJU']);
    expect(ida.pernas.map((perna) => perna.numeroVoo)).toEqual(['AD 4101', 'G3 1902']);
  });

  it('preserva itinerario estruturado de ida e volta quando ele ja existe', () => {
    const itinerario: ItinerarioCotacao = {
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [{ origem: 'AJU', destino: 'GRU', companhia: 'Latam' }],
      },
      volta: {
        tipo: 'volta',
        pernas: [{ origem: 'GRU', destino: 'AJU', companhia: 'Azul' }],
      },
    };
    const cotacao = {
      cotacao: {
        origem: 'AJU',
        destino: 'GRU',
        companhia: 'Latam',
      },
      itinerario,
    };

    expect(obterItinerarioEfetivo(cotacao)).toBe(itinerario);
  });

  it('deriva somente ida de uma cotacao antiga sem inventar data de chegada', () => {
    const itinerario = derivarItinerarioDeCotacaoLegada({
      origem: ' AJU ',
      destino: ' GRU ',
      companhia: ' Latam ',
      tipoVoo: 'ida',
      dataIda: '2026-07-25',
      horaSaidaIda: '10:00',
      horaChegadaIda: '12:30',
      duracaoIda: '2h 30m',
      paradasIda: 'Direto',
    });

    expect(itinerario).toEqual({
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [{
          origem: 'AJU',
          destino: 'GRU',
          companhia: 'Latam',
          dataSaida: '2026-07-25',
          horaSaida: '10:00',
          horaChegada: '12:30',
        }],
        fonte: 'legado',
        duracaoTotal: '2h 30m',
        paradas: 'Direto',
      },
    });
    expect(itinerario.ida.pernas[0]).not.toHaveProperty('dataChegada');
    expect(itinerario).not.toHaveProperty('volta');
  });

  it('deriva ida e volta legadas com rotas e companhias independentes', () => {
    const cotacaoLegada = {
      origem: 'GIG',
      destino: 'NVT',
      origemIda: 'SDU',
      destinoIda: 'NVT',
      origemVolta: 'NVT',
      destinoVolta: 'GIG',
      companhia: 'Latam',
      companhiaIda: 'Latam',
      companhiaVolta: 'Azul',
      tipoVoo: 'ida_volta',
      dataIda: '2026-07-28',
      dataVolta: '2026-08-02',
      horaSaidaIda: '08:00',
      horaChegadaIda: '10:00',
      horaSaidaVolta: '18:00',
      horaChegadaVolta: '20:30',
      paradasIda: 'Direto',
      paradasVolta: '1 Parada',
    };
    const copiaAntes = structuredClone(cotacaoLegada);

    expect(derivarItinerarioDeCotacaoLegada(cotacaoLegada)).toEqual({
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [{
          origem: 'SDU',
          destino: 'NVT',
          companhia: 'Latam',
          dataSaida: '2026-07-28',
          horaSaida: '08:00',
          horaChegada: '10:00',
        }],
        fonte: 'legado',
        paradas: 'Direto',
      },
      volta: {
        tipo: 'volta',
        pernas: [{
          origem: 'NVT',
          destino: 'GIG',
          companhia: 'Azul',
          dataSaida: '2026-08-02',
          horaSaida: '18:00',
          horaChegada: '20:30',
        }],
        fonte: 'legado',
        paradas: '1 Parada',
      },
    });
    expect(cotacaoLegada).toEqual(copiaAntes);
  });

  it('reconhece volta legada por seus campos mesmo sem tipoVoo', () => {
    const itinerario = obterItinerarioEfetivo({
      cotacao: {
        origem: 'AJU',
        destino: 'BSB',
        companhia: 'Latam',
        dataIda: '2026-09-03',
        dataVolta: '2026-09-18',
      },
    });

    expect(itinerario.volta).toMatchObject({
      tipo: 'volta',
      pernas: [{
        origem: 'BSB',
        destino: 'AJU',
        companhia: 'Latam',
        dataSaida: '2026-09-18',
      }],
    });
  });

  it('respeita somente ida mesmo quando existem campos residuais de volta', () => {
    const itinerario = obterItinerarioEfetivo({
      cotacao: {
        origem: 'AJU',
        destino: 'BSB',
        companhia: 'Latam',
        tipoVoo: 'ida',
        dataIda: '2026-09-03',
        dataVolta: '2026-09-18',
        origemVolta: 'BSB',
        destinoVolta: 'AJU',
      },
    });

    expect(itinerario).not.toHaveProperty('volta');
  });

  it('preserva a quantidade de paradas informada por uma cotacao legada', () => {
    const itinerario = derivarItinerarioDeCotacaoLegada({
      origem: 'GIG',
      destino: 'AJU',
      companhia: 'Azul',
      dataIda: '2026-08-23',
      paradasIda: '2 Paradas',
    });

    expect(resumirSentidoItinerario(itinerario.ida).quantidadeParadas).toBe(2);
  });

  it('nao usa o resumo textual de paradas em um sentido estruturado', () => {
    const sentido: SentidoItinerario<'ida'> = {
      tipo: 'ida',
      fonte: 'estruturado',
      pernas: [{ origem: 'AJU', destino: 'BSB' }],
      paradas: '2 Paradas',
    };

    expect(resumirSentidoItinerario(sentido).quantidadeParadas).toBe(0);
  });

  it('resume duas conexoes e elimina companhias repetidas do resumo', () => {
    const sentido: SentidoItinerario<'ida'> = {
      tipo: 'ida',
      pernas: [
        { origem: 'GIG', destino: 'VCP', companhia: 'Azul' },
        { origem: 'VCP', destino: 'CNF', companhia: 'Azul' },
        { origem: 'CNF', destino: 'AJU', companhia: 'GOL' },
      ],
    };

    expect(resumirSentidoItinerario(sentido)).toMatchObject({
      origem: 'GIG',
      destino: 'AJU',
      quantidadeParadas: 2,
      companhias: ['Azul', 'GOL'],
    });
  });
});
