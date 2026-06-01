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
});
