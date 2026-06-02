import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extrairCandidatosSmartPaste } from '../../src/lib/smartPasteCandidatesUtils';

interface ExpectedCandidate {
  trecho: 'ida' | 'volta' | 'total';
  raw: {
    pontos?: number;
    taxa?: number;
  };
  rounded: {
    pontos?: number;
    taxa?: number;
  };
}

interface ExpectedFixture {
  expectedCandidates: ExpectedCandidate[];
  expectedSmartPaste: {
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

const fixtures = [
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

describe('extrairCandidatosSmartPaste', () => {
  it.each(fixtures)('extrai candidatos de %s/%s', (source, scenario) => {
    const { text, expected } = readFixture(source, scenario);
    const result = extrairCandidatosSmartPaste(text);

    expect(result.companhia).toBe(expected.expectedSmartPaste.companhia);
    expect(result.candidates).toEqual(expected.expectedCandidates);
  });
});
