import { describe, expect, it } from 'vitest';
import { montarNovaCotacao } from './cotacaoMapper';

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

describe('montarNovaCotacao - payload persistido', () => {
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
});
