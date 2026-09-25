import assert from "node:assert/strict";
import test from "node:test";
import { cenarios } from "../dataset/cases.js";
import { TIPOS_SINAL, detectarSinais } from "../src/analyzer.js";
import { avaliarRelatorio, executarBenchmarkRelatorios } from "../src/report-benchmark.js";
import { PRIORIDADE_POR_TIPO, montarRelatorio } from "../src/report.js";

function cenario(id) {
  return cenarios.find((item) => item.id === id);
}

function sinaisDo(id) {
  const item = cenario(id);
  return detectarSinais(item.entrada);
}

test("relatório vazio no caso normal e no caso negativo", () => {
  for (const id of ["CASO-1-OPERACAO-NORMAL", "CASO-6-PARECIDAS-ABAIXO-DO-LIMIAR"]) {
    const item = cenario(id);
    const relatorio = montarRelatorio(item.entrada.dataReferencia, detectarSinais(item.entrada));
    assert.deepEqual(relatorio.resumo, {
      atrasadas: 0,
      hoje: 0,
      semProximaAcao: 0,
      padroesAltaSemelhanca: 0,
    });
    assert.deepEqual(relatorio.itens, []);
  }
});

test("resumo é calculado somente dos quatro sinais presentes", () => {
  const sinais = cenarios.flatMap(({ entrada }) => detectarSinais(entrada));
  const relatorio = montarRelatorio("2026-09-01", sinais);
  assert.deepEqual(relatorio.resumo, {
    atrasadas: 1,
    hoje: 1,
    semProximaAcao: 1,
    padroesAltaSemelhanca: 1,
  });
  assert.equal(relatorio.itens.length, sinais.length);
});

test("cada item mantém vínculo exclusivo com um sinal existente", () => {
  for (const item of cenarios) {
    const sinais = detectarSinais(item.entrada);
    const relatorio = montarRelatorio(item.entrada.dataReferencia, sinais);
    const sinaisPorId = new Map(sinais.map((sinal) => [sinal.id, sinal]));
    assert.equal(relatorio.itens.length, sinais.length);
    for (const relatorioItem of relatorio.itens) {
      assert.ok(sinaisPorId.has(relatorioItem.contexto.sinalId));
    }
    assert.equal(avaliarRelatorio(sinais, relatorio).itensOrfaos, 0);
  }
});

test("itens preservam fatos, evidenceIds, entidades e FATO/PADRÃO exatamente", () => {
  for (const item of cenarios) {
    const sinais = detectarSinais(item.entrada);
    const sinaisPorId = new Map(sinais.map((sinal) => [sinal.id, sinal]));
    const relatorio = montarRelatorio(item.entrada.dataReferencia, sinais);
    for (const relatorioItem of relatorio.itens) {
      const sinal = sinaisPorId.get(relatorioItem.contexto.sinalId);
      assert.deepEqual(relatorioItem.fatos, sinal.dados);
      assert.deepEqual(relatorioItem.evidenceIds, sinal.evidenceIds);
      assert.deepEqual(relatorioItem.entidades, sinal.entidades);
      assert.equal(relatorioItem.classificacao, sinal.classificacao);
    }
  }
});

test("SUGESTÃO está ausente do relatório", () => {
  const sinais = cenarios.flatMap(({ entrada }) => detectarSinais(entrada));
  const relatorio = montarRelatorio("2026-09-01", sinais);
  assert.doesNotMatch(JSON.stringify(relatorio), /SUGESTÃO/u);
});

test("prioridade temporal ordena atrasada antes de hoje e mantém demais neutras", () => {
  assert.equal(PRIORIDADE_POR_TIPO[TIPOS_SINAL.PROXIMA_ACAO_ATRASADA], 1);
  assert.equal(PRIORIDADE_POR_TIPO[TIPOS_SINAL.PROXIMA_ACAO_HOJE], 2);
  assert.equal(PRIORIDADE_POR_TIPO[TIPOS_SINAL.OPORTUNIDADE_SEM_PROXIMA_ACAO], 3);
  assert.equal(PRIORIDADE_POR_TIPO[TIPOS_SINAL.POSSIVEIS_PESQUISAS_REPETIDAS], 3);

  const sinais = cenarios.flatMap(({ entrada }) => detectarSinais(entrada));
  const relatorio = montarRelatorio("2026-09-01", [...sinais].reverse());
  assert.deepEqual(relatorio.itens.slice(0, 2).map(({ tipo }) => tipo), [
    TIPOS_SINAL.PROXIMA_ACAO_ATRASADA,
    TIPOS_SINAL.PROXIMA_ACAO_HOJE,
  ]);
});

test("benchmark detecta alterações, perdas, fatos novos e sugestão indevida", () => {
  const sinais = sinaisDo("CASO-5-PESQUISAS-SEMELHANTES");
  const relatorio = montarRelatorio("2026-09-01", sinais);
  const adulterado = structuredClone(relatorio);
  adulterado.itens[0].classificacao = "SUGESTÃO";
  adulterado.itens[0].evidenceIds = [];
  adulterado.itens[0].entidades = [];
  adulterado.itens[0].fatos.fatoInventado = true;

  const resultado = avaliarRelatorio(sinais, adulterado);
  assert.equal(resultado.classificacoesAlteradas, 1);
  assert.equal(resultado.evidenceIdsPerdidos, 1);
  assert.equal(resultado.entidadesPerdidas, 1);
  assert.equal(resultado.fatosNovosIndevidos, 1);
  assert.equal(resultado.sugestoesIndevidas, 1);
});

test("benchmark detecta item órfão e sinal sem item", () => {
  const sinais = sinaisDo("CASO-2-PROXIMA-ACAO-ATRASADA");
  const relatorio = montarRelatorio("2026-09-01", sinais);
  relatorio.itens[0].contexto.sinalId = "signal-inexistente";
  const resultado = avaliarRelatorio(sinais, relatorio);
  assert.equal(resultado.itensOrfaos, 1);
  assert.equal(resultado.sinaisSemItem, 1);
});

test("benchmark IA-2B atende integralmente ao critério de passagem", () => {
  const resultado = executarBenchmarkRelatorios(cenarios);
  assert.equal(resultado.sinaisRecebidos, 4);
  assert.equal(resultado.itensGerados, 4);
  assert.equal(resultado.itensOrfaos, 0);
  assert.equal(resultado.sinaisSemItem, 0);
  assert.equal(resultado.classificacoesAlteradas, 0);
  assert.equal(resultado.evidenceIdsPerdidos, 0);
  assert.equal(resultado.entidadesPerdidas, 0);
  assert.equal(resultado.fatosNovosIndevidos, 0);
  assert.equal(resultado.sugestoesIndevidas, 0);
  assert.equal(resultado.resumosInconsistentes, 0);
  assert.equal(resultado.aprovado, true);
});
