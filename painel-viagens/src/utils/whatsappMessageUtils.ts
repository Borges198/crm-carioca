interface GerarMensagemWhatsAppInput {
  cliente: string;
  valorTotal: number;
}

export function gerarMensagemWhatsApp({
  cliente,
  valorTotal,
}: GerarMensagemWhatsAppInput) {
  return `Cotação ${cliente}\n${valorTotal}\n\nAgência Voo Singular`;
}
