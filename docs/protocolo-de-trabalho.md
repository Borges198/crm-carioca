# Protocolo de Trabalho

## Como trabalhar com Codex

Use Codex como parceiro de implementacao e revisao, mas mantenha o escopo explicito antes de cada tarefa.

Ao pedir uma mudanca:

- diga se a tarefa e apenas documentacao, codigo, revisao ou investigacao;
- liste arquivos permitidos quando houver risco de mexer em areas sensiveis;
- informe comandos que devem ou nao ser executados;
- destaque regras de negocio que nao podem mudar;
- peca resumo final com arquivos alterados e validacoes feitas.

Quando a tarefa for de documentacao, Codex deve criar ou editar apenas Markdown e nao tocar na aplicacao.

## Checklist antes de alterar

- Conferir `git status`.
- Identificar branch atual.
- Ler documentacao relevante em `docs`.
- Ler apenas os arquivos de codigo necessarios para entender o comportamento.
- Confirmar escopo e arquivos permitidos.
- Verificar se ha mudancas preexistentes do usuario.
- Nao reverter mudancas que ja estavam no worktree.
- Nao instalar dependencias sem pedido explicito.
- Nao alterar credenciais, regras Firestore ou arquivos de ambiente.

## Checklist depois de alterar

- Conferir `git status`.
- Listar arquivos criados ou alterados.
- Confirmar se codigo da aplicacao foi ou nao alterado.
- Informar comandos executados.
- Informar comandos nao executados quando houver motivo.
- Sugerir commit com mensagem objetiva.

## Revisao segura antes de commit

Antes de commitar:

- revisar diff com foco em escopo;
- confirmar que nao ha arquivos sensiveis no diff;
- confirmar que `package.json` e `package-lock.json` nao mudaram sem necessidade;
- confirmar que `.env`, `.env.local`, tokens, chaves e credenciais nao entraram no commit;
- confirmar que `firestore.rules` nao foi alterado sem tarefa explicita;
- separar mudancas preexistentes do usuario das mudancas feitas na tarefa atual.

## Padrao de commits

Use mensagens curtas e descritivas em portugues ou ingles consistente com o historico do projeto.

Sugestoes de prefixo:

- `docs:` para documentacao;
- `fix:` para correcao;
- `feat:` para funcionalidade;
- `refactor:` para refatoracao sem mudanca funcional;
- `chore:` para manutencao.

Exemplo:

```bash
git commit -m "docs: cria base tecnica do CRM"
```

## Regra de credenciais

Nunca alterar, criar com valores reais ou commitar:

- `.env`;
- `.env.local`;
- tokens;
- chaves;
- credenciais Firebase;
- `firebase_credentials.json`;
- qualquer arquivo que contenha segredo operacional.

Quando for necessario documentar variaveis, usar exemplos sem valores reais.

## Regra de lint e build

Quando houver alteracao de codigo da aplicacao:

- rodar `npm run lint` dentro de `painel-viagens`;
- rodar `npm run build` dentro de `painel-viagens` quando a mudanca puder afetar build, tipos, rotas ou componentes;
- lembrar que `npm run build` pode precisar de rede por causa de `next/font` e fontes Geist.

Quando a tarefa for apenas documentacao Markdown:

- nao e necessario rodar `npm run build`;
- nao e necessario rodar `npm run lint`, a menos que o escopo peca explicitamente.
