# Checklist Leads, Historico Comercial e Clientes Reais

## Objetivo

Documentar a proxima evolucao do CRM Voo Singular para separar com clareza tres areas:

- `/historico`: registro de cotacoes;
- `/leads`: oportunidades comerciais em acompanhamento;
- `/clientes`: carteira de compradores reais.

Primeira implementacao inicial ja realizada:

- campos comerciais em cotacoes: `produtosOfertados`, `observacao` e `leadStatus`;
- edicao comercial no `/historico`;
- primeira versao de `/leads`;
- `/leads` como visao interna baseada em `cotacoes`, sem colecao nova;
- status abertos aparecem por padrao em `/leads`;
- `fechado` e `perdido` nao aparecem por padrao em `/leads`.
- acao manual `Adicionar aos clientes` no `/historico` para cotacoes com `leadStatus = "fechado"`;
- criacao de cliente com confirmacao humana, preservando `ownerId`;
- deduplicacao inicial basica por nome normalizado.

`/clientes` segue como carteira de compradores reais.

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

## Campos comerciais em cotacoes

Campos implementados para evoluir a colecao de cotacoes sem criar uma colecao paralela de leads neste primeiro momento:

- `produtosOfertados?: string[]`;
- `observacao?: string`;
- `leadStatus?: string`;

Campo ainda planejado para evolucao posterior:

- `leadAtualizadoEm?: Timestamp`.

## Regra para `/leads`

Status: primeira versao implementada.

Mostrar como oportunidades abertas:

- `novo`;
- `em_monitoramento`;
- `aguardando_cliente`;
- `orcamento_enviado`;
- `negociacao`.

Nao tratar `fechado` como lead aberto.

`perdido` pode continuar acessivel via filtro, mas nao deve aparecer como prioridade principal da tela.

`/leads` e uma visao comercial interna baseada na colecao `cotacoes`. Nao existe colecao nova de leads nesta etapa.

## Regra para `/clientes`

`/clientes` deve representar carteira de compradores reais, nao uma lista de todos os leads.

Cliente pode ser:

- cadastrado manualmente; ou
- criado a partir de uma cotacao marcada como `fechado`.

A primeira versao da acao explicita `Adicionar aos clientes` ja foi implementada no `/historico` depois que a cotacao e marcada como `fechado`. Isso reduz risco de duplicidade e evita criar cliente automaticamente para uma pessoa que ja existe na carteira.

## Como cotacao fechada vira cliente

Fluxo implementado em primeira versao:

1. Usuario acompanha a oportunidade em `/leads` ou consulta a cotacao em `/historico`.
2. Usuario altera o status comercial da cotacao para `fechado`.
3. A cotacao deixa de aparecer como lead aberto.
4. O `/historico` oferece a acao explicita `Adicionar aos clientes`.
5. O usuario confirma manualmente a criacao.
6. Antes de criar o cliente, o sistema verifica duplicidade basica por nome normalizado.
7. Ao confirmar e nao haver duplicidade, a carteira de `/clientes` passa a representar aquela pessoa como comprador real.

Detalhes da primeira versao:

- a acao aparece somente para cotacoes com `leadStatus = "fechado"`;
- o cliente criado preserva `ownerId` do usuario autenticado;
- a acao nao altera a cotacao original;
- o cliente criado nao recebe telefone porque a cotacao ainda nao possui esse campo;
- ainda nao existe vinculo formal `cotacaoOrigemId` entre cliente e cotacao.

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
- buscar cliente existente por nome normalizado nesta primeira versao;
- evoluir para telefone ou e-mail quando esses dados existirem na cotacao;
- manter a cotacao original no `/historico`;
- adiar automacoes ate existir criterio confiavel de deduplicacao.

## Plano de implementacao em fases pequenas

### Fase 1: documentacao e contrato

- registrar a diferenca entre `/historico`, `/leads` e `/clientes`;
- documentar campos futuros;
- alinhar status comerciais e produtos ofertados;
- nao alterar codigo nesta fase.

### Fase 2: modelo de dados minimo

Status: implementada em primeira versao.

- adicionar campos opcionais em novas cotacoes;
- preservar compatibilidade com cotacoes antigas sem esses campos;
- manter `ownerId` como fronteira de isolamento;
- nao migrar documentos antigos sem plano explicito.

### Fase 3: status no historico

Status: implementada em primeira versao.

- permitir marcar cotacao com status comercial;
- permitir editar `leadStatus`, `produtosOfertados` e `observacao` no `/historico`;
- atualizar `leadAtualizadoEm` ao alterar status em evolucao posterior;
- garantir que `/historico` continue listando cotacoes como registro completo.

### Fase 4: tela `/leads`

Status: implementada em primeira versao.

- criar visao filtrada para oportunidades abertas;
- priorizar status em andamento;
- permitir filtro para `perdido`;
- excluir `fechado` da visao principal de leads abertos.

### Fase 5: conversao para cliente real

Status: implementada em primeira versao.

- apos marcar cotacao como `fechado`, exibir acao `Adicionar aos clientes`;
- conferir possivel cliente existente antes da criacao por nome normalizado;
- criar cliente apenas com confirmacao humana;
- preservar vinculo conceitual com a cotacao de origem.

### Fase 6: melhorias posteriores

- estudar deduplicacao por telefone, e-mail e nome normalizado;
- avaliar vinculo formal `cotacaoOrigemId` entre cliente e cotacoes fechadas;
- avaliar captura de telefone no fluxo de cotacao;
- adicionar metricas de conversao;
- revisar filtros comerciais por produto ofertado e status.
