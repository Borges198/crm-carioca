import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ItinerarioCotacaoValidado } from '../utils/itinerarioUtils';
import RevisaoItinerario from './RevisaoItinerario';

const itinerario: ItinerarioCotacaoValidado = {
  versao: 1,
  ida: {
    tipo: 'ida',
    fonte: 'estruturado',
    pernas: [
      {
        origem: 'GIG', destino: 'CNF', companhia: 'Azul', numeroVoo: 'AD 4101',
        dataSaida: '2026-10-01', horaSaida: '20:40',
        dataChegada: '2026-10-01', horaChegada: '22:00',
      },
      {
        origem: 'CNF', destino: 'AJU',
        dataSaida: '2026-10-02', horaSaida: '12:30',
        dataChegada: '2026-10-02', horaChegada: '14:15',
      },
    ],
  },
  volta: {
    tipo: 'volta',
    fonte: 'estruturado',
    pernas: [{
      origem: 'AJU', destino: 'SDU',
      dataSaida: '2026-10-10', horaSaida: '02:45',
      dataChegada: '2026-10-10', horaChegada: '07:45',
    }],
  },
};

function renderizar(
  atual: ItinerarioCotacaoValidado = itinerario,
  confirmado = false
) {
  return renderToStaticMarkup(
    <RevisaoItinerario
      itinerario={atual}
      confirmado={confirmado}
      onConfirmar={vi.fn()}
      onDescartar={vi.fn()}
    />
  );
}

describe('RevisaoItinerario', () => {
  it('1. mostra revisão pendente com ações explícitas', () => {
    const html = renderizar();

    expect(html).toContain('Itinerário identificado');
    expect(html).toContain('Aguardando revisão');
    expect(html).toContain('Confirmar itinerário');
    expect(html).toContain('Descartar itinerário estruturado');
  });

  it('2. exibe ida e volta na ordem correta', () => {
    const html = renderizar();

    expect(html).toContain('>ida<');
    expect(html).toContain('>volta<');
    expect(html.indexOf('>ida<')).toBeLessThan(html.indexOf('>volta<'));
  });

  it('3. exibe múltiplas pernas na ordem informada', () => {
    const html = renderizar();

    expect(html.indexOf('GIG')).toBeLessThan(html.indexOf('CNF'));
    expect(html.indexOf('CNF', html.indexOf('CNF') + 1)).toBeLessThan(html.indexOf('AJU'));
    expect(html).toContain('1 conexão');
  });

  it('4. preserva datas e horários, inclusive chegada em dia posterior', () => {
    const html = renderizar();

    expect(html).toContain('01/10/2026 às 20:40');
    expect(html).toContain('02/10/2026 às 14:15');
    expect(html).toContain('10/10/2026 às 02:45');
    expect(html).toContain('10/10/2026 às 07:45');
  });

  it('5. exibe companhia e voo somente quando existentes', () => {
    const html = renderizar();

    expect(html).toContain('Companhia:');
    expect(html).toContain('Azul');
    expect(html).toContain('Voo:');
    expect(html).toContain('AD 4101');
    expect(html).not.toContain('Não identificado');
  });

  it('6. não inventa companhia ou voo ausentes', () => {
    const semMetadados: ItinerarioCotacaoValidado = {
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [{
          origem: 'GIG', destino: 'AJU',
          dataSaida: '2026-09-03', horaSaida: '13:30',
          dataChegada: '2026-09-04', horaChegada: '00:20',
        }],
      },
    };
    const html = renderizar(semMetadados);

    expect(html).not.toContain('Companhia:');
    expect(html).not.toContain('Voo:');
    expect(html).not.toContain('Não identificado');
  });

  it('7. comunica autorização e salvamento legado conforme confirmação', () => {
    const pendente = renderizar();
    const confirmado = renderizar(itinerario, true);

    expect(pendente).toContain(
      'Sem confirmação, a cotação será salva somente com os dados do formulário.'
    );
    expect(confirmado).toContain('Estrutura autorizada para acompanhar a cotação.');
    expect(confirmado).toContain('Confirmado');
    expect(confirmado).toContain('disabled=""');
  });

  it('8. preserva visualmente o recorte direto conhecido do SP-002', () => {
    const sp002: ItinerarioCotacaoValidado = {
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [{
          origem: 'GIG', destino: 'AJU',
          dataSaida: '2026-08-23', horaSaida: '20:40',
          dataChegada: '2026-08-24', horaChegada: '14:15',
        }],
      },
      volta: {
        tipo: 'volta',
        pernas: [{
          origem: 'AJU', destino: 'GIG',
          dataSaida: '2026-08-29', horaSaida: '02:45',
          dataChegada: '2026-08-29', horaChegada: '07:45',
        }],
      },
    };
    const html = renderizar(sp002);

    expect(html).toContain('23/08/2026 às 20:40');
    expect(html).toContain('24/08/2026 às 14:15');
    expect(html).toContain('29/08/2026 às 02:45');
    expect(html).toContain('29/08/2026 às 07:45');
    expect(html.match(/Voo direto/g)).toHaveLength(2);
  });

  it('9. preserva visualmente o pernoite e os sentidos do SP-003', () => {
    const sp003: ItinerarioCotacaoValidado = {
      versao: 1,
      ida: {
        tipo: 'ida',
        pernas: [{
          origem: 'AJU', destino: 'BSB',
          dataSaida: '2026-09-03', horaSaida: '13:30',
          dataChegada: '2026-09-04', horaChegada: '00:20',
        }],
      },
      volta: {
        tipo: 'volta',
        pernas: [{
          origem: 'BSB', destino: 'AJU',
          dataSaida: '2026-09-18', horaSaida: '21:10',
          dataChegada: '2026-09-19', horaChegada: '09:50',
        }],
      },
    };
    const html = renderizar(sp003);

    expect(html).toContain('03/09/2026 às 13:30');
    expect(html).toContain('04/09/2026 às 00:20');
    expect(html).toContain('18/09/2026 às 21:10');
    expect(html).toContain('19/09/2026 às 09:50');
    expect(html.indexOf('04/09/2026 às 00:20'))
      .toBeLessThan(html.indexOf('18/09/2026 às 21:10'));
  });
});
