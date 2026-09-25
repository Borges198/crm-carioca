const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

export const LIMITE_DATAS_PROXIMAS_DIAS = 3;

export const TIPOS_SINAL = Object.freeze({
  PROXIMA_ACAO_ATRASADA: "PROXIMA_ACAO_ATRASADA",
  PROXIMA_ACAO_HOJE: "PROXIMA_ACAO_HOJE",
  OPORTUNIDADE_SEM_PROXIMA_ACAO: "OPORTUNIDADE_SEM_PROXIMA_ACAO",
  POSSIVEIS_PESQUISAS_REPETIDAS: "POSSIVEIS_PESQUISAS_REPETIDAS",
});

export const CLASSIFICACAO_POR_TIPO = Object.freeze({
  [TIPOS_SINAL.PROXIMA_ACAO_ATRASADA]: "FATO",
  [TIPOS_SINAL.PROXIMA_ACAO_HOJE]: "FATO",
  [TIPOS_SINAL.OPORTUNIDADE_SEM_PROXIMA_ACAO]: "FATO",
  [TIPOS_SINAL.POSSIVEIS_PESQUISAS_REPETIDAS]: "PADRÃO",
});

function dataUtc(data) {
  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new Error(`Data inválida: ${String(data)}`);
  }

  const [ano, mes, dia] = data.split("-").map(Number);
  const instante = Date.UTC(ano, mes - 1, dia);
  const parsed = new Date(instante);
  if (
    parsed.getUTCFullYear() !== ano
    || parsed.getUTCMonth() !== mes - 1
    || parsed.getUTCDate() !== dia
  ) {
    throw new Error(`Data inválida: ${data}`);
  }
  return instante;
}

export function diferencaDias(dataA, dataB) {
  return Math.abs(dataUtc(dataA) - dataUtc(dataB)) / MILISSEGUNDOS_POR_DIA;
}

export function datasSaoProximas(dataA, dataB) {
  return diferencaDias(dataA, dataB) <= LIMITE_DATAS_PROXIMAS_DIAS;
}

function destinoCanonico(destino) {
  return destino.trim().toLocaleUpperCase("pt-BR");
}

function idSinal(tipo, entidades) {
  return `signal-${tipo.toLocaleLowerCase("pt-BR").replaceAll("_", "-")}-${entidades.join("-")}`;
}

function criarSinal(tipo, entidades, evidenceIds, dados) {
  return {
    id: idSinal(tipo, entidades),
    tipo,
    classificacao: CLASSIFICACAO_POR_TIPO[tipo],
    entidades,
    evidenceIds,
    dados,
  };
}

export function coletarIdsEntidades(entrada) {
  return new Set([
    ...entrada.clientes.map(({ id }) => id),
    ...entrada.oportunidades.map(({ id }) => id),
    ...entrada.proximasAcoes.map(({ id }) => id),
    ...entrada.pesquisas.map(({ id }) => id),
  ]);
}

function validarEntrada(entrada) {
  dataUtc(entrada.dataReferencia);
  for (const campo of ["clientes", "oportunidades", "proximasAcoes", "pesquisas"]) {
    if (!Array.isArray(entrada[campo])) throw new Error(`${campo} deve ser uma lista.`);
  }

  const ids = [
    ...entrada.clientes,
    ...entrada.oportunidades,
    ...entrada.proximasAcoes,
    ...entrada.pesquisas,
  ].map(({ id }) => id);
  if (ids.some((id) => typeof id !== "string" || id.length === 0) || new Set(ids).size !== ids.length) {
    throw new Error("Todas as entidades devem ter IDs textuais, não vazios e únicos.");
  }

  const clientes = new Set(entrada.clientes.map(({ id }) => id));
  const oportunidades = new Map(entrada.oportunidades.map((item) => [item.id, item]));
  const acoes = new Map(entrada.proximasAcoes.map((item) => [item.id, item]));

  for (const oportunidade of entrada.oportunidades) {
    if (!clientes.has(oportunidade.clienteId)) {
      throw new Error(`Cliente inexistente em ${oportunidade.id}.`);
    }
    if (oportunidade.proximaAcaoId !== null) {
      const acao = acoes.get(oportunidade.proximaAcaoId);
      if (!acao || acao.oportunidadeId !== oportunidade.id) {
        throw new Error(`Próxima ação inválida em ${oportunidade.id}.`);
      }
    }
  }

  for (const acao of entrada.proximasAcoes) {
    dataUtc(acao.data);
    if (!oportunidades.has(acao.oportunidadeId)) {
      throw new Error(`Oportunidade inexistente em ${acao.id}.`);
    }
  }

  for (const pesquisa of entrada.pesquisas) {
    if (!clientes.has(pesquisa.clienteId)) throw new Error(`Cliente inexistente em ${pesquisa.id}.`);
    if (typeof pesquisa.destino !== "string" || pesquisa.destino.trim().length === 0) {
      throw new Error(`Destino inválido em ${pesquisa.id}.`);
    }
    dataUtc(pesquisa.dataIda);
    if (pesquisa.dataVolta !== null) dataUtc(pesquisa.dataVolta);
  }
}

function pesquisasSaoSemelhantes(pesquisaA, pesquisaB) {
  if (pesquisaA.clienteId !== pesquisaB.clienteId) return false;
  if (destinoCanonico(pesquisaA.destino) !== destinoCanonico(pesquisaB.destino)) return false;
  if (!datasSaoProximas(pesquisaA.dataIda, pesquisaB.dataIda)) return false;

  const umaTemVolta = pesquisaA.dataVolta !== null || pesquisaB.dataVolta !== null;
  if (!umaTemVolta) return true;
  if (pesquisaA.dataVolta === null || pesquisaB.dataVolta === null) return false;
  return datasSaoProximas(pesquisaA.dataVolta, pesquisaB.dataVolta);
}

function sinaisDeProximasAcoes(entrada) {
  const acoes = new Map(entrada.proximasAcoes.map((item) => [item.id, item]));
  const referencia = dataUtc(entrada.dataReferencia);
  const sinais = [];

  for (const oportunidade of entrada.oportunidades) {
    if (oportunidade.status !== "ABERTA") continue;

    if (oportunidade.proximaAcaoId === null) {
      sinais.push(criarSinal(
        TIPOS_SINAL.OPORTUNIDADE_SEM_PROXIMA_ACAO,
        [oportunidade.id],
        [oportunidade.id],
        { statusOportunidade: oportunidade.status, proximaAcaoId: null },
      ));
      continue;
    }

    const acao = acoes.get(oportunidade.proximaAcaoId);
    if (acao.concluida) continue;
    const diferenca = (dataUtc(acao.data) - referencia) / MILISSEGUNDOS_POR_DIA;

    if (diferenca < 0) {
      sinais.push(criarSinal(
        TIPOS_SINAL.PROXIMA_ACAO_ATRASADA,
        [oportunidade.id],
        [oportunidade.id, acao.id],
        {
          dataReferencia: entrada.dataReferencia,
          dataProximaAcao: acao.data,
          diasEmAtraso: Math.abs(diferenca),
        },
      ));
    } else if (diferenca === 0) {
      sinais.push(criarSinal(
        TIPOS_SINAL.PROXIMA_ACAO_HOJE,
        [oportunidade.id],
        [oportunidade.id, acao.id],
        {
          dataReferencia: entrada.dataReferencia,
          dataProximaAcao: acao.data,
          diasAteAcao: 0,
        },
      ));
    }
  }

  return sinais;
}

function sinaisDePesquisas(entrada) {
  const pesquisas = [...entrada.pesquisas].sort((a, b) => a.id.localeCompare(b.id));
  const pesquisasPorId = new Map(pesquisas.map((pesquisa) => [pesquisa.id, pesquisa]));
  const vizinhos = new Map(pesquisas.map((pesquisa) => [pesquisa.id, new Set()]));
  const relacoes = [];
  const sinais = [];

  for (let primeiro = 0; primeiro < pesquisas.length; primeiro += 1) {
    for (let segundo = primeiro + 1; segundo < pesquisas.length; segundo += 1) {
      const pesquisaA = pesquisas[primeiro];
      const pesquisaB = pesquisas[segundo];
      if (!pesquisasSaoSemelhantes(pesquisaA, pesquisaB)) continue;

      vizinhos.get(pesquisaA.id).add(pesquisaB.id);
      vizinhos.get(pesquisaB.id).add(pesquisaA.id);
      relacoes.push([pesquisaA.id, pesquisaB.id]);
    }
  }

  const visitadas = new Set();
  for (const pesquisa of pesquisas) {
    if (visitadas.has(pesquisa.id) || vizinhos.get(pesquisa.id).size === 0) continue;

    const pendentes = [pesquisa.id];
    const grupo = [];
    visitadas.add(pesquisa.id);
    while (pendentes.length > 0) {
      const atual = pendentes.shift();
      grupo.push(atual);
      const proximas = [...vizinhos.get(atual)].sort((a, b) => a.localeCompare(b));
      for (const proxima of proximas) {
        if (visitadas.has(proxima)) continue;
        visitadas.add(proxima);
        pendentes.push(proxima);
      }
    }

    const entidades = [...grupo].sort((a, b) => a.localeCompare(b));
    const idsDoGrupo = new Set(entidades);
    const [primeiraId, segundaId] = relacoes.find(([a, b]) => (
      idsDoGrupo.has(a) && idsDoGrupo.has(b)
    ));
    const pesquisaA = pesquisasPorId.get(primeiraId);
    const pesquisaB = pesquisasPorId.get(segundaId);

    sinais.push(criarSinal(
      TIPOS_SINAL.POSSIVEIS_PESQUISAS_REPETIDAS,
      entidades,
      [...entidades, pesquisaA.clienteId],
      {
        clienteId: pesquisaA.clienteId,
        destino: destinoCanonico(pesquisaA.destino),
        diferencaDiasIda: diferencaDias(pesquisaA.dataIda, pesquisaB.dataIda),
        diferencaDiasVolta: pesquisaA.dataVolta === null
          ? null
          : diferencaDias(pesquisaA.dataVolta, pesquisaB.dataVolta),
        limiteDatasProximasDias: LIMITE_DATAS_PROXIMAS_DIAS,
      },
    ));
  }

  return sinais;
}

function validarSinais(sinais, entrada) {
  const idsExistentes = coletarIdsEntidades(entrada);
  for (const sinal of sinais) {
    if (!sinal.id || !CLASSIFICACAO_POR_TIPO[sinal.tipo]) throw new Error("Sinal inválido.");
    if (sinal.classificacao !== CLASSIFICACAO_POR_TIPO[sinal.tipo]) {
      throw new Error(`Classificação inválida em ${sinal.id}.`);
    }
    if (!Array.isArray(sinal.entidades) || sinal.entidades.length === 0) {
      throw new Error(`Entidades ausentes em ${sinal.id}.`);
    }
    if (!Array.isArray(sinal.evidenceIds) || sinal.evidenceIds.length === 0) {
      throw new Error(`Evidências ausentes em ${sinal.id}.`);
    }
    if (![...sinal.entidades, ...sinal.evidenceIds].every((id) => idsExistentes.has(id))) {
      throw new Error(`Referência a entidade inexistente em ${sinal.id}.`);
    }
    if (sinal.dados === null || typeof sinal.dados !== "object" || Array.isArray(sinal.dados)) {
      throw new Error(`Dados determinísticos ausentes em ${sinal.id}.`);
    }
  }
}

export function detectarSinais(entrada) {
  validarEntrada(entrada);
  const sinais = [
    ...sinaisDeProximasAcoes(entrada),
    ...sinaisDePesquisas(entrada),
  ];
  validarSinais(sinais, entrada);
  return sinais;
}
