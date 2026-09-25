import { detectarSinais } from "./analyzer.js";
import { montarRelatorio } from "./report.js";
import {
  InterpretationValidationError,
  TIPOS_VIOLACAO_INTERPRETACAO,
  auditarInterpretacao,
} from "./interpretation-validator.js";

export const UTILIDADE_HUMANA = Object.freeze([
  "UTIL",
  "PARCIALMENTE_UTIL",
  "RUIDOSA",
  "ENGANOSA",
  "NAO_AVALIADA",
]);

const CAMPO_POR_VIOLACAO = Object.freeze({
  [TIPOS_VIOLACAO_INTERPRETACAO.FATO_INVENTADO]: "fatosInventados",
  [TIPOS_VIOLACAO_INTERPRETACAO.SINAL_INVENTADO]: "sinaisInventados",
  [TIPOS_VIOLACAO_INTERPRETACAO.EVIDENCE_ID_INVENTADO]: "evidenceIdsInventados",
  [TIPOS_VIOLACAO_INTERPRETACAO.CLASSIFICACAO_ALTERADA]: "classificacoesAlteradas",
  [TIPOS_VIOLACAO_INTERPRETACAO.ITEM_SEM_SINAL_ID]: "itensSemSinalId",
  [TIPOS_VIOLACAO_INTERPRETACAO.ENTIDADE_INVENTADA]: "entidadesInventadas",
  [TIPOS_VIOLACAO_INTERPRETACAO.METRICA_INVENTADA]: "metricasInventadas",
  [TIPOS_VIOLACAO_INTERPRETACAO.SUGESTAO_COMO_FATO]: "sugestoesComoFato",
  [TIPOS_VIOLACAO_INTERPRETACAO.SINAL_SEM_INTERPRETACAO]: "sinaisOriginaisSemInterpretacao",
});

function metricasVazias() {
  return {
    fatosInventados: 0,
    sinaisInventados: 0,
    evidenceIdsInventados: 0,
    classificacoesAlteradas: 0,
    itensSemSinalId: 0,
    entidadesInventadas: 0,
    metricasInventadas: 0,
    sugestoesComoFato: 0,
    sinaisOriginaisSemInterpretacao: 0,
    respostasRejeitadasValidador: 0,
  };
}

function contarViolacoes(violacoes) {
  const metricas = metricasVazias();
  for (const { tipo } of violacoes) {
    const campo = CAMPO_POR_VIOLACAO[tipo];
    if (campo) metricas[campo] += 1;
  }
  metricas.respostasRejeitadasValidador = violacoes.length > 0 ? 1 : 0;
  return metricas;
}

export function avaliarInterpretacao(relatorio, resposta, utilidadeHumana = "NAO_AVALIADA") {
  if (!UTILIDADE_HUMANA.includes(utilidadeHumana)) throw new Error("Nota humana inválida.");
  const violacoes = auditarInterpretacao(relatorio, resposta);
  return {
    ...contarViolacoes(violacoes),
    utilidadeHumana,
    aprovado: violacoes.length === 0,
    violacoes,
  };
}

function consolidar(resultados) {
  const totais = resultados.reduce((acumulado, resultado) => {
    for (const campo of Object.keys(acumulado)) acumulado[campo] += resultado[campo];
    return acumulado;
  }, metricasVazias());
  const aprovado = Object.values(totais).every((valor) => valor === 0);
  return {
    ...totais,
    utilidadeHumana: "NAO_AVALIADA",
    aprovado,
    resultados,
  };
}

export function executarBenchmarkInterpretacoes(cenarios, fornecedor) {
  const resultados = cenarios.map((cenario) => {
    const sinais = detectarSinais(cenario.entrada);
    const relatorio = montarRelatorio(cenario.entrada.dataReferencia, sinais);
    const resposta = fornecedor(relatorio, cenario);
    const avaliacao = avaliarInterpretacao(relatorio, resposta);
    return { id: cenario.id, ...avaliacao, violacoes: undefined };
  });
  return consolidar(resultados);
}

export async function executarBenchmarkGemini(cenarios, interpretar, aoValidar = async () => {}) {
  const resultados = [];
  for (const cenario of cenarios) {
    const sinais = detectarSinais(cenario.entrada);
    const relatorio = montarRelatorio(cenario.entrada.dataReferencia, sinais);
    try {
      const resposta = await interpretar(relatorio, cenario);
      const avaliacao = avaliarInterpretacao(relatorio, resposta);
      if (avaliacao.aprovado) await aoValidar({ id: cenario.id, resposta });
      resultados.push({ id: cenario.id, ...avaliacao, violacoes: undefined });
    } catch (error) {
      const violacoes = error instanceof InterpretationValidationError ? error.violacoes : [];
      const metricas = contarViolacoes(violacoes);
      metricas.respostasRejeitadasValidador = 1;
      resultados.push({
        id: cenario.id,
        ...metricas,
        utilidadeHumana: "NAO_AVALIADA",
        aprovado: false,
        erroExecucao: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return consolidar(resultados);
}
