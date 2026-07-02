# Contexto do Projeto CRM

## Nome do projeto

CRM Voo Singular, tambem chamado no codigo de Painel de Viagens.

## Stack

- Next.js com App Router.
- React com componentes client-side.
- TypeScript.
- Tailwind CSS.
- Firebase Authentication.
- Cloud Firestore.
- `html-to-image` para gerar PNG do BilhetePreview.

## Branch principal de trabalho

Branch atual de trabalho:

```bash
crm-cotacao-clean
```

## Caminho local

Repositorio local:

```bash
/home/perfil_carioca/Documents/Rodrigo-Borges/Voo_Singular/CRM_Carioca
```

Aplicacao Next.js:

```bash
/home/perfil_carioca/Documents/Rodrigo-Borges/Voo_Singular/CRM_Carioca/painel-viagens
```

## Commit estavel conhecido

Commit consolidado da fase Firestore e identidade:

```bash
eac9c5f51f51ce04ae29bc89f15cb344caba4299
```

Esse HEAD esta sincronizado com `origin/crm-cotacao-clean`. O push foi realizado
e nao houve deploy nesta fase.

## Funcionalidades atuais

- Login com Firebase Authentication.
- Criacao de cotacoes de viagem.
- Cotacao de somente ida ou ida e volta.
- Campos por trecho para companhia, pontos/milhas, taxa, data, horarios e paradas.
- Calculo de valor total da cotacao.
- `/historico` oferece "Minhas cotacoes" por ownership e visao "Equipe" por
  `agencyId` para supervisor e admin autorizados.
- Na visao de equipe, a edicao comercial segue o perfil e o contexto; a edicao
  completa permanece disponivel somente conforme as permissoes validadas.
- Carteira de clientes filtrada por `ownerId`, com carga inicial paginada,
  cursor documental e pesquisa lazy alem da primeira pagina.
- Cache de clientes isolado por usuario, diario versionado de mutacoes e
  reconciliacao de criacao, edicao e exclusao.
- Autocomplete alimentado pela collection `clientes`, preservando o ID
  documental, separando homonimos e preenchendo nome e telefone.
- Busca telefonica com debounce e descarte de respostas antigas em logout,
  troca de usuario ou unmount.
- Edicao telefonica por cotacao selecionada em `/historico` e `/leads`.
- Criacao e edicao manual de clientes persistem conjuntamente `telefone` e
  `telefoneNormalizado`.
- Os fluxos corrigidos preservam a identidade original e descartam resultados
  obsoletos: criar, editar e excluir em `/clientes`; edicao completa e
  comercial em `/historico`; e mutacoes protegidas na fase de `/leads`.
- Essa garantia nao inclui automaticamente toda acao assincrona do CRM. Em
  particular, exclusao de cotacao e conversao em cliente dentro de
  `/historico` nao foram incluidas na barreira consolidada do Ciclo 6.
- Smart Paste global a partir da area de transferencia.
- Smart Paste por trecho para ida e volta.
- Geracao de mensagem de WhatsApp apos salvar cotacao.
- BilhetePreview visual exportavel como PNG.

## Regra de negocio sobre milhas e taxas

Na leitura automatica do Smart Paste, os valores de pontos/milhas e taxas sao arredondados para cima:

- pontos/milhas encontrados no texto sao convertidos para milhares usando `Math.ceil(valor / 1000)`;
- taxas encontradas em `R$` ou `BRL` sao convertidas para numero inteiro usando `Math.ceil`.

Exemplo: 35.200 milhas vira `36`; R$ 123,45 vira `124`.

Nos campos manuais, a aplicacao extrai apenas os numeros digitados para calcular a cotacao.

## Regra do BilhetePreview sem valores internos

O BilhetePreview deve permanecer sem pontos, milhas, taxas, valores internos, margem ou composicao de preco.

O preview mostra apenas dados operacionais e apresentaveis ao cliente:

- companhia;
- tipo de cotacao;
- origem e destino;
- datas;
- horarios;
- duracao;
- paradas;
- identificacao visual da Voo Singular.

Essa regra evita expor custo interno, estrategia de precificacao ou informacoes sensiveis no material visual enviado ao cliente.

## Regra atual da mensagem WhatsApp

A mensagem atual gerada para WhatsApp tem formato simples:

```text
Cotacao {cliente}
{valorTotal}

Agencia Voo Singular
```

No codigo atual, a mensagem e gerada apos salvar a cotacao com sucesso.

## Estado validado da fase Firestore e identidade

- 220/220 testes aprovados;
- lint aprovado;
- build e TypeScript aprovados;
- revisao independente aprovada com ressalvas nao bloqueantes;
- nenhuma migracao em massa;
- nenhuma alteracao de Rules ou indices nessa fase.

## Fronteiras de acesso

- `ownerId`: propriedade do documento e visao individual.
- `agencyId`: fronteira organizacional para visoes de equipe autorizadas.
- Perfil, pagina, visao ativa e Firestore Rules determinam o limite efetivo da
  leitura ou mutacao.
- A visao de equipe nao transfere nem elimina o ownership do documento.

## Fluxo por trecho

O formulario permite trabalhar com:

- trecho de ida;
- trecho de volta quando `tipoVoo` e `ida_volta`.

Quando ha dados por trecho, a aplicacao:

- calcula ida com companhia, pontos/milhas e taxa da ida;
- calcula volta com companhia, pontos/milhas e taxa da volta, quando houver;
- soma `valorIda` e `valorVolta` para formar `valorTotal`;
- salva campos especificos como `companhiaIda`, `companhiaVolta`, `pontosIda`, `pontosVolta`, `taxaIda`, `taxaVolta`, `valorIda` e `valorVolta`.

Se nao houver dados por trecho, a aplicacao usa o calculo global com `pontos`, `taxaEmbarque` e `companhia`.

## Smart Paste atual

O Smart Paste atual le texto da area de transferencia e tenta identificar automaticamente:

- origem e destino por codigos IATA;
- horarios;
- datas;
- companhia;
- paradas;
- pontos/milhas;
- taxa de embarque;
- tipo de voo.

Existem tres acionamentos:

- Smart Paste global, que tenta preencher a cotacao inteira;
- colar dados da ida;
- colar dados da volta.

O Smart Paste atual aplica os dados diretamente nos campos quando encontra valores reconhecidos.

## Smart Paste Assistido desejado

O Smart Paste Assistido desejado deve manter a automacao, mas inserir uma etapa de conferencia humana antes de aplicar os dados.

Fluxo desejado:

- usuario cola texto bruto de companhia, programa de milhas ou buscador;
- sistema interpreta os dados;
- sistema mostra uma pre-visualizacao estruturada;
- usuario confere origem, destino, datas, horarios, paradas, companhia, milhas e taxas;
- usuario confirma quais dados devem ser aplicados;
- somente depois da confirmacao os campos da cotacao sao atualizados.

Essa abordagem reduz risco de erro silencioso em dados de voo e preserva velocidade operacional.
