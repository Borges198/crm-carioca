import {
  CLASSIFICACAO_POR_TIPO,
  TIPOS_SINAL,
  coletarIdsEntidades,
  detectarSinais,
} from "./analyzer.js";

function identidade(sinal) {
  return `${sinal.tipo}|${[...sinal.entidades].sort().join("|")}`;
}

function iguais(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function parearSinais(esperados, detectados) {
  const indicesEsperadosDisponiveis = new Set(esperados.map((_, index) => index));
  const falsosPositivos = [];

  for (const detectado of detectados) {
    const indiceEsperado = [...indicesEsperadosDisponiveis].find((index) => (
      iguais(esperados[index], detectado)
    ));
    if (indiceEsperado === undefined) {
      falsosPositivos.push(detectado);
    } else {
      indicesEsperadosDisponiveis.delete(indiceEsperado);
    }
  }

  return {
    falsosPositivos,
    sinaisImportantesPerdidos: [...indicesEsperadosDisponiveis].map((index) => esperados[index]),
  };
}

export function avaliarCaso(cenario, sinaisDetectados = detectarSinais(cenario.entrada)) {
  const esperadosPorIdentidade = new Map(cenario.sinaisEsperados.map((sinal) => [identidade(sinal), sinal]));
  const idsExistentes = coletarIdsEntidades(cenario.entrada);
  const { falsosPositivos, sinaisImportantesPerdidos } = parearSinais(
    cenario.sinaisEsperados,
    sinaisDetectados,
  );
  const classificacoesIncorretas = sinaisDetectados.filter(
    (sinal) => CLASSIFICACAO_POR_TIPO[sinal.tipo] !== sinal.classificacao,
  );
  const fatosIncorretos = sinaisDetectados.filter((sinal) => {
    const esperado = esperadosPorIdentidade.get(identidade(sinal));
    if (!esperado || esperado.classificacao !== "FATO") return false;
    return !iguais(
      { id: sinal.id, entidades: sinal.entidades, evidenceIds: sinal.evidenceIds, dados: sinal.dados },
      { id: esperado.id, entidades: esperado.entidades, evidenceIds: esperado.evidenceIds, dados: esperado.dados },
    );
  });
  const padroesSemEvidencia = sinaisDetectados.filter((sinal) => (
    sinal.tipo === TIPOS_SINAL.POSSIVEIS_PESQUISAS_REPETIDAS
    && (
      !Array.isArray(sinal.evidenceIds)
      || sinal.evidenceIds.length === 0
      || !sinal.evidenceIds.every((id) => idsExistentes.has(id))
    )
  ));
  const entidadesInventadas = sinaisDetectados.flatMap((sinal) => (
    sinal.entidades.filter((id) => !idsExistentes.has(id)).map((id) => ({ sinalId: sinal.id, entidadeId: id }))
  ));
  const sinaisEsperadosDetectados = cenario.sinaisEsperados.length - sinaisImportantesPerdidos.length;

  return {
    id: cenario.id,
    sinaisEsperados: cenario.sinaisEsperados.length,
    sinaisDetectados: sinaisDetectados.length,
    sinaisEsperadosDetectados,
    falsosPositivos: falsosPositivos.length,
    sinaisImportantesPerdidos: sinaisImportantesPerdidos.length,
    fatosIncorretos: fatosIncorretos.length,
    padroesSemEvidencia: padroesSemEvidencia.length,
    classificacoesIncorretas: classificacoesIncorretas.length,
    entidadesInventadas: entidadesInventadas.length,
  };
}

export function executarBenchmark(cenarios) {
  const resultados = cenarios.map((cenario) => avaliarCaso(cenario));
  const totais = resultados.reduce((acumulado, resultado) => {
    for (const campo of Object.keys(acumulado)) acumulado[campo] += resultado[campo];
    return acumulado;
  }, {
    sinaisEsperados: 0,
    sinaisDetectados: 0,
    sinaisEsperadosDetectados: 0,
    falsosPositivos: 0,
    sinaisImportantesPerdidos: 0,
    fatosIncorretos: 0,
    padroesSemEvidencia: 0,
    classificacoesIncorretas: 0,
    entidadesInventadas: 0,
  });

  const percentualSinaisEsperadosDetectados = totais.sinaisEsperados === 0
    ? 100
    : (totais.sinaisEsperadosDetectados / totais.sinaisEsperados) * 100;
  const aprovado = (
    percentualSinaisEsperadosDetectados === 100
    && totais.falsosPositivos === 0
    && totais.sinaisImportantesPerdidos === 0
    && totais.fatosIncorretos === 0
    && totais.padroesSemEvidencia === 0
    && totais.classificacoesIncorretas === 0
    && totais.entidadesInventadas === 0
  );

  return {
    ...totais,
    percentualSinaisEsperadosDetectados,
    aprovado,
    resultados,
  };
}
