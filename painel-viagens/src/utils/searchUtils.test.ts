import { describe, expect, it } from 'vitest';
import { matchesSearchQuery, normalizeSearchText } from './searchUtils';

describe('searchUtils', () => {
  it('remove acentos', () => {
    expect(normalizeSearchText('João')).toBe('joao');
  });

  it('converte para minusculas', () => {
    expect(normalizeSearchText('MARIA Silva')).toBe('maria silva');
  });

  it('remove espacos duplicados e aplica trim', () => {
    expect(normalizeSearchText('  Maria   Silva  ')).toBe('maria silva');
  });

  it('trata null e undefined como texto vazio', () => {
    expect(normalizeSearchText(null)).toBe('');
    expect(normalizeSearchText(undefined)).toBe('');
  });

  it('encontra telefone com e sem mascara usando apenas numeros', () => {
    const fields = ['(79) 99999-9999'];

    expect(matchesSearchQuery('79999999999', fields)).toBe(true);
    expect(matchesSearchQuery('(79) 99999-9999', ['79999999999'])).toBe(true);
  });

  it('permite correspondencia parcial', () => {
    expect(matchesSearchQuery('maria', ['Maria Silva'])).toBe(true);
  });

  it('retorna falso para termos sem correspondencia', () => {
    expect(matchesSearchQuery('Aracaju', ['Maria Silva', 'Salvador'])).toBe(false);
  });
});
