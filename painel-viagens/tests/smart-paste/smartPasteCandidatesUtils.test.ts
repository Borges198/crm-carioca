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

  it('retorna lista vazia quando o texto nao tem candidatos reconhecidos', () => {
    const result = extrairCandidatosSmartPaste('Texto livre sem companhia, pontos, milhas ou taxa.');

    expect(result.companhia).toBeUndefined();
    expect(result.candidates).toEqual([]);
  });

  it('arredonda para cima pontos e taxa em oferta compacta da Azul', () => {
    const result = extrairCandidatosSmartPaste('Azul\nOferta selecionada\n28.001pontos+R$71,01');

    expect(result.candidates).toEqual([
      {
        trecho: 'ida',
        raw: {
          pontos: 28001,
          taxa: 71.01,
        },
        rounded: {
          pontos: 29,
          taxa: 72,
        },
      },
    ]);
  });

  it('mantem candidatos incompletos de Smiles ida-volta sem dividir taxa automaticamente', () => {
    const result = extrairCandidatosSmartPaste(`
      Passagem de ida
      GOL Linhas Aereas
      8.500 milhas por viajante
      Passagem de volta
      GOL Linhas Aereas
      7.400 milhas por viajante
    `);

    expect(result.candidates).toEqual([
      {
        trecho: 'ida',
        raw: {
          pontos: 8500,
        },
        rounded: {
          pontos: 9,
        },
      },
      {
        trecho: 'volta',
        raw: {
          pontos: 7400,
        },
        rounded: {
          pontos: 8,
        },
      },
    ]);
  });

  it('preserva valores originais de ida, volta e total em LATAM ida-volta', () => {
    const { text } = readFixture('latam', 'ida-volta');
    const result = extrairCandidatosSmartPaste(text);

    expect(result.companhia).toBe('Latam');
    expect(result.candidates).toEqual([
      {
        trecho: 'ida',
        raw: {
          pontos: 28096,
          taxa: 33.64,
        },
        rounded: {
          pontos: 29,
          taxa: 34,
        },
      },
      {
        trecho: 'volta',
        raw: {
          pontos: 38885,
          taxa: 52.04,
        },
        rounded: {
          pontos: 39,
          taxa: 53,
        },
      },
      {
        trecho: 'total',
        raw: {
          pontos: 66981,
          taxa: 85.68,
        },
        rounded: {
          pontos: 67,
          taxa: 86,
        },
      },
    ]);
  });

  it('preserva o financeiro do caso LATAM complexo com +1', () => {
    const text = readFileSync(
      join(fixturesDir, 'latam', 'latam-complexo-mais-um.txt'),
      'utf8'
    );
    const result = extrairCandidatosSmartPaste(text);

    expect(result.companhia).toBe('Latam');
    expect(result.candidates).toEqual([
      {
        trecho: 'ida',
        raw: { pontos: 32418, taxa: 52.04 },
        rounded: { pontos: 33, taxa: 53 },
      },
      {
        trecho: 'volta',
        raw: { pontos: 25735, taxa: 62.62 },
        rounded: { pontos: 26, taxa: 63 },
      },
      {
        trecho: 'total',
        raw: { pontos: 58153, taxa: 114.66 },
        rounded: { pontos: 59, taxa: 115 },
      },
    ]);
  });

  it('preserva o financeiro do caso LATAM Manaus/Navegantes futuro', () => {
    const text = readFileSync(
      join(fixturesDir, 'latam', 'latam-manaus-navegantes-futuro.txt'),
      'utf8'
    );
    const result = extrairCandidatosSmartPaste(text);

    expect(result.companhia).toBe('Latam');
    expect(result.candidates.map(({ trecho, rounded }) => ({ trecho, rounded }))).toEqual([
      { trecho: 'ida', rounded: { pontos: 122, taxa: 56 } },
      { trecho: 'volta', rounded: { pontos: 38, taxa: 51 } },
      { trecho: 'total', rounded: { pontos: 160, taxa: 106 } },
    ]);
  });

  it('mantem multiplas opcoes Azul como candidatos separados por trecho e total', () => {
    const result = extrairCandidatosSmartPaste(`
      Azul Linhas Aereas
      35.200 pontos + R$ 123,45
      22.100 pontos + R$ 80,10
      57.300 pontos + R$ 203,55
    `);

    expect(result.candidates).toEqual([
      {
        trecho: 'ida',
        raw: {
          pontos: 35200,
          taxa: 123.45,
        },
        rounded: {
          pontos: 36,
          taxa: 124,
        },
      },
      {
        trecho: 'volta',
        raw: {
          pontos: 22100,
          taxa: 80.1,
        },
        rounded: {
          pontos: 23,
          taxa: 81,
        },
      },
      {
        trecho: 'total',
        raw: {
          pontos: 57300,
          taxa: 203.55,
        },
        rounded: {
          pontos: 58,
          taxa: 204,
        },
      },
    ]);
  });
});
