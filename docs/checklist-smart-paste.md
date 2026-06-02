# Checklist Smart Paste

## Objetivo

Validar manualmente o fluxo visual do Smart Paste Assistido sem alterar o comportamento do parser principal.

## Premissas

- `extrairDadosSmartPaste(text)` continua sendo o parser principal.
- `extrairCandidatosSmartPaste(text)` roda em paralelo apenas como camada assistiva.
- Candidatos sao sugestoes para conferencia humana.
- Nenhum candidato deve ser aplicado automaticamente ao colar texto.
- A aplicacao manual de candidato deve alterar apenas pontos/milhas e taxa.
- Origem, destino, datas, cliente, companhia e tipo de voo nao devem ser alterados pela aplicacao manual de candidatos.

## Fixtures recomendadas

Usar os textos reais em:

```bash
painel-viagens/tests/fixtures/smart-paste/
```

## Checklist manual

- Abrir o app em desenvolvimento.
- Copiar a fixture Azul ida-volta.
- Acionar Smart Paste.
- Confirmar que o parser principal continua preenchendo como antes.
- Confirmar que a secao "Conferencia Smart Paste" aparece.
- Conferir companhia exibida.
- Conferir candidatos exibidos.
- Aplicar candidato de ida.
- Confirmar que apenas pontos/milhas da ida e taxa da ida mudaram.
- Aplicar candidato de volta.
- Confirmar que apenas pontos/milhas da volta e taxa da volta mudaram.
- Aplicar candidato total quando houver.
- Confirmar que apenas pontos/milhas globais e taxa global mudaram.
- Confirmar que origem, destino, datas, cliente, companhia e tipo de voo nao mudaram por causa do botao de candidato.
- Repetir o fluxo com Latam ida-volta.
- Repetir o fluxo com Smiles ida-volta.
- Testar uma fixture de somente ida.
- Testar uma fixture de somente volta.
- Testar texto sem candidatos reconhecidos.
- Confirmar que texto sem candidatos nao quebra a tela.
- Testar candidato incompleto, quando houver fixture ou texto adequado.
- Confirmar que candidato incompleto aplica apenas o campo existente.
- Confirmar que nenhum candidato e aplicado automaticamente ao colar texto.

## Comandos de validacao

Depois de qualquer ajuste de codigo relacionado ao fluxo:

```bash
npm run lint
npm run test
npm run build
```

O build pode precisar de rede para baixar Geist e Geist Mono via `next/font`.
