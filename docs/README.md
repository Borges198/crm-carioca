# CRM Voo Singular - Central de Documentacao

Bem-vindo a documentacao oficial do CRM Voo Singular.

Este diretorio reune os documentos que definem a arquitetura, operacao, seguranca e evolucao do sistema.

## Ordem Recomendada de Leitura

1. [Central de documentacao](README.md) — indice oficial.
2. [Contexto atual do projeto](contexto-projeto-crm.md) — visao geral vigente.
3. [Roadmap tecnico](roadmap-tecnico.md) — entregas concluidas e evolucoes futuras.
4. [Decisoes arquiteturais](decisoes-arquiteturais.md) — contratos tecnicos e de produto.
5. [Protocolo de trabalho](protocolo-de-trabalho.md) — regras para alteracoes seguras.
6. [Checkpoint consolidado de Firestore e identidade](checkpoints/2026-07-01-firestore-identidade-clientes.md) — checkpoint consolidado atual.
7. [Controle de acesso](access-control-checkpoint.md) — checkpoint historico de controle de acesso.
8. [Autocomplete de clientes](checkpoint-autocomplete-clientes.md) — checkpoint historico de autocomplete.

Documentos historicos servem para rastreabilidade da evolucao. Quando houver
divergencia temporal, prevalecem o contexto atual, as decisoes arquiteturais, o
roadmap e o checkpoint consolidado mais recente.

## Estrutura Atual do Produto

```text
cotacoes
→ agrupamento derivado em /leads
→ acompanhamento da oportunidade comercial
→ fechamento
→ conversao manual para a carteira de clientes
```

Lead ou oportunidade nao e um documento proprio criado por esse fluxo. A visao
em `/leads` deriva e agrupa documentos da collection `cotacoes`.

## Perfis Oficiais

```text
agent
supervisor
admin
```

## Fonte Oficial de Verdade Comercial

O CRM utiliza:

```text
leadStatus
```

como fonte oficial de verdade para todo o fluxo comercial.

Novas funcionalidades devem respeitar essa decisao arquitetural.

## Fase Atual

```text
MVP Comercial Operacional concluido
Fase Firestore e identidade de clientes concluida e sincronizada com o remote
Deploy nao realizado
```

## Proxima Fase

```text
FASE 2
CRM Inteligente de Operacao Comercial
```

Objetivos iniciais:

- otimizacao de `/historico` e `/leads`;
- testes DOM integrados;
- compactacao do diario de mutacoes;
- harmonizacao da conversao sem telefone;
- proximas acoes comerciais;
- leads atrasados;
- timeline comercial;
- tratamento de clientes legados sem `dataCadastro`.

## Diretriz Para IA, Codex e LLMs

Ao trabalhar neste projeto, considerar como fontes principais:

1. [contexto atual](contexto-projeto-crm.md);
2. [roadmap](roadmap-tecnico.md);
3. [decisoes arquiteturais](decisoes-arquiteturais.md);
4. [protocolo de trabalho](protocolo-de-trabalho.md);
5. [checkpoint consolidado mais recente](checkpoints/2026-07-01-firestore-identidade-clientes.md).

Checkpoints historicos devem ser usados para rastreabilidade, nao como verdade
atual absoluta.
