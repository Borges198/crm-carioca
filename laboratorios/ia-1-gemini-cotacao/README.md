# IA-1 — Laboratório de cotação com Gemini

Laboratório isolado para avaliar a extração de texto bruto de cotações aéreas
em JSON estruturado. Ele não importa nem altera código do CRM, Firebase, Auth,
Firestore ou Smart Paste.

## Pipeline

```text
texto bruto
→ Gemini com JSON Schema
→ JSON.parse
→ validação estrutural independente com Ajv
→ comparação com o resultado esperado
→ relatório do benchmark
```

Structured Output garante o formato, mas não garante que os valores sejam
semanticamente corretos. Por isso, a resposta só entra no benchmark depois da
validação local e ainda é comparada campo a campo com o gabarito.

## Contrato do extrator

O Gemini copia somente fatos presentes na fonte. Ele não calcula valor da
milha, custo interno, margem, lucro, markup, preço de venda, total comercial do
CRM nem arredonda pontos ou milhas. Regras de negócio e cálculos pertencem ao
CRM; a revisão e a confirmação pertencem ao humano. Ausência ou incerteza é
representada por `null`.

Ida e volta são entidades independentes: nenhum campo, companhia, aeroporto ou
valor é herdado entre elas. Valores-base e valores promocionais ou
condicionados são preservados separadamente, sem decisão de elegibilidade.

Valores monetários são registrados de forma semanticamente neutra, com o valor
numérico e sua grafia bruta na fonte. O contrato não exige que o modelo decida
entre taxa e preço quando essa natureza não estiver inequívoca.

O prefixo textual de número de voo é normalizado deterministicamente antes da
comparação (`Voo 4009` vira `4009`). O avaliador registra esse ajuste como
`NORMALIZAÇÃO`.

O dataset contém os seis casos fictícios originais como regressão técnica e os
casos operacionais anonimizados `LATAM-REAL-01`, `SMILES-REAL-01` e
`AZUL-REAL-01`.

## Modelo

O padrão do laboratório é o modelo estável `gemini-3.7-flash`. Um modelo
alternativo pode ser testado exclusivamente no laboratório por meio de
`GEMINI_MODEL`.

Erros transitórios HTTP 429 e 503 recebem no máximo três tentativas totais,
com backoff exponencial curto (250 ms e 500 ms). Outros erros não são
repetidos. O relatório registra o modelo efetivamente usado e, em falhas, a
quantidade de tentativas do caso. Não existe fallback automático entre modelos.

## Credencial

Nunca grave uma chave real em arquivo. Exporte-a somente no processo que
executará o benchmark:

```bash
export GEMINI_API_KEY="sua-chave"
```

O arquivo `.env.example` contém apenas um marcador de exemplo. O laboratório
não carrega arquivos `.env` automaticamente.

## Comandos

```bash
npm install
npm test
npm run benchmark
```

`npm test` valida schema, dataset, detector de invenções e barreira de
credencial. `npm run benchmark` faz chamadas reais ao Gemini e imprime o
relatório JSON na saída padrão; nenhum resultado é persistido automaticamente.

## Regra de aceitação

Um caso só recebe `aceitoSemCorrecaoHumana: true` quando:

- a resposta passa no JSON Schema;
- todos os campos explícitos correspondem ao gabarito;
- todos os campos ausentes permanecem `null`;
- não existe nenhum campo inventado.

As diferenças são classificadas como `EXTRAÇÃO ERRADA`, `ALUCINAÇÃO`,
`CONTRATO AMBÍGUO` ou `NORMALIZAÇÃO`. Um fato presente na fonte, mas colocado
em posição semanticamente inadequada, não é contado como alucinação. Somente
um dado sem correspondência na fonte conta como alucinação crítica. A meta do
laboratório é zero.
