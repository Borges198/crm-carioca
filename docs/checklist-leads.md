# Checklist Leads, Historico Comercial e Clientes Reais

## Objetivo

Documentar a proxima evolucao do CRM Voo Singular para separar com clareza tres areas:

- `/historico`: registro de cotacoes;
- `/leads`: oportunidades comerciais em acompanhamento;
- `/clientes`: carteira de compradores reais.

Esta etapa e apenas arquitetural e nao altera codigo da aplicacao.

## Decisao de produto

`/historico` continua sendo a base de registro das cotacoes. Toda cotacao salva deve permanecer consultavel ali, independentemente de virar lead, ser perdida ou ser fechada.

`/leads` sera a area operacional para oportunidades em andamento. Ela deve priorizar cotacoes que ainda exigem acompanhamento comercial.

`/clientes` representa compradores reais. Um cliente real e:

- uma pessoa que ja comprou antes; ou
- uma pessoa cuja cotacao foi marcada como `fechado` no `/historico` e depois adicionada a carteira de clientes.

## Status comerciais planejados

Status sugeridos para `leadStatus`:

- `novo`;
- `em_monitoramento`;
- `aguardando_cliente`;
- `orcamento_enviado`;
- `negociacao`;
- `fechado`;
- `perdido`.

## Produtos ofertados planejados

Valores sugeridos para `produtosOfertados`:

- `passagem_aerea`;
- `hospedagem`;
- `cruzeiro`;
- `aluguel_carros`;
- `seguro_viagem`;
- `pacote_completo`;
- `transfer`;
- `passeios`;
- `visto`;
- `chip_internacional`.

## Campos futuros em cotacoes

Campos planejados para evoluir a colecao de cotacoes sem criar uma colecao paralela de leads neste primeiro momento:

- `produtosOfertados?: string[]`;
- `observacao?: string`;
- `leadStatus?: string`;
- `leadAtualizadoEm?: Timestamp`.

## Regra para `/leads`

Mostrar como oportunidades abertas:

- `novo`;
- `em_monitoramento`;
- `aguardando_cliente`;
- `orcamento_enviado`;
- `negociacao`.

Nao tratar `fechado` como lead aberto.

`perdido` pode continuar acessivel via filtro, mas nao deve aparecer como prioridade principal da tela.

## Regra para `/clientes`

`/clientes` deve representar carteira de compradores reais, nao uma lista de todos os leads.

Cliente pode ser:

- cadastrado manualmente; ou
- criado a partir de uma cotacao marcada como `fechado`.

Inicialmente, preferir uma acao explicita como `Adicionar aos clientes` depois que a cotacao for marcada como `fechado`. Isso reduz risco de duplicidade e evita criar cliente automaticamente para uma pessoa que ja existe na carteira.

## Como cotacao fechada vira cliente

Fluxo planejado:

1. Usuario acompanha a oportunidade em `/leads` ou consulta a cotacao em `/historico`.
2. Usuario altera o status comercial da cotacao para `fechado`.
3. A cotacao deixa de aparecer como lead aberto.
4. A interface oferece uma acao explicita para adicionar a pessoa aos clientes.
5. Antes de criar o cliente, o usuario confere se ja existe cadastro equivalente.
6. Ao confirmar, a carteira de `/clientes` passa a representar aquela pessoa como comprador real.

## Riscos de duplicidade

Principais riscos:

- mesma pessoa aparecer com nomes ligeiramente diferentes;
- mesmo telefone ou e-mail ser digitado com formatos diferentes;
- cotacao fechada gerar cliente novo quando ja existe cliente cadastrado;
- criacao automatica esconder duplicidades em vez de expor uma escolha ao usuario;
- historico de cotacoes ficar fragmentado entre cadastros duplicados.

Mitigacoes iniciais:

- usar acao manual `Adicionar aos clientes`;
- mostrar dados principais da cotacao antes da criacao;
- buscar cliente existente por telefone, e-mail ou nome quando esses dados existirem;
- manter a cotacao original no `/historico`;
- adiar automacoes ate existir criterio confiavel de deduplicacao.

## Plano de implementacao em fases pequenas

### Fase 1: documentacao e contrato

- registrar a diferenca entre `/historico`, `/leads` e `/clientes`;
- documentar campos futuros;
- alinhar status comerciais e produtos ofertados;
- nao alterar codigo nesta fase.

### Fase 2: modelo de dados minimo

- adicionar campos opcionais em novas cotacoes;
- preservar compatibilidade com cotacoes antigas sem esses campos;
- manter `ownerId` como fronteira de isolamento;
- nao migrar documentos antigos sem plano explicito.

### Fase 3: status no historico

- permitir marcar cotacao com status comercial;
- atualizar `leadAtualizadoEm` ao alterar status;
- garantir que `/historico` continue listando cotacoes como registro completo.

### Fase 4: tela `/leads`

- criar visao filtrada para oportunidades abertas;
- priorizar status em andamento;
- permitir filtro para `perdido`;
- excluir `fechado` da visao principal de leads abertos.

### Fase 5: conversao para cliente real

- apos marcar cotacao como `fechado`, exibir acao `Adicionar aos clientes`;
- conferir possivel cliente existente antes da criacao;
- criar cliente apenas com confirmacao humana;
- preservar vinculo conceitual com a cotacao de origem.

### Fase 6: melhorias posteriores

- estudar deduplicacao por telefone, e-mail e nome normalizado;
- avaliar vinculo formal entre cliente e cotacoes fechadas;
- adicionar metricas de conversao;
- revisar filtros comerciais por produto ofertado e status.
