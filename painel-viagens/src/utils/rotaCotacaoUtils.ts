export type TrechoResolvido = {
  origem: string;
  destino: string;
};

export type RotasCotacaoResolvidas = {
  ida: TrechoResolvido;
  volta?: TrechoResolvido;
};

type CotacaoComRotas = {
  tipoVoo?: string | null;
  origem: string;
  destino: string;
  origemIda?: string | null;
  destinoIda?: string | null;
  origemVolta?: string | null;
  destinoVolta?: string | null;
};

function campoPreenchido(valor?: string | null): valor is string {
  return typeof valor === 'string' && valor.trim() !== '';
}

function resolverCampo(valor: string | null | undefined, fallback: string) {
  return campoPreenchido(valor) ? valor : fallback;
}

export function resolverRotasCotacao(cotacao: CotacaoComRotas): RotasCotacaoResolvidas {
  const rotas: RotasCotacaoResolvidas = {
    ida: {
      origem: resolverCampo(cotacao.origemIda, cotacao.origem),
      destino: resolverCampo(cotacao.destinoIda, cotacao.destino),
    },
  };

  if (cotacao.tipoVoo === 'ida_volta') {
    rotas.volta = {
      origem: resolverCampo(cotacao.origemVolta, cotacao.destino),
      destino: resolverCampo(cotacao.destinoVolta, cotacao.origem),
    };
  }

  return rotas;
}
