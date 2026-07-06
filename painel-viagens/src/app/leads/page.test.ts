import { describe, expect, it, vi } from 'vitest';
import type { Cotacao } from '../../types';
import { filterBySearch } from '../../utils/searchUtils';

const clientesService = vi.hoisted(() => ({
  atualizarCliente: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  Timestamp: class Timestamp {},
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

import {
  avancarIdentidadeSessaoLeads,
  agruparCotacoesEmOportunidades,
  atualizarTelefoneCotacaoPorId,
  atualizarCotacaoComercialPorId,
  identidadeSessaoLeadsCorresponde,
  montarCamposPesquisaOportunidade,
  montarChaveOportunidade,
  montarDadosViagemCotacao,
  montarPayloadTelefoneCotacao,
  montarPayloadEdicaoComercial,
  podeIniciarEdicaoTelefone,
  persistirTelefoneCotacao,
  sessaoPodeMutarLeads,
  sessaoLeadsProntaParaInteracao,
} from './page';

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

describe('mutação comercial protegida', () => {
  it('preserva o payload comercial existente', () => {
    expect(montarPayloadEdicaoComercial(
      'negociacao',
      ['passagem_aerea'],
      ' Retornar amanhã '
    )).toEqual({
      leadStatus: 'negociacao',
      produtosOfertados: ['passagem_aerea'],
      observacao: 'Retornar amanhã',
    });
  });

  it('atualiza comercialmente somente a cotação selecionada', () => {
    const primeira = criarCotacao('1');
    const segunda = criarCotacao('2');
    const resultado = atualizarCotacaoComercialPorId(
      [primeira, segunda],
      '1',
      montarPayloadEdicaoComercial('fechado', [], 'Concluído')
    );

    expect(resultado[0].leadStatus).toBe('fechado');
    expect(resultado[1]).toBe(segunda);
  });

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
