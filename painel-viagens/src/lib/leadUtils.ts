export const LEAD_STATUS_OPTIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'em_monitoramento', label: 'Em monitoramento' },
  { value: 'aguardando_cliente', label: 'Aguardando cliente' },
  { value: 'orcamento_enviado', label: 'Orçamento enviado' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'fechado', label: 'Fechado' },
  { value: 'perdido', label: 'Perdido' },
] as const;

export const PRODUTOS_OFERTADOS_OPTIONS = [
  { value: 'passagem_aerea', label: 'Passagem aérea' },
  { value: 'hospedagem', label: 'Hospedagem' },
  { value: 'cruzeiro', label: 'Cruzeiro' },
  { value: 'aluguel_carros', label: 'Aluguel de carros' },
  { value: 'seguro_viagem', label: 'Seguro viagem' },
  { value: 'pacote_completo', label: 'Pacote completo' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'passeios', label: 'Passeios' },
  { value: 'visto', label: 'Visto' },
  { value: 'chip_internacional', label: 'Chip internacional' },
] as const;

export type LeadStatus = typeof LEAD_STATUS_OPTIONS[number]['value'];
export type ProdutoOfertado = typeof PRODUTOS_OFERTADOS_OPTIONS[number]['value'];

export const LEAD_STATUS_ABERTOS: LeadStatus[] = [
  'novo',
  'em_monitoramento',
  'aguardando_cliente',
  'orcamento_enviado',
  'negociacao',
];

const leadStatusLabels = new Map<string, string>(
  LEAD_STATUS_OPTIONS.map((option) => [option.value, option.label])
);

const produtoOfertadoLabels = new Map<string, string>(
  PRODUTOS_OFERTADOS_OPTIONS.map((option) => [option.value, option.label])
);

export function formatarLeadStatus(status?: string | null) {
  if (!status) return 'Não informado';
  return leadStatusLabels.get(status) ?? status;
}

export function isLeadStatusAberto(status?: string | null) {
  return LEAD_STATUS_ABERTOS.includes(status as LeadStatus);
}

export function formatarProdutoOfertado(produto: string) {
  return produtoOfertadoLabels.get(produto) ?? produto;
}
