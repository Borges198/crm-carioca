# Checkpoint de controle de acesso

Data do checkpoint: 2026-06-05

Branch: `crm-cotacao`

## Commits relevantes

- `43cb08a chore: configura firebase cli para rules`
- `a249d40 fix: restringe criacao de perfil pendente`
- `d525181 feat: permite supervisor gerenciar usuarios`

## Publicacao das Firestore Rules

Projeto Firebase usado: `crm-carioca`

Comando executado:

```bash
firebase deploy --only firestore:rules
```

Resultado:

- Rules compiladas com sucesso.
- `firestore.rules` publicado em `cloud.firestore`.
- Deploy completo.
- Apenas Firestore Rules foram publicadas.
- Nao houve deploy de Hosting, Functions ou Storage.

## Checklist manual pos-deploy

- [x] Usuario novo criou perfil pendente.
- [x] Supervisor acessou `/usuarios`.
- [x] Supervisor aprovou agente.
- [x] Supervisor promoveu agente para supervisor.
- [x] Agente comum nao acessou `/usuarios`.
- [x] Agente criou cotacao.
- [x] Agente viu apenas suas proprias cotacoes.
- [x] Supervisor viu visao Equipe no `/historico`.

Resultado: aprovado.

## Validacao manual final pos-ajuste do historico

- [x] Supervisor acessa `/usuarios`.
- [x] Supervisor aprova agente pendente.
- [x] Supervisor promove agente aprovado para supervisor.
- [x] Supervisor acessa `/historico` na visao Equipe.
- [x] Supervisor na visao Equipe fica limitado as acoes permitidas.
- [x] Agente comum nao acessa `/usuarios`.
- [x] Agente ve apenas suas proprias cotacoes.
- [x] Teste manual passou no navegador real.

## Pendencias futuras

- Avaliar visao Equipe em `/leads`.
- Avaliar visao Equipe em `/clientes`.
- Melhorar UX do `/historico` para esconder acoes que supervisor nao pode executar.
- Monitorar possiveis indices Firestore.
- Revisar futuramente `hasAdminFallback`.

## Estado final da fase de acesso por perfil

A fase de acesso por perfil foi validada com supervisor, agente e fluxo de aprovacao funcionando no navegador real. O supervisor consegue acompanhar a equipe no historico, enquanto leads e clientes permanecem individuais por usuario.

Decisao de produto consolidada:

- `/historico` tem visao Equipe para supervisor/admin.
- `/leads` continua individual por usuario.
- `/clientes` continua individual por usuario.
- Supervisor acompanha producao e historico da equipe, mas nao opera leads/clientes dos agentes.

Regras de acesso validadas:

- Supervisor acessa `/usuarios`.
- Supervisor aprova usuario pendente como agente.
- Supervisor promove agente aprovado para supervisor.
- Agente comum nao acessa `/usuarios`.
- Agente ve apenas seus proprios dados.
- Supervisor ve equipe apenas no `/historico`.

Identificacao do agente responsavel:

- Novas cotacoes gravam `ownerName` e `ownerEmail`, quando disponiveis.
- Historico na visao Equipe exibe o agente responsavel pela cotacao.
- Cotacoes antigas sem esses campos exibem fallback `Agente nao identificado`.

Hardening das Firestore Rules:

- `ownerId`, `agencyId`, `ownerName` e `ownerEmail` sao preservados em updates.
- Edicao comercial do supervisor continua permitida.
- Permissoes nao foram afrouxadas.

Validacao manual:

- Testes no navegador real passaram.
- Supervisor e agente ficaram cada um no seu escopo.
- Nao houve erro de permissao observado ate o momento.

Pendencias futuras:

- Monitorar possiveis indices Firestore.
- Avaliar refinamentos de UX.
- Manter `/leads` e `/clientes` individuais.
- Preparar checklist pre-merge/main quando o bloco for fechado.
