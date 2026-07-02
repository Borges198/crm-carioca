import { describe, expect, it } from 'vitest';
import { resolverRotasCotacao } from './rotaCotacaoUtils';

describe('resolverRotasCotacao', () => {
  it('resolve documento antigo de ida e volta com rota espelhada', () => {
    expect(resolverRotasCotacao({
      origem: 'GIG',
      destino: 'NVT',
      tipoVoo: 'ida_volta',
    })).toEqual({
      ida: {
        origem: 'GIG',
        destino: 'NVT',
      },
      volta: {
        origem: 'NVT',
        destino: 'GIG',
      },
    });
  });

  it('resolve rota independente real com aeroportos diferentes no retorno', () => {
    expect(resolverRotasCotacao({
      origem: 'GIG',
      destino: 'NVT',
      origemIda: 'GIG',
      destinoIda: 'NVT',
      origemVolta: 'NVT',
      destinoVolta: 'SDU',
      tipoVoo: 'ida_volta',
    })).toEqual({
      ida: {
        origem: 'GIG',
        destino: 'NVT',
      },
      volta: {
        origem: 'NVT',
        destino: 'SDU',
      },
    });
  });

  it('resolve aeroporto diferente na saida preservando fallback da volta', () => {
    expect(resolverRotasCotacao({
      origem: 'GIG',
      destino: 'NVT',
      origemIda: 'SDU',
      destinoIda: 'NVT',
      origemVolta: 'NVT',
      destinoVolta: 'GIG',
      tipoVoo: 'ida_volta',
    })).toEqual({
      ida: {
        origem: 'SDU',
        destino: 'NVT',
      },
      volta: {
        origem: 'NVT',
        destino: 'GIG',
      },
    });
  });

  it('resolve somente ida sem criar objeto de volta', () => {
    expect(resolverRotasCotacao({
      origem: 'GIG',
      destino: 'NVT',
      tipoVoo: 'ida',
    })).toEqual({
      ida: {
        origem: 'GIG',
        destino: 'NVT',
      },
    });
  });

  it('aplica fallback campo a campo quando rotas por trecho estao parcialmente preenchidas', () => {
    expect(resolverRotasCotacao({
      origem: 'GIG',
      destino: 'NVT',
      origemIda: 'SDU',
      origemVolta: 'NVT',
      tipoVoo: 'ida_volta',
    })).toEqual({
      ida: {
        origem: 'SDU',
        destino: 'NVT',
      },
      volta: {
        origem: 'NVT',
        destino: 'GIG',
      },
    });
  });

  it('ignora strings vazias ou so com espacos nas rotas por trecho', () => {
    expect(resolverRotasCotacao({
      origem: 'GIG',
      destino: 'NVT',
      origemIda: '',
      destinoIda: '   ',
      origemVolta: '',
      destinoVolta: '   ',
      tipoVoo: 'ida_volta',
    })).toEqual({
      ida: {
        origem: 'GIG',
        destino: 'NVT',
      },
      volta: {
        origem: 'NVT',
        destino: 'GIG',
      },
    });
  });

  it('prioriza campos por trecho preenchidos sobre campos globais', () => {
    expect(resolverRotasCotacao({
      origem: 'GIG',
      destino: 'NVT',
      origemIda: 'SDU',
      destinoIda: 'JOI',
      origemVolta: 'JOI',
      destinoVolta: 'CGH',
      tipoVoo: 'ida_volta',
    })).toEqual({
      ida: {
        origem: 'SDU',
        destino: 'JOI',
      },
      volta: {
        origem: 'JOI',
        destino: 'CGH',
      },
    });
  });
});
