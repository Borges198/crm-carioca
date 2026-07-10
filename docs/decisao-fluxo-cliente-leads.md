# Decisão do fluxo entre Cliente, Cotação, Histórico e Leads

## 1. Decisão

Esta fase adota as seguintes definições:

- Cliente é a entidade central.
- Cotação é uma proposta individual.
- Histórico é a fonte operacional das cotações e dos status.
- Leads é a cartela comercial agrupada por cliente.

## 2. Problema observado

Atualmente, `/leads` ainda agrupa cotações e pode separar o mesmo cliente em
cards diferentes. Isso pode ocorrer quando mudam o telefone, a rota, o destino,
a data ou outros campos da cotação.

Esses campos descrevem uma proposta ou viagem específica e não devem definir a
identidade permanente do cliente. O agente não deve precisar caçar cotações
espalhadas da mesma pessoa.

## 3. Regra comercial

- Um cliente pode ter várias cotações.
- Um cliente pode ter várias viagens.
- Um cliente cadastrado pode continuar aparecendo em Leads e no funil
  comercial.
- Cliente não deve ser duplicado por destino diferente.
- Cotação não deve definir a identidade do cliente.
- Telefone ajuda a identificar, mas não deve ser a única identidade.

## 4. Separação de domínio

- **Cliente:** pessoa ou contato comercial.
- **Cotação:** proposta específica de viagem.
- **Histórico:** fonte operacional das cotações e dos status.
- **Leads:** cartela comercial agrupada por cliente.

O status comercial deve ter sua fonte principal em `/historico`. Leads deve
refletir esse status, sem criar uma fonte concorrente ou conflito de status.

## 5. Direção técnica futura

- `clientes/{clienteId}` representa a identidade oficial do cliente.
- `cotacoes/{cotacaoId}` representa a proposta individual.
- Novas cotações devem salvar `clienteId` quando um cliente existente for
  selecionado.
- `/leads` deve agrupar por `ownerId + clienteId` quando `clienteId` existir.

Estas definições registram uma direção técnica. Nenhuma delas é implementada
neste ciclo documental.

## 6. Fallback para documentos legados

Documentos antigos precisam de fallback seguro quando não tiverem `clienteId`:

1. Primeiro fallback: `ownerId + telefoneNormalizado`.
2. Fallback final, usado com cautela: `ownerId + nome normalizado`.

Nome sozinho não deve ser considerado identidade forte quando houver
alternativa melhor.

## 7. Fora de escopo desta fase inicial

- CRUD completo de usuários.
- Bloqueio ou desbloqueio de agente.
- Exclusão ou inativação de cliente.
- Alteração ampla de Firestore Rules.
- Deploy.
- Migração em massa.
- Refatoração visual ampla.

Também ficam fora deste ciclo a implementação de `clienteId` nas cotações, a
mudança do agrupamento de Leads e qualquer alteração de comportamento da
aplicação.

## 8. Microciclos planejados

- Ciclo 0 — Documento de decisão.
- Ciclo 1 — Diagnóstico técnico de `clienteId`.
- Ciclo 2 — Salvar `clienteId` em novas cotações.
- Ciclo 3 — Diagnóstico de agrupamento de leads.
- Ciclo 4 — Cartela de leads por cliente.
- Ciclo 5 — Status com fonte no histórico.
- Ciclo 6 — Revisão consolidada.

## 9. Limite operacional

Esta decisão não autoriza alteração direta em produção. As próximas mudanças
devem ocorrer em branch de implementação, ser validadas nos respectivos
microciclos e não devem alterar produção diretamente.
