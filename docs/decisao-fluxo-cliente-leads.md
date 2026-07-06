# Decisão do fluxo entre clientes, cotações, histórico e leads

## 1. Decisão

Cliente é a entidade central do CRM.

Cotação é uma proposta específica.

Histórico é a fonte operacional das cotações.

Leads é a cartela comercial agrupada por cliente.

## 2. Problema atual

Atualmente, `/leads` ainda pode separar o mesmo cliente em vários cards porque considera dados da cotação, como telefone, rota, data, origem e destino, na formação dos grupos.

Esses dados descrevem uma proposta ou viagem específica e não devem definir a identidade permanente do cliente. O comportamento atual, portanto, não representa corretamente o fluxo comercial da agência.

## 3. Fluxo comercial oficial

1. O agente cria uma cotação.
2. A cotação entra no Histórico.
3. O status comercial é editado no Histórico.
4. Leads reflete as cotações conforme o status comercial.
5. Leads agrupa as cotações por cliente.
6. Um cliente pode ter várias cotações dentro da mesma cartela.
7. Um cliente pode estar cadastrado e continuar aparecendo em Leads.

## 4. Regras de domínio

- Cliente não deve ser duplicado por ter um destino diferente.
- Cotação não deve definir a identidade do cliente.
- Telefone ajuda a identificar o cliente, mas não deve ser sua única identidade.
- Cliente cadastrado pode continuar no funil comercial.
- O status comercial deve ter uma fonte principal: o Histórico.
- Leads deve refletir o estado comercial sem gerar conflito de status.

## 5. Direção técnica futura

- Novas cotações devem salvar `clienteId` quando o cliente for selecionado.
- Leads deve futuramente agrupar por `ownerId + clienteId`.
- Documentos antigos devem ter fallback por `telefoneNormalizado`.
- Quando não houver telefone, o fallback por nome deve ser usado com cautela.

Estas definições registram uma direção técnica e não implementam mudanças neste ciclo.

## 6. Fora do escopo deste documento

Este ciclo não implementa:

- `clienteId` em cotação;
- novo agrupamento de leads;
- mudança de status;
- alteração de Rules;
- alteração de permissões;
- CRUD de usuários;
- exclusão de clientes;
- deploy.

## 7. Próximos ciclos sugeridos

- Ciclo 8 — Salvar `clienteId` em novas cotações.
- Ciclo 9 — Reagrupar Leads como cartela por cliente.
- Ciclo 10 — Definir status comercial apenas pelo Histórico.
- Ciclo 11 — Revisar permissões de supervisor e CRUD de usuários.
