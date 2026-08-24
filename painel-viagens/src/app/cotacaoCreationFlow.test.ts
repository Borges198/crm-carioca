import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/cotacoesService', () => ({
  criarCotacao: vi.fn(),
}));

import { criarCotacao } from '../services/cotacoesService';
import type { NovaCotacao } from '../types';
import { montarNovaCotacao } from '../utils/cotacaoMapper';
import {
  submeterNovaCotacao,
  type DadosFormularioCotacao,
  type ItinerarioPendente,
} from './cotacaoCreationFlow';

const dadosFormulario: DadosFormularioCotacao = {
  ownerId: 'usuario-1',
  ownerName: 'Agente Um',
  ownerEmail: 'agente@teste.local',
  agencyId: 'agencia-1',
  cliente: 'Maria Silva',
  telefone: '(82) 99999-9999',
  telefoneNormalizado: '82999999999',
  origem: 'MCZ',
  destino: 'GRU',
  origemIda: 'MCZ',
  destinoIda: 'GRU',
  origemVolta: 'GRU',
  destinoVolta: 'MCZ',
  companhia: 'GOL',
  companhiaIda: 'GOL',
  companhiaVolta: 'GOL',
  tipoVoo: 'ida_volta',
  dataIda: '01-10-2026',
  dataVolta: '15-10-2026',
  horaSaidaIda: '06:00',
  horaChegadaIda: '08:00',
  horaSaidaVolta: '18:00',
  horaChegadaVolta: '20:00',
  paradasIda: 'Direto',
  paradasVolta: 'Direto',
  qtdPontos: 62000,
  taxaEmbarque: 269,
  pontosIda: 28000,
  pontosVolta: 34000,
  taxaIda: 34,
  taxaVolta: 235,
  valorIda: 790,
  valorVolta: 1106,
  valorTotal: 1896,
  produtosOfertados: ['passagem_aerea'],
  observacao: '  Cliente prefere voo diurno  ',
  leadStatus: 'negociacao',
};

const itinerarioIdaEVolta = {
  versao: 1,
  ida: {
    tipo: 'ida',
    fonte: 'estruturado',
    duracaoTotal: '5h 40m',
    pernas: [
      {
        origem: ' aju ',
        destino: 'gru',
        companhia: 'Azul',
        dataSaida: '2026-10-04',
        horaSaida: '08:00',
        dataChegada: '2026-10-04',
        horaChegada: '10:20',
      },
      {
        origem: 'GRU',
        destino: 'NVT',
        companhia: 'Latam',
        dataSaida: '2026-10-04',
        horaSaida: '11:15',
        dataChegada: '2026-10-04',
        horaChegada: '13:40',
      },
    ],
  },
  volta: {
    tipo: 'volta',
    fonte: 'estruturado',
    pernas: [{
      origem: 'NVT',
      destino: 'AJU',
      companhia: 'Azul',
      dataSaida: '2026-10-12',
      horaSaida: '14:00',
      dataChegada: '2026-10-12',
      horaChegada: '16:45',
      duracao: '2h 45m',
    }],
  },
} satisfies NonNullable<ItinerarioPendente>;

const itinerarioSomenteIda = {
  versao: 1,
  ida: {
    tipo: 'ida',
    fonte: 'estruturado',
    pernas: [{
      origem: 'AJU',
      destino: 'GRU',
      companhia: 'Azul',
      dataSaida: '2026-09-03',
      horaSaida: '07:10',
      dataChegada: '2026-09-03',
      horaChegada: '09:25',
      duracao: '2h 15m',
    }],
  },
} satisfies NonNullable<ItinerarioPendente>;

const criarMock = vi.mocked(criarCotacao);
const sourcePage = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

function trechoDaPagina(inicio: string, fim: string) {
  return sourcePage.slice(sourcePage.indexOf(inicio), sourcePage.indexOf(fim));
}


function dependencias() {
  return {
    montar: vi.fn(montarNovaCotacao),
    criar: criarMock,
  };
}

beforeEach(() => {
  criarMock.mockReset();
  criarMock.mockResolvedValue(undefined as never);
});

describe('fluxo real de criação com itinerário opcional', () => {
  it('1. mantém a criação legada quando nenhum itinerário é informado', async () => {
    const deps = dependencias();
    const cotacao = await submeterNovaCotacao({ dadosFormulario }, deps);

    expect(cotacao).toMatchObject({
      origem: 'MCZ',
      destino: 'GRU',
      dataIda: '01-10-2026',
      valorTotal: 1896,
    });
  });

  it('2. não adiciona a chave itinerario no caminho legado', async () => {
    const cotacao = await submeterNovaCotacao({ dadosFormulario }, dependencias());

    expect(cotacao).not.toHaveProperty('itinerario');
    expect(criarMock.mock.calls[0][0]).not.toHaveProperty('itinerario');
  });

  it('3. entrega o itinerário explícito ao mapper', async () => {
    const deps = dependencias();

    await submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioIdaEVolta,
    }, deps);

    expect(deps.montar).toHaveBeenCalledWith(expect.objectContaining({
      itinerario: itinerarioIdaEVolta,
    }));
  });

  it('4. inclui o itinerário validado na NovaCotacao', async () => {
    const cotacao = await submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioIdaEVolta,
    }, dependencias());

    expect(cotacao.itinerario).toBeDefined();
    expect(cotacao.itinerario).not.toBe(itinerarioIdaEVolta);
  });

  it('5. envia o itinerário normalizado para criação', async () => {
    await submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioIdaEVolta,
    }, dependencias());

    const enviada = criarMock.mock.calls[0][0];
    expect(enviada.itinerario?.ida.pernas[0]).toMatchObject({
      origem: 'AJU',
      destino: 'GRU',
    });
  });

  it('6. projeta os campos legados da ida de forma coerente', async () => {
    const cotacao = await submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioIdaEVolta,
    }, dependencias());

    expect(cotacao).toMatchObject({
      origem: 'AJU',
      destino: 'NVT',
      origemIda: 'AJU',
      destinoIda: 'NVT',
      dataIda: '04-10-2026',
      horaSaidaIda: '08:00',
      horaChegadaIda: '13:40',
      paradasIda: '1 Parada',
    });
  });

  it('7. projeta os campos legados da volta de forma coerente', async () => {
    const cotacao = await submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioIdaEVolta,
    }, dependencias());

    expect(cotacao).toMatchObject({
      origemVolta: 'NVT',
      destinoVolta: 'AJU',
      dataVolta: '12-10-2026',
      horaSaidaVolta: '14:00',
      horaChegadaVolta: '16:45',
      paradasVolta: 'Direto',
    });
  });

  it('8. remove resíduos da volta em itinerário estruturado somente ida', async () => {
    const cotacao = await submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioSomenteIda,
    }, dependencias());

    for (const campo of [
      'origemVolta', 'destinoVolta', 'dataVolta', 'companhiaVolta',
      'pontosVolta', 'taxaVolta', 'valorVolta', 'horaSaidaVolta',
      'horaChegadaVolta', 'duracaoVolta', 'paradasVolta',
    ]) {
      expect(cotacao).not.toHaveProperty(campo);
    }
  });

  it('9. preserva a companhia comercial', async () => {
    const cotacao = await submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioIdaEVolta,
    }, dependencias());

    expect(cotacao.companhia).toBe('GOL');
    expect(cotacao.companhiaIda).toBe('GOL');
    expect(cotacao.companhiaVolta).toBe('GOL');
  });

  it('10. mantém companhias operacionais somente nas pernas', async () => {
    const cotacao = await submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioIdaEVolta,
    }, dependencias());

    expect(cotacao.itinerario?.ida.pernas.map((perna) => perna.companhia))
      .toEqual(['Azul', 'Latam']);
    expect(cotacao.itinerario?.volta?.pernas[0].companhia).toBe('Azul');
  });

  it('11. preserva todos os campos financeiros', async () => {
    const cotacao = await submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioIdaEVolta,
    }, dependencias());

    expect(cotacao).toMatchObject({
      pontosIda: 28000,
      pontosVolta: 34000,
      taxaIda: 34,
      taxaVolta: 235,
      valorIda: 790,
      valorVolta: 1106,
      valorTotal: 1896,
    });
  });

  it('12. impede criarCotacao quando o itinerário é inválido', async () => {
    const itinerarioInvalido = {
      versao: 1,
      ida: { tipo: 'volta', pernas: [{ origem: 'AJU', destino: 'GRU' }] },
    } as unknown as ItinerarioPendente;

    await expect(submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioInvalido,
    }, dependencias())).rejects.toThrow('itinerario.ida.tipo');
    expect(criarMock).not.toHaveBeenCalled();
  });

  it('13. não tenta fallback legado quando o mapper rejeita', async () => {
    const deps = dependencias();
    const itinerarioInvalido = {
      versao: 1,
      ida: { tipo: 'ida', pernas: [] },
    } as unknown as ItinerarioPendente;

    await expect(submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioInvalido,
    }, deps)).rejects.toThrow();
    expect(deps.montar).toHaveBeenCalledOnce();
    expect(criarMock).not.toHaveBeenCalled();
  });

  it('14. não sinaliza sucesso quando o mapper rejeita', async () => {
    const aoCriar = vi.fn();
    const aoLimparItinerario = vi.fn();

    await expect(submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: { versao: 2 } as unknown as ItinerarioPendente,
      aoCriar,
      aoLimparItinerario,
    }, dependencias())).rejects.toThrow();
    expect(aoCriar).not.toHaveBeenCalled();
    expect(aoLimparItinerario).not.toHaveBeenCalled();
  });

  it('14b. não limpa nem sinaliza sucesso quando o serviço rejeita', async () => {
    const aoCriar = vi.fn();
    const aoLimparItinerario = vi.fn();
    criarMock.mockRejectedValueOnce(new Error('Firestore indisponível'));

    await expect(submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioIdaEVolta,
      aoCriar,
      aoLimparItinerario,
    }, dependencias())).rejects.toThrow('Firestore indisponível');
    expect(criarMock).toHaveBeenCalledOnce();
    expect(aoCriar).not.toHaveBeenCalled();
    expect(aoLimparItinerario).not.toHaveBeenCalled();
  });

  it('15. limpa o itinerário pendente somente após criação bem-sucedida', async () => {
    const aoLimparItinerario = vi.fn();

    await submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioIdaEVolta,
      aoLimparItinerario,
    }, dependencias());

    expect(aoLimparItinerario).toHaveBeenCalledOnce();
    expect(criarMock.mock.invocationCallOrder[0])
      .toBeLessThan(aoLimparItinerario.mock.invocationCallOrder[0]);
  });

  it('16. impede que uma nova cotação herde o itinerário anterior', async () => {
    let pendente: ItinerarioPendente = itinerarioIdaEVolta;

    await submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: pendente,
      aoLimparItinerario: () => { pendente = undefined; },
    }, dependencias());
    await submeterNovaCotacao({
      dadosFormulario: { ...dadosFormulario, cliente: 'Nova Cliente' },
      itinerarioPendente: pendente,
    }, dependencias());

    expect(criarMock.mock.calls[0][0]).toHaveProperty('itinerario');
    expect(criarMock.mock.calls[1][0]).not.toHaveProperty('itinerario');
  });

  it('17. não muta os dados nem o itinerário originais', async () => {
    const dadosOriginais = structuredClone(dadosFormulario);
    const itinerarioOriginal = structuredClone(itinerarioIdaEVolta);

    await submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioIdaEVolta,
    }, dependencias());

    expect(dadosFormulario).toEqual(dadosOriginais);
    expect(itinerarioIdaEVolta).toEqual(itinerarioOriginal);
  });

  it('18. entrega exatamente uma NovaCotacao ao serviço', async () => {
    const cotacao = await submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioIdaEVolta,
    }, dependencias());

    expect(criarMock).toHaveBeenCalledOnce();
    expect(criarMock).toHaveBeenCalledWith(cotacao);
  });

  it('19. não realiza segunda escrita nem atualização posterior', async () => {
    await submeterNovaCotacao({
      dadosFormulario,
      itinerarioPendente: itinerarioIdaEVolta,
    }, dependencias());

    expect(criarMock.mock.calls).toHaveLength(1);
  });

  it('20. mantém o caminho legado independente de um produtor estruturado', async () => {
    const montarLegado = vi.fn((entrada: Parameters<typeof montarNovaCotacao>[0]) => ({
      ...entrada,
      dataRegistro: new Date('2026-08-24T00:00:00Z'),
      status: 'Novo 🆕',
    } as NovaCotacao));

    await submeterNovaCotacao(
      { dadosFormulario },
      { montar: montarLegado, criar: criarMock }
    );

    expect(montarLegado.mock.calls[0][0]).not.toHaveProperty('itinerario');
    expect(criarMock).toHaveBeenCalledOnce();
  });

  it('21. preserva a pendência em clipboard vazio, falha de leitura ou erro do parser', () => {
    const leituraEParse = trechoDaPagina(
      'const lerDadosSmartPaste',
      'const aplicarCandidatoSmartPaste'
    );

    expect(leituraEParse).not.toContain('setItinerarioPendente(undefined)');
    expect(leituraEParse.indexOf('return null'))
      .toBeLessThan(leituraEParse.indexOf('extrairDadosSmartPaste(text)'));
  });

  it.each([
    [
      'geral',
      'const handleSmartPaste =',
      'const handleSmartPasteIda =',
      'if (dadosExtraidos.taxaEmbarque) setTaxaEmbarque',
      '✨ Voo extraído e colado com sucesso!',
    ],
    [
      'ida',
      'const handleSmartPasteIda =',
      'const handleSmartPasteVolta =',
      'if (updates.destino) setDestino',
      'Dados da ida colados com sucesso!',
    ],
    [
      'volta',
      'const handleSmartPasteVolta =',
      'const gerarCotacao =',
      'if (updates.destinoVolta) setDestinoVolta',
      'Dados da volta colados com sucesso!',
    ],
  ])('22. limpa somente depois da aplicação bem-sucedida no Smart Paste %s', (
    _, inicio, fim, ultimaAplicacao, mensagemSucesso
  ) => {
    const handler = trechoDaPagina(inicio, fim);
    const indiceAplicacao = handler.indexOf(ultimaAplicacao);
    const indiceLimpeza = handler.indexOf('setItinerarioPendente(undefined)');
    const indiceSucesso = handler.indexOf(mensagemSucesso);

    expect(indiceAplicacao).toBeGreaterThan(-1);
    expect(indiceLimpeza).toBeGreaterThan(indiceAplicacao);
    expect(indiceSucesso).toBeGreaterThan(indiceLimpeza);
    expect(handler.slice(handler.indexOf('catch {')))
      .not.toContain('setItinerarioPendente(undefined)');
  });
});
