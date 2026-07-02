# Checkpoint do autocomplete de clientes

Data do checkpoint: 2026-06-29

Branch: `crm-cotacao-clean`

HEAD anterior ao commit: `8482ee71c004c596395adf0f7782d2e14ccff9bb`

## Contexto

O uso real da nova cotacao mostrou a necessidade de reaproveitar os dados basicos de pessoas ja registradas na carteira individual do agente.

Cliente, cotacao e oportunidade continuam sendo conceitos distintos:

- cliente representa uma pessoa da carteira real;
- cotacao registra uma pesquisa de viagem;
- oportunidade e a visao comercial de uma ou mais cotacoes relacionadas.

O autocomplete reutiliza somente nome e telefone do cliente. Ele nao recupera dados de viagens anteriores nem cria uma associacao persistida entre cliente e cotacao.

## Comportamento anterior

- O autocomplete por nome derivava suas sugestoes da collection `cotacoes`.
- As sugestoes eram reduzidas a strings com nomes.
- A selecao preenchia somente o nome.
- Clientes convertidos ou cadastrados na collection `clientes` nao eram usados diretamente como fonte.
- A pesquisa por telefone ja existia como mecanismo separado.

## Implementacao atual

- A fonte das sugestoes passou a ser a collection `clientes`.
- A consulta usa `listarClientesDoUsuario` e permanece limitada a `ownerId == userId`.
- Os clientes sao carregados quando `userId` fica disponivel ou muda.
- A filtragem por nome ocorre localmente, sem consulta Firestore a cada tecla.
- Cada sugestao preserva ID documental, nome e telefone.
- Clientes homonimos com IDs diferentes permanecem como opcoes separadas.
- A selecao preenche nome e telefone.
- Cliente sem telefone limpa qualquer telefone anterior em vez de preencher texto auxiliar.
- A digitacao manual de nome e telefone continua disponivel.
- A selecao nao altera origem, destino, companhia, datas, horarios, paradas, pontos, taxas, produtos, observacao, status comercial ou dados do Smart Paste.
- Nenhum `clienteId` foi adicionado ao tipo ou ao documento da cotacao.

## Correcao de seguranca

A primeira revisao independente identificou que o resultado da pesquisa por telefone estava associado somente ao telefone. Como o formulario permanece montado durante logout ou troca de conta, uma sugestao pertencente ao usuario anterior poderia permanecer visivel e reutilizavel.

A correcao passou a:

- associar cada resultado ao `userId` que iniciou a consulta;
- validar conjuntamente o usuario e o telefone atuais antes de exibir ou reutilizar o cliente;
- invalidar a sugestao em logout, troca de usuario, mudanca ou remocao do telefone;
- ignorar respostas assincronas de consultas antigas e respostas posteriores a desmontagem;
- impedir que uma sugestao do usuario anterior seja exibida ou reutilizada.

A revisao final nao confirmou exposicao remanescente entre usuarios.

## Estrutura preservada

- Nenhuma collection nova foi criada.
- Nenhuma migracao foi introduzida.
- Nenhuma Firestore Rule foi alterada.
- `ownerId` e `agencyId` permaneceram intactos.
- Nenhuma dependencia foi instalada.
- `package.json` e `package-lock.json` nao foram alterados.
- Smart Paste, calculos e dados da viagem nao foram modificados.

## Testes e validacoes

- Teste especifico do autocomplete: 16/16 aprovados.
- Suite completa: 113/113 aprovados.
- Lint: aprovado.
- Build e TypeScript: aprovados.
- `git diff --check`: aprovado.

Os testes unitarios caracterizam carregamento, filtro local, homonimos, selecao, telefone ausente, falha da consulta e isolamento da sugestao por usuario e telefone.

## Ressalva de cobertura

O projeto nao possui infraestrutura DOM instalada para os testes.

Renderizacao, clique e rerender real do componente ainda nao possuem teste de integracao. O comportamento foi aprovado por inspecao independente e testes unitarios que exercitam as mesmas decisoes puras usadas na renderizacao.

Um teste DOM pode ser considerado em evolucao futura, sem bloquear o encerramento deste ciclo.
