import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extrairDadosSmartPaste } from '../../src/utils/smartPasteUtils';

interface ExpectedCandidate {
  trecho: 'ida' | 'volta' | 'total';
  rounded: {
    pontos?: number;
    taxa?: number;
  };
}

interface ExpectedFixture {
  source: string;
  scenario: string;
  expectedCandidates: ExpectedCandidate[];
  expectedSmartPaste: {
    tipoVoo?: string;
    companhia?: string;
  };
}

const testDir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(testDir, '..', 'fixtures', 'smart-paste');

function readFixture(source: string, scenario: string) {
  const fixturePath = join(fixturesDir, source, `${scenario}.txt`);
  const expectedPath = join(fixturesDir, source, `${scenario}.expected.json`);

  return {
    text: readFileSync(fixturePath, 'utf8'),
    expected: JSON.parse(readFileSync(expectedPath, 'utf8')) as ExpectedFixture,
  };
}

const allFixtures = [
  ['azul', 'ida-volta'],
  ['azul', 'ida'],
  ['azul', 'volta'],
  ['latam', 'ida-volta'],
  ['latam', 'ida'],
  ['latam', 'volta'],
  ['smiles', 'ida-volta'],
  ['smiles', 'ida'],
  ['smiles', 'volta'],
] as const;

const supportedValueFixtures = [
  ['latam', 'ida-volta', 'total'],
  ['latam', 'ida', 'ida'],
  ['latam', 'volta', 'volta'],
  ['smiles', 'ida-volta', 'total'],
  ['smiles', 'ida', 'ida'],
  ['smiles', 'volta', 'volta'],
] as const;

describe('extrairDadosSmartPaste com fixtures reais', () => {
  it.each(allFixtures)('identifica metadados de %s/%s', (source, scenario) => {
    const { text, expected } = readFixture(source, scenario);
    const result = extrairDadosSmartPaste(text);

    expect(result.companhia).toBe(expected.expectedSmartPaste.companhia);

    if (expected.expectedSmartPaste.tipoVoo) {
      expect(result.tipoVoo).toBe(expected.expectedSmartPaste.tipoVoo);
    }
  });

  it.each(supportedValueFixtures)(
    'extrai pontos e taxa arredondados de %s/%s usando candidato %s',
    (source, scenario, trecho) => {
      const { text, expected } = readFixture(source, scenario);
      const result = extrairDadosSmartPaste(text);
      const candidate = expected.expectedCandidates.find((item) => item.trecho === trecho);

      expect(candidate).toBeDefined();
      expect(result.pontos).toBe(String(candidate?.rounded.pontos));
      expect(result.taxaEmbarque).toBe(String(candidate?.rounded.taxa));
    }
  );

  it.each([
    ['azul', 'ida-volta'],
    ['azul', 'ida'],
    ['azul', 'volta'],
  ] as const)('documenta lacuna atual de valores em %s/%s', (source, scenario) => {
    const { text, expected } = readFixture(source, scenario);
    const result = extrairDadosSmartPaste(text);
    const expectedRoundedValues = expected.expectedCandidates.map((candidate) => ({
      pontos: candidate.rounded.pontos ? String(candidate.rounded.pontos) : undefined,
      taxa: candidate.rounded.taxa ? String(candidate.rounded.taxa) : undefined,
    }));

    // O parser atual escolhe o maior valor encontrado no texto. Nas fixtures Azul,
    // isso captura totais ou tarifas alternativas, nao o candidato esperado.
    expect(expectedRoundedValues).not.toContainEqual({
      pontos: result.pontos,
      taxa: result.taxaEmbarque,
    });
  });

  it('extrai origem, destino, datas, horarios, companhia e paradas da fixture LATAM ida-volta', () => {
    const { text } = readFixture('latam', 'ida-volta');
    const result = extrairDadosSmartPaste(text);

    expect(result).toMatchObject({
      tipoVoo: 'ida_volta',
      origem: 'GRU',
      destino: 'AJU',
      origemVolta: 'AJU',
      destinoVolta: 'GRU',
      dataIda: '2026-07-07',
      dataVolta: '2026-07-18',
      horaSaidaIda: '07:15',
      horaChegadaIda: '09:50',
      horaSaidaVolta: '10:40',
      horaChegadaVolta: '13:25',
      companhia: 'Latam',
      paradasIda: 'Direto',
      paradasVolta: 'Direto',
    });
  });

  it('caracteriza rota tradicional de ida e volta com origem e destino globais', () => {
    const result = extrairDadosSmartPaste(`
      LATAM
      28/07/2026
      08:00 GIG
      10:00 NVT
      02/08/2026
      18:00 NVT
      20:00 GIG
    `);

    expect(result).toMatchObject({
      tipoVoo: 'ida_volta',
      origem: 'GIG',
      destino: 'NVT',
      dataIda: '2026-07-28',
      dataVolta: '2026-08-02',
      horaSaidaIda: '08:00',
      horaChegadaIda: '10:00',
      horaSaidaVolta: '18:00',
      horaChegadaVolta: '20:00',
    });
  });

  it('separa explicitamente os aeroportos da volta em texto global com quatro eventos', () => {
    const result = extrairDadosSmartPaste(`
      LATAM
      28/07/2026
      08:00 GIG
      10:00 NVT
      02/08/2026
      18:00 NVT
      20:00 SDU
    `);
    const payload = result as Record<string, unknown>;

    expect(result).toMatchObject({
      tipoVoo: 'ida_volta',
      origem: 'GIG',
      destino: 'NVT',
      origemVolta: 'NVT',
      destinoVolta: 'SDU',
      horaSaidaVolta: '18:00',
      horaChegadaVolta: '20:00',
    });
    expect(payload.origemIda).toBeUndefined();
    expect(payload.destinoIda).toBeUndefined();
    expect(result.origemVolta).toBe('NVT');
    expect(result.destinoVolta).toBe('SDU');
  });

  it('documenta lacuna atual: Smart Paste de um trecho de volta retorna origem e destino genericos', () => {
    const result = extrairDadosSmartPaste(`
      GOL
      02/08/2026
      18:00 NVT
      20:00 SDU
    `);
    const payload = result as Record<string, unknown>;

    expect(result).toMatchObject({
      tipoVoo: 'ida',
      origem: 'NVT',
      destino: 'SDU',
      dataIda: '2026-08-02',
      horaSaidaIda: '18:00',
      horaChegadaIda: '20:00',
    });
    expect(payload.origemVolta).toBeUndefined();
    expect(payload.destinoVolta).toBeUndefined();
  });

  it('arredonda para cima pontos e taxa encontrados no texto', () => {
    const result = extrairDadosSmartPaste(`
      Azul
      SSA 08:00
      GRU 10:00
      35.200 pontos
      R$ 123,45
    `);

    expect(result.pontos).toBe('36');
    expect(result.taxaEmbarque).toBe('124');
  });

  it('seleciona o maior valor encontrado quando ha multiplos pontos e taxas no texto', () => {
    const result = extrairDadosSmartPaste(`
      LATAM
      GRU 07:15
      AJU 09:50
      28.096 milhas + BRL 33,64
      38.885 milhas + BRL 52,04
      66.981 milhas + BRL 85,68
    `);

    expect(result.pontos).toBe('67');
    expect(result.taxaEmbarque).toBe('86');
  });

  it('extrai ida e volta completas da fixture operacional LATAM Salvador', () => {
    const text = readFileSync(
      join(fixturesDir, 'latam', 'operacional-salvador-ida-volta.txt'),
      'utf8'
    );
    const result = extrairDadosSmartPaste(text);

    expect(result).toMatchObject({
      tipoVoo: 'ida_volta',
      origem: 'GRU',
      destino: 'SSA',
      origemVolta: 'SSA',
      destinoVolta: 'GRU',
      dataIda: '2026-09-11',
      dataVolta: '2026-09-14',
      horaSaidaIda: '09:50',
      horaChegadaIda: '12:10',
      horaSaidaVolta: '18:35',
      horaChegadaVolta: '21:05',
      companhia: 'Latam',
      paradasIda: 'Direto',
      paradasVolta: 'Direto',
      pontos: '36',
      taxaEmbarque: '89',
    });
  });

  it('preserva os quatro eventos LATAM quando as chegadas possuem +1', () => {
    const text = readFileSync(
      join(fixturesDir, 'latam', 'latam-complexo-mais-um.txt'),
      'utf8'
    );
    const result = extrairDadosSmartPaste(text);

    expect(result).toMatchObject({
      tipoVoo: 'ida_volta',
      origem: 'AJU',
      destino: 'GIG',
      origemVolta: 'SDU',
      destinoVolta: 'AJU',
      dataIda: '2026-11-10',
      dataVolta: '2026-11-27',
      horaSaidaIda: '14:20',
      horaChegadaIda: '01:00',
      horaSaidaVolta: '11:50',
      horaChegadaVolta: '00:05',
      duracaoIda: '10h 40m',
      duracaoVolta: '12h 15m',
      companhia: 'Latam',
      paradasIda: '1 Parada',
      paradasVolta: '1 Parada',
      pontos: '59',
      taxaEmbarque: '115',
    });
  });

  it('resolve paradas por sentido no caso internacional LATAM sem deduplicar por valor', () => {
    const text = readFileSync(
      join(fixturesDir, 'latam', 'latam-internacional-paradas-2-1.txt'),
      'utf8'
    );
    const result = extrairDadosSmartPaste(text);

    expect(result).toMatchObject({
      tipoVoo: 'ida_volta',
      origem: 'GRU',
      destino: 'CTG',
      origemVolta: 'CTG',
      destinoVolta: 'GRU',
      dataIda: '2027-01-01',
      dataVolta: '2027-03-31',
      horaSaidaIda: '06:30',
      horaChegadaIda: '11:50',
      horaSaidaVolta: '17:20',
      horaChegadaVolta: '16:25',
      duracaoIda: '31h 20m',
      duracaoVolta: '21h 05m',
      paradasIda: '2 Paradas',
      paradasVolta: '1 Parada',
      pontos: '130',
      taxaEmbarque: '465',
    });
  });

  it.each([
    ['1 parada', '1 parada', '1 Parada', '1 Parada'],
    ['0 paradas', '1 parada', 'Direto', '1 Parada'],
  ])(
    'mantem paradas independentes por sentido: ida %s e volta %s',
    (paradaIda, paradaVolta, esperadoIda, esperadoVolta) => {
      const result = extrairDadosSmartPaste(`
        IDA
        Voo ${paradaIda} com duração de 2 horas 10 minutos.
        08:00 GRU
        ${paradaIda}
        10:10 GIG

        VOLTA
        Voo ${paradaVolta} com duração de 3 horas 20 minutos.
        18:00 GIG
        ${paradaVolta}
        21:20 GRU
      `);

      expect(result.paradasIda).toBe(esperadoIda);
      expect(result.paradasVolta).toBe(esperadoVolta);
    }
  );

  it('prioriza a descricao extensa e usa a linha compacta apenas como fallback do sentido', () => {
    const result = extrairDadosSmartPaste(`
      IDA
      Voo 2 paradas com duração de 8 horas 10 minutos.
      08:00 GRU
      1 parada
      16:10 CTG

      VOLTA
      17:20 CTG
      1 parada
      21:05 GRU
    `);

    expect(result.paradasIda).toBe('2 Paradas');
    expect(result.paradasVolta).toBe('1 Parada');
  });

  it('extrai duracoes no formato compacto quando nao ha descricao por extenso', () => {
    const result = extrairDadosSmartPaste(`
      08:00 AJU
      20:00 GIG
      10 h 40 min.
      21:00 SDU
      10:00 AJU
      12 h 15 min.
    `);

    expect(result).toMatchObject({
      duracaoIda: '10h 40m',
      duracaoVolta: '12h 15m',
    });
  });

  it('prioriza datas explicitas futuras no caso LATAM Manaus/Navegantes', () => {
    const text = readFileSync(
      join(fixturesDir, 'latam', 'latam-manaus-navegantes-futuro.txt'),
      'utf8'
    );
    const result = extrairDadosSmartPaste(text);

    expect(result).toMatchObject({
      tipoVoo: 'ida_volta',
      origem: 'MAO',
      destino: 'NVT',
      origemVolta: 'NVT',
      destinoVolta: 'MAO',
      dataIda: '2027-01-01',
      dataVolta: '2027-03-31',
      horaSaidaIda: '18:00',
      horaChegadaIda: '09:20',
      horaSaidaVolta: '14:10',
      horaChegadaVolta: '02:25',
      duracaoIda: '14h 20m',
      duracaoVolta: '13h 15m',
      pontos: '160',
      taxaEmbarque: '106',
    });
  });

  it('deduplica datas abreviadas e explicitas no ano atual', () => {
    const anoAtual = new Date().getFullYear();
    const result = extrairDadosSmartPaste(`
      Ida 01 de jan.
      Ida 01 de janeiro de ${anoAtual}
      Volta 31 de mar.
      Volta 31 de março de ${anoAtual}
    `);

    expect(result.dataIda).toBe(`${anoAtual}-01-01`);
    expect(result.dataVolta).toBe(`${anoAtual}-03-31`);
  });

  it('deduplica datas abreviadas em favor das explicitas no ano futuro', () => {
    const anoFuturo = new Date().getFullYear() + 1;
    const result = extrairDadosSmartPaste(`
      Ida 01 de jan.
      Ida 01 de janeiro de ${anoFuturo}
      Volta 31 de mar.
      Volta 31 de março de ${anoFuturo}
    `);

    expect(result.dataIda).toBe(`${anoFuturo}-01-01`);
    expect(result.dataVolta).toBe(`${anoFuturo}-03-31`);
  });

  it('mantem o ano atual como fallback para datas apenas abreviadas', () => {
    const anoAtual = new Date().getFullYear();
    const result = extrairDadosSmartPaste(`
      Ida 02 de fev.
      Volta 03 de mar.
    `);

    expect(result.dataIda).toBe(`${anoAtual}-02-02`);
    expect(result.dataVolta).toBe(`${anoAtual}-03-03`);
  });
});
