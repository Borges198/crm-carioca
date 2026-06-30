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
  montarPayloadEdicaoComercial,
  montarPayloadEdicaoCotacao,
  podeEditarCotacaoCompleta,
  persistirEdicaoCotacao,
  type CamposEdicaoCotacao,
} from './page';

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
    expect(montarPayloadEdicaoCotacao(camposBase)).toMatchObject({
      telefone: '(82) 99999-9999',
      telefoneNormalizado: '82999999999',
    });
  });

  it('persiste telefone vazio com normalização vazia', () => {
    expect(montarPayloadEdicaoCotacao({ ...camposBase, telefone: '' })).toMatchObject({
      telefone: '',
      telefoneNormalizado: '',
    });
  });

  it('envia somente o ID selecionado e o payload completo do modal', async () => {
    const atualizar = vi.fn().mockResolvedValue(undefined);

    await persistirEdicaoCotacao('cotacao-1', camposBase, atualizar);

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
    const payload = montarPayloadEdicaoCotacao(camposBase);

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
    const payload = montarPayloadEdicaoCotacao(camposBase);

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
      persistirEdicaoCotacao('cotacao-1', camposBase, atualizar)
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
});
