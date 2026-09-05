import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { Acompanhamento, Cotacao } from '../../types';
import { filterBySearch } from '../../utils/searchUtils';
import { normalizarDataComercialParaTimestamp } from '../../utils/acompanhamentoUtils';

const clientesService = vi.hoisted(() => ({
  atualizarCliente: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  Timestamp: class Timestamp {
    constructor(private readonly value = new Date(0)) {}

    static fromDate(value: Date) {
      return new this(value);
    }

    toDate() {
      return this.value;
    }
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../services/clientesService', () => ({
  atualizarCliente: clientesService.atualizarCliente,
  criarCliente: vi.fn(),
  listarClientesDoUsuario: vi.fn(),
}));

vi.mock('../../services/cotacoesService', () => ({
  atualizarCotacao: vi.fn(),
  listarCotacoesDoUsuario: vi.fn(),
}));

vi.mock('../../services/acompanhamentosService', () => ({
  atualizarProximaAcao: vi.fn(),
  listarAcompanhamentosDoUsuario: vi.fn(),
  materializarAcompanhamento: vi.fn(),
}));

import {
  avancarIdentidadeSessaoLeads,
  agruparCotacoesEmOportunidades,
  atualizarTelefoneCotacaoPorId,
  CLASSIFICACAO_PROXIMA_ACAO_CLASSES,
  formatarData,
  formatarProximaAcaoNoCard,
  montarDadosPersistenciaProximaAcao,
  obterCotacoesDaCartela,
  identidadeSessaoLeadsCorresponde,
  montarCamposPesquisaOportunidade,
  montarChaveOportunidade,
  montarDadosViagemCotacao,
  montarPayloadTelefoneCotacao,
  OPCOES_TIPO_PROXIMA_ACAO,
  ordenarOportunidadesPorProximaAcao,
  podeIniciarEdicaoTelefone,
  persistirTelefoneCotacao,
  sessaoPodeMutarLeads,
  sessaoLeadsProntaParaInteracao,
  TEXTO_ORIENTATIVO_LEADS_LEITURA_COMERCIAL,
} from './page';

const sourceLeadsPage = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('formatação das datas de viagem em Leads', () => {
  it.each([
    ['15-09-2026', '15/09/2026'],
    ['2026-09-15', '15/09/2026'],
  ])('formata %s sem depender do parser de Date', (entrada, esperado) => {
    expect(formatarData(entrada)).toBe(esperado);
  });

  it.each([
    '31-02-2026',
    '2026-02-31',
    'data-invalida',
  ])('usa fallback seguro para %s', (entrada) => {
    expect(formatarData(entrada)).toBe('Data inválida');
    expect(formatarData(entrada)).not.toBe('Invalid Date');
  });

  it.each([null, undefined, '', '   '])('trata ausência de data: %s', (entrada) => {
    expect(formatarData(entrada)).toBe('Data não informada');
  });

  it('mantém a apresentação de Timestamp e Date válidos em pt-BR', () => {
    const data = new Date(2026, 8, 30, 12);
    const timestamp = normalizarDataComercialParaTimestamp('2026-09-30');

    expect(formatarData(timestamp)).toBe('30/09/2026');
    expect(formatarData(data)).toBe('30/09/2026');
  });

  it('formata dataVolta legada e dataRegistro Timestamp no fluxo do card', () => {
    const dataRegistro = normalizarDataComercialParaTimestamp('2026-09-30');
    const oportunidade = agruparCotacoesEmOportunidades([
      criarCotacao('cotacao-com-datas', {
        dataVolta: '15-09-2026',
        dataRegistro,
      }),
    ])[0];

    expect(formatarData(oportunidade.dataVolta)).toBe('15/09/2026');
    expect(formatarData(oportunidade.cotacaoMaisRecente.dataRegistro)).toBe('30/09/2026');
  });
});

describe('modos da próxima ação na tela de Leads', () => {
  it('oferece exatamente DATA, DIARIA e SEM_DATA com os rótulos aprovados', () => {
    expect(OPCOES_TIPO_PROXIMA_ACAO).toEqual([
      { value: 'DATA', label: 'Escolher uma data' },
      { value: 'DIARIA', label: 'Diariamente' },
      { value: 'SEM_DATA', label: 'Sem próxima ação no momento' },
    ]);
    expect(sourceLeadsPage).toContain('type="radio"');
  });

  it('seleciona DATA e prepara data válida para salvar', () => {
    const dados = montarDadosPersistenciaProximaAcao('DATA', '2026-08-28');

    expect(dados.tipoProximaAcao).toBe('DATA');
    expect(dados.proximaAcaoEm?.toDate().toISOString()).toBe('2026-08-28T12:00:00.000Z');
  });

  it.each([
    ['DIARIA', ''],
    ['SEM_DATA', 'data ignorada'],
  ] as const)('seleciona %s e prepara null para salvar sem exigir data', (tipo, data) => {
    expect(montarDadosPersistenciaProximaAcao(tipo, data)).toEqual({
      tipoProximaAcao: tipo,
      proximaAcaoEm: null,
    });
  });

  it('DATA exige data válida', () => {
    expect(() => montarDadosPersistenciaProximaAcao('DATA', '')).toThrow(
      'Data comercial inválida'
    );
    expect(sourceLeadsPage).toContain("editTipoProximaAcao === 'DATA'");
    expect(sourceLeadsPage).toContain('required');
  });

  it('permite mudar entre os três modos sem reaproveitar data fora de DATA', () => {
    const data = montarDadosPersistenciaProximaAcao('DATA', '2026-08-28');
    const diaria = montarDadosPersistenciaProximaAcao('DIARIA', '2026-08-28');
    const semData = montarDadosPersistenciaProximaAcao('SEM_DATA', '2026-08-28');

    expect(data.proximaAcaoEm).not.toBeNull();
    expect(diaria.proximaAcaoEm).toBeNull();
    expect(semData.proximaAcaoEm).toBeNull();
  });

  it('mantém a apresentação legada com e sem data', () => {
    expect(formatarProximaAcaoNoCard({
      proximaAcaoEm: normalizarDataComercialParaTimestamp('2026-08-28'),
    })).toBe('28/08/2026');
    expect(formatarProximaAcaoNoCard({ proximaAcaoEm: null })).toBe('Não definida');
  });

  it('disponibiliza os rótulos dos seis estados nos cards', () => {
    expect(Object.keys(CLASSIFICACAO_PROXIMA_ACAO_CLASSES)).toEqual(expect.arrayContaining([
      'ATRASADA',
      'HOJE',
      'DIÁRIA',
      'PRÓXIMA',
      'SEM PRÓXIMA AÇÃO',
      'NÃO DEFINIDA',
    ]));
    expect(formatarProximaAcaoNoCard({
      tipoProximaAcao: 'DIARIA',
      proximaAcaoEm: null,
    })).toBe('DIÁRIA');
    expect(formatarProximaAcaoNoCard({
      tipoProximaAcao: 'SEM_DATA',
      proximaAcaoEm: null,
    })).toBe('SEM PRÓXIMA AÇÃO');
  });

  it('ordena visualmente os seis grupos pelo contrato do 3A', () => {
    const modos = [
      ['nao-definida', undefined, null],
      ['sem-data', 'SEM_DATA', null],
      ['proxima', 'DATA', '2026-08-29'],
      ['diaria', 'DIARIA', null],
      ['hoje', 'DATA', '2026-08-28'],
      ['atrasada', 'DATA', '2026-08-27'],
    ] as const;
    const oportunidades = modos.map(([id]) => agruparCotacoesEmOportunidades([
      criarCotacao(id, { acompanhamentoId: id, telefoneNormalizado: id }),
    ])[0]);
    const acompanhamentos = modos.map(([id, tipoProximaAcao, data]) => ({
      id,
      ownerId: 'usuario-1',
      agencyId: 'agencia-1',
      cotacaoAncoraId: id,
      tipoProximaAcao,
      proximaAcaoEm: data ? normalizarDataComercialParaTimestamp(data) : null,
      createdAt: normalizarDataComercialParaTimestamp('2026-08-01'),
      updatedAt: normalizarDataComercialParaTimestamp('2026-08-01'),
    })) satisfies Acompanhamento[];

    expect(ordenarOportunidadesPorProximaAcao(
      oportunidades,
      acompanhamentos,
      new Date('2026-08-28T18:00:00.000Z')
    ).map((oportunidade) => oportunidade.cotacoes[0].acompanhamentoId)).toEqual([
      'atrasada',
      'hoje',
      'diaria',
      'proxima',
      'sem-data',
      'nao-definida',
    ]);
  });
});

function criarCotacao(id: string, overrides: Partial<Cotacao> = {}): Cotacao {
  return {
    id,
    cliente: 'Maria Silva',
    telefone: '(82) 99999-1111',
    telefoneNormalizado: '82999991111',
    origem: 'MCZ',
    destino: 'GRU',
    companhia: 'Azul',
    valorTotal: 1500,
    dataIda: '2026-07-01',
    dataVolta: null,
    dataRegistro: '2026-06-29T10:00:00.000Z',
    ownerId: 'usuario-1',
    leadStatus: 'novo',
    ...overrides,
  };
}

describe('agrupamento de oportunidades em leads', () => {
  it('prioriza clienteId e não inclui rota ou datas na chave', () => {
    expect(montarChaveOportunidade(criarCotacao('1', {
      clienteId: 'cliente-1',
    }))).toBe('owner:usuario-1|cliente:cliente-1');
  });

  it('agrupa o mesmo clienteId com rotas, datas, telefones e nomes diferentes', () => {
    const oportunidades = agruparCotacoesEmOportunidades([
      criarCotacao('1', {
        clienteId: 'cliente-1',
        origem: 'RIO',
        destino: 'SSA',
        dataIda: '2026-07-10',
      }),
      criarCotacao('2', {
        clienteId: 'cliente-1',
        cliente: 'Maria S.',
        telefone: '(82) 98888-2222',
        telefoneNormalizado: '82988882222',
        origem: 'RIO',
        destino: 'AJU',
        dataIda: '2026-07-15',
      }),
    ]);

    expect(oportunidades).toHaveLength(1);
    expect(oportunidades[0].cotacoes).toHaveLength(2);
  });

  it('não agrupa clienteId diferentes mesmo com telefone e nome iguais', () => {
    const oportunidades = agruparCotacoesEmOportunidades([
      criarCotacao('1', { clienteId: 'cliente-1' }),
      criarCotacao('2', { clienteId: 'cliente-2' }),
    ]);

    expect(oportunidades).toHaveLength(2);
  });

  it('não agrupa cotações de owners diferentes', () => {
    const oportunidades = agruparCotacoesEmOportunidades([
      criarCotacao('1', { clienteId: 'cliente-1', ownerId: 'usuario-1' }),
      criarCotacao('2', { clienteId: 'cliente-1', ownerId: 'usuario-2' }),
    ]);

    expect(oportunidades).toHaveLength(2);
  });

  it('usa telefoneNormalizado como fallback legado sem rota ou datas', () => {
    expect(montarChaveOportunidade(criarCotacao('1'))).toBe(
      'owner:usuario-1|telefone:82999991111'
    );
    expect(agruparCotacoesEmOportunidades([
      criarCotacao('1', { origem: 'MCZ', destino: 'GRU', dataIda: '2026-07-01' }),
      criarCotacao('2', { origem: 'AJU', destino: 'SSA', dataIda: '2026-08-01' }),
    ])).toHaveLength(1);
  });

  it('normaliza telefone formatado quando o campo normalizado não existe', () => {
    expect(montarChaveOportunidade(criarCotacao('1', {
      telefoneNormalizado: undefined,
      telefone: '(82) 98888-2222',
    }))).toBe('owner:usuario-1|telefone:82988882222');
  });

  it('ignora telefoneNormalizado inválido e normaliza o telefone visual', () => {
    expect(montarChaveOportunidade(criarCotacao('1', {
      telefoneNormalizado: '   ',
      telefone: '(82) 98888-2222',
    }))).toBe('owner:usuario-1|telefone:82988882222');
  });

  it('usa nome normalizado quando telefone está ausente', () => {
    expect(montarChaveOportunidade(criarCotacao('1', {
      cliente: '  Maria   DA Silva ',
      telefone: undefined,
      telefoneNormalizado: undefined,
    }))).toBe('owner:usuario-1|nome:maria da silva');
  });

  it('usa cotacao.id quando não existe nenhuma identidade', () => {
    const primeira = criarCotacao('sem-identidade-1', {
      cliente: '',
      telefone: undefined,
      telefoneNormalizado: undefined,
    });
    const segunda = criarCotacao('sem-identidade-2', {
      cliente: '',
      telefone: undefined,
      telefoneNormalizado: undefined,
    });

    expect(montarChaveOportunidade(primeira)).toBe(
      'owner:usuario-1|cotacao:sem-identidade-1'
    );
    expect(agruparCotacoesEmOportunidades([primeira, segunda])).toHaveLength(2);
  });

  it('agrupa várias cotações e escolhe a mais recente como representante', () => {
    const antiga = criarCotacao('antiga', {
      clienteId: 'cliente-1',
      origem: 'MCZ',
      destino: 'GRU',
      dataIda: '2026-07-01',
    });
    const recente = criarCotacao('recente', {
      clienteId: 'cliente-1',
      origem: 'AJU',
      destino: 'SSA',
      dataIda: '2026-08-01',
      dataRegistro: '2026-06-30T10:00:00.000Z',
    });

    const oportunidades = agruparCotacoesEmOportunidades([antiga, recente]);

    expect(oportunidades).toHaveLength(1);
    expect(oportunidades[0].cotacoes).toHaveLength(2);
    expect(oportunidades[0].cotacaoMaisRecente.id).toBe('recente');
  });

  it('preserva rota e datas para distinguir cada cotação da cartela', () => {
    expect(montarDadosViagemCotacao(criarCotacao('1', {
      origem: 'RIO',
      destino: 'SSA',
      dataIda: '2026-07-10',
      dataVolta: '2026-07-20',
    }))).toEqual({
      rota: 'RIO → SSA',
      dataIda: '2026-07-10',
      dataVolta: '2026-07-20',
    });
  });

  it('mantém grupo único com uma cotação', () => {
    const oportunidades = agruparCotacoesEmOportunidades([criarCotacao('unica')]);
    expect(oportunidades).toHaveLength(1);
    expect(oportunidades[0].cotacaoMaisRecente.id).toBe('unica');
  });

  it('pode agrupar telefones visuais divergentes quando o normalizado é igual', () => {
    const oportunidades = agruparCotacoesEmOportunidades([
      criarCotacao('1', { telefone: '(82) 99999-1111' }),
      criarCotacao('2', { telefone: '82 99999 0000' }),
    ]);

    expect(oportunidades).toHaveLength(1);
    expect(oportunidades[0].cotacoes).toHaveLength(2);
  });

  it('prioriza acompanhamentoId sobre clienteId, telefone e nome', () => {
    const oportunidades = agruparCotacoesEmOportunidades([
      criarCotacao('1', {
        acompanhamentoId: 'acompanhamento-1',
        clienteId: 'cliente-1',
      }),
      criarCotacao('2', {
        acompanhamentoId: 'acompanhamento-1',
        clienteId: 'cliente-2',
        cliente: 'Outro nome',
        telefoneNormalizado: '11111111111',
      }),
    ]);

    expect(oportunidades).toHaveLength(1);
    expect(oportunidades[0].id).toContain('acompanhamento:acompanhamento-1');
  });

  it('separa oportunidades persistentes diferentes da mesma pessoa', () => {
    const oportunidades = agruparCotacoesEmOportunidades([
      criarCotacao('1', {
        acompanhamentoId: 'acompanhamento-1',
        clienteId: 'cliente-1',
      }),
      criarCotacao('2', {
        acompanhamentoId: 'acompanhamento-2',
        clienteId: 'cliente-1',
      }),
      criarCotacao('3', { clienteId: 'cliente-1' }),
    ]);

    expect(oportunidades).toHaveLength(3);
  });

  it('troca de representante ou subconjunto filtrado não muda a identidade persistente', () => {
    const antiga = criarCotacao('antiga', {
      acompanhamentoId: 'acompanhamento-1',
      dataRegistro: '2026-06-01',
    });
    const recente = criarCotacao('recente', {
      acompanhamentoId: 'acompanhamento-1',
      dataRegistro: '2026-07-01',
    });

    expect(montarChaveOportunidade(antiga)).toBe(montarChaveOportunidade(recente));
    expect(agruparCotacoesEmOportunidades([antiga])[0].id).toBe(
      agruparCotacoesEmOportunidades([recente])[0].id
    );
  });

  it('materialização usa somente as cotações visíveis na cartela filtrada', () => {
    const aguardandoA = criarCotacao('a', {
      clienteId: 'cliente-1',
      leadStatus: 'aguardando_cliente',
    });
    const aguardandoB = criarCotacao('b', {
      clienteId: 'cliente-1',
      leadStatus: 'aguardando_cliente',
    });
    const fechadaOculta = criarCotacao('c', {
      clienteId: 'cliente-1',
      leadStatus: 'fechado',
    });
    const cotacoesGlobais = [aguardandoA, aguardandoB, fechadaOculta];
    const cotacoesVisiveis = cotacoesGlobais.filter(
      (cotacao) => cotacao.leadStatus === 'aguardando_cliente'
    );
    const oportunidadeVisivel = agruparCotacoesEmOportunidades(cotacoesVisiveis)[0];

    const cotacoesParaMaterializar = obterCotacoesDaCartela(oportunidadeVisivel);

    expect(cotacoesParaMaterializar.map((cotacao) => cotacao.id)).toEqual(['a', 'b']);
    expect(cotacoesParaMaterializar).not.toBe(oportunidadeVisivel.cotacoes);
    expect(cotacoesParaMaterializar).not.toContain(fechadaOculta);
  });
});

describe('leitura comercial em leads', () => {
  it('não mantém botão ou modal de edição comercial na página', () => {
    expect(sourceLeadsPage).not.toContain('Editar comercial');
    expect(sourceLeadsPage).not.toContain('Salvar comercial');
    expect(sourceLeadsPage).not.toContain('modalComercial');
    expect(sourceLeadsPage).not.toContain('salvarEdicaoComercial');
  });

  it('não mantém chamada de atualizarCotacao para leadStatus, produtos ou observação', () => {
    expect(sourceLeadsPage).not.toContain('montarPayloadEdicaoComercial');
    expect(sourceLeadsPage).not.toContain('atualizarCotacaoComercialPorId');
    expect(sourceLeadsPage).not.toContain('produtosOfertados,\\n    observacao');
    expect(sourceLeadsPage).toContain('await atualizar(cotacaoId, dadosAtualizados)');
  });

  it('preserva status, produtos e observação em modo leitura na cartela', () => {
    const oportunidades = agruparCotacoesEmOportunidades([
      criarCotacao('1', {
        leadStatus: 'negociacao',
        produtosOfertados: ['passagem_aerea', 'seguro_viagem'],
        observacao: 'Cliente pediu retorno amanhã',
      }),
    ]);
    const [oportunidade] = oportunidades;

    expect(oportunidade.cotacaoMaisRecente.leadStatus).toBe('negociacao');
    expect(oportunidade.produtosOfertados).toEqual(['passagem_aerea', 'seguro_viagem']);
    expect(oportunidade.observacao).toBe('Cliente pediu retorno amanhã');
    expect(montarCamposPesquisaOportunidade(oportunidade)).toEqual(
      expect.arrayContaining([
        'negociacao',
        'passagem_aerea',
        'seguro_viagem',
        'Cliente pediu retorno amanhã',
      ])
    );
  });

  it('mantém cotações internas dentro da cartela agrupada por cliente', () => {
    const oportunidades = agruparCotacoesEmOportunidades([
      criarCotacao('ida', { clienteId: 'cliente-1', origem: 'MCZ', destino: 'GRU' }),
      criarCotacao('volta', { clienteId: 'cliente-1', origem: 'GRU', destino: 'MCZ' }),
    ]);

    expect(oportunidades).toHaveLength(1);
    expect(oportunidades[0].cotacoes.map((cotacao) => cotacao.id)).toEqual(['ida', 'volta']);
  });

  it('mantém busca por produto, observação e status comercial', () => {
    const oportunidades = agruparCotacoesEmOportunidades([
      criarCotacao('1', {
        produtosOfertados: ['cruzeiro'],
        observacao: 'Interesse em cabine externa',
        leadStatus: 'aguardando_cliente',
      }),
    ]);

    expect(filterBySearch(oportunidades, 'cruzeiro', montarCamposPesquisaOportunidade))
      .toHaveLength(1);
    expect(filterBySearch(oportunidades, 'cabine externa', montarCamposPesquisaOportunidade))
      .toHaveLength(1);
    expect(filterBySearch(oportunidades, 'aguardando_cliente', montarCamposPesquisaOportunidade))
      .toHaveLength(1);
  });

  it('exibe orientação para editar status, produtos e observações no Histórico', () => {
    expect(TEXTO_ORIENTATIVO_LEADS_LEITURA_COMERCIAL).toBe(
      'Leads é uma visão de acompanhamento por cliente. Para alterar status, produtos ou observações de uma cotação, use o Histórico.'
    );
  });
});

describe('edição segura de telefone em leads', () => {
  it('monta payload restrito com telefone formatado e normalizado', () => {
    expect(montarPayloadTelefoneCotacao('(82) 98888-2222')).toEqual({
      telefone: '(82) 98888-2222',
      telefoneNormalizado: '82988882222',
    });
  });

  it('monta ambos os campos vazios para telefone vazio', () => {
    expect(montarPayloadTelefoneCotacao('')).toEqual({
      telefone: '',
      telefoneNormalizado: '',
    });
  });

  it('persiste usando somente o ID explícito e não atualiza cliente', async () => {
    const atualizar = vi.fn().mockResolvedValue(undefined);

    await persistirTelefoneCotacao('cotacao-2', '(82) 98888-2222', atualizar);

    expect(atualizar).toHaveBeenCalledWith('cotacao-2', {
      telefone: '(82) 98888-2222',
      telefoneNormalizado: '82988882222',
    });
    expect(clientesService.atualizarCliente).not.toHaveBeenCalled();
  });

  it('altera somente a cotação selecionada, preservando homônimos e telefone igual', () => {
    const selecionada = criarCotacao('1');
    const homonima = criarCotacao('2');
    const resultado = atualizarTelefoneCotacaoPorId(
      [selecionada, homonima],
      '1',
      '(82) 97777-3333'
    );

    expect(resultado[0].telefone).toBe('(82) 97777-3333');
    expect(resultado[1]).toBe(homonima);
  });

  it('adiciona telefone normalizado a documento legado', () => {
    const legado = criarCotacao('legado', {
      telefone: undefined,
      telefoneNormalizado: undefined,
    });
    const [atualizado] = atualizarTelefoneCotacaoPorId(
      [legado],
      'legado',
      '(82) 96666-4444'
    );

    expect(atualizado).toMatchObject({
      telefone: '(82) 96666-4444',
      telefoneNormalizado: '82966664444',
    });
  });

  it('propaga falha sem produzir uma nova lista local', async () => {
    const atualizar = vi.fn().mockRejectedValue(new Error('sem permissão'));
    await expect(
      persistirTelefoneCotacao('1', '999', atualizar)
    ).rejects.toThrow('sem permissão');
  });

  it('aceita resposta apenas da mesma identidade de sessão', () => {
    const sessaoA1 = { userId: 'A', geracao: 1 };
    expect(identidadeSessaoLeadsCorresponde(sessaoA1, sessaoA1)).toBe(true);
    expect(identidadeSessaoLeadsCorresponde(
      { userId: 'B', geracao: 2 },
      sessaoA1
    )).toBe(false);
    expect(identidadeSessaoLeadsCorresponde(
      { userId: 'A', geracao: 3 },
      sessaoA1
    )).toBe(false);
  });

  it('invalida logout, troca A → B e retorno A → B → A', () => {
    const inicial = { userId: undefined, geracao: 0 };
    const sessaoA1 = avancarIdentidadeSessaoLeads(inicial, 'A');
    const logout = avancarIdentidadeSessaoLeads(sessaoA1, undefined);
    const sessaoB = avancarIdentidadeSessaoLeads(logout, 'B');
    const saidaB = avancarIdentidadeSessaoLeads(sessaoB, undefined);
    const sessaoA2 = avancarIdentidadeSessaoLeads(saidaB, 'A');

    expect(identidadeSessaoLeadsCorresponde(logout, sessaoA1)).toBe(false);
    expect(identidadeSessaoLeadsCorresponde(sessaoB, sessaoA1)).toBe(false);
    expect(identidadeSessaoLeadsCorresponde(sessaoA2, sessaoA1)).toBe(false);
    expect(identidadeSessaoLeadsCorresponde(sessaoA2, sessaoA2)).toBe(true);
  });

  it('bloqueia ação e submit antes da instalação da sessão renderizada', () => {
    const usuarioA = { uid: 'A' };
    const usuarioB = { uid: 'B' };
    const identidadeA = { userId: 'A', geracao: 1 };
    const sessaoA = { identidade: identidadeA, usuario: usuarioA };
    const cotacaoB = criarCotacao('B-1', { ownerId: 'B' });

    expect(sessaoLeadsProntaParaInteracao(
      usuarioB,
      sessaoA,
      identidadeA,
      identidadeA
    )).toBe(false);
    expect(podeIniciarEdicaoTelefone(
      cotacaoB,
      usuarioB,
      sessaoA,
      identidadeA,
      identidadeA
    )).toBe(false);
  });

  it('bloqueia A2 antes do effect e aceita somente depois da nova instalação', () => {
    const usuarioA1 = { uid: 'A' };
    const usuarioB = { uid: 'B' };
    const usuarioA2 = { uid: 'A' };
    const identidadeA1 = { userId: 'A', geracao: 1 };
    const identidadeB = { userId: 'B', geracao: 3 };
    const identidadeA2 = { userId: 'A', geracao: 5 };
    const sessaoA1 = { identidade: identidadeA1, usuario: usuarioA1 };
    const sessaoB = { identidade: identidadeB, usuario: usuarioB };
    const sessaoA2 = { identidade: identidadeA2, usuario: usuarioA2 };
    const cotacaoA = criarCotacao('A-1', { ownerId: 'A' });

    expect(sessaoLeadsProntaParaInteracao(
      usuarioA2,
      sessaoB,
      identidadeB,
      identidadeB
    )).toBe(false);
    expect(podeIniciarEdicaoTelefone(
      cotacaoA,
      usuarioA2,
      sessaoA1,
      identidadeA1,
      identidadeA1
    )).toBe(false);
    expect(podeIniciarEdicaoTelefone(
      cotacaoA,
      usuarioA2,
      sessaoA2,
      identidadeA2,
      identidadeA2
    )).toBe(true);
  });

  it('não inicia persistência quando a sessão ainda não está pronta', async () => {
    const atualizar = vi.fn();
    const usuarioB = { uid: 'B' };
    const sessaoA = {
      identidade: { userId: 'A', geracao: 1 },
      usuario: { uid: 'A' },
    };
    const cotacaoB = criarCotacao('B-1', { ownerId: 'B' });

    if (podeIniciarEdicaoTelefone(
      cotacaoB,
      usuarioB,
      sessaoA,
      sessaoA.identidade,
      sessaoA.identidade
    )) {
      await persistirTelefoneCotacao(cotacaoB.id, '999', atualizar);
    }

    expect(atualizar).not.toHaveBeenCalled();
  });

});

describe('reagrupamento após edição', () => {
  it('editar telefone preserva acompanhamentoId e a identidade materializada', () => {
    const vinculada = criarCotacao('1', {
      acompanhamentoId: 'acompanhamento-1',
    });
    const [atualizada] = atualizarTelefoneCotacaoPorId(
      [vinculada],
      '1',
      '(82) 97777-3333'
    );

    expect(atualizada.acompanhamentoId).toBe('acompanhamento-1');
    expect(montarChaveOportunidade(atualizada)).toBe(
      montarChaveOportunidade(vinculada)
    );
  });

  it('divide um grupo sem alterar a quantidade total de cotações', () => {
    const cotacoes = [criarCotacao('1'), criarCotacao('2')];
    const atualizadas = atualizarTelefoneCotacaoPorId(cotacoes, '1', '82977773333');
    const oportunidades = agruparCotacoesEmOportunidades(atualizadas);

    expect(oportunidades).toHaveLength(2);
    expect(oportunidades.flatMap((item) => item.cotacoes)).toHaveLength(2);
  });

  it('une a cotação a grupo compatível com outro telefone', () => {
    const cotacoes = [
      criarCotacao('1'),
      criarCotacao('2', {
        telefone: '(82) 97777-3333',
        telefoneNormalizado: '82977773333',
      }),
    ];
    const atualizadas = atualizarTelefoneCotacaoPorId(
      cotacoes,
      '1',
      '(82) 97777-3333'
    );

    expect(agruparCotacoesEmOportunidades(atualizadas)).toHaveLength(1);
  });

  it('troca a representante quando a mais recente sai do grupo', () => {
    const antiga = criarCotacao('antiga');
    const recente = criarCotacao('recente', {
      dataRegistro: '2026-06-30T10:00:00.000Z',
    });
    const atualizadas = atualizarTelefoneCotacaoPorId(
      [antiga, recente],
      'recente',
      '82977773333'
    );
    const grupoOriginal = agruparCotacoesEmOportunidades(atualizadas)
      .find((item) => item.cotacoes.some((cotacao) => cotacao.id === 'antiga'));

    expect(grupoOriginal?.cotacaoMaisRecente.id).toBe('antiga');
  });

  it('pesquisa o novo telefone e mantém o antigo apenas na cotação não alterada', () => {
    const cotacoes = [criarCotacao('editada'), criarCotacao('preservada')];
    const atualizadas = atualizarTelefoneCotacaoPorId(
      cotacoes,
      'editada',
      '(82) 97777-3333'
    );
    const oportunidades = agruparCotacoesEmOportunidades(atualizadas);
    const resultadoNovo = filterBySearch(
      oportunidades,
      '82977773333',
      montarCamposPesquisaOportunidade
    );
    const resultadoAntigo = filterBySearch(
      oportunidades,
      '82999991111',
      montarCamposPesquisaOportunidade
    );

    expect(resultadoNovo.flatMap((item) => item.cotacoes).map((item) => item.id))
      .toEqual(['editada']);
    expect(resultadoAntigo.flatMap((item) => item.cotacoes).map((item) => item.id))
      .toEqual(['preservada']);
  });
});

describe('barreira única de sessão para mutações', () => {
  const usuarioA = { uid: 'A' };
  const usuarioB = { uid: 'B' };
  const identidadeA1 = { userId: 'A', geracao: 1 };
  const identidadeB = { userId: 'B', geracao: 3 };
  const identidadeA2 = { userId: 'A', geracao: 5 };
  const sessaoA1 = { usuario: usuarioA, identidade: identidadeA1 };
  const cotacaoA = criarCotacao('A-1', { ownerId: 'A' });

  it('exige geração instalada igual à identidade atual', () => {
    expect(sessaoLeadsProntaParaInteracao(
      usuarioA,
      sessaoA1,
      identidadeA2,
      identidadeA2
    )).toBe(false);
  });

  it('mesmo userId com geração diferente não está pronto', () => {
    expect(sessaoPodeMutarLeads({
      userAtual: usuarioA,
      sessaoInstalada: sessaoA1,
      identidadePublicada: { userId: 'A', geracao: 2 },
      identidadeRefAtual: identidadeA1,
      ownerId: 'A',
    })).toBe(false);
  });

  it('mesma referência de usuário não contorna geração diferente', () => {
    const sessaoA2 = { usuario: usuarioA, identidade: identidadeA2 };

    expect(sessaoPodeMutarLeads({
      userAtual: usuarioA,
      sessaoInstalada: sessaoA2,
      identidadePublicada: identidadeA1,
      identidadeRefAtual: identidadeA2,
      ownerId: 'A',
    })).toBe(false);
  });

  it('sessão instalada válida permite mutação owner-only', () => {
    expect(sessaoPodeMutarLeads({
      userAtual: usuarioA,
      sessaoInstalada: sessaoA1,
      identidadePublicada: identidadeA1,
      identidadeRefAtual: identidadeA1,
      identidadeCapturada: identidadeA1,
      ownerId: 'A',
      cotacaoAindaValida: true,
    })).toBe(true);
  });

  it('logout e A → B bloqueiam todas as mutações', () => {
    expect(sessaoPodeMutarLeads({
      userAtual: undefined,
      sessaoInstalada: sessaoA1,
      identidadePublicada: identidadeA1,
      identidadeRefAtual: identidadeA1,
      ownerId: 'A',
    })).toBe(false);
    expect(sessaoPodeMutarLeads({
      userAtual: usuarioB,
      sessaoInstalada: sessaoA1,
      identidadePublicada: identidadeB,
      identidadeRefAtual: identidadeB,
      ownerId: 'A',
    })).toBe(false);
  });

  it('A1 → B → A2 com objetos diferentes rejeita A1 e libera A2 instalada', () => {
    const usuarioA2 = { uid: 'A' };
    const sessaoA2 = { usuario: usuarioA2, identidade: identidadeA2 };

    expect(sessaoPodeMutarLeads({
      userAtual: usuarioA2,
      sessaoInstalada: sessaoA2,
      identidadePublicada: identidadeA2,
      identidadeRefAtual: identidadeA2,
      identidadeCapturada: identidadeA1,
      ownerId: 'A',
    })).toBe(false);
    expect(sessaoPodeMutarLeads({
      userAtual: usuarioA2,
      sessaoInstalada: sessaoA2,
      identidadePublicada: identidadeA2,
      identidadeRefAtual: identidadeA2,
      identidadeCapturada: identidadeA2,
      ownerId: 'A',
    })).toBe(true);
  });

  it('A1 → B → A2 reutilizando objeto A ainda depende da geração', () => {
    const sessaoA2 = { usuario: usuarioA, identidade: identidadeA2 };

    expect(sessaoPodeMutarLeads({
      userAtual: usuarioA,
      sessaoInstalada: sessaoA2,
      identidadePublicada: identidadeA2,
      identidadeRefAtual: identidadeA2,
      identidadeCapturada: identidadeA1,
      ownerId: 'A',
    })).toBe(false);
  });

  it('conclusão entre render e cleanup é rejeitada pelo usuário renderizado', () => {
    expect(sessaoPodeMutarLeads({
      userAtual: usuarioB,
      sessaoInstalada: sessaoA1,
      identidadePublicada: identidadeA1,
      identidadeRefAtual: identidadeA1,
      identidadeCapturada: identidadeA1,
      ownerId: 'A',
    })).toBe(false);
  });

  it('bloqueia owner incompatível e cotação removida da sessão', () => {
    expect(sessaoPodeMutarLeads({
      userAtual: usuarioA,
      sessaoInstalada: sessaoA1,
      identidadePublicada: identidadeA1,
      identidadeRefAtual: identidadeA1,
      ownerId: 'B',
    })).toBe(false);
    expect(sessaoPodeMutarLeads({
      userAtual: usuarioA,
      sessaoInstalada: sessaoA1,
      identidadePublicada: identidadeA1,
      identidadeRefAtual: identidadeA1,
      ownerId: 'A',
      cotacaoAindaValida: false,
    })).toBe(false);
  });

  it('operação antiga não altera lista, modal ou loading da sessão nova', () => {
    const sessaoA2 = { usuario: usuarioA, identidade: identidadeA2 };
    const estadoNovo = {
      cotacoes: [cotacaoA],
      modalAberto: true,
      loading: true,
    };
    let estadoAtual = estadoNovo;

    if (sessaoPodeMutarLeads({
      userAtual: usuarioA,
      sessaoInstalada: sessaoA2,
      identidadePublicada: identidadeA2,
      identidadeRefAtual: identidadeA2,
      identidadeCapturada: identidadeA1,
      ownerId: 'A',
    })) {
      estadoAtual = { cotacoes: [], modalAberto: false, loading: false };
    }

    expect(estadoAtual).toBe(estadoNovo);
  });
});

describe('prontidão visual com identidade publicada e ref separadas', () => {
  const usuarioA = { uid: 'A' };
  const identidadeA1 = { userId: 'A', geracao: 1 };
  const identidadeA2 = { userId: 'A', geracao: 3 };
  const sessaoA1 = { usuario: usuarioA, identidade: identidadeA1 };
  const sessaoA2 = { usuario: usuarioA, identidade: identidadeA2 };
  const cotacaoA = criarCotacao('A-visual', { ownerId: 'A', leadStatus: 'fechado' });

  it('fica pronta somente quando instalada, publicada e ref são iguais', () => {
    expect(sessaoLeadsProntaParaInteracao(
      usuarioA,
      sessaoA1,
      identidadeA1,
      identidadeA1
    )).toBe(true);
  });

  it('bloqueia quando publicada coincide com instalada, mas a ref diverge', () => {
    expect(sessaoLeadsProntaParaInteracao(
      usuarioA,
      sessaoA1,
      identidadeA1,
      identidadeA2
    )).toBe(false);
  });

  it('bloqueia quando a ref coincide com instalada, mas a publicada diverge', () => {
    expect(sessaoLeadsProntaParaInteracao(
      usuarioA,
      sessaoA1,
      identidadeA2,
      identidadeA1
    )).toBe(false);
  });

  it('mesmo UID ou mesma referência de usuário não compensam geração divergente', () => {
    expect(sessaoPodeMutarLeads({
      userAtual: usuarioA,
      sessaoInstalada: sessaoA1,
      identidadePublicada: { userId: 'A', geracao: 2 },
      identidadeRefAtual: identidadeA1,
      ownerId: 'A',
    })).toBe(false);
    expect(sessaoPodeMutarLeads({
      userAtual: usuarioA,
      sessaoInstalada: sessaoA1,
      identidadePublicada: identidadeA1,
      identidadeRefAtual: { userId: 'A', geracao: 2 },
      ownerId: 'A',
    })).toBe(false);
  });

  it('janela layout → publicação bloqueia telefone, comercial e conversão', () => {
    const publicadaAindaA1 = identidadeA1;
    const refJaA2 = identidadeA2;

    expect(podeIniciarEdicaoTelefone(
      cotacaoA,
      usuarioA,
      sessaoA1,
      publicadaAindaA1,
      refJaA2
    )).toBe(false);
    expect(sessaoPodeMutarLeads({
      userAtual: usuarioA,
      sessaoInstalada: sessaoA1,
      identidadePublicada: publicadaAindaA1,
      identidadeRefAtual: refJaA2,
      ownerId: 'A',
    })).toBe(false);
  });

  it('A2 volta a funcionar somente depois de publicada, inclusive com objeto reutilizado', () => {
    expect(podeIniciarEdicaoTelefone(
      cotacaoA,
      usuarioA,
      sessaoA2,
      identidadeA2,
      identidadeA2
    )).toBe(true);
  });
});

describe('barreira residual sem edição comercial direta', () => {
  it('seleção comercial residual de outro owner é bloqueada inclusive para admin', () => {
    const admin = { uid: 'admin' };
    const identidade = { userId: 'admin', geracao: 8 };
    const sessao = { usuario: admin, identidade };

    expect(sessaoPodeMutarLeads({
      userAtual: admin,
      sessaoInstalada: sessao,
      identidadePublicada: identidade,
      identidadeRefAtual: identidade,
      ownerId: 'A',
    })).toBe(false);
  });
});
