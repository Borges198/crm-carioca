const emptySegment = (overrides = {}) => ({
  origem: null,
  destino: null,
  data: null,
  horarioSaida: null,
  horarioChegada: null,
  companhia: null,
  numeroVoo: null,
  indicadorMaisUmDia: null,
  ...overrides,
});

const emptyTrecho = (overrides = {}) => ({
  origem: null,
  destino: null,
  data: null,
  horarioSaida: null,
  horarioChegada: null,
  duracao: null,
  companhia: null,
  numeroVoo: null,
  indicadorMaisUmDia: null,
  paradas: null,
  aeroportosIntermediarios: null,
  conexoes: null,
  segmentos: null,
  financeiroApresentado: {
    unidadePontosMilhas: null,
    pontosMilhas: null,
    pontosBase: null,
    pontosCondicionados: null,
  },
  ...overrides,
});

const emptyFinanceiro = (overrides = {}) => ({
  moeda: null,
  milhasPontos: { unidade: null, ida: null, volta: null, total: null, naoAtribuido: null },
  ida: { valorMonetarioExibido: null },
  volta: { valorMonetarioExibido: null },
  total: { valorMonetarioExibido: null },
  ...overrides,
});

const expected = (overrides = {}) => ({
  schemaVersion: "1.0",
  tipoVoo: null,
  quantidadeViajantes: null,
  ida: null,
  volta: null,
  naoAtribuido: null,
  financeiro: emptyFinanceiro(),
  ...overrides,
});

export const benchmarkCases = [
  {
    id: "direto",
    rawText: `LATAM\nSomente ida\nREC → GRU\n18/11/2026\nSaída 08:10 | Chegada 11:20\nVoo LA 4001\nDireto\n24.000 pontos\nTaxas R$ 54,30\nTotal em dinheiro R$ 612,40`,
    expected: expected({
      tipoVoo: "ida",
      ida: emptyTrecho({
        origem: "REC",
        destino: "GRU",
        data: "18/11/2026",
        horarioSaida: "08:10",
        horarioChegada: "11:20",
        companhia: "LATAM",
        numeroVoo: "LA 4001",
        paradas: 0,
        aeroportosIntermediarios: [],
        conexoes: [],
        segmentos: [emptySegment({
          origem: "REC",
          destino: "GRU",
          data: "18/11/2026",
          horarioSaida: "08:10",
          horarioChegada: "11:20",
          companhia: "LATAM",
          numeroVoo: "LA 4001",
        })],
      }),
      financeiro: emptyFinanceiro({
        moeda: "R$",
        milhasPontos: { unidade: "pontos", ida: 24000, volta: null, total: null, naoAtribuido: null },
        ida: { valorMonetarioExibido: [{ valor: 54.3, valorBruto: "R$ 54,30" }] },
        total: { valorMonetarioExibido: [{ valor: 612.4, valorBruto: "R$ 612,40" }] },
      }),
    }),
  },
  {
    id: "ida-e-volta",
    rawText: `Smiles\nIda e volta\nIDA — Operado por GOL\nSSA 06:25 → GIG 08:35 em 07/02/2027\nVoo G3 2010 — Direto\nVOLTA — Operado por GOL\nGIG 19:40 → SSA 21:50 em 14/02/2027\nVoo G3 2011 — Direto\nIda 12.000 milhas | Volta 13.500 milhas | Total 25.500 milhas\nTaxas totais BRL 118,00`,
    expected: expected({
      tipoVoo: "ida_volta",
      ida: emptyTrecho({
        origem: "SSA", destino: "GIG", data: "07/02/2027", horarioSaida: "06:25", horarioChegada: "08:35",
        companhia: "GOL", numeroVoo: "G3 2010", paradas: 0, aeroportosIntermediarios: [], conexoes: [],
        segmentos: [emptySegment({ origem: "SSA", destino: "GIG", data: "07/02/2027", horarioSaida: "06:25", horarioChegada: "08:35", companhia: "GOL", numeroVoo: "G3 2010" })],
      }),
      volta: emptyTrecho({
        origem: "GIG", destino: "SSA", data: "14/02/2027", horarioSaida: "19:40", horarioChegada: "21:50",
        companhia: "GOL", numeroVoo: "G3 2011", paradas: 0, aeroportosIntermediarios: [], conexoes: [],
        segmentos: [emptySegment({ origem: "GIG", destino: "SSA", data: "14/02/2027", horarioSaida: "19:40", horarioChegada: "21:50", companhia: "GOL", numeroVoo: "G3 2011" })],
      }),
      financeiro: emptyFinanceiro({
        moeda: "BRL",
        milhasPontos: { unidade: "milhas", ida: 12000, volta: 13500, total: 25500, naoAtribuido: null },
        total: { valorMonetarioExibido: [{ valor: 118, valorBruto: "BRL 118,00" }] },
      }),
    }),
  },
  {
    id: "conexao",
    rawText: `Azul — Somente ida\nBEL para CWB — 09/03/2027\nSegmento 1: BEL 05:10 → CNF 08:05 | AD 4500 | Azul\nConexão em CNF: chegada 08:05, saída 09:30\nSegmento 2: CNF 09:30 → CWB 11:15 | AD 2788 | Azul\n1 parada em CNF`,
    expected: expected({
      tipoVoo: "ida",
      ida: emptyTrecho({
        origem: "BEL", destino: "CWB", data: "09/03/2027", horarioSaida: "05:10", horarioChegada: "11:15",
        companhia: "Azul", numeroVoo: null, paradas: 1, aeroportosIntermediarios: ["CNF"],
        conexoes: [{ aeroporto: "CNF", horarioChegada: "08:05", horarioSaida: "09:30", companhia: null, numeroVoo: null }],
        segmentos: [
          emptySegment({ origem: "BEL", destino: "CNF", data: "09/03/2027", horarioSaida: "05:10", horarioChegada: "08:05", companhia: "Azul", numeroVoo: "AD 4500" }),
          emptySegment({ origem: "CNF", destino: "CWB", data: "09/03/2027", horarioSaida: "09:30", horarioChegada: "11:15", companhia: "Azul", numeroVoo: "AD 2788" }),
        ],
      }),
    }),
  },
  {
    id: "mais-um-dia",
    rawText: `LATAM\nSomente ida\n02/12/2026\nGRU 23:15 → SCL 03:20 +1 dia\nVoo LA 761\nDireto`,
    expected: expected({
      tipoVoo: "ida",
      ida: emptyTrecho({
        origem: "GRU", destino: "SCL", data: "02/12/2026", horarioSaida: "23:15", horarioChegada: "03:20",
        companhia: "LATAM", numeroVoo: "LA 761", indicadorMaisUmDia: true, paradas: 0,
        aeroportosIntermediarios: [], conexoes: [],
        segmentos: [emptySegment({ origem: "GRU", destino: "SCL", data: "02/12/2026", horarioSaida: "23:15", horarioChegada: "03:20", companhia: "LATAM", numeroVoo: "LA 761", indicadorMaisUmDia: true })],
      }),
    }),
  },
  {
    id: "texto-incompleto",
    rawText: `Oferta selecionada\nOrigem: AJU\nDestino: BSB\nSaída: 14:05\n9.500 milhas`,
    expected: expected({
      naoAtribuido: emptyTrecho({ origem: "AJU", destino: "BSB", horarioSaida: "14:05" }),
      financeiro: emptyFinanceiro({
        milhasPontos: { unidade: "milhas", ida: null, volta: null, total: null, naoAtribuido: 9500 },
      }),
    }),
  },
  {
    id: "financeiro-complexo",
    rawText: `Azul\nIda e volta\nFOR → VCP / VCP → FOR\nIda: 18.000 pontos + R$ 82,17 de taxas\nVolta: 22.000 pontos + R$ 91,44 de taxas\nTotal: 40.000 pontos\nTotal de taxas: R$ 173,61\nAlternativa somente em dinheiro — total R$ 1.934,80`,
    expected: expected({
      tipoVoo: "ida_volta",
      ida: emptyTrecho({
        origem: "FOR",
        destino: "VCP",
      }),
      volta: emptyTrecho({
        origem: "VCP",
        destino: "FOR",
      }),
      financeiro: emptyFinanceiro({
        moeda: "R$",
        milhasPontos: { unidade: "pontos", ida: 18000, volta: 22000, total: 40000, naoAtribuido: null },
        ida: { valorMonetarioExibido: [{ valor: 82.17, valorBruto: "R$ 82,17" }] },
        volta: { valorMonetarioExibido: [{ valor: 91.44, valorBruto: "R$ 91,44" }] },
        total: { valorMonetarioExibido: [
          { valor: 173.61, valorBruto: "R$ 173,61" },
          { valor: 1934.8, valorBruto: "R$ 1.934,80" },
        ] },
      }),
    }),
  },
  {
    id: "LATAM-REAL-01",
    rawText: `LATAM Pass
Ida e volta
IDA
SDU → NVT
23/11/2026
13:10 - 16:25
LATAM Airlines Brasil
1 parada
Duração 3 h 15 min
18.892 milhas por passageiro + R$ 62,62
VOLTA
NVT → SDU
30/11/2026
15:15 - 19:35
LATAM Airlines Brasil
1 parada
Duração 4 h 20 min
8.019 milhas por passageiro + R$ 50,57
Total exibido: 26.911 milhas + R$ 113,19`,
    expected: expected({
      tipoVoo: "ida_volta",
      ida: emptyTrecho({
        origem: "SDU",
        destino: "NVT",
        data: "23/11/2026",
        horarioSaida: "13:10",
        horarioChegada: "16:25",
        duracao: "3 h 15 min",
        companhia: "LATAM Airlines Brasil",
        paradas: 1,
        financeiroApresentado: {
          unidadePontosMilhas: "milhas",
          pontosMilhas: 18892,
          pontosBase: null,
          pontosCondicionados: null,
        },
      }),
      volta: emptyTrecho({
        origem: "NVT",
        destino: "SDU",
        data: "30/11/2026",
        horarioSaida: "15:15",
        horarioChegada: "19:35",
        duracao: "4 h 20 min",
        companhia: "LATAM Airlines Brasil",
        paradas: 1,
        financeiroApresentado: {
          unidadePontosMilhas: "milhas",
          pontosMilhas: 8019,
          pontosBase: null,
          pontosCondicionados: null,
        },
      }),
      financeiro: emptyFinanceiro({
        moeda: "R$",
        milhasPontos: { unidade: "milhas", ida: 18892, volta: 8019, total: 26911, naoAtribuido: null },
        ida: { valorMonetarioExibido: [{ valor: 62.62, valorBruto: "R$ 62,62" }] },
        volta: { valorMonetarioExibido: [{ valor: 50.57, valorBruto: "R$ 50,57" }] },
        total: { valorMonetarioExibido: [{ valor: 113.19, valorBruto: "R$ 113,19" }] },
      }),
    }),
  },
  {
    id: "SMILES-REAL-01",
    rawText: `Smiles
Ida e volta
IDA
CGH → BSB
27/11/2026
06:05 - 07:55
GOL Linhas Aéreas
Direto
Duração 01h50min
16.400 milhas por viajante
VOLTA
BSB → CGH
30/11/2026
17:10 - 18:55
GOL Linhas Aéreas
Direto
Duração 01h45min
16.400 milhas por viajante
Taxa principal em dinheiro: R$ 96,69
Total exibido: 32.800 milhas + R$ 96,69
Outras opções Smiles & Money disponíveis`,
    expected: expected({
      tipoVoo: "ida_volta",
      ida: emptyTrecho({
        origem: "CGH",
        destino: "BSB",
        data: "27/11/2026",
        horarioSaida: "06:05",
        horarioChegada: "07:55",
        duracao: "01h50min",
        companhia: "GOL Linhas Aéreas",
        paradas: 0,
        aeroportosIntermediarios: [],
        conexoes: [],
        financeiroApresentado: {
          unidadePontosMilhas: "milhas",
          pontosMilhas: 16400,
          pontosBase: null,
          pontosCondicionados: null,
        },
      }),
      volta: emptyTrecho({
        origem: "BSB",
        destino: "CGH",
        data: "30/11/2026",
        horarioSaida: "17:10",
        horarioChegada: "18:55",
        duracao: "01h45min",
        companhia: "GOL Linhas Aéreas",
        paradas: 0,
        aeroportosIntermediarios: [],
        conexoes: [],
        financeiroApresentado: {
          unidadePontosMilhas: "milhas",
          pontosMilhas: 16400,
          pontosBase: null,
          pontosCondicionados: null,
        },
      }),
      financeiro: emptyFinanceiro({
        moeda: "R$",
        milhasPontos: { unidade: "milhas", ida: 16400, volta: 16400, total: 32800, naoAtribuido: null },
        total: { valorMonetarioExibido: [{ valor: 96.69, valorBruto: "R$ 96,69" }] },
      }),
    }),
  },
  {
    id: "AZUL-REAL-01",
    rawText: `Azul
Ida e volta
2 viajantes
IDA
GYN → SSA
20/12/2026
04:55 - 09:50
Azul
Voo 4009
1 conexão
Duração 4h55m
130.000 pontos base
128.700 pontos com condição de benefício
R$ 90,32
VOLTA
SSA → GYN
31/12/2026
05:15 - 09:45
Azul
Voo 4553
1 conexão
Duração 4h30m
100.000 pontos base
90.000 pontos com condição de benefício
R$ 52,72
Total exibido para 2 viajantes: 437.400 pontos + R$ 286,08`,
    expected: expected({
      tipoVoo: "ida_volta",
      quantidadeViajantes: 2,
      ida: emptyTrecho({
        origem: "GYN",
        destino: "SSA",
        data: "20/12/2026",
        horarioSaida: "04:55",
        horarioChegada: "09:50",
        duracao: "4h55m",
        companhia: "Azul",
        numeroVoo: "4009",
        paradas: 1,
        financeiroApresentado: {
          unidadePontosMilhas: "pontos",
          pontosMilhas: null,
          pontosBase: 130000,
          pontosCondicionados: 128700,
        },
      }),
      volta: emptyTrecho({
        origem: "SSA",
        destino: "GYN",
        data: "31/12/2026",
        horarioSaida: "05:15",
        horarioChegada: "09:45",
        duracao: "4h30m",
        companhia: "Azul",
        numeroVoo: "4553",
        paradas: 1,
        financeiroApresentado: {
          unidadePontosMilhas: "pontos",
          pontosMilhas: null,
          pontosBase: 100000,
          pontosCondicionados: 90000,
        },
      }),
      financeiro: emptyFinanceiro({
        moeda: "R$",
        milhasPontos: { unidade: "pontos", ida: null, volta: null, total: 437400, naoAtribuido: null },
        ida: { valorMonetarioExibido: [{ valor: 90.32, valorBruto: "R$ 90,32" }] },
        volta: { valorMonetarioExibido: [{ valor: 52.72, valorBruto: "R$ 52,72" }] },
        total: { valorMonetarioExibido: [{ valor: 286.08, valorBruto: "R$ 286,08" }] },
      }),
    }),
  },
];
