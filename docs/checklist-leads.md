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
- agrupamento visual de cotacoes relacionadas em oportunidades comerciais no `/leads`;
- acao manual `Adicionar aos clientes` no `/historico` para cotacoes com `leadStatus = "fechado"`;
- criacao de cliente com confirmacao humana, preservando `ownerId`;
- deduplicacao inicial basica por nome normalizado.

`/clientes` segue como carteira de compradores reais.

## Decisao de produto

`/historico` continua sendo a base de registro das cotacoes. Toda cotacao salva deve permanecer consultavel ali, independentemente de virar lead, ser perdida ou ser fechada.

`/leads` sera a area operacional para oportunidades em andamento. Ela deve priorizar oportunidades comerciais que ainda exigem acompanhamento, agrupando cotacoes relacionadas quando fizer sentido para reduzir ruido visual.

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

Status: primeira versao implementada e agrupamento visual de oportunidades comerciais adicionado.

Mostrar como oportunidades abertas:

- `novo`;
- `em_monitoramento`;
- `aguardando_cliente`;
- `orcamento_enviado`;
- `negociacao`.

Nao tratar `fechado` como lead aberto.

`perdido` pode continuar acessivel via filtro, mas nao deve aparecer como prioridade principal da tela.

`/leads` e uma visao comercial interna baseada na colecao `cotacoes`. Nao existe colecao nova de leads ou oportunidades nesta etapa.

`/historico` continua sendo o registro detalhado de cotacoes, com uma linha ou card por cotacao. A evolucao do `/leads` nao muda esse contrato: toda cotacao individual deve continuar consultavel no historico.

No `/leads`, uma oportunidade comercial pode conter varias cotacoes relacionadas. Isso cobre o caso em que o mesmo cliente pede varias opcoes para o mesmo percurso e a mesma data, mas com horarios, companhias ou valores diferentes. Essas variacoes devem aparecer como opcoes dentro da mesma oportunidade comercial, e nao como oportunidades separadas.

O agrupamento atual e apenas visual/frontend. A tela continua buscando cotacoes como antes, aplica o filtro de status e somente depois agrupa as cotacoes filtradas em oportunidades. Nao houve criacao de colecao nova no Firestore, migracao de dados ou alteracao de Firestore Rules.

### Chave atual de agrupamento de oportunidades

A chave de agrupamento usa:

- `ownerId`;
- `telefoneNormalizado`, quando existir;
- telefone normalizado localmente, quando nao houver `telefoneNormalizado`;
- cliente normalizado, quando nao houver telefone;
- `origem`;
- `destino`;
- `dataIda`;
- `dataVolta`.

A chave de agrupamento nao usa:

- `companhia`;
- `companhiaIda`;
- `companhiaVolta`;
- horarios;
- `valorTotal`;
- `leadStatus`;
- `observacao`.

Companhias, horarios, valores, status e observacoes continuam sendo dados da cotacao individual. As acoes comerciais tambem continuam acontecendo na cotacao individual, nao no grupo. Assim, editar status comercial, produtos ofertados ou observacao deve atualizar a cotacao especifica selecionada dentro da oportunidade.

### Limitacoes conhecidas do agrupamento visual

- cotacoes antigas ou incompletas podem agrupar demais se faltarem telefone, cliente, rota e datas;
- os indicadores do topo continuam contando cotacoes, nao oportunidades;
- `/leads` ainda e individual por usuario, nao visao de equipe;
- ainda nao existe entidade persistida de oportunidade comercial.

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

Status: implementada em primeira versao e evoluida com agrupamento visual de oportunidades.

- criar visao filtrada para oportunidades abertas;
- priorizar status em andamento;
- permitir filtro para `perdido`;
- excluir `fechado` da visao principal de leads abertos;
- agrupar cotacoes relacionadas em oportunidades comerciais apenas na interface;
- manter as acoes em nivel de cotacao individual.

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
- revisar filtros comerciais por produto ofertado e status;
- adicionar indicador de total de oportunidades;
- avaliar visao de equipe em `/leads` para supervisor;
- avaliar criacao futura de uma entidade ou colecao `oportunidades`, se a visao agrupada precisar deixar de ser apenas visual;
- adicionar filtros por cliente, rota, produto e status.
