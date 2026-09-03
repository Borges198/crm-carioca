import { assertTargetCollection } from "./read-only-contract.js";

function frozenFilter(field, value) {
  return Object.freeze({ field, operator: "==", value });
}

export function buildScopedQuery(collectionName, validatedScope) {
  const collection = assertTargetCollection(collectionName);

  return Object.freeze({
    operation: "read",
    projectId: validatedScope.projectId,
    collection,
    filters: Object.freeze([
      frozenFilter("agencyId", validatedScope.agencyId),
      frozenFilter("ownerId", validatedScope.ownerId),
    ]),
    limit: validatedScope.maxDocuments,
  });
}
