import { benchmarkCases } from "../dataset/cases.js";
import { runBenchmark } from "./benchmark.js";
import { extractCotacaoWithGemini, resolveGeminiModel } from "./gemini-client.js";

const model = resolveGeminiModel();
const requestedIds = process.argv.slice(2);
const requestedIdSet = new Set(requestedIds);
const selectedCases = requestedIds.length === 0
  ? benchmarkCases
  : benchmarkCases.filter(({ id }) => requestedIdSet.has(id));
const selectedIdSet = new Set(selectedCases.map(({ id }) => id));
const unknownIds = requestedIds.filter((id) => !selectedIdSet.has(id));

if (unknownIds.length > 0) {
  console.error(`Benchmark Gemini não executado: casos desconhecidos: ${unknownIds.join(", ")}.`);
  process.exitCode = 2;
} else if (!process.env.GEMINI_API_KEY) {
  console.error("Benchmark Gemini não executado: GEMINI_API_KEY ausente.");
  process.exitCode = 2;
} else {
  const report = await runBenchmark(
    selectedCases,
    (rawText) => extractCotacaoWithGemini(rawText, { model }),
    model,
  );

  console.log(JSON.stringify(report, null, 2));
  if (report.criticalHallucinations > 0 || report.acceptedCases !== report.totalCases) {
    process.exitCode = 1;
  }
}
