# IA-2A — Fundação determinística do Agente Singular

Laboratório isolado que lê um dataset local controlado e produz sinais
estruturados com evidências, além de métricas determinísticas de benchmark. Não
há integração, escrita externa ou acesso a dados reais.

## Sinais

- `PROXIMA_ACAO_ATRASADA` — `FATO`;
- `PROXIMA_ACAO_HOJE` — `FATO`;
- `OPORTUNIDADE_SEM_PROXIMA_ACAO` — `FATO`;
- `POSSIVEIS_PESQUISAS_REPETIDAS` — `PADRÃO`.

Um `FATO` decorre diretamente de campos e datas presentes no dataset. Um
`PADRÃO` exige evidências existentes e expressa somente **alta semelhança entre
pesquisas**. O sinal não autoriza concluir “cotações duplicadas”.

Todo sinal contém `id`, `tipo`, `classificacao`, `entidades`, `evidenceIds` e
`dados`. Entidades e evidências são validadas contra os IDs da entrada; nenhuma
entidade pode ser criada pelo analisador.

## Similaridade determinística

Duas pesquisas atingem a regra mínima somente quando:

1. possuem o mesmo `clienteId`;
2. possuem o mesmo destino após remoção de espaços externos e conversão para
   maiúsculas;
3. as datas de ida diferem em no máximo **3 dias corridos**;
4. ambas não possuem volta, ou ambas possuem volta com diferença máxima de
   **3 dias corridos**. Se apenas uma possui volta, não há correspondência.

“Datas próximas” significa, portanto, diferença absoluta inclusiva de zero a
três dias corridos, calculada em UTC sobre datas `YYYY-MM-DD`. Quatro dias já
ficam fora do limiar. As relações são identificadas por pares e consolidadas
em um único sinal por grupo conectado, com entidades e `evidenceIds` ordenados
deterministicamente. Essa consolidação não amplia nem altera a regra de
similaridade.

## Dataset e benchmark

Os seis cenários cobrem operação normal, ação atrasada, ação hoje, oportunidade
sem próxima ação, similaridade positiva e o caso parecido fora do limiar. O
último protege explicitamente contra falso positivo.

O benchmark informa sinais esperados e detectados, falsos positivos, sinais
importantes perdidos, fatos incorretos, padrões sem evidência e classificações
incorretas. A passagem exige 100% dos sinais esperados, zero em todas as
categorias de erro e nenhuma entidade inventada.

```bash
npm test
npm run benchmark
```

## Limitações

Esta fundação não prova escala, integração com formulário, concorrência,
agendamento, comunicação externa ou comportamento em produção. Não usa modelo
de IA, SDK de IA, Gemini, Firebase, Firestore, CRM, scheduler, e-mail ou
WhatsApp.

## IA-2B — Relatório operacional

O relatório é uma montagem estrutural dos sinais já existentes. Seu contrato
contém `dataReferencia`, contadores em `resumo` e uma lista de `itens`. Cada
item preserva `tipo`, `classificacao`, `evidenceIds` e `entidades` do sinal;
`fatos` é uma cópia exata de `sinal.dados`, e `contexto.sinalId` mantém o
vínculo auditável sinal → item. Nenhum item pode existir sem esse vínculo.

A prioridade é explícita e numérica, sendo menor o número mais cedo na lista:

1. `PROXIMA_ACAO_ATRASADA` — prioridade 1;
2. `PROXIMA_ACAO_HOJE` — prioridade 2;
3. os outros dois tipos — prioridade neutra 3.

A única justificativa de ordem é temporal: ação vencida antecede ação de hoje.
Os sinais sem justificativa temporal permanecem empatados e são ordenados pelo
ID do sinal para estabilidade. Não há inferência ou priorização editorial.

`FATO` e `PADRÃO` são preservados sem alteração, assim como todos os
`evidenceIds`. `SUGESTÃO` está deliberadamente ausente do contrato IA-2B. O
resumo é calculado exclusivamente pela contagem dos tipos presentes e deve
coincidir com os itens.

O IA-2B não prova redação narrativa, sugestão de conduta, entrega automática,
agendamento, integração, escala ou uso em produção. O relatório permanece local
e determinístico.

## IA-2C — Interpretação assistida

A arquitetura preserva a ordem `motor determinístico → sinais → relatório
estruturado → Gemini → validador determinístico → decisão humana`. O Gemini
recebe somente o relatório IA-2B e não participa da detecção de sinais. Sua
saída JSON contém `resumoExecutivo` e itens com `sinalId`,
`classificacaoOriginal`, `interpretacao`, `sugestoes`, `evidenceIds` e
`entidades`.

`FATO` e `PADRÃO` existem antes do Gemini. Somente `SUGESTÃO` pode nascer nessa
camada e apenas dentro de `sugestoes`, com classificação explícita. O validador
rejeita, sem correção silenciosa, sinal ou evidência inexistente, classificação
alterada, entidade ou número ausente da entrada, campos de fatos ou métricas,
sugestão fora do campo próprio, afirmações proibidas e sinais originais sem
interpretação.

O modelo padrão configurado é `gemini-3.7-flash`, substituível por
`GEMINI_MODEL`. A credencial é lida exclusivamente de `GEMINI_API_KEY`. Sem a
chave, o benchmark Gemini fica como `NAO_EXECUTADO`; testes e benchmark local
continuam disponíveis sem rede. A implementação usa a API REST e não adiciona
SDK de IA ao laboratório.

A avaliação inclui `utilidadeHumana` com os valores `UTIL`,
`PARCIALMENTE_UTIL`, `RUIDOSA`, `ENGANOSA` e `NAO_AVALIADA`. Essa nota nunca é
calculada pelo Gemini e começa como `NAO_AVALIADA`.

A validação textual determinística bloqueia identificadores, números e
formulações proibidas reconhecíveis, mas não prova verdade semântica irrestrita
de linguagem natural. Por isso, toda saída aprovada pelo validador ainda exige
decisão humana e não executa ações nem escrita externa.
