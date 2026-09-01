import Ajv from "ajv";

const nullableString = (description) => ({
  type: ["string", "null"],
  description,
});

const nullableNumber = (description) => ({
  type: ["number", "null"],
  description,
});

const nullableInteger = (description) => ({
  type: ["integer", "null"],
  minimum: 0,
  description,
});

const segmentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    origem: nullableString("Origem explícita do segmento, sem completar ou converter aeroportos."),
    destino: nullableString("Destino explícito do segmento, sem completar ou converter aeroportos."),
    data: nullableString("Data exatamente como aparece no texto; nunca adicionar ou inferir ano."),
    horarioSaida: nullableString("Horário de saída explicitamente associado ao segmento."),
    horarioChegada: nullableString("Horário de chegada explicitamente associado ao segmento."),
    companhia: nullableString("Companhia explicitamente associada ao segmento."),
    numeroVoo: nullableString("Número do voo explicitamente associado ao segmento."),
    indicadorMaisUmDia: {
      type: ["boolean", "null"],
      description: "true somente com +1/dia seguinte explícito; false somente com mesmo dia explícito; senão null.",
    },
  },
  required: [
    "origem",
    "destino",
    "data",
    "horarioSaida",
    "horarioChegada",
    "companhia",
    "numeroVoo",
    "indicadorMaisUmDia",
  ],
};

const conexaoSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    aeroporto: nullableString("Aeroporto de conexão explicitamente informado."),
    horarioChegada: nullableString("Chegada explícita ao ponto de conexão."),
    horarioSaida: nullableString("Saída explícita do ponto de conexão."),
    companhia: nullableString("Companhia explicitamente informada para a conexão."),
    numeroVoo: nullableString("Número do voo explicitamente informado para a conexão."),
  },
  required: ["aeroporto", "horarioChegada", "horarioSaida", "companhia", "numeroVoo"],
};

const valorMonetarioExibidoSchema = {
  type: "object",
  additionalProperties: false,
  description: "Valor monetário copiado como fato, sem classificá-lo como taxa ou preço.",
  properties: {
    valor: {
      type: "number",
      description: "Representação numérica do valor explicitamente exibido.",
    },
    valorBruto: {
      type: "string",
      minLength: 1,
      description: "Valor monetário exatamente como aparece na fonte, incluindo moeda e formatação.",
    },
  },
  required: ["valor", "valorBruto"],
};

const valoresMonetariosExibidosSchema = {
  type: ["array", "null"],
  description: "Valores monetários explícitos, semanticamente neutros. Use null quando nenhum valor existir.",
  items: valorMonetarioExibidoSchema,
};

const contextoMonetarioSchema = (contexto) => ({
  type: "object",
  additionalProperties: false,
  description: `Valores monetários explicitamente atribuídos ${contexto}, sem classificação ou cálculo.`,
  properties: {
    valorMonetarioExibido: valoresMonetariosExibidosSchema,
  },
  required: ["valorMonetarioExibido"],
});

const financeiroApresentadoTrechoSchema = {
  type: "object",
  additionalProperties: false,
  description: "Valores exibidos pela plataforma para este trecho, copiados sem cálculo ou arredondamento.",
  properties: {
    unidadePontosMilhas: {
      type: ["string", "null"],
      enum: ["milhas", "pontos", null],
      description: "Unidade explicitamente exibida para os valores do trecho.",
    },
    pontosMilhas: nullableNumber(
      "Quantidade padrão explicitamente exibida por passageiro/viajante; preservar o valor integral.",
    ),
    pontosBase: nullableNumber("Quantidade-base explicitamente exibida, sem escolher elegibilidade."),
    pontosCondicionados: nullableNumber(
      "Quantidade promocional ou condicionada explicitamente exibida, mantida separada do valor-base.",
    ),
  },
  required: [
    "unidadePontosMilhas",
    "pontosMilhas",
    "pontosBase",
    "pontosCondicionados",
  ],
};

const trechoSchema = {
  type: ["object", "null"],
  additionalProperties: false,
  description: "Trecho somente quando ida ou volta estiver explícita; caso contrário, null.",
  properties: {
    origem: nullableString("Origem explícita do trecho, preservada como apresentada."),
    destino: nullableString("Destino explícito do trecho, preservado como apresentado."),
    data: nullableString("Data exatamente como aparece no texto; nunca adicionar ou inferir ano."),
    horarioSaida: nullableString("Horário de saída explicitamente informado."),
    horarioChegada: nullableString("Horário de chegada explicitamente informado."),
    duracao: nullableString("Duração exatamente como exibida para o trecho; não calcular pelos horários."),
    companhia: nullableString("Companhia explicitamente informada; não inferir pelo número do voo ou plataforma."),
    numeroVoo: nullableString("Número do voo explicitamente informado."),
    indicadorMaisUmDia: {
      type: ["boolean", "null"],
      description: "true somente com +1/dia seguinte explícito; false somente com mesmo dia explícito; senão null.",
    },
    paradas: nullableInteger("Quantidade explícita de paradas; 'direto' explícito equivale a 0."),
    aeroportosIntermediarios: {
      type: ["array", "null"],
      description: "Aeroportos intermediários explícitos. Use [] somente quando o texto disser que o voo é direto.",
      items: { type: "string" },
    },
    conexoes: {
      type: ["array", "null"],
      description: "Conexões explicitamente descritas. Use [] somente quando o texto disser que o voo é direto.",
      items: conexaoSchema,
    },
    segmentos: {
      type: ["array", "null"],
      description: "Segmentos de voo explicitamente enumerados; não reconstruir segmentos ausentes.",
      items: segmentSchema,
    },
    financeiroApresentado: financeiroApresentadoTrechoSchema,
  },
  required: [
    "origem",
    "destino",
    "data",
    "horarioSaida",
    "horarioChegada",
    "duracao",
    "companhia",
    "numeroVoo",
    "indicadorMaisUmDia",
    "paradas",
    "aeroportosIntermediarios",
    "conexoes",
    "segmentos",
    "financeiroApresentado",
  ],
};

export const cotacaoJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", enum: ["1.0"] },
    tipoVoo: {
      type: ["string", "null"],
      enum: ["ida", "ida_volta", null],
      description: "Preencher somente quando o tipo estiver explícito no texto.",
    },
    quantidadeViajantes: {
      type: ["integer", "null"],
      minimum: 1,
      description: "Quantidade de viajantes somente quando explicitamente informada.",
    },
    ida: trechoSchema,
    volta: trechoSchema,
    naoAtribuido: trechoSchema,
    financeiro: {
      type: "object",
      additionalProperties: false,
      properties: {
        moeda: nullableString("Moeda ou símbolo exatamente como explícito no texto; não inferir."),
        milhasPontos: {
          type: "object",
          additionalProperties: false,
          properties: {
            unidade: {
              type: ["string", "null"],
              enum: ["milhas", "pontos", null],
              description: "Unidade somente quando o texto disser milhas ou pontos.",
            },
            ida: nullableNumber("Milhas/pontos explicitamente atribuídos à ida."),
            volta: nullableNumber("Milhas/pontos explicitamente atribuídos à volta."),
            total: nullableNumber("Total de milhas/pontos explicitamente informado; não calcular."),
            naoAtribuido: nullableNumber("Milhas/pontos explícitos sem associação segura a ida, volta ou total."),
          },
          required: ["unidade", "ida", "volta", "total", "naoAtribuido"],
        },
        ida: contextoMonetarioSchema("à ida"),
        volta: contextoMonetarioSchema("à volta"),
        total: contextoMonetarioSchema("ao total exibido"),
      },
      required: ["moeda", "milhasPontos", "ida", "volta", "total"],
    },
  },
  required: [
    "schemaVersion",
    "tipoVoo",
    "quantidadeViajantes",
    "ida",
    "volta",
    "naoAtribuido",
    "financeiro",
  ],
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(cotacaoJsonSchema);

export function validateStructuredOutput(value) {
  if (!validate(value)) {
    const error = new Error("Resposta do Gemini não atende ao schema do laboratório.");
    error.validationErrors = validate.errors;
    throw error;
  }

  return value;
}
