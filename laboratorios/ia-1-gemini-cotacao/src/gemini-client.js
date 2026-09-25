import { GoogleGenAI } from "@google/genai";
import { buildExtractionPrompt } from "./prompt.js";
import { cotacaoJsonSchema, validateStructuredOutput } from "./schema.js";

export const DEFAULT_GEMINI_MODEL = "gemini-3.7-flash";
export const GEMINI_MAX_ATTEMPTS = 3;
export const GEMINI_INITIAL_RETRY_DELAY_MS = 250;
export const GEMINI_MAX_RETRY_DELAY_MS = 1000;
const TRANSIENT_STATUS_CODES = new Set([429, 503]);

const defaultSleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

export function resolveGeminiModel(explicitModel, env = process.env) {
  return explicitModel ?? env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
}

function markAttempts(error, attempts) {
  if (error && typeof error === "object") {
    error.attempts = attempts;
    return error;
  }

  const wrappedError = new Error(String(error));
  wrappedError.attempts = attempts;
  return wrappedError;
}

export async function withTransientRetry(operation, options = {}) {
  const maxAttempts = options.maxAttempts ?? GEMINI_MAX_ATTEMPTS;
  const initialDelayMs = options.initialDelayMs ?? GEMINI_INITIAL_RETRY_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? GEMINI_MAX_RETRY_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const isTransient = TRANSIENT_STATUS_CODES.has(error?.status);
      if (!isTransient || attempt === maxAttempts) {
        throw markAttempts(error, attempt);
      }

      const delayMs = Math.min(initialDelayMs * (2 ** (attempt - 1)), maxDelayMs);
      await sleep(delayMs);
    }
  }
}

export async function extractCotacaoWithGemini(rawText, options = {}) {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const model = resolveGeminiModel(options.model);

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY ausente. Defina a variável somente no ambiente de execução.");
  }

  if (typeof rawText !== "string" || rawText.trim() === "") {
    throw new Error("O texto bruto deve ser uma string não vazia.");
  }

  const ai = options.client ?? new GoogleGenAI({
    apiKey,
    httpOptions: { retryOptions: { attempts: 1 } },
  });
  const response = await withTransientRetry(
    () => ai.models.generateContent({
      model,
      contents: buildExtractionPrompt(rawText),
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: cotacaoJsonSchema,
      },
    }),
    options.retry,
  );

  if (!response.text) {
    throw new Error("Gemini retornou uma resposta sem conteúdo textual estruturado.");
  }

  let parsed;
  try {
    parsed = JSON.parse(response.text);
  } catch (cause) {
    throw new Error("Gemini retornou conteúdo que não é JSON válido.", { cause });
  }

  return validateStructuredOutput(parsed);
}
