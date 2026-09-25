import { CLASSIFICACAO_POR_TIPO, TIPOS_SINAL } from "./analyzer.js";

export const PRIORIDADE_POR_TIPO = Object.freeze({
  [TIPOS_SINAL.PROXIMA_ACAO_ATRASADA]: 1,
  [TIPOS_SINAL.PROXIMA_ACAO_HOJE]: 2,
  [TIPOS_SINAL.OPORTUNIDADE_SEM_PROXIMA_ACAO]: 3,
  [TIPOS_SINAL.POSSIVEIS_PESQUISAS_REPETIDAS]: 3,
});

function validarSinal(sinal) {
  if (!sinal || typeof sinal !== "object" || !CLASSIFICACAO_POR_TIPO[sinal.tipo]) {
    throw new Error("Sinal desconhecido no relatório.");
  }
  if (sinal.classificacao === "SUGESTÃO") {
    throw new Error("SUGESTÃO não pertence ao contrato IA-2B.");
  }
  if (sinal.classificacao !== CLASSIFICACAO_POR_TIPO[sinal.tipo]) {
    throw new Error("Classificação do sinal incompatível com seu tipo.");
  }
  if (!Array.isArray(sinal.evidenceIds) || sinal.evidenceIds.length === 0) {
    throw new Error("Sinal sem evidenceIds.");
  }
  if (!Array.isArray(sinal.entidades) || sinal.entidades.length === 0) {
    throw new Error("Sinal sem entidades.");
  }
  if (sinal.dados === null || typeof sinal.dados !== "object" || Array.isArray(sinal.dados)) {
    throw new Error("Sinal sem dados determinísticos.");
  }
}

function criarResumo(sinais) {
  const resumo = {
    atrasadas: 0,
    hoje: 0,
    semProximaAcao: 0,
    padroesAltaSemelhanca: 0,
  };

  for (const sinal of sinais) {
    if (sinal.tipo === TIPOS_SINAL.PROXIMA_ACAO_ATRASADA) resumo.atrasadas += 1;
    if (sinal.tipo === TIPOS_SINAL.PROXIMA_ACAO_HOJE) resumo.hoje += 1;
    if (sinal.tipo === TIPOS_SINAL.OPORTUNIDADE_SEM_PROXIMA_ACAO) resumo.semProximaAcao += 1;
    if (sinal.tipo === TIPOS_SINAL.POSSIVEIS_PESQUISAS_REPETIDAS) {
      resumo.padroesAltaSemelhanca += 1;
    }
  }

  return resumo;
}

function criarItem(sinal) {
  return {
    id: "item-" + sinal.id,
    tipo: sinal.tipo,
    classificacao: sinal.classificacao,
    prioridadeDeterministica: PRIORIDADE_POR_TIPO[sinal.tipo],
    fatos: structuredClone(sinal.dados),
    evidenceIds: [...sinal.evidenceIds],
    entidades: [...sinal.entidades],
    contexto: { sinalId: sinal.id },
  };
}

export function montarRelatorio(dataReferencia, sinais) {
  if (typeof dataReferencia !== "string" || dataReferencia.length === 0) {
    throw new Error("dataReferencia é obrigatória.");
  }
  if (!Array.isArray(sinais)) throw new Error("sinais deve ser uma lista.");
  sinais.forEach(validarSinal);

  const itens = sinais
    .map(criarItem)
    .sort((a, b) => (
      a.prioridadeDeterministica - b.prioridadeDeterministica
      || a.contexto.sinalId.localeCompare(b.contexto.sinalId)
    ));

  return {
    dataReferencia,
    resumo: criarResumo(sinais),
    itens,
  };
}
