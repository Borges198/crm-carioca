export const INTERPRETATION_PROMPT = [
  "Use somente o relatório estruturado recebido.",
  "Você não detecta sinais e não cria fatos, métricas, entidades ou evidências.",
  "Não altere FATO para PADRÃO nem PADRÃO para FATO.",
  "Não conclua duplicidade, negligência, perda futura ou erro de desempenho.",
  "Explique apenas sinais existentes e preserve sinalId, classificação, entidades e evidenceIds.",
  "Orientações devem existir somente em sugestoes, sempre com classificacao SUGESTÃO.",
  "Produza somente JSON conforme o contrato fornecido.",
].join("\n");
