import { describe, expect, it } from 'vitest';
import { montarNovaCotacao } from './cotacaoMapper';
import {
  validarENormalizarItinerario,
  type ItinerarioCotacaoValidado,
} from './itinerarioUtils';

const inputBase = {
  ownerId: 'user-123',
  ownerName: 'Agente Teste',
  ownerEmail: 'agente@example.com',
  agencyId: 'agency-123',
  cliente: 'Cliente Teste',
  telefone: '(79) 99999-0000',
  telefoneNormalizado: '79999990000',
  origem: 'GRU',
  destino: 'AJU',
  companhia: 'Latam' as const,
  tipoVoo: 'ida_volta',
  dataIda: '07-07-2026',
  dataVolta: '18-07-2026',
  horaSaidaIda: '07:15',
  horaChegadaIda: '09:50',
  horaSaidaVolta: '10:40',
  horaChegadaVolta: '13:25',
  paradasIda: 'Direto',
  paradasVolta: 'Direto',
  qtdPontos: 28,
  taxaEmbarque: 34,
  valorTotal: 1896,
  produtosOfertados: ['passagem_aerea'],
  observacao: '  Observacao interna  ',
  leadStatus: 'novo' as const,
};

function criarItinerarioEstruturadoSomenteIda() {
  return validarENormalizarItinerario({
    versao: 1,
    ida: {
      tipo: 'ida',
      fonte: 'estruturado',
      pernas: [{
        origem: 'AJU',
        destino: 'GRU',
        companhia: 'Azul',
        numeroVoo: 'G3 1901',
        dataSaida: '2026-09-03',
        horaSaida: '07:10',
        dataChegada: '2026-09-03',
        horaChegada: '09:25',
        duracao: '2h 15m',
      }],
    },
  });
}

describe('montarNovaCotacao - payload persistido', () => {
  it('inclui clienteId quando o cliente selecionado é recebido', () => {
    const cotacao = montarNovaCotacao({
      ...inputBase,
      clienteId: 'cliente-123',
    });

    expect(cotacao.clienteId).toBe('cliente-123');
  });

  it.each([
    ['ausente', undefined],
    ['vazio', ''],
    ['somente espaços', '   '],
    ['nulo', null],
  ])('não inclui clienteId quando o valor é %s', (_caso, clienteId) => {
    const cotacao = montarNovaCotacao({
      ...inputBase,
      clienteId,
    });

    expect(cotacao).not.toHaveProperty('clienteId');
  });

  it('monta payload por trecho com valores calculados e metadados obrigatorios', () => {
    const cotacao = montarNovaCotacao({
      ...inputBase,
      companhiaIda: 'Latam',
      companhiaVolta: 'Azul',
      pontosIda: 28,
      pontosVolta: 34,
      taxaIda: 34,
      taxaVolta: 235,
      valorIda: 790,
      valorVolta: 1106,
    });
    const payload = cotacao as Record<string, unknown>;

    expect(cotacao).toMatchObject({
      cliente: 'Cliente Teste',
      origem: 'GRU',
      destino: 'AJU',
      companhia: 'Latam',
      companhiaIda: 'Latam',
      companhiaVolta: 'Azul',
      pontosIda: 28,
      pontosVolta: 34,
      taxaIda: 34,
      taxaVolta: 235,
      valorIda: 790,
      valorVolta: 1106,
      valorTotal: 1896,
      ownerId: 'user-123',
      ownerName: 'Agente Teste',
      ownerEmail: 'agente@example.com',
      agencyId: 'agency-123',
      dataIda: '07-07-2026',
      dataVolta: '18-07-2026',
      horaSaidaIda: '07:15',
      horaChegadaIda: '09:50',
      duracaoIda: '2h 35m',
      paradasIda: 'Direto',
      status: 'Novo 🆕',
      produtosOfertados: ['passagem_aerea'],
      observacao: 'Observacao interna',
      leadStatus: 'novo',
      telefone: '(79) 99999-0000',
      telefoneNormalizado: '79999990000',
    });
    expect(cotacao.dataRegistro).toBeInstanceOf(Date);

    // Caracterizacao do comportamento atual: qtdPontos/taxaEmbarque entram no input,
    // mas nao sao gravados como campos globais no payload retornado pelo mapper.
    expect(payload.pontos).toBeUndefined();
    expect(payload.taxaEmbarque).toBeUndefined();
  });

  it('preserva nulls explicitos de volta em cotacao somente ida por trecho', () => {
    const cotacao = montarNovaCotacao({
      ...inputBase,
      tipoVoo: 'ida',
      dataVolta: '',
      companhiaIda: 'Latam',
      companhiaVolta: null,
      pontosIda: 28,
      pontosVolta: null,
      taxaIda: 34,
      taxaVolta: null,
      valorIda: 790,
      valorVolta: null,
      valorTotal: 790,
    });

    expect(cotacao).toMatchObject({
      tipoVoo: 'ida',
      dataVolta: null,
      companhiaIda: 'Latam',
      companhiaVolta: null,
      pontosIda: 28,
      pontosVolta: null,
      taxaIda: 34,
      taxaVolta: null,
      valorIda: 790,
      valorVolta: null,
      valorTotal: 790,
    });
  });

  it('monta cotacao antiga compativel sem campos por trecho', () => {
    const cotacao = montarNovaCotacao({
      ...inputBase,
      tipoVoo: 'ida',
      dataVolta: '',
      valorTotal: 684,
    });
    const payload = cotacao as Record<string, unknown>;

    expect(cotacao).toMatchObject({
      companhia: 'Latam',
      tipoVoo: 'ida',
      dataVolta: null,
      valorTotal: 684,
      ownerId: 'user-123',
      agencyId: 'agency-123',
    });
    expect(cotacao.dataRegistro).toBeInstanceOf(Date);
    expect(payload.companhiaIda).toBeUndefined();
    expect(payload.companhiaVolta).toBeUndefined();
    expect(payload.pontosIda).toBeUndefined();
    expect(payload.pontosVolta).toBeUndefined();
    expect(payload.taxaIda).toBeUndefined();
    expect(payload.taxaVolta).toBeUndefined();
    expect(payload.valorIda).toBeUndefined();
    expect(payload.valorVolta).toBeUndefined();
    expect(payload.clienteId).toBeUndefined();
    expect(payload.pontos).toBeUndefined();
    expect(payload.taxaEmbarque).toBeUndefined();
  });

  it('caracteriza ida e volta tradicional usando apenas origem e destino globais', () => {
    const cotacao = montarNovaCotacao({
      ...inputBase,
      origem: 'GIG',
      destino: 'NVT',
      tipoVoo: 'ida_volta',
      companhiaIda: 'Latam',
      companhiaVolta: 'Latam',
      pontosIda: 28,
      pontosVolta: 28,
      taxaIda: 34,
      taxaVolta: 34,
      valorIda: 790,
      valorVolta: 790,
      valorTotal: 1580,
    });
    const payload = cotacao as Record<string, unknown>;

    expect(cotacao).toMatchObject({
      origem: 'GIG',
      destino: 'NVT',
      tipoVoo: 'ida_volta',
      pontosIda: 28,
      pontosVolta: 28,
      taxaIda: 34,
      taxaVolta: 34,
      valorIda: 790,
      valorVolta: 790,
      valorTotal: 1580,
    });
    expect(payload.origemIda).toBeUndefined();
    expect(payload.destinoIda).toBeUndefined();
    expect(payload.origemVolta).toBeUndefined();
    expect(payload.destinoVolta).toBeUndefined();
  });

  it('preserva payload de rota independente com aeroportos diferentes no retorno', () => {
    const cotacao = montarNovaCotacao({
      ...inputBase,
      origem: 'GIG',
      destino: 'NVT',
      origemIda: 'GIG',
      destinoIda: 'NVT',
      origemVolta: 'NVT',
      destinoVolta: 'SDU',
    });

    expect(cotacao).toMatchObject({
      origem: 'GIG',
      destino: 'NVT',
      origemIda: 'GIG',
      destinoIda: 'NVT',
      origemVolta: 'NVT',
      destinoVolta: 'SDU',
      tipoVoo: 'ida_volta',
    });
  });

  it('preserva payload de rota independente com aeroportos diferentes na saida', () => {
    const cotacao = montarNovaCotacao({
      ...inputBase,
      origem: 'SDU',
      destino: 'NVT',
      origemIda: 'SDU',
      destinoIda: 'NVT',
      origemVolta: 'NVT',
      destinoVolta: 'GIG',
    });

    expect(cotacao).toMatchObject({
      origem: 'SDU',
      destino: 'NVT',
      origemIda: 'SDU',
      destinoIda: 'NVT',
      origemVolta: 'NVT',
      destinoVolta: 'GIG',
      tipoVoo: 'ida_volta',
    });
  });

  it('caracteriza somente ida sem campos de rota da volta', () => {
    const cotacao = montarNovaCotacao({
      ...inputBase,
      origem: 'GIG',
      destino: 'NVT',
      tipoVoo: 'ida',
      dataVolta: '',
      companhiaIda: 'Latam',
      companhiaVolta: null,
      pontosIda: 28,
      pontosVolta: null,
      taxaIda: 34,
      taxaVolta: null,
      valorIda: 790,
      valorVolta: null,
      valorTotal: 790,
    });
    const payload = cotacao as Record<string, unknown>;

    expect(cotacao).toMatchObject({
      origem: 'GIG',
      destino: 'NVT',
      tipoVoo: 'ida',
      dataVolta: null,
      valorTotal: 790,
    });
    expect(payload.origemVolta).toBeUndefined();
    expect(payload.destinoVolta).toBeUndefined();
  });

  it('preserva campos de rota por trecho parcialmente fornecidos sem inventar fallbacks', () => {
    const cotacao = montarNovaCotacao({
      ...inputBase,
      origem: 'GIG',
      destino: 'NVT',
      origemIda: 'SDU',
      origemVolta: 'NVT',
    });
    const payload = cotacao as Record<string, unknown>;

    expect(cotacao).toMatchObject({
      origem: 'GIG',
      destino: 'NVT',
      origemIda: 'SDU',
      origemVolta: 'NVT',
    });
    expect(payload.destinoIda).toBeUndefined();
    expect(payload.destinoVolta).toBeUndefined();
  });

  it('nao persiste campos de rota por trecho vazios', () => {
    const cotacao = montarNovaCotacao({
      ...inputBase,
      origemIda: '',
      destinoIda: '   ',
      origemVolta: '',
      destinoVolta: '   ',
    });
    const payload = cotacao as Record<string, unknown>;

    expect(payload.origemIda).toBeUndefined();
    expect(payload.destinoIda).toBeUndefined();
    expect(payload.origemVolta).toBeUndefined();
    expect(payload.destinoVolta).toBeUndefined();
  });

  it('mantem o payload legado inalterado quando itinerario nao e informado', () => {
    const payload = montarNovaCotacao(inputBase) as Record<string, unknown>;

    expect(payload.valorTotal).toBe(1896);
    expect(payload.itinerario).toBeUndefined();
    expect(payload.horaSaidaVolta).toBeUndefined();
    expect(payload.horaChegadaVolta).toBeUndefined();
    expect(payload.duracaoVolta).toBeUndefined();
    expect(payload.paradasVolta).toBeUndefined();
  });

  it('remove fisicamente todos os campos da volta em itinerario estruturado somente ida', () => {
    const itinerario = criarItinerarioEstruturadoSomenteIda();
    const entrada = {
      ...inputBase,
      itinerario,
      tipoVoo: 'ida_volta',
      origem: 'CAMPO-ANTIGO',
      destino: 'DESTINO-ANTIGO',
      origemIda: 'OLD',
      destinoIda: 'OLD',
      origemVolta: 'GRU',
      destinoVolta: 'AJU',
      companhia: 'Latam',
      companhiaIda: 'GOL',
      companhiaVolta: 'Azul',
      dataIda: '01-01-2000',
      dataVolta: '02-01-2000',
      horaSaidaIda: '10:00',
      horaChegadaIda: '11:00',
      pontosVolta: 34000,
      taxaVolta: 235,
      valorIda: 790,
      valorVolta: 1106,
      valorTotal: 1896,
    } satisfies Parameters<typeof montarNovaCotacao>[0];
    const copiaAntes = structuredClone(entrada);

    const cotacao = montarNovaCotacao(entrada);

    expect(cotacao).toMatchObject({
      tipoVoo: 'ida',
      origem: 'AJU',
      destino: 'GRU',
      origemIda: 'AJU',
      destinoIda: 'GRU',
      companhia: 'Latam',
      companhiaIda: 'GOL',
      dataIda: '03-09-2026',
      horaSaidaIda: '07:10',
      horaChegadaIda: '09:25',
      duracaoIda: '2h 15m',
      paradasIda: 'Direto',
      itinerario,
    });
    expect(cotacao).not.toHaveProperty('origemVolta');
    expect(cotacao).not.toHaveProperty('destinoVolta');
    expect(cotacao).not.toHaveProperty('dataVolta');
    expect(cotacao).not.toHaveProperty('companhiaVolta');
    expect(cotacao).not.toHaveProperty('pontosVolta');
    expect(cotacao).not.toHaveProperty('taxaVolta');
    expect(cotacao).not.toHaveProperty('valorVolta');
    expect(cotacao).not.toHaveProperty('horaSaidaVolta');
    expect(cotacao).not.toHaveProperty('horaChegadaVolta');
    expect(cotacao).not.toHaveProperty('duracaoVolta');
    expect(cotacao).not.toHaveProperty('paradasVolta');
    expect(cotacao.valorTotal).toBe(790);
    expect(cotacao.itinerario).not.toBe(itinerario);
    expect(cotacao.itinerario?.ida.pernas[0].companhia).toBe('Azul');
    expect(entrada).toEqual(copiaAntes);
  });

  it('rejeita somente ida com valorVolta definido sem valorIda', () => {
    const itinerario = criarItinerarioEstruturadoSomenteIda();

    expect(() => montarNovaCotacao({
      ...inputBase,
      itinerario,
      valorIda: undefined,
      valorVolta: 1106,
      valorTotal: 1896,
    })).toThrow(
      'Cotação estruturada somente ida inválida: valorVolta informado sem valorIda'
    );
  });

  it('preserva valorTotal global em somente ida sem valores por sentido', () => {
    const itinerario = criarItinerarioEstruturadoSomenteIda();

    const cotacao = montarNovaCotacao({
      ...inputBase,
      itinerario,
      valorIda: undefined,
      valorVolta: undefined,
      valorTotal: 684,
    });

    expect(cotacao.valorTotal).toBe(684);
  });

  it('persiste itinerario normalizado e projecao legada de ida e volta', () => {
    const itinerario = validarENormalizarItinerario({
      versao: 1,
      ida: {
        tipo: 'ida',
        fonte: 'estruturado',
        duracaoTotal: '5h 40m',
        pernas: [
          {
            origem: 'AJU',
            destino: 'GRU',
            companhia: 'Latam',
            dataSaida: '2026-10-04',
            horaSaida: '08:00',
            dataChegada: '2026-10-04',
            horaChegada: '10:20',
          },
          {
            origem: 'GRU',
            destino: 'NVT',
            companhia: 'GOL',
            dataSaida: '2026-10-04',
            horaSaida: '11:15',
            dataChegada: '2026-10-04',
            horaChegada: '13:40',
          },
        ],
      },
      volta: {
        tipo: 'volta',
        fonte: 'estruturado',
        pernas: [{
          origem: 'NVT',
          destino: 'AJU',
          companhia: 'Azul',
          dataSaida: '2026-10-12',
          horaSaida: '14:00',
          dataChegada: '2026-10-12',
          horaChegada: '16:45',
          duracao: '2h 45m',
        }],
      },
    });

    const cotacao = montarNovaCotacao({
      ...inputBase,
      itinerario,
      companhia: 'GOL',
      companhiaIda: 'GOL',
      companhiaVolta: 'GOL',
      pontosIda: 28000,
      pontosVolta: 34000,
      taxaIda: 34,
      taxaVolta: 235,
      valorIda: 790,
      valorVolta: 1106,
      valorTotal: 1896,
    });

    expect(cotacao).toMatchObject({
      tipoVoo: 'ida_volta',
      origem: 'AJU',
      destino: 'NVT',
      origemIda: 'AJU',
      destinoIda: 'NVT',
      origemVolta: 'NVT',
      destinoVolta: 'AJU',
      companhia: 'GOL',
      companhiaIda: 'GOL',
      companhiaVolta: 'GOL',
      dataIda: '04-10-2026',
      dataVolta: '12-10-2026',
      horaSaidaIda: '08:00',
      horaChegadaIda: '13:40',
      horaSaidaVolta: '14:00',
      horaChegadaVolta: '16:45',
      duracaoIda: '5h 40m',
      duracaoVolta: '2h 45m',
      paradasIda: '1 Parada',
      paradasVolta: 'Direto',
      pontosIda: 28000,
      pontosVolta: 34000,
      taxaIda: 34,
      taxaVolta: 235,
      valorIda: 790,
      valorVolta: 1106,
      valorTotal: 1896,
      itinerario,
    });
    expect(cotacao.itinerario?.ida.pernas.map((perna) => perna.companhia))
      .toEqual(['Latam', 'GOL']);
    expect(cotacao.itinerario?.volta?.pernas[0].companhia).toBe('Azul');
  });

  it('nao inventa companhias comerciais a partir das pernas operacionais', () => {
    const itinerario = validarENormalizarItinerario({
      versao: 1,
      ida: {
        tipo: 'ida',
        fonte: 'estruturado',
        pernas: [{ origem: 'AJU', destino: 'GRU', companhia: 'Azul' }],
      },
      volta: {
        tipo: 'volta',
        fonte: 'estruturado',
        pernas: [{ origem: 'GRU', destino: 'AJU', companhia: 'Latam' }],
      },
    });

    const cotacao = montarNovaCotacao({
      ...inputBase,
      itinerario,
      companhia: 'GOL',
      companhiaIda: undefined,
      companhiaVolta: undefined,
    });

    expect(cotacao.companhia).toBe('GOL');
    expect(cotacao).not.toHaveProperty('companhiaIda');
    expect(cotacao).not.toHaveProperty('companhiaVolta');
    expect(cotacao.itinerario?.ida.pernas[0].companhia).toBe('Azul');
    expect(cotacao.itinerario?.volta?.pernas[0].companhia).toBe('Latam');
  });

  it('revalida o itinerario na fronteira do mapper', () => {
    const itinerarioInvalido = {
      versao: 1,
      ida: {
        tipo: 'volta',
        pernas: [{ origem: 'AJU', destino: 'GRU' }],
      },
    } as unknown as ItinerarioCotacaoValidado;

    expect(() => montarNovaCotacao({
      ...inputBase,
      itinerario: itinerarioInvalido,
    })).toThrow('itinerario.ida.tipo');
  });
});
