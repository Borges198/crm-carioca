import { validateStructuredOutput } from "./schema.js";
import { normalizeStructuredOutputWithReport } from "./normalization.js";

export const DIFFERENCE_CLASSIFICATIONS = {
  WRONG_EXTRACTION: "EXTRAÇÃO ERRADA",
  HALLUCINATION: "ALUCINAÇÃO",
  AMBIGUOUS_CONTRACT: "CONTRATO AMBÍGUO",
  NORMALIZATION: "NORMALIZAÇÃO",
};

function flatten(value, path = "", output = new Map()) {
  if (Array.isArray(value)) {
    output.set(path, value);
    return output;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, path ? `${path}.${key}` : key, output);
    }
    return output;
  }

  output.set(path, value);
  return output;
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getValueAtPath(value, path) {
  return path.split(".").reduce((current, key) => current?.[key], value);
}

function isMonetaryPath(path) {
  return path.includes("valorMonetarioExibido");
}

export function evaluateCase(testCase, returnedValue) {
  const normalization = normalizeStructuredOutputWithReport(returnedValue);
  const normalizedValue = validateStructuredOutput(normalization.value);

  const expected = flatten(testCase.expected);
  const returned = flatten(normalizedValue);
  const mismatches = [];
  let expectedFields = 0;
  let returnedFields = 0;
  let correctFields = 0;
  let correctlyNullFields = 0;

  for (const [path, expectedValue] of expected) {
    const returnedValueAtPath = returned.has(path)
      ? returned.get(path)
      : getValueAtPath(normalizedValue, path);

    if (expectedValue !== null) expectedFields += 1;
    if (returnedValueAtPath !== null && returnedValueAtPath !== undefined) returnedFields += 1;

    if (expectedValue === null && returnedValueAtPath === null) {
      correctlyNullFields += 1;
      continue;
    }

    if (expectedValue === null && returnedValueAtPath != null) {
      mismatches.push({ path, expected: null, returned: returnedValueAtPath });
      continue;
    }

    if (sameValue(expectedValue, returnedValueAtPath)) {
      correctFields += 1;
    } else {
      mismatches.push({ path, expected: expectedValue, returned: returnedValueAtPath ?? null });
    }
  }

  const differences = normalization.changes.map((change) => ({
    classificacao: DIFFERENCE_CLASSIFICATIONS.NORMALIZATION,
    ...change,
  }));
  const handled = new Set();

  for (let index = 0; index < mismatches.length; index += 1) {
    if (handled.has(index)) continue;
    const missing = mismatches[index];
    if (missing.expected === null) continue;

    const relocatedIndex = mismatches.findIndex((candidate, candidateIndex) => (
      candidateIndex !== index
      && !handled.has(candidateIndex)
      && candidate.expected === null
      && sameValue(candidate.returned, missing.expected)
    ));

    if (relocatedIndex === -1) continue;
    const relocated = mismatches[relocatedIndex];
    const ambiguousContract = isMonetaryPath(missing.path) || isMonetaryPath(relocated.path);
    differences.push({
      classificacao: ambiguousContract
        ? DIFFERENCE_CLASSIFICATIONS.AMBIGUOUS_CONTRACT
        : DIFFERENCE_CLASSIFICATIONS.WRONG_EXTRACTION,
      pathEsperado: missing.path,
      pathRetornado: relocated.path,
      expected: missing.expected,
      returned: relocated.returned,
    });
    handled.add(index);
    handled.add(relocatedIndex);
  }

  for (let index = 0; index < mismatches.length; index += 1) {
    if (handled.has(index)) continue;
    const mismatch = mismatches[index];

    if (mismatch.expected !== null) {
      differences.push({
        classificacao: DIFFERENCE_CLASSIFICATIONS.WRONG_EXTRACTION,
        ...mismatch,
      });
      continue;
    }

    const factExistsInSource = [...expected.values()].some((expectedValue) => (
      expectedValue !== null && sameValue(expectedValue, mismatch.returned)
    ));
    differences.push({
      classificacao: factExistsInSource
        ? (isMonetaryPath(mismatch.path)
          ? DIFFERENCE_CLASSIFICATIONS.AMBIGUOUS_CONTRACT
          : DIFFERENCE_CLASSIFICATIONS.WRONG_EXTRACTION)
        : DIFFERENCE_CLASSIFICATIONS.HALLUCINATION,
      ...mismatch,
    });
  }

  const substantiveDifferences = differences.filter(({ classificacao }) => (
    classificacao !== DIFFERENCE_CLASSIFICATIONS.NORMALIZATION
  ));
  const inventedFields = differences
    .filter(({ classificacao }) => classificacao === DIFFERENCE_CLASSIFICATIONS.HALLUCINATION)
    .map(({ path, returned: invented }) => ({ path, returned: invented }));
  const incorrectFields = substantiveDifferences
    .filter(({ classificacao }) => classificacao !== DIFFERENCE_CLASSIFICATIONS.HALLUCINATION);
  const classificationCounts = Object.fromEntries(
    Object.values(DIFFERENCE_CLASSIFICATIONS).map((classification) => [
      classification,
      differences.filter(({ classificacao }) => classificacao === classification).length,
    ]),
  );

  return {
    id: testCase.id,
    camposEsperados: expectedFields,
    camposRetornados: returnedFields,
    camposCorretos: correctFields,
    camposAusentesCorretamenteNull: correctlyNullFields,
    camposIncorretos: incorrectFields,
    camposInventados: inventedFields,
    diferencas: differences,
    classificacaoDiferencas: classificationCounts,
    alucinacoesCriticas: inventedFields.length,
    aceitoSemCorrecaoHumana: substantiveDifferences.length === 0,
  };
}

export async function runBenchmark(cases, extractor, model) {
  const results = [];

  for (const testCase of cases) {
    try {
      const returned = await extractor(testCase.rawText);
      results.push(evaluateCase(testCase, returned));
    } catch (error) {
      results.push({
        id: testCase.id,
        erro: error instanceof Error ? error.message : String(error),
        tentativas: typeof error?.attempts === "number" ? error.attempts : 1,
        aceitoSemCorrecaoHumana: false,
        alucinacoesCriticas: 0,
      });
    }
  }

  return {
    model,
    generatedAt: new Date().toISOString(),
    totalCases: cases.length,
    acceptedCases: results.filter((result) => result.aceitoSemCorrecaoHumana).length,
    criticalHallucinations: results.reduce((total, result) => total + result.alucinacoesCriticas, 0),
    results,
  };
}
