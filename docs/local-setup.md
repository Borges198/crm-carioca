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

As regras Firestore ainda estao documentadas apenas como proposta em:

```bash
docs/firestore-security-proposal.md
```

Nenhum deploy de regras deve ser feito sem revisar essa proposta e decidir como tratar documentos antigos.

## Observacao sobre indices Firestore

Consultas com `ownerId` e `orderBy` podem exigir indices compostos no Firestore.

Se o console do navegador ou o Firebase retornar um erro com link para criar indice, revise e crie o indice no Firebase Console antes de considerar isso um erro de codigo.

## Seguranca

Nunca commite arquivos ou valores sensiveis, incluindo:

- `.env`
- `.env.local`
- tokens
- chaves
- credenciais Firebase
- `firebase_credentials.json`

Use arquivos de exemplo sem valores reais quando precisar documentar variaveis de ambiente.
