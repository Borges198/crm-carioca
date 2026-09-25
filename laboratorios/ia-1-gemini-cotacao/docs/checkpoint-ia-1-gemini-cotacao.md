# Checkpoint final — IA-1 Agente Extrator de Pesquisa

**Status:** POC APROVADA ✅

## Objetivo e limites

O IA-1 valida o Gemini como extrator estruturado de pesquisas aéreas. O agente
recebe texto bruto e devolve fatos presentes na fonte em um contrato JSON. Ele
não calcula a cotação, não decide regras comerciais e não possui autoridade de
escrita no CRM ou em sistemas de produção.

## Arquitetura validada

```text
Plataforma aérea
→ texto bruto
→ Gemini
→ dados estruturados
→ camada determinística
→ futura revisão humana
→ CRM calcula
```

As responsabilidades permanecem separadas:

- Gemini: extrai fatos da fonte;
- camada determinística: valida o schema e normaliza campos previstos;
- humano: valida e decide;
- CRM: interpreta os dados aprovados e executa cálculos.

## Regras de domínio confirmadas

- Ida e volta são totalmente independentes.
- Companhias e aeroportos podem ser diferentes entre os trechos.
- Ausência ou incerteza é representada por `null`.
- Dados ausentes não podem ser inventados ou completados.
- O financeiro preserva os contextos de ida, volta e total.
- Valores monetários não são classificados à força como taxa, preço, custo,
  margem ou valor de venda.
- Pontos e milhas permanecem com os valores brutos apresentados pela fonte na
  camada de IA.
- Arredondamentos, interpretações comerciais e cálculos pertencem ao CRM.
- Quando a Azul apresenta valores-base e condicionados ou promocionais, ambos
  permanecem distintos, sem decisão automática de elegibilidade.

## Modelo e prompt

O modelo validado nesta POC foi o `gemini-3.6-flash`.

O prompt permaneceu congelado durante a rodada final. O fechamento contratual
foi realizado no schema e nos gabaritos, sem ampliar a autoridade do modelo.

## Contrato final

O contrato mantém objetos independentes para `ida` e `volta`, inclusive seus
dados operacionais e valores de pontos ou milhas apresentados por trecho. Os
valores monetários são fatos semanticamente neutros, preservando representação
numérica e valor bruto da fonte, nos seguintes contextos explícitos:

- `financeiro.ida.valorMonetarioExibido`;
- `financeiro.volta.valorMonetarioExibido`;
- `financeiro.total.valorMonetarioExibido`.

Cada contexto aceita ausência (`null`) e preserva mais de um valor quando a
fonte exibe múltiplos valores no mesmo contexto. O contrato não calcula totais
nem transfere valores entre ida e volta.

## Normalizações determinísticas

Normalizações conhecidas acontecem depois da extração, são registradas pelo
avaliador e não alteram a semântica da fonte. Exemplo:

```text
"Voo 4009"
→ "4009"
```

## Dataset validado

O dataset final contém nove casos:

- seis casos fictícios para regressão técnica;
- três casos reais anonimizados: `LATAM-REAL-01`, `SMILES-REAL-01` e
  `AZUL-REAL-01`.

## Resultado final nos casos reais

| Indicador | Resultado |
| --- | ---: |
| Casos aprovados | 3/3 PASS |
| Campos corretos | 95/95 |
| Extrações erradas | 0 |
| Alucinações críticas | 0 |
| Invenções | 0 |
| Contratos ambíguos | 0 |
| Normalizações pendentes | 0 |
| Confusões entre ida e volta | 0 |
| Aceitos sem correção humana | 3/3 |

## Evolução do laboratório

Durante a POC, algumas combinações de modelo e rodada apresentaram
indisponibilidade HTTP 503. O cliente passou a tratar falhas transitórias 429 e
503 com retry limitado e backoff. A disponibilidade também permaneceu sujeita
à quota do Free Tier.

O contrato monetário evoluiu para uma representação neutra e contextualizada,
sem impor classificação comercial. O avaliador passou a distinguir quatro
categorias: `EXTRAÇÃO ERRADA`, `ALUCINAÇÃO`, `CONTRATO AMBÍGUO` e
`NORMALIZAÇÃO`.

## Limitações ainda não provadas

- volume maior e mais diverso de casos reais;
- mudanças futuras de layout das plataformas aéreas;
- latência operacional;
- disponibilidade e quota do modelo;
- concorrência entre múltiplos agentes;
- integração real com formulário;
- comportamento em produção.

## Decisão final

**IA-1:** POC APROVADA.

**Integração com o CRM:** NÃO AUTORIZADA.

O próximo gate pertence à Central, que deverá decidir entre iniciar o IA-2 —
Agente Singular — ou autorizar futuramente uma integração experimental
isolada.
