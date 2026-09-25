import assert from "node:assert/strict";
import test from "node:test";
import { cenarios } from "../dataset/cases.js";
import { criarInterpretacaoControlada } from "../dataset/mock-interpretations.js";
import { detectarSinais } from "../src/analyzer.js";
import {
  DEFAULT_GEMINI_MODEL,
  interpretarRelatorioComGemini,
  resolverModeloGemini,
} from "../src/gemini-interpreter.js";
import { executarBenchmarkInterpretacoes, avaliarInterpretacao } from "../src/interpretation-benchmark.js";
import { INTERPRETATION_PROMPT } from "../src/interpretation-prompt.js";
import { InterpretationValidationError, validarInterpretacao } from "../src/interpretation-validator.js";
import { montarRelatorio } from "../src/report.js";

function cenario(id) {
  return cenarios.find((item) => item.id === id);
}

function contexto(id = "CASO-5-PESQUISAS-SEMELHANTES") {
  const item = cenario(id);
  const relatorio = montarRelatorio(item.entrada.dataReferencia, detectarSinais(item.entrada));
  return { relatorio, resposta: criarInterpretacaoControlada(relatorio) };
}

function rejeita(relatorio, resposta) {
  assert.throws(
    () => validarInterpretacao(relatorio, resposta),
    (error) => error instanceof InterpretationValidationError && error.violacoes.length > 0,
  );
}

test("saída válida preserva sinalId, evidenceIds, entidades e classificação", () => {
  const { relatorio, resposta } = contexto();
  assert.equal(validarInterpretacao(relatorio, resposta), resposta);
  assert.equal(resposta.itens[0].sinalId, relatorio.itens[0].contexto.sinalId);
  assert.equal(resposta.itens[0].classificacaoOriginal, relatorio.itens[0].classificacao);
  assert.deepEqual(resposta.itens[0].evidenceIds, relatorio.itens[0].evidenceIds);
  assert.deepEqual(resposta.itens[0].entidades, relatorio.itens[0].entidades);
});

test("rejeita sinalId inexistente e item sem sinalId", () => {
  const primeiro = contexto();
  primeiro.resposta.itens[0].sinalId = "signal-inexistente";
  rejeita(primeiro.relatorio, primeiro.resposta);
  assert.equal(avaliarInterpretacao(primeiro.relatorio, primeiro.resposta).sinaisInventados, 1);

  const segundo = contexto();
  delete segundo.resposta.itens[0].sinalId;
  rejeita(segundo.relatorio, segundo.resposta);
  assert.equal(avaliarInterpretacao(segundo.relatorio, segundo.resposta).itensSemSinalId, 1);
});

test("rejeita evidenceId e entidade inventados", () => {
  const evidencia = contexto();
  evidencia.resposta.itens[0].evidenceIds.push("evidencia-inexistente");
  rejeita(evidencia.relatorio, evidencia.resposta);
  assert.equal(avaliarInterpretacao(evidencia.relatorio, evidencia.resposta).evidenceIdsInventados, 1);

  const entidade = contexto();
  entidade.resposta.itens[0].entidades.push("cliente-999");
  rejeita(entidade.relatorio, entidade.resposta);
  assert.equal(avaliarInterpretacao(entidade.relatorio, entidade.resposta).entidadesInventadas, 1);
});

test("rejeita classificação original alterada", () => {
  const { relatorio, resposta } = contexto();
  resposta.itens[0].classificacaoOriginal = "FATO";
  rejeita(relatorio, resposta);
  assert.equal(avaliarInterpretacao(relatorio, resposta).classificacoesAlteradas, 1);
});

test("rejeita métrica e fato inventados", () => {
  const metrica = contexto();
  metrica.resposta.itens[0].interpretacao += " Métrica operacional 999.";
  rejeita(metrica.relatorio, metrica.resposta);
  assert.equal(avaliarInterpretacao(metrica.relatorio, metrica.resposta).metricasInventadas, 1);

  const fato = contexto();
  fato.resposta.itens[0].interpretacao = "Essas cotações são duplicadas.";
  rejeita(fato.relatorio, fato.resposta);
  assert.equal(avaliarInterpretacao(fato.relatorio, fato.resposta).fatosInventados, 1);
});

test("SUGESTÃO é aceita somente no campo próprio", () => {
  const valido = contexto();
  assert.equal(validarInterpretacao(valido.relatorio, valido.resposta), valido.resposta);

  const invalido = contexto();
  invalido.resposta.itens[0].interpretacao = "Recomendo revisar este sinal.";
  rejeita(invalido.relatorio, invalido.resposta);
  assert.equal(avaliarInterpretacao(invalido.relatorio, invalido.resposta).sugestoesComoFato, 1);
});

test("casos sem sinais não criam itens nem conclusão de duplicidade", () => {
  for (const id of ["CASO-1-OPERACAO-NORMAL", "CASO-6-PARECIDAS-ABAIXO-DO-LIMIAR"]) {
    const { relatorio, resposta } = contexto(id);
    assert.deepEqual(relatorio.itens, []);
    assert.deepEqual(resposta.itens, []);
    assert.doesNotMatch(JSON.stringify(resposta), /duplicad/iu);
    assert.equal(validarInterpretacao(relatorio, resposta), resposta);
  }
});

test("sinal original sem interpretação é medido e rejeitado", () => {
  const { relatorio, resposta } = contexto();
  resposta.itens = [];
  rejeita(relatorio, resposta);
  assert.equal(avaliarInterpretacao(relatorio, resposta).sinaisOriginaisSemInterpretacao, 1);
});

test("benchmark local reporta zero violações e utilidade não avaliada", () => {
  const resultado = executarBenchmarkInterpretacoes(cenarios, criarInterpretacaoControlada);
  assert.equal(resultado.fatosInventados, 0);
  assert.equal(resultado.sinaisInventados, 0);
  assert.equal(resultado.evidenceIdsInventados, 0);
  assert.equal(resultado.classificacoesAlteradas, 0);
  assert.equal(resultado.itensSemSinalId, 0);
  assert.equal(resultado.entidadesInventadas, 0);
  assert.equal(resultado.metricasInventadas, 0);
  assert.equal(resultado.sugestoesComoFato, 0);
  assert.equal(resultado.sinaisOriginaisSemInterpretacao, 0);
  assert.equal(resultado.respostasRejeitadasValidador, 0);
  assert.equal(resultado.utilidadeHumana, "NAO_AVALIADA");
  assert.equal(resultado.aprovado, true);
});

test("cliente exige chave, aceita modelo por ambiente e valida resposta injetada", async () => {
  await assert.rejects(
    interpretarRelatorioComGemini(contexto().relatorio, { apiKey: "" }),
    /GEMINI_API_KEY ausente/,
  );
  assert.equal(resolverModeloGemini(undefined, {}), DEFAULT_GEMINI_MODEL);
  assert.equal(resolverModeloGemini(undefined, { GEMINI_MODEL: "modelo-teste" }), "modelo-teste");

  const { relatorio, resposta } = contexto();
  let request;
  const resultado = await interpretarRelatorioComGemini(relatorio, {
    apiKey: "chave-apenas-para-teste",
    model: "modelo-teste",
    generateContent: async (received) => {
      request = received;
      return structuredClone(resposta);
    },
  });
  assert.deepEqual(resultado, resposta);
  assert.deepEqual(request.relatorio, relatorio);
  assert.equal(request.model, "modelo-teste");
  assert.match(request.prompt, /não cria fatos/iu);
  assert.match(request.prompt, /não conclua duplicidade/iu);
  assert.equal(request.schema.additionalProperties, false);
});

test("prompt restringe fatos, classificação, evidências, duplicidade e sugestão", () => {
  assert.match(INTERPRETATION_PROMPT, /somente o relatório/iu);
  assert.match(INTERPRETATION_PROMPT, /não cria fatos/iu);
  assert.match(INTERPRETATION_PROMPT, /não altere FATO/iu);
  assert.match(INTERPRETATION_PROMPT, /evidenceIds/iu);
  assert.match(INTERPRETATION_PROMPT, /duplicidade/iu);
  assert.match(INTERPRETATION_PROMPT, /SUGESTÃO/iu);
});
