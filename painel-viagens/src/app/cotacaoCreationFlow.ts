import { criarCotacao } from '../services/cotacoesService';
import type { NovaCotacao } from '../types';
import { montarNovaCotacao } from '../utils/cotacaoMapper';

type MontarNovaCotacaoInput = Parameters<typeof montarNovaCotacao>[0];

export type DadosFormularioCotacao = Omit<MontarNovaCotacaoInput, 'itinerario'>;
export type ItinerarioPendente = MontarNovaCotacaoInput['itinerario'];

interface SubmeterNovaCotacaoOptions {
  dadosFormulario: DadosFormularioCotacao;
  itinerarioPendente?: ItinerarioPendente;
  aoCriar?: (cotacao: NovaCotacao) => void;
  aoLimparItinerario?: () => void;
}

interface SubmeterNovaCotacaoDependencies {
  montar: typeof montarNovaCotacao;
  criar: typeof criarCotacao;
}

const dependenciasPadrao: SubmeterNovaCotacaoDependencies = {
  montar: montarNovaCotacao,
  criar: criarCotacao,
};

export async function submeterNovaCotacao(
  {
    dadosFormulario,
    itinerarioPendente,
    aoCriar,
    aoLimparItinerario,
  }: SubmeterNovaCotacaoOptions,
  dependencias: SubmeterNovaCotacaoDependencies = dependenciasPadrao
) {
  const entrada: MontarNovaCotacaoInput = itinerarioPendente
    ? { ...dadosFormulario, itinerario: itinerarioPendente }
    : dadosFormulario;
  const novaCotacao = dependencias.montar(entrada);

  await dependencias.criar(novaCotacao);
  aoLimparItinerario?.();
  aoCriar?.(novaCotacao);

  return novaCotacao;
}
