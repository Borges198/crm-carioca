# Checkpoint final da recuperação do Firebase DEV

Data: 2026-08-25

## 1. Objetivo

Registrar o estado comprovado do Firebase DEV do CRM Voo Singular, sua
separação operacional da produção e a segregação Git das mudanças de
infraestrutura em relação à fase Smart Paste.

Este documento é um checkpoint. Ele não autoriza merge, deploy, alteração de
Rules, mudança de usuários ou revisão ampla de autoridade.

## 2. Estado final comprovado

| Item | Estado |
| --- | --- |
| Frontend local | **crm-carioca-dev** |
| Authentication DEV | Configurado |
| Email/Password | Habilitado |
| Google | Habilitado |
| Login do supervisor DEV | Passou |
| Perfil Firestore | supervisor, aprovado, voo-singular |
| Rotas principais | Passaram nos testes de leitura e navegação |
| Rules locais e publicadas no DEV | Iguais |
| Índices compostos no DEV | 3, todos READY |
| Produção usada nos testes | Não |

## 3. Isolamento entre DEV e produção

> **Regra crítica:** branch Git não define o projeto Firebase. .env.local e
> Firebase CLI são configurações independentes da branch.

- Ambiente local, Firebase DEV: **crm-carioca-dev**
- Produção, Firebase: **crm-carioca**
- Firebase CLI default: **crm-carioca**

O frontend local foi comprovado em crm-carioca-dev. A .firebaserc, porém,
mantém default apontando para crm-carioca, que é produção. Por isso, qualquer
comando Firebase destinado ao DEV e dependente de projeto **deve conter**:

    --project crm-carioca-dev

Nunca inferir o projeto Firebase a partir da branch atual.

## 4. Authentication DEV

O Authentication de crm-carioca-dev está configurado. Os provedores
Email/Password e Google estão habilitados. O teste funcional reutilizou o
usuário DEV existente, sem criar conta, alterar senha ou modificar providers.

## 5. Usuário inicial e perfil Firestore

- UID: **GACV9HXbwmck16RI5ucY43lk53E2**
- role: **supervisor**
- status: **aprovado**
- agencyId: **voo-singular**

O login passou, o frontend carregou o perfil e as rotas raiz, /historico,
/clientes, /usuarios e /leads carregaram sem permission-denied nos fluxos de
leitura e navegação testados.

## 6. Firestore Rules

O arquivo versionado é firestore.rules, referenciado por firebase.json. Seu
conteúdo foi comprovado como idêntico ao ruleset publicado no DEV durante a
recuperação.

As Rules ainda contêm hasAdminFallback() e o UID hardcoded antigo:

    tQ327uYKAdd85xTz4rdoarEYFNT2

Esse UID não bloqueou os fluxos normais de leitura e navegação testados com o
UID DEV atual. Isso não equivale a uma revisão completa das autoridades
admin > supervisor > agent.

## 7. Regra operacional da Firebase CLI

Exemplos de comandos destinados ao DEV:

    firebase firestore:indexes --project crm-carioca-dev
    firebase deploy --only firestore:rules --project crm-carioca-dev
    firebase deploy --only firestore:indexes --project crm-carioca-dev

Os comandos de deploy acima são exemplos de sintaxe segura, não registro de
deploy executado neste fechamento. Não executar firebase use para contornar o
default de produção; usar o projeto explícito em cada comando.

## 8. Índices Firestore

O DEV possui três índices compostos, todos READY, queryScope COLLECTION e
density SPARSE_ALL:

| Collection group | Campos |
| --- | --- |
| clientes | ownerId ASCENDING, dataCadastro DESCENDING, __name__ DESCENDING |
| cotacoes | agencyId ASCENDING, dataRegistro DESCENDING, __name__ DESCENDING |
| cotacoes | ownerId ASCENDING, dataRegistro DESCENDING, __name__ DESCENDING |

Eles foram versionados em firestore.indexes.json. O firebase.json passou a
referenciar tanto firestore.rules quanto firestore.indexes.json.

## 9. Branch e commit de infraestrutura

As mudanças foram isoladas em:

- Branch: **firebase-dev-recovery**
- Commit: **0b560ec835f0491193a068f60bef83c72bb96ca6**
- Mensagem: **chore: versiona indices firestore**

O commit contém exclusivamente firebase.json e firestore.indexes.json.

A branch foi publicada no remoto. Ela não foi integrada à main. Nenhum deploy
Firebase foi executado nesse fechamento, e produção não foi alterada.

## 10. Segregação da fase Smart Paste

A branch smartpaste-itinerarios-complexos foi preservada. Depois da comprovação
do backup remoto, as cópias locais de firebase.json e firestore.indexes.json
foram removidas de seu working tree.

Ao final do DEV-7, restavam ali exclusivamente sete arquivos relacionados ao
Smart Paste. O conteúdo desses arquivos pertence a outra fase e não faz parte
deste checkpoint.

## 11. Pendências conhecidas

### Autoridade administrativa

A hierarquia admin > supervisor > agent precisa de ciclo próprio cobrindo:

- Firestore Rules;
- aprovação de usuários;
- promoção de agent para supervisor;
- comportamento do admin;
- exclusões e bloqueios;
- fronteiras por agencyId;
- telas protegidas e gestão de usuários.

### UID hardcoded

O UID tQ327uYKAdd85xTz4rdoarEYFNT2 permanece nas Rules. Não foi substituído
pelo UID DEV e deve ser reavaliado na fase de autoridade.

### Documentação histórica

Existem registros históricos com firebase deploy --only firestore:rules sem
projeto explícito. Eles não devem ser usados como instrução operacional para o
DEV. A dívida documental deve continuar sendo revisada quando esses registros
forem reutilizados.

### Terceiro projeto Firebase

Foi identificado o projeto englesh-turbo, associado a um script Python da raiz
e a credenciais ignoradas pelo Git. Sua necessidade e seu isolamento devem ser
investigados em ciclo separado, caso o script ainda seja utilizado.

## 12. Itens fora de escopo

- merge de firebase-dev-recovery para main;
- qualquer deploy Firebase;
- alteração de Rules, Auth, usuários ou documentos;
- remoção do UID hardcoded;
- revisão integral de autoridade;
- investigação do projeto englesh-turbo;
- mudanças ou validações da implementação Smart Paste.

## 13. Critério de retomada do Smart Paste

A fase Smart Paste pode ser retomada sem carregar mudanças Firebase quando:

1. o trabalho ocorrer em smartpaste-itinerarios-complexos;
2. o working tree dessa branch continuar sem alteração em firebase.json e sem
   firestore.indexes.json não rastreado;
3. a infraestrutura permanecer preservada em firebase-dev-recovery no commit
   0b560ec835f0491193a068f60bef83c72bb96ca6;
4. qualquer comando Firebase futuro para o DEV usar explicitamente
   --project crm-carioca-dev;
5. mudanças de autoridade ou infraestrutura ocorrerem em ciclo e branch
   separados.

## 14. Limites deste checkpoint

O checkpoint consolida evidências coletadas nos ciclos DEV-0B a DEV-7. Ele
registra o estado observado, mas não substitui validações futuras após merge,
mudança de configuração, alteração de Rules ou novo deploy.
