# Checkpoint final — IA-3 READ ONLY

**Status:** POC OPERACIONAL ASSISTIDA READ ONLY APROVADA ✅

**Ambiente validado:** `crm-carioca-dev`.

**Produção:** NÃO ACESSADA.

**Escrita:** 0.

## 1. Objetivo

O IA-3 validou leitura controlada real exclusivamente no ambiente DEV, em modo
READ ONLY, sem escrita e sem automação. A POC permanece assistida: o sistema
produz evidência, mas a decisão continua sendo humana.

## 2. Arquitetura

```text
Firestore crm-carioca-dev
→ query escopada por agencyId + ownerId
→ limite de documentos
→ allowlist
→ motor determinístico IA-2
→ relatório estruturado
→ Gemini
→ validador
→ humano decide
```

## 3. Contrato READ ONLY

- `projectId` obrigatório e igual a `crm-carioca-dev`;
- `agencyId` obrigatório;
- `ownerId` obrigatório;
- `maxDocuments` obrigatório, inteiro na faixa de 1 a 25;
- ausência ou inconsistência causa bloqueio fail closed;
- produção é bloqueada antes de qualquer consulta;
- a abstração aceita somente capacidade de leitura;
- zero APIs ou caminhos de escrita.

## 4. Dados

As únicas coleções autorizadas são:

- `cotacoes`;
- `acompanhamentos`.

PII, texto livre e campos fora da allowlist não chegam ao pipeline. Documentos
Firestore brutos não atravessam a fronteira do reader e não aparecem em logs
ou saídas. `evidenceIds` são somente identificadores técnicos mínimos.

## 5. IA-3A — Fundação READ ONLY

| Controle | Resultado |
| --- | --- |
| Arquitetura READ ONLY | PASS |
| Abstração sem capacidade de escrita | PASS |
| Fail closed | PASS |
| Proteção `crm-carioca-dev` | PASS |
| Limite 1..25 | PASS |
| Allowlist | PASS |
| Logs sem documento bruto | PASS |
| `cotacoes` com escopo | PASS |
| `acompanhamentos` | COMPATÍVEL |
| Testes | 12/12 PASS |

O schema de `acompanhamentos` possui `ownerId` e `agencyId` diretamente. Não
foi necessário criar fallback, join amplo ou leitura adicional.

## 6. IA-3B-R1 — Identidade e leitura real controlada

A identidade e a autorização foram validadas a partir da sessão técnica DEV
autenticada e de uma leitura direta e exata do perfil `usuarios/{uid}`. As
coleções operacionais não foram usadas para descobrir a identidade.

| Parâmetro | Valor |
| --- | --- |
| `projectId` | `crm-carioca-dev` |
| `agencyId` | `voo-singular` |
| `ownerId` | `GACV9HXbwmck16RI5ucY43lk53E2` |
| `maxDocuments` | 10 |

| Evidência | Resultado |
| --- | ---: |
| Cotações consultadas | 10 |
| Cotações aceitas | 10 |
| Acompanhamentos consultados | 4 |
| Acompanhamentos aceitos | 4 |
| Documentos fora de `ownerId`/`agencyId` | 0 |
| Campos não autorizados na saída | 0 |
| Documentos brutos em logs/saída | 0 |
| Escritas | 0 |
| Acessos à produção | 0 |

## 7. IA-3C-R1 — Pipeline real completo

```text
Firestore DEV READ ONLY
→ allowlist
→ motor determinístico
→ relatório estruturado
→ Gemini
→ validador
→ avaliação humana
```

O motor detectou um sinal `POSSIVEIS_PESQUISAS_REPETIDAS`, classificado como
`PADRÃO`. O relatório estruturado foi aprovado. O Gemini foi executado com o
modelo `gemini-3.6-flash`, e sua resposta passou no validador determinístico.

| Violação | Quantidade |
| --- | ---: |
| Fatos inventados | 0 |
| Sinais inventados | 0 |
| `evidenceIds` inventados | 0 |
| Classificações alteradas | 0 |
| Entidades inventadas | 0 |
| Métricas inventadas | 0 |
| Sugestões como fato | 0 |
| Itens sem `sinalId` | 0 |

O Gemini preservou a classificação `PADRÃO` e não afirmou duplicidade. A
avaliação humana classificou a evidência como **ÚTIL**.

## 8. Limitações

Ainda não foram provados nem autorizados:

- produção;
- scheduler;
- execução automática;
- integração com a UI;
- escrita;
- ações automáticas;
- escala ampla;
- múltiplos owners ou agências simultaneamente;
- operação contínua;
- decisão autônoma pelo Gemini.

## 9. Bloqueios atuais

| Superfície | Estado |
| --- | --- |
| Produção | BLOQUEADA |
| Escrita | BLOQUEADA |
| Scheduler | BLOQUEADO |
| UI | BLOQUEADA |
| Automação | BLOQUEADA |
| Mudanças em Leads/Histórico | BLOQUEADAS |

## 10. Status final

**IA-3 → POC OPERACIONAL ASSISTIDA READ ONLY APROVADA ✅**

- Ambiente validado: `crm-carioca-dev`;
- Produção: NÃO ACESSADA;
- Escrita: 0;
- Próximo gate: decisão exclusiva da Central.

Nenhuma nova integração é aberta neste ciclo.
