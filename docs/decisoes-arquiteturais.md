# Decisoes Arquiteturais

## Objetivo

Registrar decisoes tecnicas e operacionais do CRM Voo Singular para preservar contexto entre chats, commits e fases do projeto.

## Decisoes tomadas

- Usar `docs` como base oficial de contexto tecnico do projeto.
- Manter a aplicacao Next.js dentro de `painel-viagens`.
- Usar Firebase Authentication para identificar usuario autenticado.
- Usar Firestore para `cotacoes` e `clientes`.
- Gravar `ownerId` em novas cotacoes e novos clientes.
- Usar `ownerId` para propriedade e visao individual, com visoes autorizadas por
  `agencyId` em paginas e perfis especificos.
- Manter BilhetePreview sem valores internos.
- Manter Smart Paste global enquanto o Smart Paste Assistido nao estiver pronto.
- Implementar Smart Paste Assistido como camada de conferencia humana, sem substituir o parser principal.
- Preservar documentos antigos sem `ownerId` ate existir plano de migracao.
- Separar `/historico`, `/leads` e `/clientes` como areas com responsabilidades diferentes.
- Tratar `/clientes` como carteira de compradores reais, nao como lista geral de leads.
- Tratar o banho de loja inicial como polimento de UX e responsividade, sem mudanca de modelo de dados ou regra de negocio.
- Separar configuracao do frontend, projeto default da Firebase CLI e branch
  Git: nenhuma dessas dimensoes seleciona automaticamente as demais.
- Exigir `--project crm-carioca-dev` em todo comando Firebase destinado ao
  DEV.

## Motivo de usar ownerId

`ownerId` identifica a propriedade do documento e delimita a visao individual.
`agencyId` funciona como fronteira organizacional para visoes autorizadas de
equipe.

Motivos:

- permite filtrar cotacoes e clientes do usuario autenticado;
- prepara o projeto para regras Firestore baseadas em `request.auth.uid`;
- reduz risco de um usuario visualizar dados de outro;
- cria uma base simples para seguranca antes de papeis administrativos mais avancados.

O `ownerId` deve continuar sendo gravado em toda nova cotacao e todo novo cliente.
A visao de equipe nao elimina ownership: supervisor e admin podem receber
leitura ou mutacoes limitadas conforme `agencyId`, perfil, visao ativa, pagina
e Firestore Rules.

## Decisao de isolamento operacional do Firebase DEV

O frontend local usa `crm-carioca-dev`. Producao usa `crm-carioca`, que
permanece como default da Firebase CLI na `.firebaserc`.

Decisoes:

- nao alterar o default como mecanismo de seguranca temporario;
- informar `--project crm-carioca-dev` em toda operacao Firebase do DEV;
- nao presumir projeto Firebase pela branch Git;
- manter mudancas de infraestrutura em branch separada das fases de produto;
- preservar indices existentes em `firestore.indexes.json`, sem adicionar
  indices especulativos.

O checkpoint detalhado dessa recuperacao esta em
`docs/checkpoint-firebase-dev-recovery.md`.

## Motivo de manter BilhetePreview sem valores

O BilhetePreview e um material visual que pode ser enviado ao cliente.

Por isso, ele nao deve revelar:

- pontos/milhas internas;
- taxas internas;
- valor total;
- valor por trecho;
- margem;
- composicao de preco;
- qualquer regra comercial sensivel.

A decisao protege a estrategia comercial da Voo Singular e evita que dados internos sejam expostos em prints ou imagens compartilhadas.

## Motivo de manter Smart Paste global por enquanto

O Smart Paste global ja acelera a operacao atual e preenche dados a partir da area de transferencia.

Ele deve ser preservado enquanto o assistido nao estiver pronto porque:

- ja existe fluxo operacional apoiado nele;
- remover a funcao antes do substituto reduziria produtividade;
- o assistido ainda precisa de desenho de interface e validacao de fluxo;
- o Smart Paste por trecho tambem ja ajuda no preenchimento de ida e volta.

Mudancas nessa area devem manter compatibilidade operacional ate que o fluxo assistido seja confiavel.

## Decisao de Smart Paste Assistido com conferencia humana

O Smart Paste Assistido interpreta texto automaticamente, mas nao substitui o parser principal.

Decisoes:

- manter `extrairDadosSmartPaste(text)` como parser principal do fluxo atual;
- usar `extrairCandidatosSmartPaste(text)` como camada assistiva de candidatos;
- rodar a camada assistiva em paralelo ao parser principal;
- exibir candidatos como sugestoes para conferencia visual;
- nao autoaplicar candidatos ao colar texto;
- permitir aplicacao apenas por acao manual e explicita do usuario;
- limitar a aplicacao manual, por enquanto, a pontos/milhas e taxa;
- nao aplicar automaticamente origem, destino, datas, cliente, companhia ou tipo de voo a partir dos candidatos.

O fluxo visual deve priorizar conferencia humana. A UI pode sugerir valores, mas a decisao operacional permanece com o usuario.

Motivos:

- dados de voo podem vir em formatos diferentes por companhia ou programa de milhas;
- datas, horarios e taxas extraidas incorretamente podem gerar proposta errada;
- a conferencia humana reduz erro silencioso;
- o usuario continua ganhando velocidade sem abrir mao de controle.

O fluxo atual e: colar texto, manter o preenchimento do parser principal, apresentar candidatos estruturados em "Conferencia Smart Paste" e permitir aplicacao manual apenas de pontos/milhas e taxa.

## Decisao de preservar documentos antigos ate plano de migracao

Documentos antigos sem `ownerId` nao devem ser alterados automaticamente.

Motivos:

- atribuir `ownerId` errado pode expor dados para usuario incorreto;
- regras Firestore baseadas em `ownerId` podem tornar documentos antigos inacessiveis;
- uma migracao precisa de criterio claro de propriedade;
- pode ser melhor migrar, arquivar ou aceitar inacessibilidade conforme decisao operacional.

Antes de aplicar regras de seguranca em producao, e necessario decidir explicitamente o destino desses documentos antigos.

## Decisao sobre Historico, Leads e Clientes Reais

`/historico`, `/leads` e `/clientes` devem ter responsabilidades diferentes.

Decisoes:

- `/historico` continua sendo o registro de cotacoes;
- `/leads` sera a area de oportunidades em acompanhamento comercial;
- `/clientes` representa carteira de compradores reais.

`/clientes` nao deve ser tratado como deposito de todo lead. Um cliente real e uma pessoa que ja comprou antes ou uma pessoa cuja cotacao foi marcada como `fechado` no `/historico` e depois adicionada a carteira.

Motivos:

- lead aberto ainda e oportunidade, nao comprador;
- misturar leads e clientes distorce a carteira comercial;
- compradores reais precisam ser uma base mais confiavel para relacionamento, recompra e acompanhamento pos-venda;
- cotacoes fechadas devem continuar existindo no `/historico`, mesmo quando geram um cadastro em `/clientes`.

Campos planejados para evoluir cotacoes:

- `produtosOfertados?: string[]`;
- `observacao?: string`;
- `leadStatus?: string`;
- `leadAtualizadoEm?: Timestamp`.

Status comerciais sugeridos:

- `novo`;
- `em_monitoramento`;
- `aguardando_cliente`;
- `orcamento_enviado`;
- `negociacao`;
- `fechado`;
- `perdido`.

Produtos ofertados sugeridos:

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

Em `/leads`, a visao principal deve mostrar apenas oportunidades ainda abertas: `novo`, `em_monitoramento`, `aguardando_cliente`, `orcamento_enviado` e `negociacao`.

`fechado` nao deve aparecer como lead aberto. `perdido` pode ficar acessivel por filtro, mas nao deve ser prioridade principal.

Em `/clientes`, a criacao pode acontecer manualmente ou a partir de uma cotacao marcada como `fechado`.

A conversao de cotacao fechada para cliente deve ser manual, por uma acao como `Adicionar aos clientes`. A criacao automatica deve ser evitada enquanto nao houver regra confiavel de deduplicacao, porque a mesma pessoa pode aparecer com variacoes de nome, telefone ou e-mail.

Primeira versao implementada:

- a acao `Adicionar aos clientes` aparece no `/historico` somente para cotacoes com `leadStatus = "fechado"`;
- a criacao do cliente exige confirmacao do usuario;
- a deteccao operacional de possivel duplicidade considera nome normalizado ou
  telefone normalizado;
- o cliente criado preserva `ownerId` do usuario autenticado;
- a acao nao altera a cotacao original;
- o cliente criado recebe o telefone da cotacao quando disponivel;
- sem telefone, o fluxo legado pode gravar `"Nao informado"` sem
  `telefoneNormalizado`;
- ainda nao existe vinculo formal `cotacaoOrigemId` entre cliente e cotacao.

Assim, `/historico` segue como memoria das cotacoes e ponto de acao comercial, `/leads` segue como painel de oportunidades comerciais abertas e `/clientes` segue como carteira de compradores reais.

Plano de implementacao:

- documentar o contrato de negocio;
- adicionar campos opcionais em cotacoes;
- preservar compatibilidade com cotacoes antigas;
- permitir atualizar status comercial no `/historico`;
- criar `/leads` como visao de oportunidades abertas;
- oferecer acao manual para adicionar cliente depois de marcar cotacao como `fechado`;
- estudar sinais adicionais antes de automatizar conversoes.

## Decisao sobre polimento visual e responsividade

O banho de loja inicial deve melhorar a operacao diaria sem alterar contratos de dados.

Decisoes:

- manter navegacao principal persistente entre as areas centrais;
- usar estados vazios profissionais para orientar proximas acoes;
- padronizar labels, textos, botoes e badges;
- manter tabelas em desktop/tablet quando elas ajudam na leitura comparativa;
- usar cards mobile em telas onde tabelas ficam desconfortaveis;
- preservar `/leads` em cards, ja que a tela funciona naturalmente como painel de oportunidades;
- nao alterar calculo comercial, Smart Paste, BilhetePreview, services, Firebase ou regras Firestore durante polimentos visuais.

Implementado no checkpoint atual:

- navegacao principal persistente;
- estados vazios profissionais;
- labels e badges padronizados;
- responsividade inicial das tabelas;
- cards mobile em `/historico`;
- cards mobile em `/clientes`.

A aplicacao ficou mais confortavel para uso em celular, mas o teste mobile real segue pendente ate a aplicacao estar hospedada.

Proximas melhorias de acabamento podem focar em modais em telas pequenas, formulario de cotacao no celular e documentacao de deploy/hospedagem.

## Decisao sobre identidade documental, telefone e sessoes

### Identidade de cliente

Cliente e identificado pelo ID documental do Firestore. Nome e telefone nao sao
identidade documental. Clientes homonimos com IDs diferentes devem permanecer
separados no autocomplete, cache, listagem e mutacoes.

Nome normalizado ou telefone normalizado sao usados somente para detectar uma
possivel duplicidade durante a conversao. Depois que o cliente existe, esses
campos nao substituem seu ID documental.

### Separacao de entidades

Cliente, cotacao e oportunidade comercial sao entidades distintas. Alterar uma
cotacao nao altera automaticamente o cliente nem outras cotacoes.

Em `/leads`, o card representa um agrupamento derivado de cotacoes. Nao existe
documento proprio de oportunidade nesta fase. A edicao telefonica exige uma
cotacao interna explicitamente selecionada por `cotacao.id` e atualiza somente
ela.

### Persistencia telefonica

`telefone` e `telefoneNormalizado` formam um par de persistencia. Toda criacao
ou edicao manual de cliente deve preservar o telefone visual e recalcular o
normalizado pela funcao central. Telefone vazio grava ambos como `""`.

Documentos antigos nao sao migrados em massa; recebem o par coerente quando
forem editados.

### Identidade de sessao

Nos fluxos corrigidos nesta fase, formularios e selecoes mutaveis preservam a
identidade da sessao em que nasceram: usuario, geracao, agencia, perfil e
contexto da operacao. Essa identidade e validada antes e depois das mutacoes
explicitamente tratadas nos Ciclos 5B e 6.

Trocas de usuario, perfil ou agencia limpam o estado mutavel. Uma operacao de
A1 nao pode ser aceita em A2, ainda que UID, agencia, perfil ou referencia do
usuario parecam iguais.

### Uso eficiente do Firestore

Paginacao e pesquisa lazy sao preferiveis ao carregamento integral. Nos fluxos
corrigidos nesta fase, resultados assincronos antigos nao podem ser publicados
em uma sessao nova. Firestore Rules continuam sendo uma defesa adicional, nao
substituto para as barreiras de sessao aplicadas a esses fluxos.
