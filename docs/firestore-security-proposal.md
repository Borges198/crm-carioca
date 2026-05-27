# Firestore Security Proposal

## Objetivo

Propor regras de seguranca para isolar dados por usuario autenticado usando o campo `ownerId` ja gravado em novos documentos de `cotacoes` e `clientes`.

Esta proposta nao foi aplicada em producao e nao substitui uma migracao planejada dos documentos antigos.

## Regras sugeridas

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner() {
      return isSignedIn() && request.auth.uid == resource.data.ownerId;
    }

    function isCreatingOwnDocument() {
      return isSignedIn() && request.auth.uid == request.resource.data.ownerId;
    }

    match /cotacoes/{cotacaoId} {
      allow create: if isCreatingOwnDocument();
      allow read, update, delete: if isOwner();
    }

    match /clientes/{clienteId} {
      allow create: if isCreatingOwnDocument();
      allow read, update, delete: if isOwner();
    }
  }
}
```

## Explicacao curta

- Usuarios sem login (`request.auth == null`) nao conseguem ler nem escrever dados.
- Novas `cotacoes` e novos `clientes` so podem ser criados quando `ownerId` for igual a `request.auth.uid`.
- Leitura, edicao e exclusao so sao permitidas quando o documento existente pertence ao usuario autenticado.
- O campo `ownerId` e a fronteira de isolamento atual. Ele deve continuar sendo gravado pela aplicacao em novas criacoes.

## Impacto em documentos antigos

Documentos antigos sem `ownerId` deixarao de ser acessiveis por essas regras.

Para recuperar acesso a esses dados, sera necessario fazer uma migracao manual ou um script separado que atribua `ownerId` corretamente. Essa migracao deve ser revisada antes de qualquer aplicacao das regras em producao.

## Riscos e pontos de atencao

- Consultas com `where("ownerId", "==", uid)` e `orderBy(...)` podem exigir indices compostos no Firestore.
- Se houver documentos com `ownerId` incorreto, eles ficarao visiveis para o usuario errado. A qualidade da migracao/importacao de dados e critica.
- O `isAdmin` existente no `AuthContext` e apenas uma verificacao client-side. Ele nao deve ser tratado como seguranca real sem custom claims verificadas nas regras do Firestore.
- Regras de seguranca nao devem depender de dados enviados pelo client sem validacao. Para papeis administrativos, use custom claims em `request.auth.token`.

## Checklist antes de aplicar

- Confirmar que novas `cotacoes` gravam `ownerId`.
- Confirmar que novos `clientes` gravam `ownerId`.
- Validar em ambiente de teste que `/historico` lista apenas documentos do usuario autenticado.
- Validar em ambiente de teste que `/clientes` lista apenas documentos do usuario autenticado.
- Decidir o destino dos documentos antigos sem `ownerId`: migrar, arquivar ou aceitar que fiquem inacessiveis.
- Criar os indices compostos solicitados pelo Firestore, se aparecerem erros nas queries.
- Testar leitura, criacao, edicao e exclusao com dois usuarios diferentes.
- Revisar se algum fluxo administrativo real precisa de custom claims antes de aplicar regras mais amplas.
- Aplicar as regras primeiro em ambiente de desenvolvimento ou staging.

## Proximo passo sugerido

Criar um arquivo `firestore.rules` apenas depois de revisar esta proposta e decidir como tratar documentos antigos sem `ownerId`.
