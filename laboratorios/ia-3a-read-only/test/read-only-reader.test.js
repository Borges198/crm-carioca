import assert from "node:assert/strict";
import test from "node:test";

import {
  OUTPUT_ALLOWLIST,
  ReadContractError,
  TARGET_COLLECTIONS,
  validateReadScope,
} from "../src/read-only-contract.js";
import { createReadOnlyReader } from "../src/read-only-reader.js";

const validScope = Object.freeze({
  projectId: "crm-carioca-dev",
  agencyId: "agency-test",
  ownerId: "owner-test",
  maxDocuments: 10,
});

const scopedRecord = (id, data = {}) => ({
  id,
  data: {
    agencyId: validScope.agencyId,
    ownerId: validScope.ownerId,
    ...data,
  },
});

test("projectId diferente de crm-carioca-dev bloqueia antes da consulta", async () => {
  let calls = 0;
  const reader = createReadOnlyReader(async () => {
    calls += 1;
    return [];
  });

  await assert.rejects(
    reader.readCollection("cotacoes", { ...validScope, projectId: "crm-carioca" }),
    (error) => error instanceof ReadContractError && error.code === "PROJECT_BLOCKED",
  );
  assert.equal(calls, 0);
});

test("projectId ausente falha fechado", () => {
  assert.throws(
    () => validateReadScope({ ...validScope, projectId: undefined }),
    (error) => error instanceof ReadContractError && error.code === "INVALID_SCOPE",
  );
});

test("agencyId ausente falha fechado antes da consulta", async () => {
  let calls = 0;
  const reader = createReadOnlyReader(async () => {
    calls += 1;
    return [];
  });

  await assert.rejects(
    reader.readCollection("cotacoes", { ...validScope, agencyId: "" }),
    (error) => error instanceof ReadContractError && error.code === "INVALID_SCOPE",
  );
  assert.equal(calls, 0);
});

test("ownerId ausente falha fechado antes da consulta", async () => {
  let calls = 0;
  const reader = createReadOnlyReader(async () => {
    calls += 1;
    return [];
  });

  await assert.rejects(
    reader.readCollection("cotacoes", { ...validScope, ownerId: undefined }),
    (error) => error instanceof ReadContractError && error.code === "INVALID_SCOPE",
  );
  assert.equal(calls, 0);
});

test("maxDocuments aceita somente inteiros entre 1 e 25 e bloqueia antes da consulta", async () => {
  let calls = 0;
  const reader = createReadOnlyReader(async () => {
    calls += 1;
    return [];
  });

  for (const maxDocuments of [0, 26, 1.5, NaN, undefined]) {
    await assert.rejects(
      reader.readCollection("cotacoes", { ...validScope, maxDocuments }),
      (error) => error instanceof ReadContractError
        && error.code === "INVALID_MAX_DOCUMENTS",
    );
  }
  assert.equal(calls, 0);
  assert.equal(validateReadScope({ ...validScope, maxDocuments: 1 }).maxDocuments, 1);
  assert.equal(validateReadScope({ ...validScope, maxDocuments: 25 }).maxDocuments, 25);
});

test("reader aceita apenas função de leitura e não expõe capacidade de mutação", () => {
  assert.throws(
    () => createReadOnlyReader({ executeQuery: async () => [], mutate: async () => {} }),
    /somente uma função de leitura/u,
  );

  const reader = createReadOnlyReader(async () => []);
  assert.deepEqual(Object.keys(reader), ["readCollection"]);
  assert.equal(Object.isFrozen(reader), true);
});

test("query de cotacoes nasce limitada por projectId, agencyId, ownerId e máximo", async () => {
  let receivedQuery;
  const reader = createReadOnlyReader(async (query) => {
    receivedQuery = query;
    return [];
  });

  await reader.readCollection("cotacoes", validScope);
  assert.deepEqual(receivedQuery, {
    operation: "read",
    projectId: "crm-carioca-dev",
    collection: "cotacoes",
    filters: [
      { field: "agencyId", operator: "==", value: "agency-test" },
      { field: "ownerId", operator: "==", value: "owner-test" },
    ],
    limit: 10,
  });
  assert.equal(Object.isFrozen(receivedQuery), true);
});

test("campos fora da allowlist não atravessam a fronteira", async () => {
  const reader = createReadOnlyReader(async () => [scopedRecord("quote-1", {
    clienteId: "client-1",
    destino: "SSA",
    dataIda: "2026-09-10",
    segredo: "não pode atravessar",
    observacao: "texto livre fora do contrato",
  })]);

  const result = await reader.readCollection("cotacoes", validScope);
  assert.deepEqual(result.documents, [{
    id: "quote-1",
    clienteId: "client-1",
    destino: "SSA",
    dataIda: "2026-09-10",
  }]);
  assert.equal("segredo" in result.documents[0], false);
  assert.equal("observacao" in result.documents[0], false);
  assert.equal("agencyId" in result.documents[0], false);
  assert.equal("ownerId" in result.documents[0], false);
  assert.deepEqual(Object.keys(result.documents[0]).slice(1).every(
    (field) => OUTPUT_ALLOWLIST.cotacoes.includes(field),
  ), true);
});

test("auditoria não recebe documento bruto", async () => {
  const auditEvents = [];
  const forbiddenValue = "RAW-SECRET-MARKER";
  const reader = createReadOnlyReader(
    async () => [scopedRecord("quote-2", {
      clienteId: "client-2",
      destino: "GRU",
      internalSecret: forbiddenValue,
    })],
    (event) => auditEvents.push(event),
  );

  const result = await reader.readCollection("cotacoes", validScope);
  const serializedLogs = JSON.stringify(auditEvents);
  assert.equal(serializedLogs.includes(forbiddenValue), false);
  assert.equal(serializedLogs.includes("internalSecret"), false);
  assert.deepEqual(result.evidenceIds, ["cotacoes/quote-2"]);
});

test("documento inconsistente com o escopo falha fechado", async () => {
  const reader = createReadOnlyReader(async () => [scopedRecord("quote-3", {
    agencyId: "outra-agencia",
  })]);

  await assert.rejects(
    reader.readCollection("cotacoes", validScope),
    (error) => error instanceof ReadContractError && error.code === "SCOPE_MISMATCH",
  );
});

test("acompanhamentos usa escopo direto e allowlist própria, sem join", async () => {
  let receivedQuery;
  const reader = createReadOnlyReader(async (query) => {
    receivedQuery = query;
    return [scopedRecord("followup-1", {
      cotacaoAncoraId: "quote-1",
      clienteId: "client-1",
      proximaAcaoEm: "2026-09-04T12:00:00.000Z",
      createdAt: "fora-da-allowlist",
    })];
  });

  const result = await reader.readCollection("acompanhamentos", validScope);
  assert.equal(receivedQuery.collection, "acompanhamentos");
  assert.deepEqual(receivedQuery.filters.map(({ field }) => field), ["agencyId", "ownerId"]);
  assert.equal(receivedQuery.limit, validScope.maxDocuments);
  assert.deepEqual(result.documents, [{
    id: "followup-1",
    cotacaoAncoraId: "quote-1",
    clienteId: "client-1",
    proximaAcaoEm: "2026-09-04T12:00:00.000Z",
  }]);
  assert.deepEqual(TARGET_COLLECTIONS, ["cotacoes", "acompanhamentos"]);
});

test("resultado acima de maxDocuments é recusado", async () => {
  const reader = createReadOnlyReader(async () => [
    scopedRecord("quote-1"),
    scopedRecord("quote-2"),
  ]);

  await assert.rejects(
    reader.readCollection("cotacoes", { ...validScope, maxDocuments: 1 }),
    (error) => error instanceof ReadContractError && error.code === "LIMIT_VIOLATION",
  );
});
