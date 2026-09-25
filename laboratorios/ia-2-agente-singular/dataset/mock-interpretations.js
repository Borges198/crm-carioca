const INTERPRETACAO_POR_TIPO = Object.freeze({
  PROXIMA_ACAO_ATRASADA: "O sinal registra próxima ação atrasada.",
  PROXIMA_ACAO_HOJE: "O sinal registra próxima ação para hoje.",
  OPORTUNIDADE_SEM_PROXIMA_ACAO: "O sinal registra oportunidade sem próxima ação.",
  POSSIVEIS_PESQUISAS_REPETIDAS: "O sinal registra alta semelhança entre pesquisas.",
});

export function criarInterpretacaoControlada(relatorio) {
  return {
    resumoExecutivo: relatorio.itens.length === 0
      ? "Relatório sem sinais para interpretação humana."
      : "Relatório estruturado disponível para interpretação humana.",
    itens: relatorio.itens.map((item) => ({
      sinalId: item.contexto.sinalId,
      classificacaoOriginal: item.classificacao,
      interpretacao: INTERPRETACAO_POR_TIPO[item.tipo],
      sugestoes: [{
        classificacao: "SUGESTÃO",
        texto: "Revisar o sinal com decisão humana.",
      }],
      evidenceIds: [...item.evidenceIds],
      entidades: [...item.entidades],
    })),
  };
}
