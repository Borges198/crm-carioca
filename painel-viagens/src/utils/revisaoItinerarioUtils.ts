import type { ItinerarioCotacaoValidado } from './itinerarioUtils';

export interface EstadoRevisaoItinerario {
  itinerario?: ItinerarioCotacaoValidado;
  confirmado: boolean;
}

export function criarRevisaoItinerario(
  itinerario?: ItinerarioCotacaoValidado
): EstadoRevisaoItinerario {
  return itinerario
    ? { itinerario, confirmado: false }
    : { confirmado: false };
}

export function confirmarRevisaoItinerario(
  estado: EstadoRevisaoItinerario
): EstadoRevisaoItinerario {
  return estado.itinerario
    ? { ...estado, confirmado: true }
    : estado;
}

export function descartarRevisaoItinerario(): EstadoRevisaoItinerario {
  return { confirmado: false };
}

export function obterItinerarioConfirmado(
  estado: EstadoRevisaoItinerario
): ItinerarioCotacaoValidado | undefined {
  return estado.confirmado ? estado.itinerario : undefined;
}
