# MVP Comercial Operacional - CRM Voo Singular

## Status

Concluido e validado em producao.

Data de referencia: junho de 2026.

## Objetivo

Estabelecer o primeiro fluxo comercial completo do CRM Voo Singular, permitindo:

- registrar cotacoes;
- acompanhar oportunidades;
- gerenciar negociacoes;
- fechar vendas;
- converter clientes;
- controlar acesso por perfil e agencia.

## Fluxo comercial oficial

```text
Cotacao
↓
Lead
↓
Monitoramento
↓
Negociacao
↓
Fechado
↓
Conversao em Cliente
```

## Fonte de verdade comercial

O campo `leadStatus` passa a ser a unica fonte de verdade para o funil comercial.

Todos os indicadores comerciais devem utilizar este campo.

Status comerciais oficiais:

```text
novo
em_monitoramento
aguardando_cliente
orcamento_enviado
negociacao
fechado
perdido
```

## Status da venda

Antes desta fase, o sistema possuia dois controles independentes:

```text
Status da Venda
Status Comercial
```

Isso permitia inconsistencias, como:

```text
Status da Venda = Fechado ✅
Status Comercial = Novo
```

Na situacao atual, o campo `Status da Venda` nao e mais editavel. Ele e derivado automaticamente de `leadStatus`.

Mapeamento oficial:

```text
novo                → Novo 🆕
em_monitoramento    → Monitorando 👀
aguardando_cliente  → Retornar 📞
orcamento_enviado   → Retornar 📞
negociacao          → Monitorando 👀
fechado             → Fechado ✅
perdido             → Desistiu ❌
```

## Dashboard comercial

### Total de cotacoes

Quantidade total de registros.

### Negocios fechados

Contabiliza cotações com:

```text
leadStatus = fechado
```

Compatibilidade legado:

```text
status = Fechado ✅
```

A compatibilidade legado deve ser usada apenas quando o documento nao possuir `leadStatus`.

### Volume de vendas

Soma dos valores das cotacoes consideradas fechadas pela regra acima.

## Leads comerciais

A tela `/leads` e a visao operacional de oportunidades.

Ela concentra as oportunidades em andamento e apoia o acompanhamento comercial ate a conclusao do negocio.

## Agrupamento de oportunidades

Cotações relacionadas sao agrupadas visualmente.

O agrupamento considera:

- proprietario da cotacao;
- telefone;
- cliente;
- origem;
- destino;
- data de ida;
- data de volta.

Nao participam do agrupamento:

- companhia aerea;
- horarios;
- valores;
- observacoes;
- status comercial.

## Conversao para cliente

Fluxo oficial:

```text
leadStatus = fechado
↓
Botao "Adicionar aos clientes"
↓
Conversao explicita
↓
Registro em /clientes
```

A conversao depende exclusivamente de:

```text
leadStatus = fechado
```

## Controle de acesso

Perfis suportados:

```text
agent
supervisor
admin
```

### Agent

Pode acessar apenas seus proprios:

- leads;
- clientes;
- cotacoes.

### Supervisor

Pode:

- visualizar equipe;
- editar informacoes comerciais;
- acompanhar historico da agencia.

Nao pode alterar propriedade das cotacoes.

### Admin

Possui acesso administrativo completo dentro da agencia.

## Resultado final da Fase 1

O CRM Voo Singular passa a possuir um fluxo comercial operacional completo:

```text
Captura de Cotacao
↓
Gestao de Lead
↓
Acompanhamento Comercial
↓
Fechamento
↓
Conversao para Cliente
↓
Carteira de Clientes
```

Este documento representa a conclusao da fase MVP Comercial Operacional.
