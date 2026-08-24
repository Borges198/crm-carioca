import type { ItinerarioCotacaoValidado } from './itinerarioUtils';
import {
  extrairItinerarioSmartPaste,
  type ResultadoSmartPasteEstruturado,
} from './smartPasteItinerarioUtils';

type ParserItinerarioSmartPaste = (texto: string) => ResultadoSmartPasteEstruturado;
type RegistrarErroSmartPaste = (mensagem: string, erro: unknown) => void;

export function resolverItinerarioPendenteSmartPaste(
  texto: string,
  parser: ParserItinerarioSmartPaste = extrairItinerarioSmartPaste,
  registrarErro: RegistrarErroSmartPaste = console.error
): ItinerarioCotacaoValidado | undefined {
  try {
    const resultado = parser(texto);
    return resultado.ok ? resultado.itinerario : undefined;
  } catch (erro) {
    registrarErro('Erro inesperado no parser estruturado do Smart Paste:', erro);
    return undefined;
  }
}
