# Checklist pre-merge - Acesso por perfil e agencia

> **Aviso operacional:** este documento registra uma fase historica em
> `crm-carioca` (producao). Os comandos abaixo sem `--project` nao sao modelo
> para o Firebase DEV. Toda operacao destinada ao DEV deve usar explicitamente
> `--project crm-carioca-dev`.

## Estado esperado

- Branch atual: `crm-cotacao`.
- Working tree limpo com `git status --short`.
- Fase de acesso por perfil validada manualmente.
- Firestore Rules publicadas no projeto `crm-carioca`.
- Supervisor ve equipe apenas em `/historico`.
- `/leads` permanece individual por usuario.
- `/clientes` permanece individual por usuario.

## Commits relevantes

- `502ff6c docs: fecha fase de acesso por perfil`
- `b044d35 fix: preserva autoria nas regras de cotacao`
- `3a48194 feat: exibe agente responsavel no historico`
- `7975e25 fix: mantem leads individuais por usuario`
- `390fae1 fix: ajusta acoes do supervisor no historico`
- `68b90a2 docs: registra checkpoint de acesso por perfil`
- `43cb08a chore: configura firebase cli para rules`
- `a249d40 fix: restringe criacao de perfil pendente`

## Validacoes automaticas antes do merge

Rodar dentro de `painel-viagens`:

```bash
npm run test
npm run lint
npm run build
```

Observacao: o build pode falhar por fetch das fontes Geist/Google Fonts. Se isso acontecer, repetir com rede liberada antes de considerar erro de codigo.

## Validacoes manuais obrigatorias

- Novo usuario cria perfil `pendente`.
- Supervisor acessa `/usuarios`.
- Supervisor aprova agente.
- Supervisor promove agente para supervisor.
- Agente comum nao acessa `/usuarios`.
- Agente ve apenas seus proprios dados.
- Supervisor ve equipe apenas em `/historico`.
- `/leads` segue individual.
- `/clientes` segue individual.
- `/historico` visao Equipe mostra agente responsavel.
- Cotacoes antigas exibem fallback `Agente nao identificado`.
- Supervisor na visao Equipe so ve `Editar comercial`.
- Edicao comercial funciona sem erro de permissao.

## Firestore Rules

- Confirmar projeto Firebase: `crm-carioca`.
- Confirmar que o deploy foi feito somente com:

```bash
firebase deploy --only firestore:rules
```

- Confirmar que o commit `b044d35 fix: preserva autoria nas regras de cotacao` ja foi publicado nas rules antes do merge para `main`.
- Confirmar que `ownerId`, `agencyId`, `ownerName` e `ownerEmail` sao preservados em updates.
- Confirmar que permissoes nao foram afrouxadas.

## Console do navegador

Conferir durante os testes:

- Sem erro inesperado de permissao.
- Sem erro pendente de indice Firestore.
- Se aparecer link de indice, registrar antes de alterar codigo.

## Seguranca e arquivos sensiveis

Antes do merge, confirmar:

- `.env` e `.env.local` nao aparecem no diff.
- Credenciais nao aparecem no diff.
- `firebase_credentials.json` nao esta versionado.
- `package.json` e lockfile nao foram alterados sem motivo.
- Nao houve deploy de Hosting, Functions ou Storage.
- Nao houve push/merge acidental.

## Decisoes de produto consolidadas

- `/historico` e a unica visao de equipe para supervisor.
- `/leads` e individual por usuario.
- `/clientes` e individual por usuario.
- Supervisor acompanha producao e historico da equipe, mas nao opera leads/clientes dos agentes.
- Identificacao do agente responsavel aparece no historico de equipe.

## Riscos conhecidos

- Cotacoes antigas sem `ownerName`/`ownerEmail` mostram `Agente nao identificado`.
- Pode haver necessidade de indices Firestore para consultas por `agencyId` com ordenacao.
- `hasAdminFallback` deve ser revisado futuramente.
- Build pode depender de rede para baixar fontes Geist/Google Fonts.

## Checklist final antes de mergear em main

- [ ] `git status --short` limpo.
- [ ] `npm run test` passou.
- [ ] `npm run lint` passou.
- [ ] `npm run build` passou.
- [ ] Teste manual de agente passou.
- [ ] Teste manual de supervisor passou.
- [ ] `/historico` Equipe validado.
- [ ] `/leads` individual validado.
- [ ] `/clientes` individual validado.
- [ ] Firestore Rules com `b044d35` publicadas em `crm-carioca`.
- [ ] Nenhum arquivo sensivel no diff.
- [ ] Nenhum deploy indevido de Hosting/Functions/Storage.

## Rollback basico

- Se a UI quebrar, reverter o commit de UI correspondente.
- Se rules bloquearem operacao, revisar o ultimo commit de `firestore.rules` e publicar novamente somente com `firebase deploy --only firestore:rules`.
- Nao reverter rules em producao sem confirmar impacto em usuarios pendentes, agentes e supervisores.
