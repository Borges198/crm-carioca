import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const rules = readFileSync(
  new URL('../../../firestore.rules', import.meta.url),
  'utf8'
);

describe('Rules locais de acompanhamento', () => {
  it('mantém acompanhamentos owner-only e update restrito à data', () => {
    expect(rules).toContain('match /acompanhamentos/{acompanhamentoId}');
    expect(rules).toContain('allow read: if isApproved() && isOwner()');
    expect(rules).toContain('"proximaAcaoEm",\n          "updatedAt"');
  });

  it('exige que o primeiro vínculo seja atômico com a criação do acompanhamento', () => {
    expect(rules).toContain('!exists(\n            /databases/$(database)/documents/acompanhamentos/');
    expect(rules).toContain('existsAfter(\n            /databases/$(database)/documents/acompanhamentos/');
    expect(rules).toContain('.data.acompanhamentoId == acompanhamentoId');
  });

  it('não permite que nova cotação nasça vinculada automaticamente', () => {
    expect(rules).toContain('&& !("acompanhamentoId" in request.resource.data)');
  });
});

