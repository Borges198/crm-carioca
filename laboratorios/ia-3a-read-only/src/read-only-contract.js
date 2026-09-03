export const DEV_PROJECT_ID = "crm-carioca-dev";
export const MIN_DOCUMENTS = 1;
export const MAX_DOCUMENTS = 25;

export const TARGET_COLLECTIONS = Object.freeze([
  "cotacoes",
  "acompanhamentos",
]);

export const OUTPUT_ALLOWLIST = Object.freeze({
  cotacoes: Object.freeze([
    "clienteId",
    "acompanhamentoId",
    "destino",
    "dataIda",
    "dataVolta",
    "leadStatus",
  ]),
  acompanhamentos: Object.freeze([
    "cotacaoAncoraId",
    "clienteId",
    "proximaAcaoEm",
  ]),
});

export class ReadContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ReadContractError";
    this.code = code;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ReadContractError("INVALID_SCOPE", `${field} é obrigatório.`);
  }
  return value.trim();
}

export function validateReadScope(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ReadContractError("INVALID_SCOPE", "Escopo de leitura inválido.");
  }

  // O ambiente é validado primeiro: nenhum outro passo pode anteceder este gate.
  const projectId = requiredText(input.projectId, "projectId");
  if (projectId !== DEV_PROJECT_ID) {
    throw new ReadContractError("PROJECT_BLOCKED", "Somente crm-carioca-dev é permitido.");
  }

  const agencyId = requiredText(input.agencyId, "agencyId");
  const ownerId = requiredText(input.ownerId, "ownerId");
  const maxDocuments = input.maxDocuments;
  if (
    !Number.isInteger(maxDocuments)
    || maxDocuments < MIN_DOCUMENTS
    || maxDocuments > MAX_DOCUMENTS
  ) {
    throw new ReadContractError(
      "INVALID_MAX_DOCUMENTS",
      `maxDocuments deve ser inteiro entre ${MIN_DOCUMENTS} e ${MAX_DOCUMENTS}.`,
    );
  }

  return Object.freeze({ projectId, agencyId, ownerId, maxDocuments });
}

export function assertTargetCollection(collectionName) {
  if (!TARGET_COLLECTIONS.includes(collectionName)) {
    throw new ReadContractError("COLLECTION_BLOCKED", "Coleção não permitida.");
  }
  return collectionName;
}
