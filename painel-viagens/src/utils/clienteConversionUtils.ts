import type { Cliente, Cotacao, NovoCliente } from '../types';

export function normalizarNomeCliente(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizarTelefoneCliente(telefone?: string | null): string {
  return (telefone ?? '').replace(/\D/g, '');
}

export function montarResumoViagem(
  item: Pick<Cotacao, 'origem' | 'destino' | 'dataIda'>,
  formatarData: (data: Cotacao['dataIda']) => string
): string {
  const rota = `${item.origem} → ${item.destino}`;
  if (!item.dataIda) return rota;
  return `${rota} | ${formatarData(item.dataIda)}`;
}

export function clienteJaExiste(
  clientes: Cliente[],
  nomeCliente: string,
  telefone?: string | null
): boolean {
  const nomeNormalizado = normalizarNomeCliente(nomeCliente);
  const telefoneNormalizado = normalizarTelefoneCliente(telefone);

  return clientes.some((cliente) => {
    const mesmoNome = normalizarNomeCliente(cliente.nome) === nomeNormalizado;
    const telefoneCliente = cliente.telefoneNormalizado
      || normalizarTelefoneCliente(cliente.telefone);
    const mesmoTelefone = telefoneNormalizado.length > 0
      && telefoneCliente === telefoneNormalizado;

    return mesmoNome || mesmoTelefone;
  });
}

type CotacaoParaCliente = Pick<
  Cotacao,
  'cliente' | 'telefone' | 'telefoneNormalizado' | 'origem' | 'destino' | 'dataIda' | 'leadStatus'
>;

type MontarClienteInput = {
  cotacao: CotacaoParaCliente;
  userId: string;
  agencyId: string;
  formatarData: (data: Cotacao['dataIda']) => string;
  dataCadastro?: Date;
};

type ConverterClienteInput = MontarClienteInput & {
  clientesExistentes: Cliente[];
  criarCliente: (cliente: NovoCliente) => Promise<unknown>;
};

type ClienteConversionResult =
  | { status: 'created'; cliente: NovoCliente }
  | { status: 'duplicate' }
  | { status: 'not_closed' }
  | { status: 'missing_agency' };

export function montarClienteDeCotacaoFechada({
  cotacao,
  userId,
  agencyId,
  formatarData,
  dataCadastro = new Date(),
}: MontarClienteInput): NovoCliente | null {
  const agencyIdResolvido = agencyId.trim();
  if (!agencyIdResolvido) {
    return null;
  }

  const telefone = cotacao.telefone?.trim() || 'Não informado';
  const telefoneNormalizado = cotacao.telefoneNormalizado
    || normalizarTelefoneCliente(telefone);

  return {
    nome: cotacao.cliente?.trim() || 'Cliente sem nome',
    telefone,
    ...(telefoneNormalizado ? { telefoneNormalizado } : {}),
    origemLead: 'Cotação fechada',
    primeiraViagem: montarResumoViagem(cotacao, formatarData),
    ownerId: userId,
    agencyId: agencyIdResolvido,
    dataCadastro,
  };
}

export async function converterCotacaoFechadaEmCliente({
  cotacao,
  userId,
  agencyId,
  formatarData,
  dataCadastro,
  clientesExistentes,
  criarCliente,
}: ConverterClienteInput): Promise<ClienteConversionResult> {
  if (cotacao.leadStatus !== 'fechado') {
    return { status: 'not_closed' };
  }

  const cliente = montarClienteDeCotacaoFechada({
    cotacao,
    userId,
    agencyId,
    formatarData,
    dataCadastro,
  });

  if (!cliente) {
    return { status: 'missing_agency' };
  }

  if (clienteJaExiste(clientesExistentes, cliente.nome, cliente.telefoneNormalizado || cliente.telefone)) {
    return { status: 'duplicate' };
  }

  await criarCliente(cliente);

  return { status: 'created', cliente };
}
