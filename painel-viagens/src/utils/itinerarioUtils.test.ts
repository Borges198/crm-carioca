import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ItinerarioCotacao, SentidoItinerario } from '../types';
import {
  derivarItinerarioDeCotacaoLegada,
  obterItinerarioEfetivo,
  projetarItinerarioParaCamposLegados,
  resumirSentidoItinerario,
  validarENormalizarItinerario,
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

  it('valida unknown e produz uma copia canonica sem chaves desconhecidas', () => {
    const entrada = {
      versao: 1,
      campoInesperado: 'não deve sobreviver',
      ida: {
        tipo: 'ida',
        fonte: ' estruturado ',
        campoInesperado: true,
        pernas: [{
          origem: ' aju ',
          destino: ' gru ',
          companhia: ' Latam ',
          numeroVoo: ' LA 3701 ',
          dataSaida: '03/09/2026',
          horaSaida: '7:05',
          dataChegada: '2026-09-03',
          horaChegada: '09:40',
          duracao: ' 2h 35m ',
          observacaoInesperada: 'remover',
        }],
        duracaoTotal: ' 2h 35m ',
        paradas: '  texto informativo ',
      },
      volta: null,
    };
    const copiaAntes = structuredClone(entrada);

    const itinerario = validarENormalizarItinerario(entrada);

    expect(itinerario).toEqual({
      versao: 1,
      ida: {
        tipo: 'ida',
        fonte: 'estruturado',
        pernas: [{
          origem: 'AJU',
          destino: 'GRU',
          companhia: 'Latam',
          numeroVoo: 'LA 3701',
          dataSaida: '2026-09-03',
          horaSaida: '07:05',
          dataChegada: '2026-09-03',
          horaChegada: '09:40',
          duracao: '2h 35m',
        }],
        duracaoTotal: '2h 35m',
        paradas: 'texto informativo',
      },
    });
    expect(entrada).toEqual(copiaAntes);
    expect(itinerario).not.toBe(entrada);
    expect(itinerario.ida).not.toBe(entrada.ida);
    expect(itinerario.ida.pernas[0]).not.toBe(entrada.ida.pernas[0]);
  });

  it.each([
    ['raiz não objeto', null, 'itinerario'],
    ['versão desconhecida', { versao: 2, ida: {} }, 'itinerario.versao'],
    ['direção incoerente', {
      versao: 1,
      ida: { tipo: 'volta', pernas: [{ origem: 'AJU', destino: 'GRU' }] },
    }, 'itinerario.ida.tipo'],
    ['lista de pernas vazia', {
      versao: 1,
      ida: { tipo: 'ida', pernas: [] },
    }, 'itinerario.ida.pernas'],
    ['origem ausente', {
      versao: 1,
      ida: { tipo: 'ida', pernas: [{ destino: 'GRU' }] },
    }, 'itinerario.ida.pernas[0].origem'],
    ['data impossível', {
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [{ origem: 'AJU', destino: 'GRU', dataSaida: '2026-02-30' }],
      },
    }, 'itinerario.ida.pernas[0].dataSaida'],
    ['horário impossível', {
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [{ origem: 'AJU', destino: 'GRU', horaSaida: '24:00' }],
      },
    }, 'itinerario.ida.pernas[0].horaSaida'],
    ['conexão descontínua', {
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [
          { origem: 'AJU', destino: 'GRU' },
          { origem: 'VCP', destino: 'BSB' },
        ],
      },
    }, 'itinerario.ida.pernas[1].origem'],
  ])('rejeita %s com caminho preciso', (_caso, entrada, caminho) => {
    expect(() => validarENormalizarItinerario(entrada)).toThrow(caminho);
  });

  it('rejeita chegada anterior a saida dentro da mesma perna', () => {
    expect(() => validarENormalizarItinerario({
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [{
          origem: 'AJU',
          destino: 'GRU',
          dataSaida: '2026-09-03',
          horaSaida: '18:00',
          dataChegada: '2026-09-03',
          horaChegada: '17:59',
        }],
      },
    })).toThrow('itinerario.ida.pernas[0].dataChegada');
  });

  it('aceita chegada no dia seguinte dentro da mesma perna', () => {
    const itinerario = validarENormalizarItinerario({
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [{
          origem: 'AJU',
          destino: 'GRU',
          dataSaida: '2026-09-03',
          horaSaida: '23:30',
          dataChegada: '2026-09-04',
          horaChegada: '00:20',
        }],
      },
    });

    expect(itinerario.ida.pernas[0].dataChegada).toBe('2026-09-04');
  });

  it('rejeita conexao cuja proxima saida antecede a chegada anterior', () => {
    expect(() => validarENormalizarItinerario({
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [
          {
            origem: 'AJU',
            destino: 'GRU',
            dataChegada: '2026-09-03',
            horaChegada: '14:30',
          },
          {
            origem: 'GRU',
            destino: 'BSB',
            dataSaida: '2026-09-03',
            horaSaida: '14:20',
          },
        ],
      },
    })).toThrow('itinerario.ida.pernas[1].dataSaida');
  });

  it('valida cronologia apenas quando os instantes comparados estao completos', () => {
    const itinerario = validarENormalizarItinerario({
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [
          {
            origem: 'AJU',
            destino: 'GRU',
            dataSaida: '2026-09-03',
            horaSaida: '18:00',
            horaChegada: '17:00',
          },
          {
            origem: 'GRU',
            destino: 'BSB',
            dataSaida: '2026-09-03',
            horaSaida: '16:00',
          },
        ],
      },
    });

    expect(itinerario.ida.pernas).toHaveLength(2);
  });

  it('projeta ida e volta com múltiplas pernas sem perder o itinerário detalhado', () => {
    const entrada = {
      versao: 1,
      ida: {
        tipo: 'ida',
        fonte: 'estruturado',
        duracaoTotal: '17h 35m',
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
      },
      volta: {
        tipo: 'volta',
        fonte: 'estruturado',
        duracaoTotal: '2h 20m',
        pernas: [{
          origem: 'AJU',
          destino: 'GIG',
          companhia: 'Latam',
          numeroVoo: 'LA 3810',
          dataSaida: '2026-09-02',
          horaSaida: '18:00',
          dataChegada: '2026-09-02',
          horaChegada: '20:20',
        }],
      },
    };
    const copiaAntes = structuredClone(entrada);
    const itinerario = validarENormalizarItinerario(entrada);

    expect(projetarItinerarioParaCamposLegados(itinerario)).toEqual({
      tipoVoo: 'ida_volta',
      origem: 'GIG',
      destino: 'AJU',
      origemIda: 'GIG',
      destinoIda: 'AJU',
      origemVolta: 'AJU',
      destinoVolta: 'GIG',
      companhia: 'Azul',
      companhiaIda: 'Azul',
      companhiaVolta: 'Latam',
      dataIda: '23-08-2026',
      dataVolta: '02-09-2026',
      horaSaidaIda: '20:40',
      horaChegadaIda: '14:15',
      horaSaidaVolta: '18:00',
      horaChegadaVolta: '20:20',
      duracaoIda: '17h 35m',
      duracaoVolta: '2h 20m',
      paradasIda: '1 Parada',
      paradasVolta: 'Direto',
    });
    expect(itinerario.ida.pernas.map((perna) => perna.numeroVoo))
      .toEqual(['AD 4101', 'G3 1902']);
    expect(entrada).toEqual(copiaAntes);
  });

  it('projeta somente ida sem criar campos da volta ou propriedades undefined', () => {
    const itinerario = validarENormalizarItinerario({
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [{
          origem: 'AJU',
          destino: 'BSB',
          dataSaida: '2026-09-03',
          dataChegada: '2026-09-04',
        }],
        paradas: '2 Paradas',
      },
    });

    const projecao = projetarItinerarioParaCamposLegados(itinerario);
    const valores = Object.values(projecao);

    expect(projecao).toEqual({
      tipoVoo: 'ida',
      origem: 'AJU',
      destino: 'BSB',
      origemIda: 'AJU',
      destinoIda: 'BSB',
      dataIda: '03-09-2026',
      paradasIda: 'Direto',
    });
    expect(valores).not.toContain(undefined);
    expect(projecao).not.toHaveProperty('dataVolta');
    expect(projecao).not.toHaveProperty('paradasVolta');
  });

  it('mantem a quantidade textual de paradas quando a fonte validada e legada', () => {
    const itinerario = validarENormalizarItinerario({
      versao: 1,
      ida: {
        tipo: 'ida',
        fonte: 'legado',
        pernas: [{ origem: 'GIG', destino: 'AJU' }],
        paradas: '2 Paradas',
      },
    });

    expect(projetarItinerarioParaCamposLegados(itinerario).paradasIda)
      .toBe('2 Paradas');
  });

  it('usa a duracao da unica perna como fallback para voo direto', () => {
    const itinerario = validarENormalizarItinerario({
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [{
          origem: 'AJU',
          destino: 'GRU',
          duracao: '2h 35m',
        }],
      },
    });

    expect(projetarItinerarioParaCamposLegados(itinerario).duracaoIda)
      .toBe('2h 35m');
  });

  it('prioriza duracaoTotal e nao trata duracao de uma perna como total multitrecho', () => {
    const direto = validarENormalizarItinerario({
      versao: 1,
      ida: {
        tipo: 'ida',
        duracaoTotal: '3h 00m',
        pernas: [{ origem: 'AJU', destino: 'GRU', duracao: '2h 35m' }],
      },
    });
    const multitrecho = validarENormalizarItinerario({
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [
          { origem: 'AJU', destino: 'GRU', duracao: '2h 35m' },
          { origem: 'GRU', destino: 'BSB', duracao: '1h 30m' },
        ],
      },
    });

    expect(projetarItinerarioParaCamposLegados(direto).duracaoIda).toBe('3h 00m');
    expect(projetarItinerarioParaCamposLegados(multitrecho))
      .not.toHaveProperty('duracaoIda');
  });
});
