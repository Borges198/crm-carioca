import { cenarios } from "../dataset/cases.js";
import { criarInterpretacaoControlada } from "../dataset/mock-interpretations.js";
import { persistirEvidenciaIa2d } from "./benchmark-evidence.js";
import { executarBenchmark } from "./benchmark.js";
import { interpretarRelatorioComGemini, resolverModeloGemini } from "./gemini-interpreter.js";
import { executarBenchmarkGemini, executarBenchmarkInterpretacoes } from "./interpretation-benchmark.js";
import { executarBenchmarkRelatorios } from "./report-benchmark.js";

const sinais = executarBenchmark(cenarios);
const relatorios = executarBenchmarkRelatorios(cenarios);
const interpretacoesLocais = executarBenchmarkInterpretacoes(cenarios, criarInterpretacaoControlada);
const model = resolverModeloGemini();
let gemini = {
  status: "NAO_EXECUTADO",
  motivo: "GEMINI_API_KEY ausente",
  model,
  utilidadeHumana: "NAO_AVALIADA",
};

if (process.env.GEMINI_API_KEY) {
  const respostasValidadas = [];
  const resultadoGemini = await executarBenchmarkGemini(
    cenarios,
    (relatorio) => interpretarRelatorioComGemini(relatorio, { model }),
    (respostaValidada) => respostasValidadas.push(respostaValidada),
  );
  await persistirEvidenciaIa2d(respostasValidadas);
  gemini = { status: "EXECUTADO", model, ...resultadoGemini };
}

const aprovado = sinais.aprovado
  && relatorios.aprovado
  && interpretacoesLocais.aprovado
  && (gemini.status === "NAO_EXECUTADO" || gemini.aprovado);
const resultado = { sinais, relatorios, interpretacoesLocais, gemini, aprovado };
process.stdout.write(`${JSON.stringify(resultado, null, 2)}\n`);

if (!resultado.aprovado) process.exitCode = 1;
