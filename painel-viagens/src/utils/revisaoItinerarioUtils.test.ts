import { describe, expect, it } from 'vitest';
import { extrairItinerarioSmartPaste } from './smartPasteItinerarioUtils';
import {
  confirmarRevisaoItinerario,
  criarRevisaoItinerario,
  descartarRevisaoItinerario,
  obterItinerarioConfirmado,
  type EstadoRevisaoItinerario,
} from './revisaoItinerarioUtils';

function itinerario(data = '01/09/2026') {
  const resultado = extrairItinerarioSmartPaste([
    `IDA ${data}`,
    `${data} 08:00 GIG | Azul | AD 4101`,
    `${data} 10:00 AJU | Azul | AD 4101`,
  ].join('\n'));
  if (!resultado.ok) throw new Error(resultado.motivo);
  return resultado.itinerario;
}

describe('estado da revisão assistida do itinerário', () => {
  it('1. cria revisão não confirmada para novo itinerário', () => {
    const atual = criarRevisaoItinerario(itinerario());

    expect(atual.itinerario).toBeDefined();
    expect(atual.confirmado).toBe(false);
  });

  it('2. não autoriza persistência antes da confirmação', () => {
    const atual = criarRevisaoItinerario(itinerario());

    expect(obterItinerarioConfirmado(atual)).toBeUndefined();
  });

  it('3. confirmar autoriza exatamente o itinerário revisado', () => {
    const esperado = itinerario();
    const confirmado = confirmarRevisaoItinerario(criarRevisaoItinerario(esperado));

    expect(confirmado.confirmado).toBe(true);
    expect(obterItinerarioConfirmado(confirmado)).toBe(esperado);
  });

  it('4. descartar remove estrutura e autorização', () => {
    const descartado = descartarRevisaoItinerario();

    expect(descartado).toEqual({ confirmado: false });
    expect(obterItinerarioConfirmado(descartado)).toBeUndefined();
  });

  it('5. novo itinerário substitui revisão anterior e exige nova confirmação', () => {
    const anterior = confirmarRevisaoItinerario(criarRevisaoItinerario(itinerario()));
    const novo = criarRevisaoItinerario(itinerario('02/09/2026'));

    expect(novo.itinerario).not.toEqual(anterior.itinerario);
    expect(novo.confirmado).toBe(false);
    expect(obterItinerarioConfirmado(novo)).toBeUndefined();
  });

  it('6. resultado sem estrutura limpa revisão anterior', () => {
    const anterior = confirmarRevisaoItinerario(criarRevisaoItinerario(itinerario()));
    const atual = criarRevisaoItinerario(undefined);

    expect(anterior.itinerario).toBeDefined();
    expect(atual).toEqual({ confirmado: false });
  });

  it('7. ausência de transição preserva revisão em falha anterior à aplicação', () => {
    const anterior = criarRevisaoItinerario(itinerario());
    const atual = anterior;

    expect(atual).toBe(anterior);
  });

  it('8. confirmação sem itinerário não fabrica estrutura', () => {
    const vazio: EstadoRevisaoItinerario = { confirmado: false };

    expect(confirmarRevisaoItinerario(vazio)).toBe(vazio);
    expect(obterItinerarioConfirmado(vazio)).toBeUndefined();
  });
});
