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

Status: implementada e validada em primeira versao.

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
- manter validacao automatizada do parser de candidatos com fixtures reais;
- cobrir casos de estabilizacao como texto sem candidatos, arredondamento para cima e candidatos incompletos;
- estudar aplicacao assistida de outros campos apenas depois de nova decisao arquitetural;
- manter testes de caracterizacao com fixtures reais das companhias.

## Fase 4: seguranca e producao

Status: acesso por perfil e Rules implementados em fase anterior; tratamento de
documentos legados continua pendente.

Escopo:

- manter `docs/firestore-security-proposal.md` como registro do desenho inicial;
- consultar `docs/access-control-checkpoint.md` para o estado validado;
- decidir destino de documentos antigos sem `ownerId`;
- criar plano de migracao, arquivamento ou aceite de inacessibilidade;
- monitorar indices compostos exigidos por consultas com `ownerId` e ordenacao;
- validar testes com mais de um usuario autenticado;
- garantir que credenciais e arquivos sensiveis nao sejam commitados.

Pontos de atencao:

- `ownerId` delimita propriedade e visao individual; visoes autorizadas de
  equipe tambem consideram `agencyId`, perfil, pagina e Rules;
- `isAdmin` client-side nao deve ser tratado como seguranca real;
- alteracoes futuras de Rules exigem plano para documentos antigos.

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

Status: Leads e conversao manual para Clientes Reais implementados em MVP.

Decisao central:

- `/historico` continua sendo o registro de cotacoes;
- `/leads` sera a area de oportunidades em acompanhamento comercial;
- `/clientes` representa carteira de compradores reais.

`/clientes` nao deve representar todos os leads. Cliente real e uma pessoa que ja comprou antes ou uma pessoa cuja cotacao foi marcada como `fechado` e adicionada a carteira.

Campos planejados para cotacoes:

- `produtosOfertados?: string[]`;
- `observacao?: string`;
- `leadStatus?: string`;
- `leadAtualizadoEm?: Timestamp` em evolucao posterior.

Ja implementado:

- campos comerciais em cotacoes: `produtosOfertados`, `observacao` e `leadStatus`;
- edicao comercial no `/historico`;
- primeira versao de `/leads`;
- `/leads` como visao interna baseada em `cotacoes`, sem colecao nova;
- status abertos aparecem por padrao;
- `fechado` e `perdido` nao aparecem por padrao.
- acao manual `Adicionar aos clientes` no `/historico` para cotacoes com `leadStatus = "fechado"`;
- criacao de cliente com confirmacao do usuario;
- verificacao de possivel duplicidade por nome normalizado ou telefone normalizado;
- preservacao de `ownerId` no cliente criado;
- criacao sem alterar a cotacao original.

Limitacoes conhecidas do MVP:

- a conversao copia o telefone da cotacao quando disponivel;
- sem telefone, a conversao ainda pode usar `"Nao informado"` sem
  `telefoneNormalizado`, comportamento legado a harmonizar;
- ainda nao existe vinculo formal `cotacaoOrigemId` entre cliente e cotacao;
- a regra operacional usa nome normalizado ou telefone normalizado; e-mail,
  vinculo formal e outros sinais continuam fora da regra atual.

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
- usar acao manual `Adicionar aos clientes` apos o fechamento, em vez de criacao automatica.

Plano em fases pequenas:

- documentar contrato de negocio e modelo planejado: concluido;
- adicionar campos opcionais em cotacoes mantendo compatibilidade com documentos antigos: concluido em primeira versao;
- permitir status comercial no `/historico`: concluido em primeira versao;
- criar `/leads` como visao de oportunidades abertas: concluido em primeira versao;
- adicionar fluxo manual para converter cotacao fechada em cliente real: concluido em primeira versao;
- estudar identidade operacional mais forte antes de ampliar automacoes, sem
  substituir o ID documental como identidade persistente.

## Fase 7: Polimento visual e responsividade mobile

Status: banho de loja inicial implementado.

Objetivo:

- deixar o MVP mais profissional para uso operacional;
- reduzir friccao entre `/historico`, `/leads` e `/clientes`;
- melhorar conforto em telas pequenas sem mudar regras de negocio.

Ja implementado:

- navegacao principal persistente com acesso a nova cotacao, historico, leads e clientes;
- estados vazios profissionais nas telas principais;
- labels, textos, botoes e badges padronizados;
- responsividade inicial das tabelas com overflow horizontal controlado;
- cards mobile em `/historico`, mantendo tabela para desktop/tablet;
- cards mobile em `/clientes`, mantendo tabela para desktop/tablet;
- `/leads` ja funciona naturalmente em cards;
- aplicacao mais confortavel para uso em celular.

Validacoes realizadas durante as etapas:

- `npm run test` passou;
- `npm run lint` passou;
- `npm run build` passou com rede externa para fontes Geist.

Ponto pendente:

- teste mobile real ainda esta pendente porque a aplicacao ainda nao esta hospedada.

Proximos passos possiveis:

- melhorar modais em telas pequenas;
- testar mobile real depois da hospedagem;
- revisar formulario de cotacao em celular;
- documentar estrategia de deploy e hospedagem.

## Fase 8: Firestore, identidade de clientes e isolamento de sessao

Status: concluida, validada e sincronizada com o remote. Deploy nao realizado.

Concluido:

- autocomplete de clientes usando identidade documental;
- reducao de consultas por telefone com debounce;
- paginacao de `/clientes`;
- pesquisa lazy alem da primeira pagina;
- cache por usuario e diario versionado de mutacoes;
- edicao telefonica em `/historico`;
- edicao telefonica em `/leads`;
- isolamento de sessao nas mutacoes corrigidas de `/clientes` e nas edicoes de
  `/historico`;
- persistencia coerente de `telefone` e `telefoneNormalizado`.

Futuro:

- otimizar as cargas de `/historico` e `/leads`;
- adicionar testes DOM integrados;
- compactar o diario de mutacoes;
- evitar carga integral da carteira no autocomplete por nome;
- tratar clientes legados sem `dataCadastro`;
- harmonizar a conversao de cotacao sem telefone.
