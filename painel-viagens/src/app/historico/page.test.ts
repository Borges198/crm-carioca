import { describe, expect, it, vi } from 'vitest';
import type { Cotacao } from '../../types';

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
  excluirCotacao: vi.fn(),
  listarCotacoesDaAgencia: vi.fn(),
  listarCotacoesDoUsuario: vi.fn(),
}));

import {
  atualizarCotacaoLocalPorId,
  criarCamposEdicaoCotacao,
  criarSelecaoCotacao,
  montarPayloadEdicaoComercial,
  montarPayloadEdicaoCotacao,
  operacaoHistoricoPertenceASessao,
  podeEditarCotacaoCompleta,
  persistirEdicaoCotacao,
  type CamposEdicaoCotacao,
} from './historicoUtils';

const cotacaoBase: Cotacao = {
  id: 'cotacao-1',
  cliente: 'Maria Silva',
  telefone: '(82) 98888-1111',
  telefoneNormalizado: '82988881111',
  origem: 'MCZ',
  destino: 'GRU',
  companhia: 'Azul',
  valorTotal: 1500,
  dataIda: '01-07-2026',
  dataRegistro: '2026-06-29',
};

const camposBase: CamposEdicaoCotacao = {
  cliente: 'Maria Silva',
  telefone: '(82) 99999-9999',
  origem: 'MCZ',
  destino: 'GRU',
  companhia: 'Azul',
  valorTotal: 1700,
  dataIda: '02-07-2026',
};

describe('edição segura do telefone no histórico', () => {
  it('inicializa o telefone atual preservando a formatação visual', () => {
    expect(criarCamposEdicaoCotacao(cotacaoBase).telefone).toBe('(82) 98888-1111');
  });

  it('inicializa telefone ausente como vazio', () => {
    expect(criarCamposEdicaoCotacao({ ...cotacaoBase, telefone: undefined }).telefone).toBe('');
  });

  it('preserva o telefone formatado e normaliza somente para o campo derivado', () => {
    expect(montarPayloadEdicaoCotacao(cotacaoBase, camposBase)).toMatchObject({
      telefone: '(82) 99999-9999',
      telefoneNormalizado: '82999999999',
    });
  });

  it('persiste telefone vazio com normalização vazia', () => {
    expect(montarPayloadEdicaoCotacao(cotacaoBase, { ...camposBase, telefone: '' })).toMatchObject({
      telefone: '',
      telefoneNormalizado: '',
    });
  });

  it('envia somente o ID selecionado e o payload completo do modal', async () => {
    const atualizar = vi.fn().mockResolvedValue(undefined);

    await persistirEdicaoCotacao('cotacao-1', cotacaoBase, camposBase, atualizar);

    expect(atualizar).toHaveBeenCalledOnce();
    expect(atualizar).toHaveBeenCalledWith('cotacao-1', {
      cliente: 'Maria Silva',
      telefone: '(82) 99999-9999',
      telefoneNormalizado: '82999999999',
      origem: 'MCZ',
      destino: 'GRU',
      companhia: 'Azul',
      valorTotal: 1700,
      dataIda: '02-07-2026',
    });
    expect(clientesService.atualizarCliente).not.toHaveBeenCalled();
  });

  it('não inclui associação ou campos comerciais no payload', () => {
    const payload = montarPayloadEdicaoCotacao(cotacaoBase, camposBase);

    expect(payload).not.toHaveProperty('clienteId');
    expect(payload).not.toHaveProperty('leadStatus');
    expect(payload).not.toHaveProperty('produtosOfertados');
    expect(payload).not.toHaveProperty('observacao');
  });

  it('atualiza localmente somente a cotação selecionada e preserva homônimo', () => {
    const homonima: Cotacao = {
      ...cotacaoBase,
      id: 'cotacao-2',
      telefone: '(82) 97777-2222',
    };
    const payload = montarPayloadEdicaoCotacao(cotacaoBase, camposBase);

    const resultado = atualizarCotacaoLocalPorId(
      [cotacaoBase, homonima],
      'cotacao-1',
      payload
    );

    expect(resultado[0].telefone).toBe('(82) 99999-9999');
    expect(resultado[1]).toBe(homonima);
    expect(resultado[1].telefone).toBe('(82) 97777-2222');
  });

  it('não produz alteração local quando a persistência falha', async () => {
    const atualizar = vi.fn().mockRejectedValue(new Error('sem permissão'));
    const cotacoesAntes = [cotacaoBase];

    await expect(
      persistirEdicaoCotacao('cotacao-1', cotacaoBase, camposBase, atualizar)
    ).rejects.toThrow('sem permissão');

    expect(cotacoesAntes).toEqual([cotacaoBase]);
  });

  it('mantém telefone fora do modal comercial', () => {
    expect(montarPayloadEdicaoComercial('negociacao', ['passagem_aerea'], ' Retornar ')).toEqual({
      leadStatus: 'negociacao',
      produtosOfertados: ['passagem_aerea'],
      observacao: 'Retornar',
    });
  });

  it('impede edição completa para supervisor na visão da equipe', () => {
    expect(podeEditarCotacaoCompleta('supervisor', true)).toBe(false);
  });

  it('preserva edição completa para supervisor owner, agent e admin', () => {
    expect(podeEditarCotacaoCompleta('supervisor', false)).toBe(true);
    expect(podeEditarCotacaoCompleta('agent', false)).toBe(true);
    expect(podeEditarCotacaoCompleta('admin', true)).toBe(true);
  });

  it('bloqueia seleção residual após troca direta A para B, inclusive admin da agência', () => {
    const sessaoA = {
      userId: 'usuario-a',
      geracao: 1,
      visao: 'minhas' as const,
      agencyId: 'agencia-1',
      role: 'admin',
    };
    const selecaoA = criarSelecaoCotacao(cotacaoBase, sessaoA, 'completo');

    expect(operacaoHistoricoPertenceASessao(
      { userId: 'usuario-b', geracao: 2, visao: 'equipe', agencyId: 'agencia-1' },
      selecaoA.identidade,
      'usuario-b',
      [cotacaoBase],
      'cotacao-1',
      'admin'
    )).toBe(false);
  });

  it('submit e resultado antigos não persistem nem alteram lista, mensagens ou loading de B', async () => {
    const sessaoA = {
      userId: 'usuario-a',
      geracao: 1,
      visao: 'minhas' as const,
      agencyId: 'agencia-1',
    };
    const selecaoA = criarSelecaoCotacao(cotacaoBase, sessaoA, 'completo');
    const sessaoB = {
      userId: 'usuario-b',
      geracao: 2,
      visao: 'equipe' as const,
      agencyId: 'agencia-1',
    };
    const persistir = vi.fn();
    const estadoB = {
      cotacoes: [{ ...cotacaoBase, id: 'cotacao-b' }],
      sucesso: 'sucesso-b',
      erro: 'erro-b',
      loading: true,
      modalAberto: true,
    };
    let estadoAtual = estadoB;

    if (operacaoHistoricoPertenceASessao(
      sessaoB, selecaoA.identidade, 'usuario-b', [cotacaoBase], 'cotacao-1', 'admin'
    )) {
      await persistir('cotacao-1');
      estadoAtual = {
        cotacoes: [cotacaoBase],
        sucesso: 'sucesso-a',
        erro: '',
        loading: false,
        modalAberto: false,
      };
    }

    expect(persistir).not.toHaveBeenCalled();
    expect(estadoAtual).toBe(estadoB);
  });

  it('rejeita cotação ausente e seleção diferente no conjunto atual', () => {
    const sessao = {
      userId: 'usuario-a',
      geracao: 3,
      visao: 'minhas' as const,
      agencyId: 'agencia-1',
    };
    const selecao = criarSelecaoCotacao(cotacaoBase, sessao, 'completo');

    expect(operacaoHistoricoPertenceASessao(
      sessao, selecao.identidade, 'usuario-a', [], 'cotacao-1', 'agent'
    )).toBe(false);
    expect(operacaoHistoricoPertenceASessao(
      sessao, selecao.identidade, 'usuario-a', [cotacaoBase], 'cotacao-2', 'agent'
    )).toBe(false);
  });

  it('rejeita ownership e agência incompatíveis', () => {
    const minhas = { userId: 'usuario-a', geracao: 3, visao: 'minhas' as const };
    const selecaoMinhas = criarSelecaoCotacao(
      { ...cotacaoBase, ownerId: 'usuario-b' },
      minhas,
      'completo'
    );
    expect(operacaoHistoricoPertenceASessao(
      minhas,
      selecaoMinhas.identidade,
      'usuario-a',
      [{ ...cotacaoBase, ownerId: 'usuario-b' }],
      'cotacao-1',
      'agent'
    )).toBe(false);

    const equipe = {
      userId: 'admin-a',
      geracao: 4,
      visao: 'equipe' as const,
      agencyId: 'agencia-1',
    };
    const cotacaoOutraAgencia = { ...cotacaoBase, agencyId: 'agencia-2' };
    const selecaoEquipe = criarSelecaoCotacao(cotacaoOutraAgencia, equipe, 'completo');
    expect(operacaoHistoricoPertenceASessao(
      equipe,
      selecaoEquipe.identidade,
      'admin-a',
      [cotacaoOutraAgencia],
      'cotacao-1',
      'admin'
    )).toBe(false);
  });

  it('aceita operação atual e atualiza somente a cotação selecionada', () => {
    const sessao = { userId: 'usuario-a', geracao: 3, visao: 'minhas' as const };
    const cotacaoDoUsuario = { ...cotacaoBase, ownerId: 'usuario-a' };
    const selecao = criarSelecaoCotacao(cotacaoDoUsuario, sessao, 'completo');
    expect(operacaoHistoricoPertenceASessao(
      sessao,
      selecao.identidade,
      'usuario-a',
      [cotacaoDoUsuario],
      'cotacao-1',
      'agent'
    )).toBe(true);
  });

  it('captura cotação, identidade, owner e tipo inseparáveis nos dois modais', () => {
    const sessao = {
      userId: 'usuario-a',
      geracao: 8,
      visao: 'minhas' as const,
      agencyId: 'agencia-1',
      role: 'agent',
    };
    const cotacao = { ...cotacaoBase, ownerId: 'usuario-a' };
    const completo = criarSelecaoCotacao(cotacao, sessao, 'completo');
    const comercial = criarSelecaoCotacao(cotacao, sessao, 'comercial');

    expect(completo).toEqual({
      cotacao,
      tipoModal: 'completo',
      identidade: {
        ...sessao,
        cotacaoId: 'cotacao-1',
        ownerId: 'usuario-a',
        operacao: 'editar',
        tipoModal: 'completo',
      },
    });
    expect(comercial.identidade).toMatchObject({
      ...sessao,
      cotacaoId: 'cotacao-1',
      ownerId: 'usuario-a',
      operacao: 'comercial',
      tipoModal: 'comercial',
    });
  });

  it('rejeita modal A1 em A2 com mesmo UID, agência, perfil e referência de usuário', () => {
    const usuarioReutilizado = { uid: 'usuario-a' };
    const sessaoA1 = {
      userId: usuarioReutilizado.uid,
      geracao: 1,
      visao: 'minhas' as const,
      agencyId: 'agencia-1',
      role: 'agent',
    };
    const selecaoA1 = criarSelecaoCotacao(cotacaoBase, sessaoA1, 'comercial');
    const sessaoA2 = { ...sessaoA1, geracao: 3 };

    expect(operacaoHistoricoPertenceASessao(
      sessaoA2,
      selecaoA1.identidade,
      usuarioReutilizado.uid,
      [cotacaoBase],
      selecaoA1.cotacao.id,
      'agent'
    )).toBe(false);
  });

  it('não persiste modal completo ou comercial residual criado em A1', async () => {
    const sessaoA1 = {
      userId: 'usuario-a',
      geracao: 1,
      visao: 'minhas' as const,
      agencyId: 'agencia-1',
      role: 'agent',
    };
    const sessaoA2 = { ...sessaoA1, geracao: 3 };
    const completoA1 = criarSelecaoCotacao(cotacaoBase, sessaoA1, 'completo');
    const comercialA1 = criarSelecaoCotacao(cotacaoBase, sessaoA1, 'comercial');
    const persistirCompleto = vi.fn();
    const persistirComercial = vi.fn();

    if (operacaoHistoricoPertenceASessao(
      sessaoA2, completoA1.identidade, 'usuario-a', [cotacaoBase], cotacaoBase.id, 'agent'
    )) await persistirCompleto();
    if (operacaoHistoricoPertenceASessao(
      sessaoA2, comercialA1.identidade, 'usuario-a', [cotacaoBase], cotacaoBase.id, 'agent'
    )) await persistirComercial();

    expect(persistirCompleto).not.toHaveBeenCalled();
    expect(persistirComercial).not.toHaveBeenCalled();
  });
});
