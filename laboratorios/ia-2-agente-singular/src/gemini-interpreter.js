import { interpretationJsonSchema } from "./interpretation-schema.js";
import { INTERPRETATION_PROMPT } from "./interpretation-prompt.js";
import { validarInterpretacao } from "./interpretation-validator.js";

export const DEFAULT_GEMINI_MODEL = "gemini-3.7-flash";

export function resolverModeloGemini(model, env = process.env) {
  return model || env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

async function chamarGeminiRest({ apiKey, model, relatorio, fetchImpl }) {
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/"
    + encodeURIComponent(model)
    + ":generateContent";
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: INTERPRETATION_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify(relatorio) }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: interpretationJsonSchema,
      },
    }),
  });
  if (!response.ok) throw new Error("Falha na chamada Gemini: HTTP " + response.status);
  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
  if (!text) throw new Error("Resposta Gemini sem conteúdo estruturado.");
  return JSON.parse(text);
}

export async function interpretarRelatorioComGemini(relatorio, options = {}) {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente; benchmark Gemini não executado.");
  const model = resolverModeloGemini(options.model);
  const gerar = options.generateContent ?? ((request) => chamarGeminiRest({
    ...request,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
  }));
  const respostaBruta = await gerar({
    apiKey,
    model,
    relatorio: structuredClone(relatorio),
    prompt: INTERPRETATION_PROMPT,
    schema: interpretationJsonSchema,
  });
  const resposta = typeof respostaBruta === "string" ? JSON.parse(respostaBruta) : respostaBruta;
  return validarInterpretacao(relatorio, resposta);
}
