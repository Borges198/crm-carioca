# Checkpoint final — IA-2 Agente Singular

**Status:** POC APROVADA ✅

**Integração direta com o CRM:** NÃO AUTORIZADA.

**Firebase/Firestore automático:** BLOQUEADO.

**Escrita automática:** BLOQUEADA.

## Objetivo e arquitetura validada

O IA-2 valida uma cadeia assistiva local na qual fatos verificáveis permanecem
sob responsabilidade do código, a linguagem natural permanece subordinada ao
contrato e a decisão final pertence a uma pessoa:

```text
dados
→ motor determinístico
→ sinais + evidenceIds
→ relatório estruturado
→ Gemini
→ validador determinístico
→ humano decide
```

As responsabilidades são separadas:

- **Código:** determina fatos verificáveis e sinais suportados pelos dados;
- **Gemini:** interpreta, explica e redige; cria somente sugestões explícitas;
- **Humano:** valida a utilidade e decide qualquer ação.

## Contrato oficial

- **FATO:** conclusão comprovada deterministicamente;
- **PADRÃO:** inferência suportada por evidências;
- **SUGESTÃO:** orientação explícita, nunca apresentada como fato.

Todo sinal possui `evidenceIds`. O Gemini não cria sinais ou fatos, não altera
as classificações `FATO` e `PADRÃO`, não inventa evidências e não executa
ações. `SUGESTÃO` pode surgir somente no campo próprio e com classificação
explícita.

## Sinais validados

| Sinal | Classificação |
| --- | --- |
| `PROXIMA_ACAO_ATRASADA` | `FATO` |
| `PROXIMA_ACAO_HOJE` | `FATO` |
| `OPORTUNIDADE_SEM_PROXIMA_ACAO` | `FATO` |
| `POSSIVEIS_PESQUISAS_REPETIDAS` | `PADRÃO` |

A similaridade entre pesquisas exige o mesmo cliente, o mesmo destino e
diferença máxima inclusiva de três dias nas datas. Quatro dias ficam fora do
limiar. Relações par-a-par conectadas são consolidadas estruturalmente em um
único grupo, sem mudar essa regra de similaridade.

O sistema nunca pode afirmar automaticamente que as pesquisas são duplicadas.

## IA-2A — Motor determinístico

O motor foi validado inicialmente no dataset controlado:

| Indicador | Resultado |
| --- | ---: |
| Sinais esperados | 4 |
| Sinais detectados | 4 |
| Falsos positivos | 0 |
| Falsos negativos | 0 |
| Fatos incorretos | 0 |
| Padrões sem evidência | 0 |
| Testes | 12/12 PASS |

## IA-2B — Relatório estruturado

O relatório determinístico contém `dataReferencia`, `resumo` e `itens`. Cada
item preserva `tipo`, `classificacao`, `prioridadeDeterministica`, `fatos`,
`evidenceIds`, `entidades` e `contexto.sinalId`.

| Indicador | Resultado |
| --- | ---: |
| Sinais recebidos | 4 |
| Itens gerados | 4 |
| Itens órfãos | 0 |
| Sinais sem item | 0 |
| Fatos novos | 0 |
| Sugestões indevidas | 0 |
| Testes | 21/21 PASS |

## IA-2C — Interpretação assistida

O Gemini foi validado como intérprete e redator sobre um relatório já pronto.
O modelo aprovado foi `gemini-3.6-flash`. O modelo `gemini-3.7-flash`
apresentou indisponibilidade HTTP 503 recorrente durante a fase.

O benchmark controlado final aprovou semanticamente os seis cenários: 6/6
PASS. Foram registradas zero ocorrências em todas as categorias:

- fatos inventados;
- sinais inventados;
- `evidenceIds` inventados;
- classificações alteradas;
- entidades inventadas;
- métricas inventadas;
- sugestões apresentadas como fato;
- itens sem `sinalId`.

## IA-2D — Utilidade humana

Os seis relatórios controlados foram avaliados por uma pessoa:

| Classificação | Quantidade |
| --- | ---: |
| ÚTIL | 6/6 |
| PARCIALMENTE ÚTIL | 0 |
| RUIDOSA | 0 |
| ENGANOSA | 0 |

Os textos ainda utilizavam IDs sintéticos, o que foi considerado aceitável
para a POC.

## IA-2E — Snapshot real anonimizado

A validação inicial sobre dados reais adotou isolamento manual e local:

```text
CRM real
→ exportação manual
→ anonimização fora do laboratório
→ snapshot local anonimizado
→ gold standard humano
→ motor
→ relatório
→ Gemini
→ validador
→ avaliação humana
```

O arquivo bruto permaneceu fora do repositório. O snapshot anonimizado e os
artefatos de evidência permanecem locais e ignorados pelo Git. A auditoria do
snapshot registrou:

| Verificação | Ocorrências |
| --- | ---: |
| Dados pessoais | 0 |
| Credenciais | 0 |
| IDs reais | 0 |
| Campos fora da allowlist | 0 |
| Observações livres | 0 |

Firebase e Firestore não foram usados nessa cadeia.

## Gold standard humano real

O snapshot final contém uma oportunidade e três pesquisas. O gold standard
humano registra um sinal esperado, `POSSIVEIS_PESQUISAS_REPETIDAS`, envolvendo:

- `pesquisa-001`;
- `pesquisa-002`;
- `pesquisa-003`.

Os seguintes sinais foram marcados como não presentes na amostra:

- `PROXIMA_ACAO_ATRASADA`;
- `PROXIMA_ACAO_HOJE`;
- `OPORTUNIDADE_SEM_PROXIMA_ACAO`.

## Descoberta do primeiro benchmark real

Na primeira execução, o motor emitiu três sinais par-a-par:

```text
pesquisa-001 + pesquisa-002
pesquisa-001 + pesquisa-003
pesquisa-002 + pesquisa-003
```

O gold standard esperava um único padrão agrupando as três pesquisas. A
detecção semântica estava correta, mas a agregação divergia. Não houve
alucinação; houve ruído estrutural causado pelas combinações de pares.

## IA-2E-R1 — Consolidação estrutural

A emissão evoluiu de um sinal por par para um único sinal por grupo conectado.
A regra de similaridade permaneceu inalterada.

| Indicador real | Resultado |
| --- | ---: |
| Sinais esperados | 1 |
| Sinais detectados | 1 |
| Verdadeiros positivos | 1 |
| Falsos positivos | 0 |
| Falsos negativos | 0 |
| Testes pertinentes | 24/24 PASS |

## IA-2E-R2 — Pipeline anonimizado completo

O pipeline completo sobre o snapshot real anonimizado passou em todas as
etapas:

| Etapa | Resultado |
| --- | --- |
| Motor determinístico | PASS |
| Relatório estruturado | PASS |
| Gemini (`gemini-3.6-flash`) | PASS |
| Validador determinístico | PASS |
| Violações contratuais | 0 |
| Avaliação humana | ÚTIL |

O Gemini preservou a classificação `PADRÃO` e não afirmou duplicidade.

## Limitações ainda não provadas

- leitura direta do Firestore;
- operação contínua;
- scheduler;
- múltiplos agentes em escala;
- grande volume de cotações;
- robustez estatística;
- escrita ou ações automáticas;
- comportamento em produção;
- cobertura real dos quatro sinais em amostra ampla.

A amostra real atual é pequena. Ela constitui evidência inicial de aderência,
não validação estatística.

## Decisão final e próximo gate

| Dimensão | Decisão |
| --- | --- |
| IA-2 | POC APROVADA ✅ |
| Dados sintéticos | APROVADOS |
| Snapshot real anonimizado | APROVADO |
| Gemini | Aderente ao contrato |
| Utilidade humana | Positiva |
| Integração direta com CRM | BLOQUEADA |

O próximo gate depende de decisão da Central sobre uma futura fase **IA-3 —
LEITURA CONTROLADA REAL**, exclusivamente **READ ONLY** e **SEM ESCRITA**.
