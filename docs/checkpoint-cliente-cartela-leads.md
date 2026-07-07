# Checkpoint da fase Cliente e Cartela de Leads

## 1. Objetivo da fase

Esta fase reorganizou o CRM Voo Singular para tratar cliente como entidade
comercial central, e nao cada viagem como uma oportunidade isolada.

A mudanca evita que o acompanhamento comercial fique fragmentado por rota,
destino ou data. A cartela de Leads passa a representar a relacao comercial com
o cliente, enquanto cada cotacao continua sendo uma proposta individual dentro
desse historico.

## 2. Decisao de dominio

- Cliente = entidade comercial.
- Cotacao = proposta individual.
- Historico = superficie operacional de edicao.
- Leads = superficie comercial de acompanhamento.

A regra operacional final da fase e:

```text
/historico edita.
/leads acompanha.
```

## 3. Problema original

Antes desta fase, `/leads` agrupava oportunidades por:

```text
ownerId + telefone/nome + origem + destino + dataIda + dataVolta
```

Isso fazia o mesmo cliente aparecer em varias cartelas quando mudava rota,
destino ou data. Esses campos descrevem uma cotacao ou uma viagem especifica,
mas nao devem definir a identidade comercial permanente do cliente.

## 4. Solucao implementada

- Novas cotacoes podem salvar `clienteId` quando o agente seleciona
  explicitamente um cliente.
- `clienteId` nao atravessa troca de usuario, logout ou sessao.
- `/leads` agrupa por `ownerId + clienteId` quando existe.
- `/leads` usa fallback legado por telefone, depois nome, depois `cotacao.id`.
- Rota e datas nao fazem mais parte da chave de agrupamento.
- `/leads` exibe rota/data dentro das cotacoes internas.
- `/leads` deixou de editar `leadStatus`, `produtosOfertados` e `observacao`.
- `/historico` permanece como tela de edicao comercial.

## 5. Regra atual de agrupamento em /leads

A prioridade atual da chave de agrupamento em `/leads` e:

1. `ownerId + clienteId`
2. `ownerId + telefoneNormalizado`
3. `ownerId + telefone normalizado em execucao`
4. `ownerId + nome normalizado`
5. `ownerId + cotacao.id`

O fallback por `cotacao.id` evita misturar documentos sem identidade confiavel.
Ele preserva documentos legados isolados quando nao ha `clienteId`, telefone ou
nome utilizavel.

## 6. Regra atual de status

`/historico` e a tela para alterar `leadStatus`, `produtosOfertados` e
`observacao`.

`/leads` apenas exibe esses dados em modo leitura.

O status comercial pertence a cotacao, nao ao cliente inteiro. Por isso, a
cartela de Leads acompanha as cotacoes do cliente, mas nao cria um status
agregado novo nem permite edicao comercial direta nessa superficie.

## 7. Commits da fase

- `da86dd0f7d8537219cc5e30de36b32f815f0479f` - `docs: registra fluxo cliente leads`
- `79e1843d0ad90f05eb4bbb19038513749f980ec8` - `feat: salvar cliente selecionado na cotacao`
- `255619c05ee7de03c218dc3a0a8d93a6ccb87852` - `fix: isolar cliente selecionado por usuario`
- `e4b0e69a4e65b24b52b2d50855461a0dcda3865e` - `feat: agrupar leads por cliente`
- `807e8a4575654eeba018bd483b42738c0700ecc1` - `refactor: tornar leads leitura comercial`

## 8. Validacoes realizadas

- Ciclo 2: lint aprovado; testes de `FormularioCotacao` e `cotacaoMapper`
  aprovados.
- Ciclo 2A: lint aprovado; testes relacionados aprovados; 41 testes aprovados.
- Ciclo 4: lint aprovado; teste `/leads` aprovado; 47 testes aprovados.
- Ciclo 5A: lint aprovado; teste `/leads` aprovado; 51 testes aprovados.

Estas validacoes sao registradas a partir dos relatorios anteriores da fase.

## 9. Revisoes independentes

- Ciclo 2 foi reprovado inicialmente por risco de `clienteId` atravessar
  usuarios.
- Ciclo 2A corrigiu o risco e foi aprovado com ressalva nao bloqueante.
- Ciclo 4 foi aprovado com ressalvas nao bloqueantes.
- Ciclo 5A foi aprovado com ressalvas nao bloqueantes.

## 10. Ressalvas aceitas

- Falta teste integrado montando `page.tsx` com troca real de contexto de
  autenticacao.
- Homonimos legados sem telefone podem ser agrupados pelo nome.
- Falta teste DOM confirmando visualmente rota e datas nas cotacoes internas.
- Testes de ausencia de edicao comercial em `/leads` usam leitura estatica do
  arquivo, nao renderizacao real.

Essas ressalvas nao bloquearam a fase porque nao foi identificado vazamento
real, mistura critica ou quebra funcional. Elas permanecem como pontos de
fortalecimento futuro, especialmente para testes integrados e cenarios legados.

## 11. Fora de escopo

Esta fase nao fez:

- push
- deploy
- alteracao em `main`
- alteracao de Firestore Rules
- migracao de documentos antigos
- alteracao em services
- alteracao em `/historico` no Ciclo 5A
- alteracao em `/clientes` no Ciclo 5A
- criacao de status agregado por cliente

## 12. Proximos cuidados

- Antes de merge para `main`, rodar validacao ampla.
- Antes de deploy, confirmar ambiente correto e banco correto.
- `main` esta ligada a producao e Netlify.
- Branches de implementacao devem usar ambiente separado/local.
- Avaliar teste integrado futuro para troca real de usuario.
- Avaliar teste DOM futuro para `/leads`.
- Avaliar estrategia de migracao ou associacao manual para cotacoes legadas sem
  `clienteId`.
