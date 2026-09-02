export const interpretationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    resumoExecutivo: { type: "string", minLength: 1 },
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          sinalId: { type: "string", minLength: 1 },
          classificacaoOriginal: { type: "string", enum: ["FATO", "PADRÃO"] },
          interpretacao: { type: "string", minLength: 1 },
          sugestoes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                classificacao: { type: "string", enum: ["SUGESTÃO"] },
                texto: { type: "string", minLength: 1 },
              },
              required: ["classificacao", "texto"],
            },
          },
          evidenceIds: { type: "array", items: { type: "string" } },
          entidades: { type: "array", items: { type: "string" } },
        },
        required: [
          "sinalId",
          "classificacaoOriginal",
          "interpretacao",
          "sugestoes",
          "evidenceIds",
          "entidades",
        ],
      },
    },
  },
  required: ["resumoExecutivo", "itens"],
};
