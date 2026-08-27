# Checkpoint Style Mobile

Data do checkpoint: 2026-08-27

## Estado da frente

```text
STYLE MOBILE
→ PAUSADO DE FORMA CONTROLADA
```

Este checkpoint consolida os ciclos UXM-0, UXM-1 e UXM-2. A frente não está
definitivamente encerrada. Melhorias futuras de responsividade, legibilidade e
usabilidade mobile permanecem sob responsabilidade desta frente quando a
Central decidir retomá-la.

## UXM-0 — Diagnóstico

Status: **CONCLUÍDO**.

O diagnóstico identificou que valores já preenchidos em campos da Nova Cotação
podiam apresentar contraste insuficiente em aparelhos configurados para modo
escuro.

A causa técnica consolidada foi:

```text
GLOBAL_CSS + HERANÇA
```

O `body` fornecia a cor global e os controles sem cor explícita herdavam esse
valor. Em modo escuro, a combinação produzia texto claro sobre os fundos claros
dos inputs. A investigação também confirmou que a causa não era `disabled`,
`readOnly` nem opacidade aplicada ao formulário.

## UXM-1 — Legibilidade da Nova Cotação

Status: **CONCLUÍDO**.

Commit:

```text
fee5061
fix: melhora legibilidade da cotacao no mobile
```

A correção foi restrita aos inputs da Nova Cotação que dependiam da herança de
cor. Foram aplicadas as classes:

```text
text-slate-700
placeholder:text-slate-400
```

Com isso, valores preenchidos passaram a ter cor escura explícita e os
placeholders permaneceram visualmente secundários, inclusive quando o aparelho
está em modo escuro.

### Validações do UXM-1

- `FormularioCotacao.test.tsx`: 27/27 testes aprovados.
- Lint: aprovado.
- `git diff --check`: aprovado.
- Teste visual em telefone real: aprovado.

### Escopo preservado no UXM-1

- Smart Paste.
- Estados React.
- Cálculos.
- Firebase.
- Firestore Rules.
- `globals.css`.
- Layout geral.

## UXM-2 — Navegação Mobile

Status: **CONCLUÍDO**.

Commit:

```text
7084ea1
fix: melhora navegacao mobile
```

A solução ficou restrita a `MainNav.tsx` e preservou a arquitetura existente:

- navegação em uma única linha;
- scroll horizontal com `overflow-x-auto`;
- fade visual à direita no mobile para indicar continuidade;
- padding final no trilho horizontal para o último item ter espaço de leitura;
- comportamento desktop preservado.

Não foram introduzidos menu hambúrguer, dropdown, quebra em múltiplas linhas ou
reordenação de rotas.

### Validações do UXM-2

- Lint: aprovado.
- Build: aprovado.
- `git diff --check`: aprovado.
- Teste visual em telefone real: aprovado.

## Estado publicado informado

Ao consolidar os ciclos de código, o estado informado foi:

```text
origin/main...main: 0 0
working tree: LIMPA
```

## Escopo preservado pelo checkpoint

Este checkpoint é exclusivamente documental. Não altera:

- código da aplicação;
- CSS;
- testes;
- `package.json`;
- Firebase;
- Firestore Rules;
- Smart Paste.

## Continuidade futura

Os ciclos concluídos resolvem os problemas específicos de contraste dos campos
da Nova Cotação e de indicação da navegação horizontal observados nesta etapa.
Eles não representam o encerramento definitivo da área mobile.

Quando a Central decidir retomar a frente Style Mobile, novas melhorias de
responsividade, legibilidade e usabilidade devem partir deste checkpoint e ser
tratadas em microciclos próprios.
