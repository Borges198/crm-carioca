/*
 * Uso: abra /leads no CRM, espere o carregamento terminar e cole este arquivo
 * inteiro no Console do DevTools. O script usa exclusivamente a função temporária
 * window.__IA2E_EXPORT_STATE__, que lê os dados já carregados, e baixa
 * ia-2e-export-bruto.json. Ele não importa nem chama Firebase.
 */
(() => {
  'use strict';

  const NOME_ARQUIVO = 'ia-2e-export-bruto.json';
  const STATUS_ABERTOS = new Set([
    'novo',
    'em_monitoramento',
    'aguardando_cliente',
    'orcamento_enviado',
    'negociacao',
  ]);

  function texto(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
  }

  function dataYYYYMMDD(valor, campo, permiteNull = true) {
    if (valor === null || valor === undefined || valor === '') {
      if (permiteNull) return null;
      throw new Error(`${campo} não foi informado.`);
    }

    if (typeof valor?.toDate === 'function') valor = valor.toDate();
    else if (typeof valor?.seconds === 'number') valor = new Date(valor.seconds * 1000);

    if (valor instanceof Date) {
      if (Number.isNaN(valor.getTime())) throw new Error(`${campo} contém data inválida.`);
      return [
        valor.getUTCFullYear(),
        String(valor.getUTCMonth() + 1).padStart(2, '0'),
        String(valor.getUTCDate()).padStart(2, '0'),
      ].join('-');
    }

    const bruto = String(valor).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return bruto;
    const brasileira = /^(\d{2})-(\d{2})-(\d{4})$/.exec(bruto);
    if (brasileira) return `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}`;
    throw new Error(`${campo} deve ser YYYY-MM-DD ou DD-MM-YYYY.`);
  }

  function timestampMs(valor) {
    if (!valor) return 0;
    if (typeof valor?.toDate === 'function') return valor.toDate().getTime();
    if (typeof valor?.seconds === 'number') return valor.seconds * 1000;
    const instante = new Date(valor).getTime();
    return Number.isNaN(instante) ? 0 : instante;
  }

  function localizarEstado() {
    if (typeof window.__IA2E_EXPORT_STATE__ !== 'function') {
      throw new Error(
        'Função temporária window.__IA2E_EXPORT_STATE__ não encontrada. Recarregue a página /leads com o ajuste local ativo.'
      );
    }

    const estado = window.__IA2E_EXPORT_STATE__();
    const cotacoes = estado?.cotacoes;
    const acompanhamentos = estado?.acompanhamentos;
    if (!Array.isArray(cotacoes) || !Array.isArray(acompanhamentos)) {
      throw new Error('A função temporária retornou um estado IA-2E inválido.');
    }

    return { cotacoes, acompanhamentos };
  }

  function idOportunidade(cotacao) {
    const ownerId = texto(cotacao.ownerId) || 'sem_owner';
    const acompanhamentoId = texto(cotacao.acompanhamentoId);
    if (acompanhamentoId) return `owner:${ownerId}|acompanhamento:${acompanhamentoId}`;
    return `owner:${ownerId}|cliente:${texto(cotacao.clienteId)}`;
  }

  function gerar() {
    const { cotacoes, acompanhamentos } = localizarEstado();
    const semClienteId = cotacoes.filter((item) => !texto(item.clienteId));
    const cotacoesExportaveis = cotacoes.filter((item) => texto(item.clienteId));

    const acompanhamentosPorId = new Map(acompanhamentos.map((item) => [texto(item.id), item]));
    const grupos = new Map();
    for (const cotacao of cotacoesExportaveis.filter(
      (item) => STATUS_ABERTOS.has(texto(item.leadStatus))
    )) {
      const chave = idOportunidade(cotacao);
      const grupo = grupos.get(chave) ?? [];
      grupo.push(cotacao);
      grupos.set(chave, grupo);
    }

    const oportunidades = [...grupos.entries()].map(([id, itens]) => {
      const ordenados = [...itens].sort((a, b) => timestampMs(b.dataRegistro) - timestampMs(a.dataRegistro));
      const maisRecente = ordenados[0];
      const acompanhamentoId = texto(ordenados[0].acompanhamentoId);
      const acompanhamento = acompanhamentoId ? acompanhamentosPorId.get(acompanhamentoId) : undefined;
      const status = texto(maisRecente.leadStatus);
      if (!status) throw new Error(`Oportunidade ${id} não possui status.`);
      return {
        id,
        clienteId: texto(maisRecente.clienteId),
        status,
        proximaAcaoEm: dataYYYYMMDD(acompanhamento?.proximaAcaoEm, `${id}.proximaAcaoEm`),
        acaoId: acompanhamento ? texto(acompanhamento.id) || null : null,
      };
    });

    const pesquisas = cotacoesExportaveis.map((item) => {
      const status = texto(item.status) || texto(item.leadStatus);
      if (!status) throw new Error(`Cotação ${item.id} não possui status.`);
      return {
        id: texto(item.id),
        clienteId: texto(item.clienteId),
        destino: texto(item.destino),
        dataIda: dataYYYYMMDD(item.dataIda, `${item.id}.dataIda`),
        dataVolta: dataYYYYMMDD(item.dataVolta, `${item.id}.dataVolta`),
        status,
      };
    });

    const agora = new Date();
    const exportacao = {
      dataReferencia: [
        agora.getFullYear(),
        String(agora.getMonth() + 1).padStart(2, '0'),
        String(agora.getDate()).padStart(2, '0'),
      ].join('-'),
      oportunidades,
      pesquisas,
    };

    const blob = new Blob([`${JSON.stringify(exportacao, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = NOME_ARQUIVO;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    console.info(`Arquivo ${NOME_ARQUIVO} gerado somente com os campos permitidos.`, {
      'cotações exportadas': pesquisas.length,
      'cotações excluídas sem clienteId': semClienteId.length,
      'oportunidades exportadas': oportunidades.length,
    });
  }

  gerar();
})();
