import { validarENormalizarItinerario, type ItinerarioCotacaoValidado } from './itinerarioUtils';

export type CodigoFalhaSmartPasteEstruturado =
  | 'texto_nao_reconhecido'
  | 'dados_insuficientes'
  | 'inconsistencia_estrutural';

export type ResultadoSmartPasteEstruturado =
  | {
      ok: true;
      itinerario: ItinerarioCotacaoValidado;
    }
  | {
      ok: false;
      codigo: CodigoFalhaSmartPasteEstruturado;
      motivo: string;
    };

type FalhaSmartPasteEstruturado = Extract<ResultadoSmartPasteEstruturado, { ok: false }>;

type TipoSentido = 'ida' | 'volta';

interface SecaoTexto {
  tipo: TipoSentido;
  linhas: string[];
}

interface EventoVoo {
  aeroporto: string;
  hora: string;
  data?: string;
  dataContexto?: string;
  maisUmDia: boolean;
  papel: 'saida' | 'chegada' | 'desconhecido';
  companhia?: string;
  numeroVoo?: string;
}

interface EventoVooResolvido extends EventoVoo {
  data: string;
  papel: 'saida' | 'chegada';
}

const MESES: Record<string, string> = {
  janeiro: '01', jan: '01',
  fevereiro: '02', fev: '02',
  marco: '03', março: '03', mar: '03',
  abril: '04', abr: '04',
  maio: '05', mai: '05',
  junho: '06', jun: '06',
  julho: '07', jul: '07',
  agosto: '08', ago: '08',
  setembro: '09', set: '09',
  outubro: '10', out: '10',
  novembro: '11', nov: '11',
  dezembro: '12', dez: '12',
};

function removerAcentos(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function dataExiste(ano: number, mes: number, dia: number) {
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano
    && data.getUTCMonth() === mes - 1
    && data.getUTCDate() === dia;
}

function montarDataIso(ano: number, mes: number, dia: number) {
  if (!dataExiste(ano, mes, dia)) return undefined;
  return [ano, mes, dia].map((parte, indice) => (
    parte.toString().padStart(indice === 0 ? 4 : 2, '0')
  )).join('-');
}

function normalizarDataLiteral(texto: string) {
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return montarDataIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const brasileira = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!brasileira) return undefined;
  return montarDataIso(
    Number(brasileira[3]),
    Number(brasileira[2]),
    Number(brasileira[1])
  );
}

function extrairDataCompleta(texto: string) {
  const numerica = texto.match(/\b(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/);
  if (numerica) return normalizarDataLiteral(numerica[1]);

  const semAcentos = removerAcentos(texto).toLowerCase();
  const porExtenso = semAcentos.match(
    /\b(\d{1,2})\s+de\s+([a-z]+)\.?\s+de\s+(\d{4})\b/
  );
  if (!porExtenso) return undefined;
  const mes = MESES[porExtenso[2]];
  return mes
    ? montarDataIso(Number(porExtenso[3]), Number(mes), Number(porExtenso[1]))
    : undefined;
}

function adicionarDias(dataIso: string, dias: number) {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return [
    data.getUTCFullYear().toString().padStart(4, '0'),
    (data.getUTCMonth() + 1).toString().padStart(2, '0'),
    data.getUTCDate().toString().padStart(2, '0'),
  ].join('-');
}

function normalizarHora(hora: string) {
  const match = hora.match(/^(\d{1,2}):(\d{2})$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return undefined;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function detectarTipoSecao(linha: string): TipoSentido | undefined {
  const normalizada = removerAcentos(linha).trim().toLowerCase();
  const contextual = normalizada.match(/^(?:passagem|voo)\s+de\s+(ida|volta)\b/);
  if (contextual) return contextual[1] as TipoSentido;
  const titulo = normalizada.match(/^(?:trecho\s+de\s+)?(ida|volta)\b/);
  return titulo?.[1] as TipoSentido | undefined;
}

function segmentarTexto(linhas: string[]) {
  const marcadores = linhas.flatMap((linha, indice) => {
    const tipo = detectarTipoSecao(linha);
    return tipo ? [{ indice, tipo }] : [];
  });

  if (marcadores.length === 0) {
    return {
      possuiMarcadores: false,
      secoes: [{ tipo: 'ida' as const, linhas }],
    };
  }

  return {
    possuiMarcadores: true,
    secoes: marcadores.map((marcador, indice): SecaoTexto => ({
      tipo: marcador.tipo,
      linhas: linhas.slice(
        marcador.indice,
        marcadores[indice + 1]?.indice ?? linhas.length
      ),
    })),
  };
}

function normalizarNumeroVoo(valor?: string) {
  if (!valor) return undefined;
  const normalizado = valor.replace(/^voo\s*/i, '').trim().toUpperCase();
  return /^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/.test(normalizado)
    ? normalizado
    : undefined;
}

const COMPANHIAS_COM_PREFIXO_COMPROVADO: Record<string, string[]> = {
  AD: ['azul'],
  LA: ['latam'],
  G3: ['gol'],
};

function normalizarNomeCompanhia(valor: string) {
  return removerAcentos(valor).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function ehCompanhiaOperacionalReconhecivel(valor?: string, numeroVoo?: string) {
  if (!valor) return undefined;
  const normalizada = valor.trim();
  if (!/^[\p{L}\d][\p{L}\d .&'-]{1,48}$/u.test(normalizada)) return undefined;

  const nomeNormalizado = normalizarNomeCompanhia(normalizada);
  if (numeroVoo) {
    const prefixo = numeroVoo.match(/^[A-Z0-9]{2,3}/)?.[0];
    if (prefixo && COMPANHIAS_COM_PREFIXO_COMPROVADO[prefixo]?.includes(nomeNormalizado)) {
      return normalizada;
    }
    return undefined;
  }

  const nomesComprovados = Object.values(COMPANHIAS_COM_PREFIXO_COMPROVADO).flat();
  const possuiDesignacaoOperacional = /\b(?:airlines?|airways?|aereas?|aviacao|aerolineas)\b/
    .test(nomeNormalizado);
  return nomesComprovados.includes(nomeNormalizado) || possuiDesignacaoOperacional
    ? normalizada
    : undefined;
}

function extrairValorCompanhiaExplicita(valor?: string) {
  return valor?.match(
    /^(?:companhia(?:\s+a[eé]rea)?|operado\s+por|operado\s+pela)\s*:?\s*(.+)$/i
  )?.[1];
}

function extrairMetadados(campos: string[]) {
  const numeroVoo = normalizarNumeroVoo(campos[2]);
  const companhiaComVoo = numeroVoo
    ? ehCompanhiaOperacionalReconhecivel(campos[1], numeroVoo)
    : undefined;
  const companhia = companhiaComVoo
    ?? ehCompanhiaOperacionalReconhecivel(extrairValorCompanhiaExplicita(campos[1]));
  return { companhia, numeroVoo };
}

function extrairPapelEvento(texto: string) {
  const match = texto.match(
    /^(sa[ií]da|partida|departure|chegada|arrival)\s*[:\-]?\s*(.+)$/i
  );
  if (!match) return { papel: 'desconhecido' as const, conteudo: texto };
  return {
    papel: /^(?:chegada|arrival)$/i.test(match[1])
      ? 'chegada' as const
      : 'saida' as const,
    conteudo: match[2].trim(),
  };
}

function extrairEventoDeLinha(linha: string): EventoVoo | undefined {
  const campos = linha.split('|').map((campo) => campo.trim());
  const maisUmDia = /(?:^|\s)\+1(?:\s|$)/.test(campos[0]);
  const semMaisUm = campos[0].replace(/(?:^|\s)\+1(?:\s|$)/g, ' ').trim();
  const { papel, conteudo: principal } = extrairPapelEvento(semMaisUm);
  const metadados = extrairMetadados(campos);
  const completo = principal.match(
    /^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s+([A-Z]{3})$/i
  );
  if (completo) {
    const data = normalizarDataLiteral(completo[1]);
    const hora = normalizarHora(completo[2]);
    if (!data || !hora) return undefined;
    return {
      papel,
      aeroporto: completo[3].toUpperCase(),
      data,
      hora,
      maisUmDia,
      ...metadados,
    };
  }

  const horaAeroporto = principal.match(/^(\d{1,2}:\d{2})\s+([A-Z]{3})$/i);
  if (horaAeroporto) {
    const hora = normalizarHora(horaAeroporto[1]);
    if (!hora) return undefined;
    return {
      papel,
      aeroporto: horaAeroporto[2].toUpperCase(),
      hora,
      maisUmDia,
      ...metadados,
    };
  }

  const aeroportoHora = principal.match(/^([A-Z]{3})\s+(\d{1,2})(?:h|:)(\d{2})$/i);
  if (!aeroportoHora) return undefined;
  const hora = normalizarHora(`${aeroportoHora[2]}:${aeroportoHora[3]}`);
  if (!hora) return undefined;
  return {
    papel,
    aeroporto: aeroportoHora[1].toUpperCase(),
    hora,
    maisUmDia,
    ...metadados,
  };
}

function extrairAeroportoIsolado(linha: string, ano?: string) {
  const match = linha.match(/^([A-Z]{3})(?:\s*•\s*(\d{2})\/(\d{2})(?:\/(\d{4}))?)?$/i);
  if (!match) return undefined;
  const anoResolvido = match[4] ?? ano;
  const data = match[2] && match[3] && anoResolvido
    ? montarDataIso(Number(anoResolvido), Number(match[3]), Number(match[2]))
    : undefined;
  return { aeroporto: match[1].toUpperCase(), data };
}

function extrairEventos(secao: SecaoTexto) {
  const eventos: EventoVoo[] = [];
  let dataContextoPendente: string | undefined;
  let ultimaDataConhecida: string | undefined;

  for (let indice = 0; indice < secao.linhas.length; indice += 1) {
    const linha = secao.linhas[indice].trim();
    const evento = extrairEventoDeLinha(linha);
    if (evento) {
      eventos.push({
        ...evento,
        ...(!evento.data && dataContextoPendente
          ? { dataContexto: dataContextoPendente }
          : {}),
      });
      ultimaDataConhecida = evento.data ?? dataContextoPendente ?? ultimaDataConhecida;
      dataContextoPendente = undefined;
      continue;
    }

    const papelLinha = extrairPapelEvento(linha);
    const horaIsolada = normalizarHora(papelLinha.conteudo);
    if (horaIsolada) {
      const aeroporto = extrairAeroportoIsolado(
        secao.linhas[indice + 1]?.trim() ?? '',
        ultimaDataConhecida?.slice(0, 4)
      );
      if (aeroporto) {
        eventos.push({
          aeroporto: aeroporto.aeroporto,
          hora: horaIsolada,
          data: aeroporto.data,
          ...(!aeroporto.data && dataContextoPendente
            ? { dataContexto: dataContextoPendente }
            : {}),
          maisUmDia: /\+1/.test(secao.linhas[indice + 1]),
          papel: papelLinha.papel,
        });
        ultimaDataConhecida = aeroporto.data ?? dataContextoPendente ?? ultimaDataConhecida;
        dataContextoPendente = undefined;
        indice += 1;
        continue;
      }
    }

    const dataDaLinha = extrairDataCompleta(linha);
    if (dataDaLinha) {
      dataContextoPendente = dataDaLinha;
      ultimaDataConhecida = dataDaLinha;
    }
  }

  return eventos;
}

function estabelecerPapeis(eventos: EventoVoo[], tipo: TipoSentido):
  | FalhaSmartPasteEstruturado
  | { ok: true; eventos: Array<EventoVoo & { papel: 'saida' | 'chegada' }> } {
  const resolvidos: Array<EventoVoo & { papel: 'saida' | 'chegada' }> = [];
  for (let indice = 0; indice < eventos.length; indice += 1) {
    const esperado = indice % 2 === 0 ? 'saida' : 'chegada';
    const evento = eventos[indice];
    if (evento.papel !== 'desconhecido' && evento.papel !== esperado) {
      return {
        ok: false,
        codigo: 'inconsistencia_estrutural',
        motivo: 'O trecho de ' + tipo + ' apresenta ' + evento.papel
          + ' onde era esperada ' + esperado,
      };
    }
    if (esperado === 'saida' && evento.maisUmDia) {
      return {
        ok: false,
        codigo: 'inconsistencia_estrutural',
        motivo: 'O indicador +1 não pode estar associado à saída do trecho de ' + tipo,
      };
    }
    resolvidos.push({ ...evento, papel: esperado });
  }
  return { ok: true, eventos: resolvidos };
}

function resolverDatas(eventos: Array<EventoVoo & { papel: 'saida' | 'chegada' }>) {
  const resolvidos: EventoVooResolvido[] = [];

  for (let indice = 0; indice < eventos.length; indice += 1) {
    const evento = eventos[indice];
    const referencia = evento.dataContexto ?? resolvidos[indice - 1]?.data;
    let data = evento.data ?? referencia;
    if (!data) return undefined;
    if (!evento.data && evento.papel === 'chegada' && evento.maisUmDia) {
      data = adicionarDias(data, 1);
    }
    resolvidos.push({ ...evento, data });
  }

  return resolvidos;
}

function extrairQuantidadeConexoes(texto: string) {
  if (/\bdireto\b/i.test(texto)) return 0;
  const normalizado = removerAcentos(texto).toLowerCase();
  const numerica = normalizado.match(/\b(\d+)\s*(?:conex(?:ao|oes)|paradas?)\b/);
  if (numerica) return Number(numerica[1]);
  const textual = normalizado.match(/\b(uma|duas|tres)\s+conex(?:ao|oes)\b/);
  if (!textual) return undefined;
  return { uma: 1, duas: 2, tres: 3 }[textual[1] as 'uma' | 'duas' | 'tres'];
}

function extrairCompanhiaDaSecao(texto: string) {
  const linhas = texto.split('\n').map((linha) => linha.trim()).filter(Boolean);
  for (let indice = 0; indice < linhas.length; indice += 1) {
    const explicita = extrairValorCompanhiaExplicita(linhas[indice]);
    if (explicita) return ehCompanhiaOperacionalReconhecivel(explicita);
    if (/^(?:companhia(?:\s+a[eé]rea)?|operado\s+por|operado\s+pela)\s*:?$/i
      .test(linhas[indice])) {
      return ehCompanhiaOperacionalReconhecivel(linhas[indice + 1]);
    }
  }
  return undefined;
}

function montarSentido(secao: SecaoTexto): FalhaSmartPasteEstruturado | {
  ok: true;
  sentido: {
    tipo: TipoSentido;
    fonte: 'estruturado';
    pernas: Array<{
      origem: string;
      destino: string;
      dataSaida: string;
      horaSaida: string;
      dataChegada: string;
      horaChegada: string;
      companhia?: string;
      numeroVoo?: string;
    }>;
  };
} {
  const texto = secao.linhas.join('\n');
  const eventos = extrairEventos(secao);
  if (eventos.length < 2) {
    return {
      ok: false,
      codigo: eventos.length === 0 ? 'texto_nao_reconhecido' : 'dados_insuficientes',
      motivo: `O trecho de ${secao.tipo} não contém saída e chegada completas`,
    };
  }
  if (eventos.length % 2 !== 0) {
    return {
      ok: false,
      codigo: 'dados_insuficientes',
      motivo: `O trecho de ${secao.tipo} possui um evento de aeroporto sem par`,
    };
  }

  const papeis = estabelecerPapeis(eventos, secao.tipo);
  if (!papeis.ok) return papeis;
  const eventosResolvidos = resolverDatas(papeis.eventos);
  if (!eventosResolvidos) {
    return {
      ok: false,
      codigo: 'dados_insuficientes',
      motivo: `O trecho de ${secao.tipo} não informa o ano necessário para todas as pernas`,
    };
  }

  const quantidadePernas = eventosResolvidos.length / 2;
  const conexoesDeclaradas = extrairQuantidadeConexoes(texto);
  if (conexoesDeclaradas !== undefined && quantidadePernas !== conexoesDeclaradas + 1) {
    return {
      ok: false,
      codigo: 'dados_insuficientes',
      motivo: `O trecho de ${secao.tipo} declara ${conexoesDeclaradas} conexão(ões), mas não mostra todos os aeroportos intermediários`,
    };
  }

  const companhiaSecao = extrairCompanhiaDaSecao(texto);
  const pernas = Array.from({ length: quantidadePernas }, (_, indice) => {
    const saida = eventosResolvidos[indice * 2];
    const chegada = eventosResolvidos[indice * 2 + 1];
    const companhia = saida.companhia ?? chegada.companhia ?? companhiaSecao;
    const numeroVoo = saida.numeroVoo ?? chegada.numeroVoo;
    return {
      origem: saida.aeroporto,
      destino: chegada.aeroporto,
      dataSaida: saida.data,
      horaSaida: saida.hora,
      dataChegada: chegada.data,
      horaChegada: chegada.hora,
      ...(companhia ? { companhia } : {}),
      ...(numeroVoo ? { numeroVoo } : {}),
    };
  });

  return {
    ok: true,
    sentido: {
      tipo: secao.tipo,
      fonte: 'estruturado',
      pernas,
    },
  };
}

function possuiRetornoAmbiguo(pernas: Array<{ origem: string; destino: string }>) {
  if (pernas.length < 2) return false;
  if (pernas[0].origem === pernas[pernas.length - 1].destino) return true;
  return pernas.some((perna, indice) => pernas.slice(indice + 1).some(
    (posterior) => perna.origem === posterior.destino
      && perna.destino === posterior.origem
  ));
}

export function extrairItinerarioSmartPaste(
  textoOriginal: string
): ResultadoSmartPasteEstruturado {
  const texto = textoOriginal.trim();
  if (!texto) {
    return {
      ok: false,
      codigo: 'texto_nao_reconhecido',
      motivo: 'O texto está vazio',
    };
  }

  const linhas = texto.split(/\r?\n/);
  const segmentacao = segmentarTexto(linhas);
  const { secoes } = segmentacao;
  const secoesIda = secoes.filter((secao) => secao.tipo === 'ida');
  const secoesVolta = secoes.filter((secao) => secao.tipo === 'volta');
  if (secoesIda.length !== 1 || secoesVolta.length > 1) {
    return {
      ok: false,
      codigo: secoesIda.length === 0 ? 'dados_insuficientes' : 'inconsistencia_estrutural',
      motivo: secoesIda.length === 0
        ? 'Não foi possível identificar um trecho de ida'
        : 'O texto contém seções duplicadas de ida ou volta',
    };
  }

  const ida = montarSentido(secoesIda[0]);
  if (!ida.ok) return ida;
  if (!segmentacao.possuiMarcadores && possuiRetornoAmbiguo(ida.sentido.pernas)) {
    return {
      ok: false,
      codigo: 'dados_insuficientes',
      motivo: 'O texto sem marcadores contém possível mudança de sentido entre ida e volta',
    };
  }
  const volta = secoesVolta[0] ? montarSentido(secoesVolta[0]) : undefined;
  if (volta && !volta.ok) return volta;

  try {
    const itinerario = validarENormalizarItinerario({
      versao: 1,
      ida: ida.sentido,
      ...(volta?.ok ? { volta: volta.sentido } : {}),
    });
    return { ok: true, itinerario };
  } catch (erro) {
    if (!(erro instanceof Error) || !erro.message.startsWith('Itinerário inválido em ')) {
      throw erro;
    }
    return {
      ok: false,
      codigo: 'inconsistencia_estrutural',
      motivo: erro.message,
    };
  }
}
