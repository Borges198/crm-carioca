import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/cotacoesService', () => ({
  atualizarCotacao: vi.fn(),
}));
import type { Cotacao, ItinerarioCotacao } from '../../types';
import {
  CAMPOS_OPERACIONAIS_PROTEGIDOS,
  cotacaoPossuiItinerarioProtegido,
  montarPayloadEdicaoCotacao,
  persistirEdicaoCotacao,
  protegerPayloadEdicaoCotacao,
  type CamposEdicaoCotacao,
} from './historicoUtils';

const itinerarioSomenteIda: ItinerarioCotacao = {
  versao: 1,
  ida: {
    tipo: 'ida',
    pernas: [{
      origem: 'MCZ',
      destino: 'GRU',
      companhia: 'Azul',
      dataSaida: '2026-07-01',
      horaSaida: '10:00',
      horaChegada: '12:40',
    }],
  },
};

const itinerarioIdaEVolta: ItinerarioCotacao = {
  ...itinerarioSomenteIda,
  volta: {
    tipo: 'volta',
    pernas: [{
      origem: 'GRU',
      destino: 'MCZ',
      companhia: 'GOL',
      dataSaida: '2026-07-08',
      horaSaida: '18:00',
      horaChegada: '20:40',
    }],
  },
};

const cotacaoLegada: Cotacao = {
  id: 'cotacao-legada',
  cliente: 'Maria Silva',
  telefone: '(82) 98888-1111',
  origem: 'MCZ',
  destino: 'GRU',
  companhia: 'Azul',
  valorTotal: 1500,
  dataIda: '01-07-2026',
  dataRegistro: '2026-06-29',
};

const camposEditados: CamposEdicaoCotacao = {
  cliente: 'Maria Souza',
  telefone: '(82) 99999-9999',
  origem: 'AJU',
  destino: 'CGH',
  companhia: 'Latam',
  valorTotal: 1800,
  dataIda: '02-07-2026',
};

const alteracoesOperacionais: Partial<Cotacao> = {
  tipoVoo: 'ida_volta',
  origem: 'AJU',
  destino: 'CGH',
  origemIda: 'AJU',
  destinoIda: 'CGH',
  dataIda: '02-07-2026',
  horaSaidaIda: '11:00',
  horaChegadaIda: '13:00',
  duracaoIda: '2h',
  paradasIda: 'Direto',
  origemVolta: 'CGH',
  destinoVolta: 'AJU',
  dataVolta: '09-07-2026',
  horaSaidaVolta: '14:00',
  horaChegadaVolta: '16:00',
  duracaoVolta: '2h',
  paradasVolta: 'Direto',
};

describe('proteção do itinerário estruturado no Histórico', () => {
  it('mantém toda a edição operacional anterior para cotação legada', () => {
    expect(protegerPayloadEdicaoCotacao(cotacaoLegada, alteracoesOperacionais))
      .toEqual(alteracoesOperacionais);
    expect(montarPayloadEdicaoCotacao(cotacaoLegada, camposEditados)).toMatchObject({
      origem: 'AJU',
      destino: 'CGH',
      dataIda: '02-07-2026',
    });
  });

  it.each([
    ['somente ida', itinerarioSomenteIda],
    ['ida e volta', itinerarioIdaEVolta],
  ])('bloqueia origem, destino, datas, horários, duração, paradas e rotas em %s', (_, itinerario) => {
    const cotacao = { ...cotacaoLegada, itinerario };
    const payload = protegerPayloadEdicaoCotacao(cotacao, alteracoesOperacionais);

    for (const campo of CAMPOS_OPERACIONAIS_PROTEGIDOS) {
      expect(payload).not.toHaveProperty(campo);
    }
  });

  it('remove campos operacionais por construção do payload, independentemente da UI', async () => {
    const cotacao = { ...cotacaoLegada, itinerario: itinerarioSomenteIda };
    const atualizar = vi.fn().mockResolvedValue(undefined);

    const payload = await persistirEdicaoCotacao(
      cotacao.id,
      cotacao,
      camposEditados,
      atualizar
    );

    expect(payload).not.toHaveProperty('origem');
    expect(payload).not.toHaveProperty('destino');
    expect(payload).not.toHaveProperty('dataIda');
    expect(atualizar).toHaveBeenCalledWith(cotacao.id, payload);
  });

  it('nunca envia itinerario nem o substitui, remove ou reconstrói', () => {
    const cotacao = { ...cotacaoLegada, itinerario: itinerarioIdaEVolta };
    const itinerarioOriginal = structuredClone(cotacao.itinerario);
    const payload = protegerPayloadEdicaoCotacao(cotacao, {
      itinerario: itinerarioSomenteIda,
      origem: 'AJU',
      cliente: 'Maria Souza',
    });
    const resultadoLocal = { ...cotacao, ...payload };

    expect(payload).not.toHaveProperty('itinerario');
    expect(resultadoLocal.itinerario).toBe(cotacao.itinerario);
    expect(cotacao.itinerario).toEqual(itinerarioOriginal);
  });

  it('preserva cliente, telefone, valor e companhia comercial no payload seguro', () => {
    const cotacao = { ...cotacaoLegada, itinerario: itinerarioSomenteIda };

    expect(montarPayloadEdicaoCotacao(cotacao, camposEditados)).toEqual({
      cliente: 'Maria Souza',
      telefone: '(82) 99999-9999',
      telefoneNormalizado: '82999999999',
      companhia: 'Latam',
      valorTotal: 1800,
    });
    expect(protegerPayloadEdicaoCotacao(cotacao, {
      companhia: 'Latam',
      companhiaIda: 'Azul',
      companhiaVolta: 'GOL',
    })).toEqual({
      companhia: 'Latam',
      companhiaIda: 'Azul',
      companhiaVolta: 'GOL',
    });
  });

  it('preserva status, produtos e observação como alterações comerciais', () => {
    const cotacao = { ...cotacaoLegada, itinerario: itinerarioSomenteIda };
    const comerciais: Partial<Cotacao> = {
      leadStatus: 'negociacao',
      produtosOfertados: ['passagem_aerea'],
      observacao: 'Retornar amanhã',
    };

    expect(protegerPayloadEdicaoCotacao(cotacao, comerciais)).toEqual(comerciais);
  });

  it('não muta a cotação nem o objeto de alterações solicitado', () => {
    const cotacao = { ...cotacaoLegada, itinerario: itinerarioIdaEVolta };
    const cotacaoAntes = structuredClone(cotacao);
    const alteracoes = { ...alteracoesOperacionais, companhia: 'GOL' };
    const alteracoesAntes = structuredClone(alteracoes);

    protegerPayloadEdicaoCotacao(cotacao, alteracoes);

    expect(cotacao).toEqual(cotacaoAntes);
    expect(alteracoes).toEqual(alteracoesAntes);
  });

  it.each([null, 'inesperado', { versao: 99 }])(
    'trata itinerario presente e malformado (%j) como potencialmente estruturado',
    (itinerarioInesperado) => {
      const cotacao = {
        ...cotacaoLegada,
        itinerario: itinerarioInesperado,
      } as unknown as Cotacao;

      expect(cotacaoPossuiItinerarioProtegido(cotacao)).toBe(true);
      expect(protegerPayloadEdicaoCotacao(cotacao, alteracoesOperacionais)).toEqual({});
    }
  );

  it('não considera cotação antiga sem a propriedade itinerario como estruturada', () => {
    expect(cotacaoPossuiItinerarioProtegido(cotacaoLegada)).toBe(false);
  });

  it('mantém a proteção visível e desabilita os três campos operacionais expostos na UI', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
    const disabled = 'disabled={cotacaoPossuiItinerarioProtegido(selecaoEdicao.cotacao)}';

    expect(source).toContain('Itinerário estruturado — rota e horários protegidos');
    expect(source.match(new RegExp(disabled.replace(/[{}().]/g, '\\$&'), 'g')))
      .toHaveLength(3);
  });
});
