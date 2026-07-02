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

  it('documenta lacuna atual: Smart Paste nao separa aeroportos diferentes no retorno', () => {
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
      horaSaidaVolta: '18:00',
      horaChegadaVolta: '20:00',
    });
    expect(payload.origemIda).toBeUndefined();
    expect(payload.destinoIda).toBeUndefined();
    expect(payload.origemVolta).toBeUndefined();
    expect(payload.destinoVolta).toBeUndefined();
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
});
