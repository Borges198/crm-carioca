import { TIPOS_SINAL, detectarSinais } from "./analyzer.js";
import { montarRelatorio } from "./report.js";

function iguais(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function resumoEsperado(sinais) {
  return {
    atrasadas: sinais.filter(({ tipo }) => tipo === TIPOS_SINAL.PROXIMA_ACAO_ATRASADA).length,
    hoje: sinais.filter(({ tipo }) => tipo === TIPOS_SINAL.PROXIMA_ACAO_HOJE).length,
    semProximaAcao: sinais.filter(({ tipo }) => tipo === TIPOS_SINAL.OPORTUNIDADE_SEM_PROXIMA_ACAO).length,
    padroesAltaSemelhanca: sinais.filter(
      ({ tipo }) => tipo === TIPOS_SINAL.POSSIVEIS_PESQUISAS_REPETIDAS,
    ).length,
  };
}

function contemSugestao(value) {
  if (typeof value === "string") return value.toLocaleUpperCase("pt-BR") === "SUGESTÃO";
  if (Array.isArray(value)) return value.some(contemSugestao);
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(([chave, item]) => (
    chave.toLocaleLowerCase("pt-BR").includes("sugest") || contemSugestao(item)
  ));
}

export function avaliarRelatorio(sinais, relatorio) {
  const sinaisPorId = new Map(sinais.map((sinal) => [sinal.id, sinal]));
  const sinaisConsumidos = new Set();
  let itensOrfaos = 0;
  let classificacoesAlteradas = 0;
  let evidenceIdsPerdidos = 0;
  let entidadesPerdidas = 0;
  let fatosNovosIndevidos = 0;
  let sugestoesIndevidas = 0;

  for (const item of relatorio.itens) {
    const sinalId = item.contexto?.sinalId;
    const sinal = sinaisPorId.get(sinalId);
    if (!sinal || sinaisConsumidos.has(sinalId)) {
      itensOrfaos += 1;
      if (contemSugestao(item)) sugestoesIndevidas += 1;
      continue;
    }

    sinaisConsumidos.add(sinalId);
    if (item.classificacao !== sinal.classificacao) classificacoesAlteradas += 1;
    if (!iguais(item.evidenceIds, sinal.evidenceIds)) evidenceIdsPerdidos += 1;
    if (!iguais(item.entidades, sinal.entidades)) entidadesPerdidas += 1;
    if (!iguais(item.fatos, sinal.dados)) fatosNovosIndevidos += 1;
    if (contemSugestao(item)) sugestoesIndevidas += 1;
  }

  const sinaisSemItem = sinais.filter((sinal) => !sinaisConsumidos.has(sinal.id)).length;
  const resumosInconsistentes = iguais(relatorio.resumo, resumoEsperado(sinais)) ? 0 : 1;

  return {
    sinaisRecebidos: sinais.length,
    itensGerados: relatorio.itens.length,
    itensOrfaos,
    sinaisSemItem,
    classificacoesAlteradas,
    evidenceIdsPerdidos,
    entidadesPerdidas,
    fatosNovosIndevidos,
    sugestoesIndevidas,
    resumosInconsistentes,
  };
}

export function executarBenchmarkRelatorios(cenarios) {
  const resultados = cenarios.map((cenario) => {
    const sinais = detectarSinais(cenario.entrada);
    const relatorio = montarRelatorio(cenario.entrada.dataReferencia, sinais);
    return { id: cenario.id, ...avaliarRelatorio(sinais, relatorio) };
  });
  const totais = resultados.reduce((acumulado, resultado) => {
    for (const campo of Object.keys(acumulado)) acumulado[campo] += resultado[campo];
    return acumulado;
  }, {
    sinaisRecebidos: 0,
    itensGerados: 0,
    itensOrfaos: 0,
    sinaisSemItem: 0,
    classificacoesAlteradas: 0,
    evidenceIdsPerdidos: 0,
    entidadesPerdidas: 0,
    fatosNovosIndevidos: 0,
    sugestoesIndevidas: 0,
    resumosInconsistentes: 0,
  });
  const aprovado = (
    totais.itensOrfaos === 0
    && totais.sinaisSemItem === 0
    && totais.classificacoesAlteradas === 0
    && totais.evidenceIdsPerdidos === 0
    && totais.entidadesPerdidas === 0
    && totais.fatosNovosIndevidos === 0
    && totais.sugestoesIndevidas === 0
    && totais.resumosInconsistentes === 0
  );

  return { ...totais, aprovado, resultados };
}
