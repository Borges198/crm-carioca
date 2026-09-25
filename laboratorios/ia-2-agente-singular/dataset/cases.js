const entradaBase = (overrides = {}) => ({
  dataReferencia: "2026-09-01",
  clientes: [],
  oportunidades: [],
  proximasAcoes: [],
  pesquisas: [],
  ...overrides,
});

export const cenarios = [
  {
    id: "CASO-1-OPERACAO-NORMAL",
    descricao: "Operação normal sem sinal indevido.",
    entrada: entradaBase({
      clientes: [{ id: "cliente-001" }],
      oportunidades: [{
        id: "oportunidade-001",
        clienteId: "cliente-001",
        status: "ABERTA",
        proximaAcaoId: "acao-001",
      }],
      proximasAcoes: [{
        id: "acao-001",
        oportunidadeId: "oportunidade-001",
        data: "2026-09-02",
        concluida: false,
      }],
      pesquisas: [{
        id: "pesquisa-001",
        clienteId: "cliente-001",
        destino: "SSA",
        dataIda: "2026-10-10",
        dataVolta: "2026-10-15",
      }],
    }),
    sinaisEsperados: [],
  },
  {
    id: "CASO-2-PROXIMA-ACAO-ATRASADA",
    descricao: "Próxima ação aberta anterior à data de referência.",
    entrada: entradaBase({
      clientes: [{ id: "cliente-002" }],
      oportunidades: [{
        id: "oportunidade-002",
        clienteId: "cliente-002",
        status: "ABERTA",
        proximaAcaoId: "acao-002",
      }],
      proximasAcoes: [{
        id: "acao-002",
        oportunidadeId: "oportunidade-002",
        data: "2026-08-31",
        concluida: false,
      }],
    }),
    sinaisEsperados: [{
      id: "signal-proxima-acao-atrasada-oportunidade-002",
      tipo: "PROXIMA_ACAO_ATRASADA",
      classificacao: "FATO",
      entidades: ["oportunidade-002"],
      evidenceIds: ["oportunidade-002", "acao-002"],
      dados: {
        dataReferencia: "2026-09-01",
        dataProximaAcao: "2026-08-31",
        diasEmAtraso: 1,
      },
    }],
  },
  {
    id: "CASO-3-PROXIMA-ACAO-HOJE",
    descricao: "Próxima ação aberta na data de referência.",
    entrada: entradaBase({
      clientes: [{ id: "cliente-003" }],
      oportunidades: [{
        id: "oportunidade-003",
        clienteId: "cliente-003",
        status: "ABERTA",
        proximaAcaoId: "acao-003",
      }],
      proximasAcoes: [{
        id: "acao-003",
        oportunidadeId: "oportunidade-003",
        data: "2026-09-01",
        concluida: false,
      }],
    }),
    sinaisEsperados: [{
      id: "signal-proxima-acao-hoje-oportunidade-003",
      tipo: "PROXIMA_ACAO_HOJE",
      classificacao: "FATO",
      entidades: ["oportunidade-003"],
      evidenceIds: ["oportunidade-003", "acao-003"],
      dados: {
        dataReferencia: "2026-09-01",
        dataProximaAcao: "2026-09-01",
        diasAteAcao: 0,
      },
    }],
  },
  {
    id: "CASO-4-SEM-PROXIMA-ACAO",
    descricao: "Oportunidade aberta sem referência de próxima ação.",
    entrada: entradaBase({
      clientes: [{ id: "cliente-004" }],
      oportunidades: [{
        id: "oportunidade-004",
        clienteId: "cliente-004",
        status: "ABERTA",
        proximaAcaoId: null,
      }],
    }),
    sinaisEsperados: [{
      id: "signal-oportunidade-sem-proxima-acao-oportunidade-004",
      tipo: "OPORTUNIDADE_SEM_PROXIMA_ACAO",
      classificacao: "FATO",
      entidades: ["oportunidade-004"],
      evidenceIds: ["oportunidade-004"],
      dados: { statusOportunidade: "ABERTA", proximaAcaoId: null },
    }],
  },
  {
    id: "CASO-5-PESQUISAS-SEMELHANTES",
    descricao: "Mesmo cliente e destino, com ida a 2 dias e volta a 3 dias.",
    entrada: entradaBase({
      clientes: [{ id: "cliente-005" }],
      pesquisas: [
        {
          id: "pesquisa-005-a",
          clienteId: "cliente-005",
          destino: "REC",
          dataIda: "2026-10-10",
          dataVolta: "2026-10-15",
        },
        {
          id: "pesquisa-005-b",
          clienteId: "cliente-005",
          destino: "rec",
          dataIda: "2026-10-12",
          dataVolta: "2026-10-18",
        },
      ],
    }),
    sinaisEsperados: [{
      id: "signal-possiveis-pesquisas-repetidas-pesquisa-005-a-pesquisa-005-b",
      tipo: "POSSIVEIS_PESQUISAS_REPETIDAS",
      classificacao: "PADRÃO",
      entidades: ["pesquisa-005-a", "pesquisa-005-b"],
      evidenceIds: ["pesquisa-005-a", "pesquisa-005-b", "cliente-005"],
      dados: {
        clienteId: "cliente-005",
        destino: "REC",
        diferencaDiasIda: 2,
        diferencaDiasVolta: 3,
        limiteDatasProximasDias: 3,
      },
    }],
  },
  {
    id: "CASO-6-PARECIDAS-ABAIXO-DO-LIMIAR",
    descricao: "Mesmo cliente e destino, mas datas de ida separadas por 4 dias.",
    entrada: entradaBase({
      clientes: [{ id: "cliente-006" }],
      pesquisas: [
        {
          id: "pesquisa-006-a",
          clienteId: "cliente-006",
          destino: "FOR",
          dataIda: "2026-10-10",
          dataVolta: "2026-10-20",
        },
        {
          id: "pesquisa-006-b",
          clienteId: "cliente-006",
          destino: "FOR",
          dataIda: "2026-10-14",
          dataVolta: "2026-10-22",
        },
      ],
    }),
    sinaisEsperados: [],
  },
];
