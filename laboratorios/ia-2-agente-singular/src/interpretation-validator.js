export const TIPOS_VIOLACAO_INTERPRETACAO = Object.freeze({
  FATO_INVENTADO: "FATO_INVENTADO",
  SINAL_INVENTADO: "SINAL_INVENTADO",
  EVIDENCE_ID_INVENTADO: "EVIDENCE_ID_INVENTADO",
  CLASSIFICACAO_ALTERADA: "CLASSIFICACAO_ALTERADA",
  ITEM_SEM_SINAL_ID: "ITEM_SEM_SINAL_ID",
  ENTIDADE_INVENTADA: "ENTIDADE_INVENTADA",
  METRICA_INVENTADA: "METRICA_INVENTADA",
  SUGESTAO_COMO_FATO: "SUGESTAO_COMO_FATO",
  SINAL_SEM_INTERPRETACAO: "SINAL_SEM_INTERPRETACAO",
  RESPOSTA_INVALIDA: "RESPOSTA_INVALIDA",
});

const CHAVES_RAIZ = new Set(["resumoExecutivo", "itens"]);
const CHAVES_ITEM = new Set([
  "sinalId", "classificacaoOriginal", "interpretacao", "sugestoes", "evidenceIds", "entidades",
]);
const CHAVES_SUGESTAO = new Set(["classificacao", "texto"]);
const PADROES_AFIRMACAO_PROIBIDA = [
  /\bduplicad[ao]s?\b/iu,
  /\besquecid[ao]s?\b/iu,
  /\bneglig[eê]ncia\b/iu,
  /\bser[aá]\s+perdid[ao]\b/iu,
  /\btrabalhou\s+errad[ao]\b/iu,
];
const PADRAO_SUGESTAO_FORA_DO_CAMPO = /\b(sugiro|recomendo|deve(?:ria)?|é recomendável)\b/iu;
const PADRAO_IDENTIFICADOR = /\b(?:cliente|oportunidade|acao|pesquisa|signal|item)-[\p{L}\p{N}-]+\b/giu;
const PADRAO_NUMERO = /-?\d+(?:[.,]\d+)?/gu;

function violacao(tipo, caminho, detalhe) {
  return { tipo, caminho, detalhe };
}

function valoresPermitidos(relatorio) {
  const ids = new Set();
  for (const item of relatorio.itens) {
    ids.add(item.id);
    ids.add(item.contexto.sinalId);
    item.evidenceIds.forEach((id) => ids.add(id));
    item.entidades.forEach((id) => ids.add(id));
  }
  const numeros = new Set(JSON.stringify(relatorio).match(PADRAO_NUMERO) ?? []);
  return { ids, numeros };
}

function auditarTexto(texto, caminho, permitidos, sugestaoPermitida) {
  const violacoes = [];
  if (typeof texto !== "string" || texto.trim().length === 0) {
    return [violacao(TIPOS_VIOLACAO_INTERPRETACAO.RESPOSTA_INVALIDA, caminho, "texto ausente")];
  }
  if (PADROES_AFIRMACAO_PROIBIDA.some((padrao) => padrao.test(texto))) {
    violacoes.push(violacao(
      TIPOS_VIOLACAO_INTERPRETACAO.FATO_INVENTADO,
      caminho,
      "afirmação proibida",
    ));
  }
  if (!sugestaoPermitida && PADRAO_SUGESTAO_FORA_DO_CAMPO.test(texto)) {
    violacoes.push(violacao(
      TIPOS_VIOLACAO_INTERPRETACAO.SUGESTAO_COMO_FATO,
      caminho,
      "orientação fora de sugestoes",
    ));
  }
  for (const id of texto.match(PADRAO_IDENTIFICADOR) ?? []) {
    if (!permitidos.ids.has(id)) {
      violacoes.push(violacao(
        TIPOS_VIOLACAO_INTERPRETACAO.ENTIDADE_INVENTADA,
        caminho,
        "identificador ausente da entrada",
      ));
    }
  }
  for (const numero of texto.match(PADRAO_NUMERO) ?? []) {
    if (!permitidos.numeros.has(numero)) {
      violacoes.push(violacao(
        TIPOS_VIOLACAO_INTERPRETACAO.METRICA_INVENTADA,
        caminho,
        "número ausente da entrada",
      ));
    }
  }
  return violacoes;
}

function auditarChaves(value, permitidas, caminho) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [violacao(TIPOS_VIOLACAO_INTERPRETACAO.RESPOSTA_INVALIDA, caminho, "objeto esperado")];
  }
  return Object.keys(value).filter((chave) => !permitidas.has(chave)).map((chave) => {
    const normalizada = chave.toLocaleLowerCase("pt-BR");
    if (normalizada.includes("fato")) {
      return violacao(TIPOS_VIOLACAO_INTERPRETACAO.FATO_INVENTADO, caminho + "." + chave, "campo proibido");
    }
    if (normalizada.includes("metrica") || normalizada.includes("contador")) {
      return violacao(TIPOS_VIOLACAO_INTERPRETACAO.METRICA_INVENTADA, caminho + "." + chave, "campo proibido");
    }
    if (normalizada.includes("sugest")) {
      return violacao(
        TIPOS_VIOLACAO_INTERPRETACAO.SUGESTAO_COMO_FATO,
        caminho + "." + chave,
        "sugestão fora do campo próprio",
      );
    }
    return violacao(TIPOS_VIOLACAO_INTERPRETACAO.RESPOSTA_INVALIDA, caminho + "." + chave, "campo não previsto");
  });
}

export function auditarInterpretacao(relatorio, resposta) {
  const violacoes = [];
  const permitidos = valoresPermitidos(relatorio);
  const itensOriginais = new Map(relatorio.itens.map((item) => [item.contexto.sinalId, item]));
  const sinaisInterpretados = new Set();

  violacoes.push(...auditarChaves(resposta, CHAVES_RAIZ, "resposta"));
  if (resposta === null || typeof resposta !== "object" || Array.isArray(resposta)) return violacoes;
  violacoes.push(...auditarTexto(resposta.resumoExecutivo, "resumoExecutivo", permitidos, false));
  if (!Array.isArray(resposta.itens)) {
    violacoes.push(violacao(TIPOS_VIOLACAO_INTERPRETACAO.RESPOSTA_INVALIDA, "itens", "lista esperada"));
    return violacoes;
  }

  resposta.itens.forEach((item, index) => {
    const caminho = "itens." + index;
    violacoes.push(...auditarChaves(item, CHAVES_ITEM, caminho));
    if (item === null || typeof item !== "object" || Array.isArray(item)) return;

    if (typeof item.sinalId !== "string" || item.sinalId.length === 0) {
      violacoes.push(violacao(TIPOS_VIOLACAO_INTERPRETACAO.ITEM_SEM_SINAL_ID, caminho, "sinalId ausente"));
      return;
    }
    const original = itensOriginais.get(item.sinalId);
    if (!original || sinaisInterpretados.has(item.sinalId)) {
      violacoes.push(violacao(TIPOS_VIOLACAO_INTERPRETACAO.SINAL_INVENTADO, caminho + ".sinalId", "sinal inexistente ou repetido"));
      return;
    }
    sinaisInterpretados.add(item.sinalId);

    if (item.classificacaoOriginal !== original.classificacao) {
      violacoes.push(violacao(
        TIPOS_VIOLACAO_INTERPRETACAO.CLASSIFICACAO_ALTERADA,
        caminho + ".classificacaoOriginal",
        "classificação divergente",
      ));
    }
    if (!Array.isArray(item.evidenceIds)) {
      violacoes.push(violacao(TIPOS_VIOLACAO_INTERPRETACAO.RESPOSTA_INVALIDA, caminho + ".evidenceIds", "lista esperada"));
    } else {
      for (const id of item.evidenceIds) {
        if (!original.evidenceIds.includes(id)) {
          violacoes.push(violacao(
            TIPOS_VIOLACAO_INTERPRETACAO.EVIDENCE_ID_INVENTADO,
            caminho + ".evidenceIds",
            "evidenceId ausente do sinal original",
          ));
        }
      }
      if (JSON.stringify(item.evidenceIds) !== JSON.stringify(original.evidenceIds)) {
        violacoes.push(violacao(TIPOS_VIOLACAO_INTERPRETACAO.RESPOSTA_INVALIDA, caminho + ".evidenceIds", "evidenceIds não preservados"));
      }
    }
    if (!Array.isArray(item.entidades)) {
      violacoes.push(violacao(TIPOS_VIOLACAO_INTERPRETACAO.RESPOSTA_INVALIDA, caminho + ".entidades", "lista esperada"));
    } else {
      for (const id of item.entidades) {
        if (!original.entidades.includes(id)) {
          violacoes.push(violacao(
            TIPOS_VIOLACAO_INTERPRETACAO.ENTIDADE_INVENTADA,
            caminho + ".entidades",
            "entidade ausente do sinal original",
          ));
        }
      }
      if (JSON.stringify(item.entidades) !== JSON.stringify(original.entidades)) {
        violacoes.push(violacao(TIPOS_VIOLACAO_INTERPRETACAO.RESPOSTA_INVALIDA, caminho + ".entidades", "entidades não preservadas"));
      }
    }

    violacoes.push(...auditarTexto(item.interpretacao, caminho + ".interpretacao", permitidos, false));
    if (!Array.isArray(item.sugestoes)) {
      violacoes.push(violacao(TIPOS_VIOLACAO_INTERPRETACAO.RESPOSTA_INVALIDA, caminho + ".sugestoes", "lista esperada"));
    } else {
      item.sugestoes.forEach((sugestao, sugestaoIndex) => {
        const caminhoSugestao = caminho + ".sugestoes." + sugestaoIndex;
        violacoes.push(...auditarChaves(sugestao, CHAVES_SUGESTAO, caminhoSugestao));
        if (sugestao?.classificacao !== "SUGESTÃO") {
          violacoes.push(violacao(
            TIPOS_VIOLACAO_INTERPRETACAO.SUGESTAO_COMO_FATO,
            caminhoSugestao + ".classificacao",
            "sugestão sem classificação explícita",
          ));
        }
        violacoes.push(...auditarTexto(sugestao?.texto, caminhoSugestao + ".texto", permitidos, true));
      });
    }
  });

  for (const sinalId of itensOriginais.keys()) {
    if (!sinaisInterpretados.has(sinalId)) {
      violacoes.push(violacao(
        TIPOS_VIOLACAO_INTERPRETACAO.SINAL_SEM_INTERPRETACAO,
        "itens",
        "sinal original sem interpretação",
      ));
    }
  }
  return violacoes;
}

export class InterpretationValidationError extends Error {
  constructor(violacoes) {
    super("Resposta do Gemini rejeitada pelo validador determinístico.");
    this.name = "InterpretationValidationError";
    this.violacoes = violacoes;
  }
}

export function validarInterpretacao(relatorio, resposta) {
  const violacoes = auditarInterpretacao(relatorio, resposta);
  if (violacoes.length > 0) throw new InterpretationValidationError(violacoes);
  return resposta;
}
