# Checkpoint: Firestore e identidade de clientes

## Identificacao

- Projeto: CRM Voo Singular / Painel de Viagens
- Fase: Firestore, identidade de clientes e isolamento de sessao
- Data: 2026-07-01
- Branch: `crm-cotacao-clean`
- HEAD: `eac9c5f51f51ce04ae29bc89f15cb344caba4299`
- Remote: sincronizado com `origin/crm-cotacao-clean` (`0` atras / `0` a frente)
- Push: realizado
- Deploy: nao realizado

## Objetivo da fase

Comercialmente, a fase tornou o reaproveitamento de clientes mais seguro e
reduziu friccao ao preencher novas cotacoes, pesquisar a carteira e corrigir
telefones.

Tecnicamente, consolidou identidade documental por ID, reduziu leituras do
Firestore, paginou `/clientes`, tornou as mutacoes reconciliaveis e impediu que
formularios, selecoes ou resultados assincronos atravessem sessoes.

## Problemas originais

- Cliente era identificado de forma insuficiente em alguns fluxos.
- O autocomplete nao preservava identidade documental segura.
- A busca telefonica podia gerar consultas excessivas.
- A carteira era carregada integralmente.
- Edicoes telefonicas eram ausentes ou ambiguas.
- Resultados e selecoes podiam sobreviver a trocas de sessao.
- Criacao e edicao manual podiam deixar `telefoneNormalizado` incoerente.

## Decisoes arquiteturais

- Cliente e identificado pelo ID documental do Firestore.
- Nome e telefone nao substituem o ID; homonimos permanecem separados.
- Cliente, cotacao e oportunidade comercial sao entidades distintas.
- O lead e um agrupamento derivado de cotacoes, sem documento proprio.
- Editar telefone atualiza somente a cotacao explicitamente selecionada.
- Em `/leads`, a cotacao interna e selecionada por `cotacao.id`.
- `telefone` e `telefoneNormalizado` sao persistidos em conjunto.
- Os fluxos corrigidos nesta fase preservam a identidade original da abertura
  ou selecao.

## Commits consolidados

| Hash | Mensagem | Objetivo |
| ---- | -------- | -------- |
| `549f214` | `feat: preencher cliente na nova cotacao` | Usar clientes reais no autocomplete, preservando ID, nome e telefone. |
| `a0ecbfe` | `perf: reduzir consultas na busca por telefone` | Aplicar debounce e invalidar resultados telefonicos obsoletos. |
| `1337ac5` | `perf: paginar carteira de clientes` | Paginar a carga inicial e introduzir pesquisa lazy, cache e reconciliacao. |
| `5973dbc` | `feat: permitir editar telefone no historico` | Editar somente a cotacao selecionada, com telefone visual e normalizado. |
| `fa8a38f` | `feat: permitir editar telefone nos leads` | Editar a cotacao interna por ID e reagrupar a oportunidade derivada. |
| `eac9c5f` | `fix: isolar sessoes em clientes e historico` | Vincular formularios e selecoes a identidade original da sessao. |

## Arquivos principais da fase

- `painel-viagens/src/components/FormularioCotacao.tsx`
- `painel-viagens/src/components/FormularioCotacao.test.tsx`
- `painel-viagens/src/app/clientes/page.tsx`
- `painel-viagens/src/app/clientes/page.test.ts`
- `painel-viagens/src/app/historico/page.tsx`
- `painel-viagens/src/app/historico/page.test.ts`
- `painel-viagens/src/app/leads/page.tsx`
- `painel-viagens/src/app/leads/page.test.ts`
- `painel-viagens/src/services/clientesService.ts`
- `painel-viagens/src/services/clientesService.test.ts`
- `docs/checkpoint-autocomplete-clientes.md`

## Comportamento final

### Autocomplete

- Usa a collection `clientes`.
- Preserva o ID documental e separa homonimos.
- Preenche nome e telefone, sem recuperar viagens antigas.
- Mantem digitacao manual.
- A busca telefonica permanece isolada por usuario.

### Debounce

- Reduz consultas durante a digitacao do telefone.
- Trata telefone vazio.
- Descarta respostas antigas apos troca de usuario, logout ou unmount.

### `/clientes`

- A carga inicial e paginada por cursor documental.
- A pesquisa lazy carrega a carteira integral somente quando necessaria.
- Cache e diario versionado sao segmentados por usuario e geracao.
- Criacao, edicao e exclusao sao reconciliadas sem perder respostas concorrentes.
- Listas sao deduplicadas por ID e preservam homonimos.
- Criacao e edicao manual persistem telefone visual e normalizado.

### `/historico`

- A edicao completa usa apenas a cotacao selecionada por ID.
- `telefone` e `telefoneNormalizado` sao persistidos juntos.
- Nenhum cliente ou cotacao irma e alterado.
- Permissoes de agent, supervisor e admin foram preservadas.
- A selecao carrega a identidade original da sessao.

### `/leads`

- A oportunidade e um agrupamento visual derivado.
- A edicao exige uma cotacao interna explicitamente selecionada por ID.
- Somente essa cotacao e atualizada.
- O grupo e a pesquisa refletem o novo telefone.
- Clientes e cotacoes irmas nao sao alterados.
- A tela permanece owner-only.

### Sessao

- Em `/clientes`, criacao, edicao, exclusao, cargas paginadas, pesquisa lazy,
  cache e diario de mutacoes foram protegidos contra troca de sessao.
- Em `/historico`, a garantia cobre edicao completa, edicao comercial e cargas
  assincronas protegidas da pagina.
- Em `/leads`, a fase validou edicao telefonica, edicao comercial e conversao
  em cliente dentro do fluxo protegido da pagina.
- Nesses fluxos, formularios e selecoes guardam a identidade da abertura, a
  geracao nao e recapturada no submit e os resultados obsoletos sao descartados.
- A validacao antes e depois do write foi aplicada as mutacoes explicitamente
  tratadas nos Ciclos 5B e 6.
- Exclusao de cotacao em `/historico`, adicionar cotacao aos clientes em
  `/historico` e outras acoes nao modificadas no Ciclo 6 ficaram fora dessa
  garantia consolidada.
- A garantia nao deve ser interpretada como cobertura automatica de toda acao
  assincrona existente no CRM.

### Telefone normalizado

- O telefone visual e preservado.
- `telefoneNormalizado` e recalculado pela funcao central.
- Telefone vazio grava ambos os campos como `""`.
- Documentos antigos sao corrigidos apenas quando editados.
- Nenhuma migracao em massa foi realizada.

## Seguranca

As mutacoes corrigidas capturam usuario, geracao, agencia, perfil, tipo e ID
aplicavel. Nas edicoes do historico, tambem preservam visao e ownership.

Nesses fluxos, a validacao ocorre antes do write e antes de publicar sucesso,
erro ou estado local. Isso protege trocas A para B e A1 para B para A2,
inclusive quando A2 reutiliza UID, agencia, perfil ou referencia de usuario
aparentemente iguais.

Firestore Rules permanecem como defesa adicional. Elas nao substituem a
validacao de contexto no cliente.

## Firestore

- Consultas telefonicas foram reduzidas por debounce.
- `/clientes` passou a usar paginacao por cursor.
- A pesquisa alem da primeira pagina e lazy.
- O autocomplete por nome ainda carrega a carteira integralmente.
- Nao houve migracao de documentos.
- Nao houve alteracao de Rules nesta fase.
- Nao houve alteracao de indices nesta fase.

## Validacoes

- 220/220 testes aprovados.
- Lint aprovado.
- Build aprovado.
- TypeScript aprovado.
- `git diff --check` aprovado.
- Revisoes independentes aprovadas, com ressalvas nao bloqueantes.

## Ressalvas

- Ausencia de testes DOM integrados.
- Diario de mutacoes sem compactacao.
- Autocomplete por nome ainda carrega a carteira integralmente.
- Clientes sem `dataCadastro` continuam fora de consultas ordenadas.
- Conversao legada sem telefone preserva o comportamento antigo: o fluxo nao
  foi alterado nesta fase, pode gravar `"Nao informado"` e pode omitir
  `telefoneNormalizado`. A harmonizacao fica para ciclo futuro.

## Estado Git final

```text
Branch: crm-cotacao-clean
HEAD: eac9c5f51f51ce04ae29bc89f15cb344caba4299
Remote: sincronizado
Push: realizado
Deploy: nao realizado
```

## Proximos passos

- Otimizar `/historico`.
- Otimizar `/leads`.
- Adicionar testes DOM integrados.
- Compactar o diario de mutacoes.
- Evitar carga integral no autocomplete por nome.
- Harmonizar a conversao sem telefone.
- Tratar clientes legados sem `dataCadastro`.
