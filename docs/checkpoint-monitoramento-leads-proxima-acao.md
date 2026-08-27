# Checkpoint: monitoramento de leads por próxima ação

## Objetivo da fase

Esta fase adicionou acompanhamento comercial persistente às oportunidades de
`/leads` e passou a priorizar visualmente as cartelas pela data da próxima
ação, sem transformar pessoa, cotação e oportunidade na mesma entidade.

## Modelo de domínio

- Pessoa não é oportunidade: a pessoa representa a identidade comercial; a
  oportunidade representa um contexto de acompanhamento derivado das cotações.
- A coleção `acompanhamentos` persiste o estado operacional da oportunidade,
  incluindo proprietário, agência, cotação-âncora e `proximaAcaoEm`.
- `acompanhamentoId` materializa o vínculo entre as cotações atuais da cartela e
  o documento de acompanhamento.
- A criação ocorre sob demanda, somente quando o usuário define a primeira
  próxima ação.
- Antes da materialização, a interface informa quantas cotações atuais serão
  vinculadas e exige confirmação explícita.
- Uma nova cotação não herda `acompanhamentoId` automaticamente. A inclusão em
  um acompanhamento existente exige uma decisão futura e explícita.

## Persistência e segurança

- A criação do acompanhamento e o vínculo das cotações são feitos na mesma
  transação.
- As Rules validam proprietário, agência, cotação-âncora e consistência de
  `acompanhamentoId` na materialização inicial.
- Leituras e atualizações de `acompanhamentos` permanecem owner-only.
- A listagem no cliente consulta `acompanhamentos` por `ownerId`.
- A correção das Rules permite a primeira materialização transacional sem
  ampliar a visão de equipe do supervisor.

## Classificação e ordenação

As próximas ações são classificadas como:

1. `ATRASADA`
2. `HOJE`
3. `PRÓXIMA`
4. `NÃO DEFINIDA`

A ordenação segue a mesma prioridade. Dentro dos grupos, ações atrasadas usam a
data mais antiga primeiro, ações próximas usam a data mais próxima primeiro e
os grupos `HOJE` e `NÃO DEFINIDA` preservam a ordem relativa anterior. A edição
de `proximaAcaoEm` atualiza o acompanhamento e a lista é reordenada a partir do
estado persistido.

## Validações da fase

- Testes unitários cobrem identidade e vínculo do acompanhamento, criação sob
  demanda, ausência de herança automática, atualização da próxima ação,
  classificação e ordenação estável.
- A suíte executável com Firebase Emulator cobre leitura owner-only,
  materialização transacional válida e rejeição de violações de proprietário,
  agência, cotação-âncora ou vínculo.
- A validação operacional da persistência foi realizada no Firebase DEV; a
  produção não foi usada. A validação visual final de `/leads` depende de uma
  sessão autenticada no Firebase DEV e é realizada manualmente pelo usuário.
- `git diff --check origin/main...HEAD` foi aprovado na auditoria final.

## Commits da fase

| Commit | Descrição |
| --- | --- |
| `e5bb4e6991716cdf8bfbf0c0a31d9d1f0c45c18a` | `feat: adiciona acompanhamento persistente de leads` |
| `71e3d1fb072d29bf5fb3dd97859d5fead14109e4` | `fix: permite materializacao inicial de acompanhamento` |
| `3b6496b1b26c8c132da0e55ae2c27b6881b8ffb6` | `feat: classifica proxima acao dos leads` |
| `e3d1d17f060401d51d59ac3b00c275a0ab57f11f` | `feat: prioriza leads pela proxima acao` |

## Escopo preservado

- Smart Paste não foi alterado.
- A visão de equipe do supervisor não foi ampliada.
- Configuração e ambiente de produção não foram alterados.
- Não houve merge para `main` nesta fase.

## Ressalva fora da fase

O texto `Invalid Date` observado em `/leads` é um bug separado e ficou fora do
escopo desta fase. Nenhuma correção relacionada foi incluída.

## Estado de produção

Produção permaneceu intocada: sem alteração de configuração, sem merge e sem
deploy.
