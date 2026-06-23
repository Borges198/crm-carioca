import { describe, expect, it } from 'vitest';
import { mapearSmartPasteParaTrecho } from './smartPasteTrechoUtils';

describe('mapearSmartPasteParaTrecho', () => {
  it('mapeia Smart Paste da ida sem gerar campos da volta', () => {
    const updates = mapearSmartPasteParaTrecho('ida', {
      origem: 'GIG',
      destino: 'NVT',
      companhia: 'GOL',
      pontos: '132',
      taxaEmbarque: '36',
      dataIda: '2026-07-28',
      horaSaidaIda: '08:00',
      horaChegadaIda: '10:00',
      paradasIda: 'Direto',
    });

    expect(updates).toEqual({
      origem: 'GIG',
      destino: 'NVT',
      companhiaIda: 'GOL',
      pontosIda: '132',
      taxaIda: '36',
      dataIda: '2026-07-28',
      horaSaidaIda: '08:00',
      horaChegadaIda: '10:00',
      paradasIda: 'Direto',
    });
    expect(updates).not.toHaveProperty('origemVolta');
    expect(updates).not.toHaveProperty('destinoVolta');
    expect(updates).not.toHaveProperty('companhiaVolta');
    expect(updates).not.toHaveProperty('pontosVolta');
    expect(updates).not.toHaveProperty('taxaVolta');
  });

  it('mapeia Smart Paste da volta sem gerar campos da ida', () => {
    const updates = mapearSmartPasteParaTrecho('volta', {
      origem: 'NVT',
      destino: 'SDU',
      companhia: 'Latam',
      pontos: '41',
      taxaEmbarque: '53',
      dataIda: '2026-08-02',
      horaSaidaIda: '18:00',
      horaChegadaIda: '20:00',
      paradasIda: 'Direto',
    });

    expect(updates).toEqual({
      origemVolta: 'NVT',
      destinoVolta: 'SDU',
      companhiaVolta: 'Latam',
      pontosVolta: '41',
      taxaVolta: '53',
      dataVolta: '2026-08-02',
      horaSaidaVolta: '18:00',
      horaChegadaVolta: '20:00',
      paradasVolta: 'Direto',
    });
    expect(updates).not.toHaveProperty('origem');
    expect(updates).not.toHaveProperty('destino');
    expect(updates).not.toHaveProperty('companhiaIda');
    expect(updates).not.toHaveProperty('pontosIda');
    expect(updates).not.toHaveProperty('taxaIda');
  });

  it('prioriza campos especificos de volta quando o parser retorna ida e volta', () => {
    expect(mapearSmartPasteParaTrecho('volta', {
      origem: 'GIG',
      destino: 'NVT',
      dataIda: '2026-07-28',
      dataVolta: '2026-08-02',
      horaSaidaIda: '08:00',
      horaChegadaIda: '10:00',
      horaSaidaVolta: '18:00',
      horaChegadaVolta: '20:00',
      paradasIda: 'Direto',
      paradasVolta: '1 Parada',
    })).toMatchObject({
      origemVolta: 'GIG',
      destinoVolta: 'NVT',
      dataVolta: '2026-08-02',
      horaSaidaVolta: '18:00',
      horaChegadaVolta: '20:00',
      paradasVolta: '1 Parada',
    });
  });

  it('nao apaga valores existentes quando o texto parcial nao possui campos reconhecidos', () => {
    expect(mapearSmartPasteParaTrecho('volta', {
      companhia: 'Latam',
      pontos: '41',
    })).toEqual({
      companhiaVolta: 'Latam',
      pontosVolta: '41',
    });
  });
});
