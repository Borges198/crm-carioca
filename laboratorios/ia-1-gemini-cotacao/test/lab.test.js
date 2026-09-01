import assert from "node:assert/strict";
import test from "node:test";
import { benchmarkCases } from "../dataset/cases.js";
import {
  DIFFERENCE_CLASSIFICATIONS,
  evaluateCase,
  runBenchmark,
} from "../src/benchmark.js";
import {
  extractCotacaoWithGemini,
  GEMINI_MAX_ATTEMPTS,
  resolveGeminiModel,
  withTransientRetry,
} from "../src/gemini-client.js";
import { validateStructuredOutput } from "../src/schema.js";

test("todos os gabaritos do dataset atendem ao schema", () => {
  for (const testCase of benchmarkCases) {
    assert.equal(validateStructuredOutput(testCase.expected), testCase.expected);
  }
});

test("mantém os seis casos técnicos e adiciona os três casos reais", () => {
  assert.deepEqual(
    benchmarkCases.map(({ id }) => id),
    [
      "direto",
      "ida-e-volta",
      "conexao",
      "mais-um-dia",
      "texto-incompleto",
      "financeiro-complexo",
      "LATAM-REAL-01",
      "SMILES-REAL-01",
      "AZUL-REAL-01",
    ],
  );
});

test("gabaritos reais preservam valores integrais e a independência entre ida e volta", () => {
  const latam = benchmarkCases.find(({ id }) => id === "LATAM-REAL-01").expected;
  const smiles = benchmarkCases.find(({ id }) => id === "SMILES-REAL-01").expected;
  const azul = benchmarkCases.find(({ id }) => id === "AZUL-REAL-01").expected;

  assert.equal(latam.ida.financeiroApresentado.pontosMilhas, 18892);
  assert.equal(latam.volta.financeiroApresentado.pontosMilhas, 8019);
  assert.equal(smiles.ida.financeiroApresentado.pontosMilhas, 16400);
  assert.equal(smiles.volta.financeiroApresentado.pontosMilhas, 16400);
  assert.equal(azul.ida.financeiroApresentado.pontosBase, 130000);
  assert.equal(azul.ida.financeiroApresentado.pontosCondicionados, 128700);
  assert.equal(azul.volta.financeiroApresentado.pontosBase, 100000);
  assert.equal(azul.volta.financeiroApresentado.pontosCondicionados, 90000);
  assert.equal(azul.quantidadeViajantes, 2);
  assert.notEqual(azul.ida.origem, azul.volta.origem);
  assert.notEqual(azul.ida.numeroVoo, azul.volta.numeroVoo);

  assert.deepEqual(latam.financeiro.ida.valorMonetarioExibido, [
    { valor: 62.62, valorBruto: "R$ 62,62" },
  ]);
  assert.deepEqual(latam.financeiro.volta.valorMonetarioExibido, [
    { valor: 50.57, valorBruto: "R$ 50,57" },
  ]);
  assert.deepEqual(latam.financeiro.total.valorMonetarioExibido, [
    { valor: 113.19, valorBruto: "R$ 113,19" },
  ]);
  assert.deepEqual(azul.financeiro.ida.valorMonetarioExibido, [
    { valor: 90.32, valorBruto: "R$ 90,32" },
  ]);
  assert.deepEqual(azul.financeiro.volta.valorMonetarioExibido, [
    { valor: 52.72, valorBruto: "R$ 52,72" },
  ]);
  assert.deepEqual(azul.financeiro.total.valorMonetarioExibido, [
    { valor: 286.08, valorBruto: "R$ 286,08" },
  ]);
  assert.deepEqual(smiles.financeiro.total.valorMonetarioExibido, [
    { valor: 96.69, valorBruto: "R$ 96,69" },
  ]);
});

test("casos reais idênticos ao gabarito têm zero alucinações críticas", () => {
  const realCases = benchmarkCases.filter(({ id }) => id.endsWith("-REAL-01"));

  for (const testCase of realCases) {
    const result = evaluateCase(testCase, structuredClone(testCase.expected));
    assert.equal(result.alucinacoesCriticas, 0, testCase.id);
    assert.equal(result.aceitoSemCorrecaoHumana, true, testCase.id);
    assert.deepEqual(result.camposIncorretos, [], testCase.id);
    assert.deepEqual(result.camposInventados, [], testCase.id);
  }
});

test("resultado idêntico é aceito sem correção humana e sem alucinação", () => {
  const testCase = benchmarkCases[0];
  const result = evaluateCase(testCase, structuredClone(testCase.expected));

  assert.equal(result.aceitoSemCorrecaoHumana, true);
  assert.equal(result.alucinacoesCriticas, 0);
  assert.deepEqual(result.camposIncorretos, []);
  assert.deepEqual(result.camposInventados, []);
});

test("valor não nulo em campo ausente é alucinação crítica", () => {
  const testCase = benchmarkCases.find((item) => item.id === "texto-incompleto");
  const returned = structuredClone(testCase.expected);
  returned.ida = {
    origem: "AJU", destino: "BSB", data: "01/01/2027", horarioSaida: "14:05", horarioChegada: null,
    duracao: null, companhia: null, numeroVoo: null, indicadorMaisUmDia: null, paradas: null,
    aeroportosIntermediarios: null, conexoes: null, segmentos: null,
    financeiroApresentado: {
      unidadePontosMilhas: null, pontosMilhas: null, pontosBase: null,
      pontosCondicionados: null,
    },
  };

  const result = evaluateCase(testCase, returned);

  assert.equal(result.aceitoSemCorrecaoHumana, false);
  assert.equal(result.alucinacoesCriticas, 1);
  assert.equal(result.camposInventados[0].path, "ida");
  assert.equal(result.classificacaoDiferencas[DIFFERENCE_CLASSIFICATIONS.HALLUCINATION], 1);
});

test("avaliador separa extração errada de alucinação", () => {
  const testCase = benchmarkCases.find(({ id }) => id === "LATAM-REAL-01");
  const returned = structuredClone(testCase.expected);
  returned.ida.origem = "XXX";

  const result = evaluateCase(testCase, returned);

  assert.equal(result.classificacaoDiferencas[DIFFERENCE_CLASSIFICATIONS.WRONG_EXTRACTION], 1);
  assert.equal(result.classificacaoDiferencas[DIFFERENCE_CLASSIFICATIONS.HALLUCINATION], 0);
  assert.equal(result.alucinacoesCriticas, 0);
});

test("valor existente em posição monetária inadequada é contrato ambíguo, não alucinação", () => {
  const testCase = benchmarkCases.find(({ id }) => id === "SMILES-REAL-01");
  const returned = structuredClone(testCase.expected);
  returned.financeiro.ida.valorMonetarioExibido =
    returned.financeiro.total.valorMonetarioExibido;
  returned.financeiro.total.valorMonetarioExibido = null;

  const result = evaluateCase(testCase, returned);

  assert.equal(result.classificacaoDiferencas[DIFFERENCE_CLASSIFICATIONS.AMBIGUOUS_CONTRACT], 1);
  assert.equal(result.classificacaoDiferencas[DIFFERENCE_CLASSIFICATIONS.HALLUCINATION], 0);
  assert.equal(result.alucinacoesCriticas, 0);
  assert.equal(result.aceitoSemCorrecaoHumana, false);
});

test("normaliza prefixo Voo deterministicamente e registra a normalização", () => {
  const testCase = benchmarkCases.find(({ id }) => id === "AZUL-REAL-01");
  const returned = structuredClone(testCase.expected);
  returned.ida.numeroVoo = "Voo 4009";
  returned.volta.numeroVoo = "Voo 4553";

  const result = evaluateCase(testCase, returned);

  assert.equal(result.classificacaoDiferencas[DIFFERENCE_CLASSIFICATIONS.NORMALIZATION], 2);
  assert.equal(result.alucinacoesCriticas, 0);
  assert.equal(result.aceitoSemCorrecaoHumana, true);
  assert.deepEqual(
    result.diferencas.map(({ original, normalizado }) => ({ original, normalizado })),
    [
      { original: "Voo 4009", normalizado: "4009" },
      { original: "Voo 4553", normalizado: "4553" },
    ],
  );
});

test("schema rejeita propriedades não previstas", () => {
  const value = structuredClone(benchmarkCases[0].expected);
  value.aeroportoInventado = "XYZ";

  assert.throws(() => validateStructuredOutput(value), /não atende ao schema/);
});

test("cliente bloqueia chamada sem GEMINI_API_KEY", async () => {
  await assert.rejects(
    extractCotacaoWithGemini("Somente ida"),
    /GEMINI_API_KEY ausente/,
  );
});

test("cliente envia JSON Schema ao Gemini e valida a resposta antes de retornar", async () => {
  const expected = benchmarkCases[0].expected;
  let request;
  const client = {
    models: {
      generateContent: async (receivedRequest) => {
        request = receivedRequest;
        return { text: JSON.stringify(expected) };
      },
    },
  };

  const result = await extractCotacaoWithGemini("Cotação fictícia", {
    apiKey: "chave-apenas-para-teste",
    client,
  });

  assert.deepEqual(result, expected);
  assert.equal(request.model, "gemini-3.7-flash");
  assert.equal(request.config.responseMimeType, "application/json");
  assert.equal(request.config.temperature, 0);
  assert.equal(request.config.responseJsonSchema.type, "object");
  assert.match(request.contents, /Não invente nem complete dados ausentes/);
  assert.match(request.contents, /Não arredonde nem converta pontos ou milhas/);
  assert.match(request.contents, /Trate ida e volta como entidades independentes/);
  assert.match(request.contents, /cálculos pertencem ao CRM/);
  assert.match(request.contents, /Cotação fictícia/);
});

test("cliente rejeita resposta JSON estruturalmente inválida", async () => {
  const client = {
    models: {
      generateContent: async () => ({ text: JSON.stringify({ schemaVersion: "1.0" }) }),
    },
  };

  await assert.rejects(
    extractCotacaoWithGemini("Cotação fictícia", {
      apiKey: "chave-apenas-para-teste",
      client,
    }),
    /não atende ao schema/,
  );
});

test("retry recupera erros 429 com backoff exponencial", async () => {
  let attempts = 0;
  const delays = [];

  const result = await withTransientRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error("limite temporário"), { status: 429 });
      return "ok";
    },
    { sleep: async (delayMs) => delays.push(delayMs) },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [250, 500]);
});

test("retry esgota três tentativas para erro 503", async () => {
  let attempts = 0;
  const delays = [];

  await assert.rejects(
    withTransientRetry(
      async () => {
        attempts += 1;
        throw Object.assign(new Error("serviço indisponível"), { status: 503 });
      },
      { sleep: async (delayMs) => delays.push(delayMs) },
    ),
    (error) => error.status === 503 && error.attempts === GEMINI_MAX_ATTEMPTS,
  );

  assert.equal(attempts, 3);
  assert.deepEqual(delays, [250, 500]);
});

test("erro permanente não é repetido", async () => {
  let attempts = 0;
  const delays = [];

  await assert.rejects(
    withTransientRetry(
      async () => {
        attempts += 1;
        throw Object.assign(new Error("requisição inválida"), { status: 400 });
      },
      { sleep: async (delayMs) => delays.push(delayMs) },
    ),
    (error) => error.status === 400 && error.attempts === 1,
  );

  assert.equal(attempts, 1);
  assert.deepEqual(delays, []);
});

test("modelo pode vir do ambiente e mantém o padrão estável", () => {
  assert.equal(resolveGeminiModel(undefined, {}), "gemini-3.7-flash");
  assert.equal(
    resolveGeminiModel(undefined, { GEMINI_MODEL: "gemini-modelo-laboratorio" }),
    "gemini-modelo-laboratorio",
  );
});

test("benchmark registra modelo e falha por caso após esgotar retries", async () => {
  const exhaustedError = Object.assign(new Error("serviço indisponível"), { attempts: 3 });
  const report = await runBenchmark(
    [{ id: "caso-transitorio", rawText: "texto fictício" }],
    async () => { throw exhaustedError; },
    "gemini-modelo-laboratorio",
  );

  assert.equal(report.model, "gemini-modelo-laboratorio");
  assert.equal(report.results[0].erro, "serviço indisponível");
  assert.equal(report.results[0].tentativas, 3);
  assert.equal(report.results[0].aceitoSemCorrecaoHumana, false);
});
