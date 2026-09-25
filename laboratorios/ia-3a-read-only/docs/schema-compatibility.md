# IA-3A — compatibilidade estática do schema

Esta fundação não acessa Firebase nem Firestore. A compatibilidade foi verificada
somente no código atual do CRM.

`acompanhamentos` suporta o escopo aprovado diretamente: o tipo
`Acompanhamento` declara `ownerId` e `agencyId`, e a materialização persiste os
dois campos em cada documento. Portanto a consulta pode aplicar ambos os
filtros na própria coleção, sem fallback, join amplo ou leitura adicional.

Fontes verificadas:

- `painel-viagens/src/types/acompanhamento.ts`
- `painel-viagens/src/services/acompanhamentosService.ts`

A integração concreta com Firestore permanece fora do IA-3A. O único ponto de
entrada externo desta fundação é uma função de leitura que recebe uma
especificação imutável de consulta. Nenhum SDK Firebase é importado e nenhuma
API de mutação é exposta.
