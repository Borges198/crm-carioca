# Checkpoint — Monitoramento de Leads: recorrência

## Objetivo

Evoluir a próxima ação dos acompanhamentos de Leads para representar uma data específica, uma recorrência diária ou a ausência intencional de próxima ação, com classificação e ordenação coerentes na interface.

## Contrato

O campo `tipoProximaAcao` admite:

- `DATA`: exige `proximaAcaoEm` preenchida com um Timestamp válido;
- `DIARIA`: exige `proximaAcaoEm = null`;
- `SEM_DATA`: exige `proximaAcaoEm = null`.

Não há scheduler nem criação de documentos diários. `DIARIA` é uma classificação persistida no acompanhamento, não uma automação. Também não houve migração em massa.

## Compatibilidade legada

- documento sem `tipoProximaAcao` e com `proximaAcaoEm` preenchida é interpretado como `DATA`;
- documento sem `tipoProximaAcao` e sem data é interpretado como `NÃO DEFINIDA`.

`SEM_DATA` é uma decisão explícita do usuário e aparece como `SEM PRÓXIMA AÇÃO`. Portanto, não equivale ao estado legado `NÃO DEFINIDA`, que representa ausência de definição.

## Comportamento e ordenação

Em `DATA`, a data determina a classificação `ATRASADA`, `HOJE` ou `PRÓXIMA`. Em `DIARIA`, a classificação é sempre `DIÁRIA`, sem depender de Timestamp. Em `SEM_DATA`, a classificação é sempre `SEM PRÓXIMA AÇÃO` e nunca fica atrasada.

A ordenação aprovada é:

1. `ATRASADA` — data mais antiga primeiro;
2. `HOJE` — ordem estável;
3. `DIÁRIA` — ordem estável;
4. `PRÓXIMA` — data mais próxima primeiro;
5. `SEM PRÓXIMA AÇÃO` — ordem estável;
6. `NÃO DEFINIDA` — ordem estável.

## Persistência e segurança

O serviço de acompanhamentos materializa e atualiza os três modos, rejeitando combinações inválidas antes da escrita. As Firestore Rules permitem o novo campo, validam a coerência entre modo e data e preservam os contratos existentes de owner, agência, cotação-âncora e cliente, sem ampliar permissões.

Os testes das Rules foram executados no Emulator local: **15/15 PASS**. O Firebase de produção não foi acessado.

## Interface

O modal de próxima ação em `/leads` oferece `Escolher uma data`, `Diariamente` e `Sem próxima ação no momento`. O input de data aparece e é obrigatório somente em `DATA`. Os cards exibem os seis estados e seguem a ordenação aprovada.

UI, modal e cards estão concluídos para esta fase. O problema de `Invalid Date` ficou fora do escopo.

## Validação final

- testes: **307 PASS / 15 SKIPPED**;
- lint: **PASS**;
- build: **PASS**;
- `git diff --check`: **PASS**;
- Firebase produção: **NÃO ACESSADO**;
- deploy: **NÃO EXECUTADO**.

## Commits da fase

- 3A — `552397cdab957205a78c018ea65d6daf5ec6ab2d` — `feat: adiciona modos de proxima acao`;
- 3B — `eafe5b2638939a541f9cc934e11da10161c6ada9` — `feat: persiste modos de proxima acao`;
- 3C — `b497731d1d242ee5176b9667cd701612363fdd95` — `feat: adiciona recorrencia ao acompanhamento de leads`.

## Estado separado

O stash `stash@{0}: wip ia-2e ponte leads` permanece preservado, não foi aplicado e não pertence a esta fase de recorrência.
