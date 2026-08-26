# Local Setup

## Pasta do projeto

O app Next.js fica em:

```bash
painel-viagens
```

Execute os comandos abaixo a partir dessa pasta.

```bash
cd painel-viagens
```

## Comandos principais

Instalar dependencias:

```bash
npm install
```

Rodar em desenvolvimento:

```bash
npm run dev
```

Rodar em desenvolvimento com limite de memoria e webpack:

```bash
NODE_OPTIONS="--max-old-space-size=1024" npx next dev --webpack
```

Validar lint:

```bash
npm run lint
```

Gerar build de producao:

```bash
npm run build
```

## Observacao sobre build e fontes

O projeto usa `next/font` com as fontes Geist e Geist Mono.

Por isso, `npm run build` pode precisar de acesso a internet para baixar:

- `Geist`
- `Geist Mono`

Se o build falhar apenas com erro de fetch dessas fontes, isso nao significa necessariamente erro no codigo da aplicacao. Rode novamente com rede disponivel.

## Observacao sobre multiplos package-lock.json

Existe mais de um `package-lock.json` em diretorios acima do projeto. Para evitar que o Next/Turbopack infira a raiz errada, o projeto fixa a raiz em `painel-viagens/next.config.ts` usando `turbopack.root`.

Mesmo assim, os comandos devem ser executados dentro de `painel-viagens`.

## Troubleshooting do dev server Next

Se uma nova tentativa de iniciar o dev server subir em `3001`, isso geralmente indica que a porta `3000` ainda esta ocupada por um servidor antigo.

Verifique processos ativos relacionados a Next, Node ou npm:

```bash
ps aux | grep -E "next|node|npm" | grep -v grep
```

Se houver um servidor Next antigo e voce quiser reiniciar do zero, encerre os processos do dev server:

```bash
pkill -f "next-server"
pkill -f "next dev"
```

Depois, limpe apenas o cache de desenvolvimento do Next. Nao apague `node_modules`.

```bash
rm -rf .next/dev
```

Inicie novamente em modo mais estavel:

```bash
NODE_OPTIONS="--max-old-space-size=1024" npx next dev --webpack
```

O arquivo `.next/dev/lock` pode apontar para PID e porta usados pelo dev server. Antes de limpar esse cache, confirme que nao ha processo Next ativo do projeto.

## Observacao sobre Firestore e ownerId

Novas cotacoes e novos clientes gravam `ownerId` com o UID do usuario autenticado.

As telas abaixo filtram dados por `ownerId`:

- `/historico`
- `/clientes`

Documentos antigos sem `ownerId` nao aparecem nessas telas filtradas. Eles precisam de uma migracao manual ou script separado caso devam voltar a ser acessiveis.

O desenho inicial das Rules permanece registrado em:

```bash
docs/firestore-security-proposal.md
```

O estado posteriormente validado de acesso por perfil e publicacao de Rules
esta registrado em:

```bash
docs/access-control-checkpoint.md
```

A fase Firestore e identidade consolidada em 2026-07-01 nao alterou nem
republicou Rules. Mudancas futuras ainda devem considerar documentos antigos.

## Observacao sobre indices Firestore

O ambiente local usa o Firebase DEV `crm-carioca-dev`, enquanto a Firebase
CLI mantem `crm-carioca` (producao) como projeto default na `.firebaserc`.
Branch Git nao seleciona projeto Firebase.

Todo comando Firebase destinado ao DEV deve informar explicitamente:

```bash
--project crm-carioca-dev
```

Por exemplo:

```bash
firebase firestore:indexes --project crm-carioca-dev
```

Os tres indices compostos existentes no DEV estao versionados em
`firestore.indexes.json` e referenciados por `firebase.json` na branch
`firebase-dev-recovery`, commit `0b560ec835f0491193a068f60bef83c72bb96ca6`.

Se surgir necessidade de outro indice, primeiro confirme o projeto e a query.
Nao crie nem publique indice especulativo e nunca use deploy do DEV sem
`--project crm-carioca-dev`.

O checkpoint consolidado esta em
`docs/checkpoint-firebase-dev-recovery.md`.

## Seguranca

Nunca commite arquivos ou valores sensiveis, incluindo:

- `.env`
- `.env.local`
- tokens
- chaves
- credenciais Firebase
- `firebase_credentials.json`

Use arquivos de exemplo sem valores reais quando precisar documentar variaveis de ambiente.
