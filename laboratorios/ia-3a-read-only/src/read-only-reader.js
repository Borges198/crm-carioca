import {
  OUTPUT_ALLOWLIST,
  ReadContractError,
  assertTargetCollection,
  validateReadScope,
} from "./read-only-contract.js";
import { buildScopedQuery } from "./scoped-query.js";

const NOOP_AUDIT = () => {};

function emitAudit(audit, event) {
  audit(Object.freeze({ ...event }));
}

function assertReadResult(records, maxDocuments) {
  if (!Array.isArray(records)) {
    throw new ReadContractError("INVALID_READ_RESULT", "A leitura deve retornar uma lista.");
  }
  if (records.length > maxDocuments) {
    throw new ReadContractError("LIMIT_VIOLATION", "A leitura excedeu maxDocuments.");
  }
}

function sanitizeRecord(collection, record, scope) {
  if (
    !record
    || typeof record !== "object"
    || Array.isArray(record)
    || typeof record.id !== "string"
    || record.id.trim() === ""
    || !record.data
    || typeof record.data !== "object"
    || Array.isArray(record.data)
  ) {
    throw new ReadContractError("INVALID_DOCUMENT", "Documento de leitura inválido.");
  }

  if (
    record.data.projectId !== undefined
    && record.data.projectId !== scope.projectId
  ) {
    throw new ReadContractError("SCOPE_MISMATCH", "projectId inconsistente.");
  }
  if (
    record.data.agencyId !== scope.agencyId
    || record.data.ownerId !== scope.ownerId
  ) {
    throw new ReadContractError("SCOPE_MISMATCH", "Documento fora do escopo solicitado.");
  }

  const sanitized = { id: record.id.trim() };
  for (const field of OUTPUT_ALLOWLIST[collection]) {
    if (Object.hasOwn(record.data, field)) sanitized[field] = record.data[field];
  }
  return Object.freeze(sanitized);
}

function minimalEvidenceId(collection, documentId) {
  return `${collection}/${documentId}`;
}

export function createReadOnlyReader(executeQuery, audit = NOOP_AUDIT) {
  if (typeof executeQuery !== "function") {
    throw new TypeError("O reader aceita somente uma função de leitura.");
  }
  if (typeof audit !== "function") {
    throw new TypeError("A auditoria deve ser uma função.");
  }

  async function readCollection(collectionName, inputScope) {
    // Validação completa ocorre antes da construção ou execução da consulta.
    const scope = validateReadScope(inputScope);
    const collection = assertTargetCollection(collectionName);
    const query = buildScopedQuery(collection, scope);

    emitAudit(audit, {
      event: "READ_QUERY_CREATED",
      collection,
      maxDocuments: scope.maxDocuments,
      scopeFields: Object.freeze(["agencyId", "ownerId"]),
    });

    let rawRecords;
    try {
      rawRecords = await executeQuery(query);
    } catch {
      emitAudit(audit, { event: "READ_FAILED", collection });
      throw new ReadContractError("READ_FAILED", "Falha na abstração de leitura.");
    }

    assertReadResult(rawRecords, scope.maxDocuments);
    const documents = Object.freeze(
      rawRecords.map((record) => sanitizeRecord(collection, record, scope)),
    );
    const evidenceIds = Object.freeze(
      documents.map(({ id }) => minimalEvidenceId(collection, id)),
    );

    emitAudit(audit, {
      event: "READ_COMPLETED",
      collection,
      documentCount: documents.length,
      evidenceIds,
    });

    return Object.freeze({ collection, documents, evidenceIds });
  }

  return Object.freeze({ readCollection });
}
