# Roadmap Tecnico

## Objetivo

Organizar a evolucao do CRM Voo Singular em fases claras, mantendo uma base estavel para cotacao, historico, seguranca e melhorias futuras.

## Fase 1: base estavel

Status: base atual de referencia.

Escopo:

- manter aplicacao Next.js funcionando dentro de `painel-viagens`;
- manter login com Firebase Authentication;
- salvar cotacoes no Firestore;
- listar historico de cotacoes;
- listar clientes;
- filtrar dados por `ownerId`;
- manter documentacao tecnica em `docs`;
- preservar comandos principais documentados em `docs/local-setup.md`.

Criterio de estabilidade:

- app roda em desenvolvimento;
- lint e build passam quando houver alteracao de codigo;
- cotacoes e clientes novos gravam `ownerId`;
- documentos antigos sem `ownerId` nao sao migrados sem plano explicito.

## Fase 2: cotacao por trecho

Status: implementada como comportamento atual.

Escopo:

- permitir companhias diferentes para ida e volta;
- permitir pontos/milhas e taxa separados por trecho;
- calcular `valorIda`;
- calcular `valorVolta`;
- somar valores por trecho em `valorTotal`;
- manter fallback para cotacao global quando o usuario nao usa campos por trecho;
- manter BilhetePreview sem valores internos.

Pontos de atencao:

- conferir se historico exibe valores por trecho de forma coerente quando necessario;
- garantir que edicoes futuras nao misturem campos globais e por trecho de forma ambigua;
- preservar compatibilidade com cotacoes antigas.

## Fase 3: Smart Paste Assistido

Status: primeira camada implementada.

Escopo:

- manter `extrairDadosSmartPaste(text)` como parser principal;
- usar `extrairCandidatosSmartPaste(text)` como camada assistiva em paralelo;
- interpretar texto bruto em candidatos revisaveis;
- mostrar conferencia visual com companhia, trecho, pontos/milhas, taxa e preview curto;
- permitir aplicacao manual de candidato somente por clique explicito;
- limitar a aplicacao manual atual a pontos/milhas e taxa;
- preservar o Smart Paste atual e seu preenchimento automatico historico;
- nao aplicar automaticamente candidatos ao colar texto.

Criterio de aceite:

- nenhum candidato deve ser aplicado sem confirmacao humana;
- usuario consegue revisar candidatos antes de aplicar;
- candidatos podem aplicar apenas pontos/milhas e taxa nesta fase;
- origem, destino, datas, cliente, companhia e tipo de voo nao devem ser alterados pela aplicacao manual de candidatos;
- fluxo reduz erros silenciosos sem atrasar demais a operacao.

Proxima evolucao:

- validar manualmente o fluxo visual usando `docs/checklist-smart-paste.md`;
- estudar aplicacao assistida de outros campos apenas depois de nova decisao arquitetural;
- manter testes de caracterizacao com fixtures reais das companhias.

## Fase 4: seguranca e producao

Status: proposta documentada, ainda exige decisao operacional.

Escopo:

- revisar `docs/firestore-security-proposal.md`;
- validar regras em ambiente seguro antes de producao;
- decidir destino de documentos antigos sem `ownerId`;
- criar plano de migracao, arquivamento ou aceite de inacessibilidade;
- criar indices compostos exigidos por consultas com `ownerId` e ordenacao;
- validar testes com mais de um usuario autenticado;
- garantir que credenciais e arquivos sensiveis nao sejam commitados.

Pontos de atencao:

- `ownerId` e a fronteira atual de isolamento;
- `isAdmin` client-side nao deve ser tratado como seguranca real;
- regras Firestore nao devem ser aplicadas sem plano para documentos antigos.

## Fase 5: melhorias futuras

Ideias candidatas:

- Leads, Historico Comercial e Clientes Reais conforme `docs/checklist-leads.md`;
- historico com filtros mais avancados;
- busca por cliente, rota, periodo, companhia e status;
- edicao completa de cotacoes salvas;
- tela de detalhes da cotacao;
- melhoria da mensagem de WhatsApp com formato comercial revisado;
- modelo de proposta exportavel;
- painel de metricas de conversao;
- controle de status com funil operacional;
- migracao planejada de documentos antigos;
- testes automatizados para calculo, Smart Paste e mapeamento de cotacao;
- documentacao de deploy e operacao em producao.

Qualquer melhoria futura deve preservar as regras de seguranca, isolamento por usuario e nao exposicao de valores internos no BilhetePreview.

## Fase 6: Leads, Historico Comercial e Clientes Reais

Status: arquitetura documentada, ainda sem implementacao de codigo.

Decisao central:

- `/historico` continua sendo o registro de cotacoes;
- `/leads` sera a area de oportunidades em acompanhamento comercial;
- `/clientes` representa carteira de compradores reais.

`/clientes` nao deve representar todos os leads. Cliente real e uma pessoa que ja comprou antes ou uma pessoa cuja cotacao foi marcada como `fechado` e adicionada a carteira.

Campos planejados para cotacoes:

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

Regra para `/leads`:

- mostrar oportunidades abertas com status `novo`, `em_monitoramento`, `aguardando_cliente`, `orcamento_enviado` e `negociacao`;
- nao tratar `fechado` como lead aberto;
- manter `perdido` acessivel por filtro, mas fora da prioridade principal.

Regra para `/clientes`:

- representar compradores reais;
- permitir cadastro manual;
- permitir criacao a partir de cotacao marcada como `fechado`;
- preferir inicialmente botao ou acao `Adicionar aos clientes` apos o fechamento, em vez de criacao automatica.

Plano em fases pequenas:

- documentar contrato de negocio e modelo planejado;
- adicionar campos opcionais em cotacoes mantendo compatibilidade com documentos antigos;
- permitir status comercial no `/historico`;
- criar `/leads` como visao de oportunidades abertas;
- adicionar fluxo manual para converter cotacao fechada em cliente real;
- estudar deduplicacao antes de qualquer automacao.
