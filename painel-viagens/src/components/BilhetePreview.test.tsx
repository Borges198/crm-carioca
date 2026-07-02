import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BilhetePreview from './BilhetePreview';

const propsBase = {
  ticketRef: { current: null },
  companhia: 'Latam' as const,
  companhiaIda: 'Latam',
  companhiaVolta: 'Latam',
  tipoVoo: 'ida_volta',
  dataIda: '2026-07-28',
  horaSaidaIda: '08:00',
  horaChegadaIda: '10:00',
  paradasIda: 'Direto',
  dataVolta: '2026-08-02',
  horaSaidaVolta: '18:00',
  horaChegadaVolta: '20:00',
  paradasVolta: 'Direto',
};

function renderPreview(props: Partial<Parameters<typeof BilhetePreview>[0]> = {}) {
  return renderToStaticMarkup(
    <BilhetePreview
      {...propsBase}
      origem="GIG"
      destino="NVT"
      {...props}
    />
  );
}

describe('BilhetePreview - rotas por trecho', () => {
  it('resolve cotacao antiga de ida e volta com fallback espelhado', () => {
    const html = renderPreview();

    expect(html).toContain('Trecho ida');
    expect(html).toContain('Trecho volta');
    expect(html).toContain('GIG');
    expect(html).toContain('NVT');
    expect(html.indexOf('GIG')).toBeLessThan(html.indexOf('NVT'));
    expect(html.lastIndexOf('NVT')).toBeLessThan(html.lastIndexOf('GIG'));
  });

  it('renderiza rota assimetrica real com retorno por outro aeroporto', () => {
    const html = renderPreview({
      origemIda: 'GIG',
      destinoIda: 'NVT',
      origemVolta: 'NVT',
      destinoVolta: 'SDU',
    });

    expect(html).toContain('Trecho ida');
    expect(html).toContain('Trecho volta');
    expect(html).toContain('GIG');
    expect(html).toContain('NVT');
    expect(html).toContain('SDU');
    expect(html.indexOf('GIG')).toBeLessThan(html.indexOf('NVT'));
    expect(html.lastIndexOf('NVT')).toBeLessThan(html.indexOf('SDU'));
  });

  it('renderiza saida e retorno por aeroportos diferentes', () => {
    const html = renderPreview({
      origem: 'GIG',
      destino: 'NVT',
      origemIda: 'SDU',
      destinoIda: 'NVT',
      origemVolta: 'NVT',
      destinoVolta: 'GIG',
    });

    expect(html).toContain('SDU');
    expect(html).toContain('NVT');
    expect(html).toContain('GIG');
    expect(html.indexOf('SDU')).toBeLessThan(html.indexOf('NVT'));
    expect(html.lastIndexOf('NVT')).toBeLessThan(html.lastIndexOf('GIG'));
  });

  it('renderiza somente ida sem trecho de volta', () => {
    const html = renderPreview({
      tipoVoo: 'ida',
      dataVolta: '',
      origemVolta: 'NVT',
      destinoVolta: 'SDU',
    });

    expect(html).toContain('Trecho ida');
    expect(html).not.toContain('Trecho volta');
    expect(html).toContain('GIG');
    expect(html).toContain('NVT');
    expect(html).not.toContain('SDU');
  });

  it('aplica fallback campo a campo quando rotas por trecho estao vazias', () => {
    const html = renderPreview({
      origemIda: '',
      destinoIda: '   ',
      origemVolta: 'NVT',
      destinoVolta: '   ',
    });

    expect(html).toContain('GIG');
    expect(html).toContain('NVT');
    expect(html.lastIndexOf('NVT')).toBeLessThan(html.lastIndexOf('GIG'));
    expect(html).not.toContain('   ');
  });

  it('preserva companhias independentes no mesmo preview', () => {
    const html = renderPreview({
      companhia: 'GOL',
      companhiaIda: 'GOL',
      companhiaVolta: 'Latam',
      origemIda: 'GIG',
      destinoIda: 'NVT',
      origemVolta: 'NVT',
      destinoVolta: 'SDU',
    });

    expect(html).toContain('GIG');
    expect(html).toContain('NVT');
    expect(html).toContain('SDU');
    expect(html).toContain('GOL');
    expect(html).toContain('Latam');
    expect(html).toContain('28/07');
    expect(html).toContain('02/08');
    expect(html).toContain('08:00');
    expect(html).toContain('20:00');
    expect(html).toContain('Direto');
    expect(html).toContain('2h 00m');
  });

  it('continua sem exibir valores internos da composicao financeira', () => {
    const html = renderPreview({
      origemIda: 'GIG',
      destinoIda: 'NVT',
      origemVolta: 'NVT',
      destinoVolta: 'SDU',
    });

    expect(html).not.toContain('pontos');
    expect(html).not.toContain('milhas');
    expect(html).not.toContain('taxa');
    expect(html).not.toContain('valorIda');
    expect(html).not.toContain('valorVolta');
    expect(html).not.toContain('valorTotal');
    expect(html).not.toContain('margem');
    expect(html).not.toContain('composição de preço');
  });
});
