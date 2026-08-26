import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import RevisaoItinerario from '../components/RevisaoItinerario';
import { extrairCandidatosSmartPaste } from '../lib/smartPasteCandidatesUtils';
import {
  confirmarRevisaoItinerario,
  criarRevisaoItinerario,
  obterItinerarioConfirmado,
} from './revisaoItinerarioUtils';
import { extrairDadosSmartPaste } from './smartPasteUtils';
import {
  resolverItinerarioPendenteSmartPaste,
} from './smartPasteItinerarioIntegration';
import type { ResultadoSmartPasteEstruturado } from './smartPasteItinerarioUtils';

const textoEstruturado = [
  'IDA 01/09/2026',
  '01/09/2026 08:00 GIG | Azul | AD 4101',
  '01/09/2026 10:00 AJU | Azul | AD 4101',
].join('\n');
const sourcePage = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const textoLatamOperacional = readFileSync(
  new URL(
    '../../tests/fixtures/smart-paste/latam/operacional-salvador-ida-volta.txt',
    import.meta.url
  ),
  'utf8'
);

function trechoDaPagina(inicio: string, fim: string) {
  return sourcePage.slice(sourcePage.indexOf(inicio), sourcePage.indexOf(fim));
}

function parserCom(resultado: ResultadoSmartPasteEstruturado) {
  return vi.fn(() => resultado);
}

function itinerarioValido() {
  const itinerario = resolverItinerarioPendenteSmartPaste(textoEstruturado);
  if (!itinerario) throw new Error('Fixture estruturada deveria ser válida');
  return itinerario;
}

describe('integração controlada do itinerário no Smart Paste global', () => {
  it('1. mantém o resultado legado e produz itinerário para texto compatível', () => {
    const legado = extrairDadosSmartPaste(textoEstruturado);
    const estruturado = resolverItinerarioPendenteSmartPaste(textoEstruturado);

    expect(legado).toMatchObject({
      tipoVoo: 'ida',
      origem: 'GIG',
      destino: 'AJU',
      horaSaidaIda: '08:00',
      horaChegadaIda: '10:00',
    });
    expect(estruturado?.ida.pernas[0]).toMatchObject({
      origem: 'GIG',
      destino: 'AJU',
      numeroVoo: 'AD 4101',
    });
  });

  it('2. devolve o itinerário quando o parser estruturado retorna ok', () => {
    const esperado = itinerarioValido();
    const parser = parserCom({ ok: true, itinerario: esperado });

    expect(resolverItinerarioPendenteSmartPaste('texto', parser)).toBe(esperado);
    expect(parser).toHaveBeenCalledOnce();
  });

  it.each([
    ['dados_insuficientes', 'faltam dados'],
    ['texto_nao_reconhecido', 'texto desconhecido'],
    ['inconsistencia_estrutural', 'estrutura contraditória'],
  ] as const)('3. converte %s em estado pendente ausente', (codigo, motivo) => {
    const parser = parserCom({ ok: false, codigo, motivo });

    expect(resolverItinerarioPendenteSmartPaste('texto', parser)).toBeUndefined();
  });

  it('4. limpa logicamente um itinerário anterior após novo paste sem estrutura', () => {
    let pendente = itinerarioValido();
    const parser = parserCom({
      ok: false,
      codigo: 'dados_insuficientes',
      motivo: 'faltam dados',
    });

    pendente = resolverItinerarioPendenteSmartPaste('paste B', parser) as typeof pendente;

    expect(pendente).toBeUndefined();
  });

  it('5. não impede a aplicação legada quando o estruturado falha normalmente', () => {
    const aplicarLegado = vi.fn();
    const parser = parserCom({
      ok: false,
      codigo: 'texto_nao_reconhecido',
      motivo: 'texto desconhecido',
    });

    aplicarLegado(extrairDadosSmartPaste('08:00 GIG 10:00 AJU'));
    const pendente = resolverItinerarioPendenteSmartPaste('texto', parser);

    expect(aplicarLegado).toHaveBeenCalledOnce();
    expect(pendente).toBeUndefined();
  });

  it('6. preserva o legado e registra erro inesperado do parser estruturado', () => {
    const eventos: string[] = [];
    const erro = new Error('falha inesperada');
    const registrarErro = vi.fn();
    const parser = vi.fn(() => {
      eventos.push('estruturado');
      throw erro;
    });

    eventos.push('legado aplicado');
    const pendente = resolverItinerarioPendenteSmartPaste('texto', parser, registrarErro);

    expect(eventos).toEqual(['legado aplicado', 'estruturado']);
    expect(pendente).toBeUndefined();
    expect(registrarErro).toHaveBeenCalledWith(
      'Erro inesperado no parser estruturado do Smart Paste:',
      erro
    );
  });

  it('7. preserva os dados financeiros extraídos pelo legado', () => {
    const legado = extrairDadosSmartPaste([
      textoEstruturado,
      '42.000 pontos + R$ 123,45',
    ].join('\n'));

    resolverItinerarioPendenteSmartPaste(textoEstruturado);

    expect(legado).toMatchObject({ pontos: '42', taxaEmbarque: '124' });
  });

  it('8. define somente um resultado estruturado por resolução', () => {
    const parser = parserCom({ ok: true, itinerario: itinerarioValido() });

    resolverItinerarioPendenteSmartPaste('texto', parser);

    expect(parser).toHaveBeenCalledOnce();
  });

  it('9. substitui o itinerário anterior quando o novo paste também é válido', () => {
    const anterior = itinerarioValido();
    const textoNovo = [
      'IDA 02/09/2026',
      '02/09/2026 09:00 AJU | LATAM | LA 3701',
      '02/09/2026 11:20 GRU | LATAM | LA 3701',
    ].join('\n');

    const atual = resolverItinerarioPendenteSmartPaste(textoNovo);

    expect(atual).not.toEqual(anterior);
    expect(atual?.ida.pernas[0]).toMatchObject({
      origem: 'AJU',
      destino: 'GRU',
      dataSaida: '2026-09-02',
    });
  });

  it('10. integra o recorte temporal conhecido do SP-002 sem fabricar conexões', () => {
    const texto = [
      'IDA 23/08/2026',
      '23/08/2026 20:40 GIG',
      '24/08/2026 14:15 AJU',
      'VOLTA 29/08/2026',
      '29/08/2026 02:45 AJU',
      '29/08/2026 07:45 GIG',
    ].join('\n');

    const itinerario = resolverItinerarioPendenteSmartPaste(texto);

    expect(itinerario?.ida.pernas).toHaveLength(1);
    expect(itinerario?.ida.pernas[0]).toMatchObject({
      dataSaida: '2026-08-23', horaSaida: '20:40',
      dataChegada: '2026-08-24', horaChegada: '14:15',
    });
    expect(itinerario?.volta?.pernas).toHaveLength(1);
    expect(itinerario?.volta?.pernas[0]).toMatchObject({
      dataSaida: '2026-08-29', horaSaida: '02:45',
      dataChegada: '2026-08-29', horaChegada: '07:45',
    });
  });

  it('11. integra o recorte temporal conhecido do SP-003 com +1 por sentido', () => {
    const texto = [
      'IDA 03/09/2026',
      '13:30 AJU',
      '00:20 BSB +1',
      'VOLTA 18/09/2026',
      '21:10 BSB',
      '09:50 AJU +1',
    ].join('\n');

    const itinerario = resolverItinerarioPendenteSmartPaste(texto);

    expect(itinerario?.ida.pernas[0]).toMatchObject({
      dataSaida: '2026-09-03', horaSaida: '13:30',
      dataChegada: '2026-09-04', horaChegada: '00:20',
    });
    expect(itinerario?.volta?.pernas[0]).toMatchObject({
      dataSaida: '2026-09-18', horaSaida: '21:10',
      dataChegada: '2026-09-19', horaChegada: '09:50',
    });
  });

  it('12. liga o parser estruturado somente depois da aplicação legada global', () => {
    const handler = trechoDaPagina(
      'const handleSmartPaste =',
      'const handleSmartPasteIda ='
    );
    const ultimaAplicacaoLegada = handler.indexOf(
      'if (dadosExtraidos.taxaEmbarque) setTaxaEmbarque'
    );
    const resolverEstruturado = handler.indexOf(
      'resolverItinerarioPendenteSmartPaste(texto)'
    );
    const estadoFinal = handler.indexOf('setRevisaoItinerario(', resolverEstruturado);

    expect(ultimaAplicacaoLegada).toBeGreaterThan(-1);
    expect(resolverEstruturado).toBeGreaterThan(ultimaAplicacaoLegada);
    expect(estadoFinal).toBeGreaterThan(resolverEstruturado);
    expect(handler).toContain(
      'setRevisaoItinerario(criarRevisaoItinerario(itinerarioExtraido))'
    );
  });

  it.each([
    ['ida', 'const handleSmartPasteIda =', 'const handleSmartPasteVolta =', 'updates.destino'],
    ['volta', 'const handleSmartPasteVolta =', 'const gerarCotacao =', 'updates.destinoVolta'],
  ])('13. mantém o Smart Paste separado de %s somente no legado', (
    _, inicio, fim, ultimaAplicacao
  ) => {
    const handler = trechoDaPagina(inicio, fim);

    expect(handler).not.toContain('resolverItinerarioPendenteSmartPaste');
    expect(handler.indexOf('setRevisaoItinerario(descartarRevisaoItinerario())'))
      .toBeGreaterThan(handler.indexOf(ultimaAplicacao));
  });

  it('14. não altera itinerário durante leitura vazia, falha de leitura ou parse legado', () => {
    const leitura = trechoDaPagina(
      'const lerDadosSmartPaste',
      'const aplicarCandidatoSmartPaste'
    );

    expect(leitura).not.toContain('setRevisaoItinerario');
    expect(leitura.indexOf('return null'))
      .toBeLessThan(leitura.indexOf('extrairDadosSmartPaste(text)'));
  });

  it('15. percorre texto LATAM real, parser, revisão e renderização sem mock', () => {
    const itinerario = resolverItinerarioPendenteSmartPaste(textoLatamOperacional);
    const revisao = criarRevisaoItinerario(itinerario);

    expect(revisao).toMatchObject({ confirmado: false });
    expect(revisao.itinerario?.ida.pernas[0]).toMatchObject({
      origem: 'GRU',
      destino: 'SSA',
      dataSaida: '2026-09-11',
      horaSaida: '09:50',
      horaChegada: '12:10',
    });
    expect(revisao.itinerario?.volta?.pernas[0]).toMatchObject({
      origem: 'SSA',
      destino: 'GRU',
      dataSaida: '2026-09-14',
      horaSaida: '18:35',
      horaChegada: '21:05',
    });
    expect(obterItinerarioConfirmado(revisao)).toBeUndefined();

    if (!revisao.itinerario) throw new Error('A revisão LATAM deveria conter itinerário');
    const html = renderToStaticMarkup(createElement(RevisaoItinerario, {
      itinerario: revisao.itinerario,
      confirmado: revisao.confirmado,
      onConfirmar: vi.fn(),
      onDescartar: vi.fn(),
    }));

    expect(html).toContain('Itinerário identificado');
    expect(html).toContain('Aguardando revisão');
    expect(html).toContain('GRU');
    expect(html).toContain('SSA');
    expect(html.indexOf('GRU')).toBeLessThan(html.indexOf('SSA'));
    expect(html.indexOf('SSA', html.indexOf('SSA') + 1))
      .toBeLessThan(html.lastIndexOf('GRU'));
    expect(html).toContain('11/09/2026 às 09:50');
    expect(html).toContain('14/09/2026 às 18:35');
    expect(html).toContain('Confirmar itinerário');

    const confirmado = confirmarRevisaoItinerario(revisao);
    expect(obterItinerarioConfirmado(confirmado)).toBe(revisao.itinerario);
  });

  it('16. aplica a rota de volta explícita no handler global após a extração', () => {
    const handler = trechoDaPagina(
      'const handleSmartPaste =',
      'const handleSmartPasteIda ='
    );
    const extracao = handler.indexOf('const { texto, dadosExtraidos } = leitura');
    const origemVolta = handler.indexOf(
      'if (dadosExtraidos.origemVolta) setOrigemVolta(dadosExtraidos.origemVolta)'
    );
    const destinoVolta = handler.indexOf(
      'if (dadosExtraidos.destinoVolta) setDestinoVolta(dadosExtraidos.destinoVolta)'
    );

    expect(origemVolta).toBeGreaterThan(extracao);
    expect(destinoVolta).toBeGreaterThan(origemVolta);
  });

  it('17. preserva os candidatos financeiros do texto operacional LATAM', () => {
    expect(extrairCandidatosSmartPaste(textoLatamOperacional).candidates).toEqual([
      {
        trecho: 'ida',
        raw: { pontos: 17795, taxa: 35.75 },
        rounded: { pontos: 18, taxa: 36 },
      },
      {
        trecho: 'volta',
        raw: { pontos: 17795, taxa: 52.72 },
        rounded: { pontos: 18, taxa: 53 },
      },
      {
        trecho: 'total',
        raw: { pontos: 35590, taxa: 88.47 },
        rounded: { pontos: 36, taxa: 89 },
      },
    ]);
  });
});
