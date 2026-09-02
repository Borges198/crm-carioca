import assert from "node:assert/strict";
import test from "node:test";
import { cenarios } from "../dataset/cases.js";
import {
  CLASSIFICACAO_POR_TIPO,
  LIMITE_DATAS_PROXIMAS_DIAS,
  TIPOS_SINAL,
  coletarIdsEntidades,
  datasSaoProximas,
  detectarSinais,
} from "../src/analyzer.js";
import { avaliarCaso, executarBenchmark } from "../src/benchmark.js";

function cenario(id) {
  return cenarios.find((item) => item.id === id);
}

function entradaComPesquisas(pesquisas) {
  const clientes = [...new Set(pesquisas.map(({ clienteId }) => clienteId))]
    .map((id) => ({ id }));
  return {
    dataReferencia: "2026-09-01",
    clientes,
    oportunidades: [],
    proximasAcoes: [],
    pesquisas,
  };
}

function pesquisa(id, clienteId, destino, dataIda) {
  return { id, clienteId, destino, dataIda, dataVolta: null };
}

test("dataset contém os seis cenários controlados obrigatórios", () => {
  assert.deepEqual(cenarios.map(({ id }) => id), [
    "CASO-1-OPERACAO-NORMAL",
    "CASO-2-PROXIMA-ACAO-ATRASADA",
    "CASO-3-PROXIMA-ACAO-HOJE",
    "CASO-4-SEM-PROXIMA-ACAO",
    "CASO-5-PESQUISAS-SEMELHANTES",
    "CASO-6-PARECIDAS-ABAIXO-DO-LIMIAR",
  ]);
});

test("operação normal não gera sinal indevido", () => {
  assert.deepEqual(detectarSinais(cenario("CASO-1-OPERACAO-NORMAL").entrada), []);
});

test("detecta próxima ação atrasada como FATO", () => {
  const [sinal] = detectarSinais(cenario("CASO-2-PROXIMA-ACAO-ATRASADA").entrada);
  assert.equal(sinal.tipo, TIPOS_SINAL.PROXIMA_ACAO_ATRASADA);
  assert.equal(sinal.classificacao, "FATO");
  assert.equal(sinal.dados.diasEmAtraso, 1);
});

test("detecta próxima ação hoje como FATO", () => {
  const [sinal] = detectarSinais(cenario("CASO-3-PROXIMA-ACAO-HOJE").entrada);
  assert.equal(sinal.tipo, TIPOS_SINAL.PROXIMA_ACAO_HOJE);
  assert.equal(sinal.classificacao, "FATO");
  assert.equal(sinal.dados.diasAteAcao, 0);
});

test("detecta oportunidade aberta sem próxima ação como FATO", () => {
  const [sinal] = detectarSinais(cenario("CASO-4-SEM-PROXIMA-ACAO").entrada);
  assert.equal(sinal.tipo, TIPOS_SINAL.OPORTUNIDADE_SEM_PROXIMA_ACAO);
  assert.equal(sinal.classificacao, "FATO");
  assert.equal(sinal.dados.proximaAcaoId, null);
});

test("detecta alta semelhança entre pesquisas como PADRÃO", () => {
  const [sinal] = detectarSinais(cenario("CASO-5-PESQUISAS-SEMELHANTES").entrada);
  assert.equal(sinal.tipo, TIPOS_SINAL.POSSIVEIS_PESQUISAS_REPETIDAS);
  assert.equal(sinal.classificacao, "PADRÃO");
  assert.deepEqual(sinal.dados, {
    clienteId: "cliente-005",
    destino: "REC",
    diferencaDiasIda: 2,
    diferencaDiasVolta: 3,
    limiteDatasProximasDias: 3,
  });
});

test("consolida três pesquisas mutuamente relacionadas sem duplicar entidades", () => {
  const sinais = detectarSinais(entradaComPesquisas([
    pesquisa("pesquisa-c", "cliente-1", "SSA", "2026-10-10"),
    pesquisa("pesquisa-a", "cliente-1", "ssa", "2026-10-10"),
    pesquisa("pesquisa-b", "cliente-1", "SSA", "2026-10-10"),
  ]));

  assert.equal(sinais.length, 1);
  assert.equal(sinais[0].tipo, TIPOS_SINAL.POSSIVEIS_PESQUISAS_REPETIDAS);
  assert.equal(sinais[0].classificacao, "PADRÃO");
  assert.deepEqual(sinais[0].entidades, ["pesquisa-a", "pesquisa-b", "pesquisa-c"]);
  assert.equal(new Set(sinais[0].entidades).size, sinais[0].entidades.length);
  assert.deepEqual(sinais[0].evidenceIds, [
    "pesquisa-a",
    "pesquisa-b",
    "pesquisa-c",
    "cliente-1",
  ]);
});

test("consolida cadeia conectada mesmo quando as pontas não são semelhantes", () => {
  const sinais = detectarSinais(entradaComPesquisas([
    pesquisa("pesquisa-c", "cliente-1", "SSA", "2026-10-16"),
    pesquisa("pesquisa-a", "cliente-1", "SSA", "2026-10-10"),
    pesquisa("pesquisa-b", "cliente-1", "SSA", "2026-10-13"),
  ]));

  assert.equal(datasSaoProximas("2026-10-10", "2026-10-16"), false);
  assert.equal(sinais.length, 1);
  assert.deepEqual(sinais[0].entidades, ["pesquisa-a", "pesquisa-b", "pesquisa-c"]);
  assert.deepEqual(sinais[0].evidenceIds, [
    "pesquisa-a",
    "pesquisa-b",
    "pesquisa-c",
    "cliente-1",
  ]);
});

test("mantém grupos conectados independentes como sinais separados e determinísticos", () => {
  const entrada = entradaComPesquisas([
    pesquisa("pesquisa-d", "cliente-2", "REC", "2026-11-02"),
    pesquisa("pesquisa-b", "cliente-1", "SSA", "2026-10-12"),
    pesquisa("pesquisa-c", "cliente-2", "REC", "2026-11-01"),
    pesquisa("pesquisa-a", "cliente-1", "SSA", "2026-10-10"),
  ]);
  const sinais = detectarSinais(entrada);
  const sinaisReordenados = detectarSinais({ ...entrada, pesquisas: [...entrada.pesquisas].reverse() });

  assert.equal(sinais.length, 2);
  assert.deepEqual(sinais, sinaisReordenados);
  assert.deepEqual(sinais.map(({ entidades, evidenceIds }) => ({ entidades, evidenceIds })), [
    {
      entidades: ["pesquisa-a", "pesquisa-b"],
      evidenceIds: ["pesquisa-a", "pesquisa-b", "cliente-1"],
    },
    {
      entidades: ["pesquisa-c", "pesquisa-d"],
      evidenceIds: ["pesquisa-c", "pesquisa-d", "cliente-2"],
    },
  ]);
});

test("datas próximas incluem o limite de três dias e rejeitam quatro dias", () => {
  assert.equal(LIMITE_DATAS_PROXIMAS_DIAS, 3);
  assert.equal(datasSaoProximas("2026-10-10", "2026-10-13"), true);
  assert.equal(datasSaoProximas("2026-10-10", "2026-10-14"), false);
});

test("caso parecido fora do limiar não gera falso positivo de pesquisas", () => {
  const sinais = detectarSinais(cenario("CASO-6-PARECIDAS-ABAIXO-DO-LIMIAR").entrada);
  assert.equal(
    sinais.some(({ tipo }) => tipo === TIPOS_SINAL.POSSIVEIS_PESQUISAS_REPETIDAS),
    false,
  );
  assert.deepEqual(sinais, []);
});

test("todo sinal possui evidências, classificação correta e somente entidades existentes", () => {
  for (const item of cenarios) {
    const idsExistentes = coletarIdsEntidades(item.entrada);
    for (const sinal of detectarSinais(item.entrada)) {
      assert.ok(sinal.id);
      assert.ok(sinal.evidenceIds.length > 0);
      assert.equal(sinal.classificacao, CLASSIFICACAO_POR_TIPO[sinal.tipo]);
      assert.ok(sinal.entidades.every((id) => idsExistentes.has(id)));
      assert.ok(sinal.evidenceIds.every((id) => idsExistentes.has(id)));
    }
  }
});

test("benchmark diagnostica fato incorreto, padrão sem evidência e classificação incorreta", () => {
  const casoFato = cenario("CASO-2-PROXIMA-ACAO-ATRASADA");
  const fatoAlterado = structuredClone(casoFato.sinaisEsperados[0]);
  fatoAlterado.dados.diasEmAtraso = 2;
  assert.equal(avaliarCaso(casoFato, [fatoAlterado]).fatosIncorretos, 1);

  const casoPadrao = cenario("CASO-5-PESQUISAS-SEMELHANTES");
  const padraoAlterado = structuredClone(casoPadrao.sinaisEsperados[0]);
  padraoAlterado.evidenceIds = [];
  padraoAlterado.classificacao = "FATO";
  const resultado = avaliarCaso(casoPadrao, [padraoAlterado]);
  assert.equal(resultado.padroesSemEvidencia, 1);
  assert.equal(resultado.classificacoesIncorretas, 1);
});

test("benchmark conta sinal duplicado como falso positivo e sinal ausente como perdido", () => {
  const casoFato = cenario("CASO-2-PROXIMA-ACAO-ATRASADA");
  const esperado = structuredClone(casoFato.sinaisEsperados[0]);
  assert.equal(avaliarCaso(casoFato, [esperado, structuredClone(esperado)]).falsosPositivos, 1);
  assert.equal(avaliarCaso(casoFato, []).sinaisImportantesPerdidos, 1);
});

test("benchmark final atende integralmente ao critério de passagem", () => {
  const resultado = executarBenchmark(cenarios);
  assert.equal(resultado.sinaisEsperados, 4);
  assert.equal(resultado.sinaisDetectados, 4);
  assert.equal(resultado.sinaisEsperadosDetectados, 4);
  assert.equal(resultado.percentualSinaisEsperadosDetectados, 100);
  assert.equal(resultado.falsosPositivos, 0);
  assert.equal(resultado.sinaisImportantesPerdidos, 0);
  assert.equal(resultado.fatosIncorretos, 0);
  assert.equal(resultado.padroesSemEvidencia, 0);
  assert.equal(resultado.classificacoesIncorretas, 0);
  assert.equal(resultado.entidadesInventadas, 0);
  assert.equal(resultado.aprovado, true);
});
