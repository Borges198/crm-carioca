# Decisoes Arquiteturais

## Objetivo

Registrar decisoes tecnicas e operacionais do CRM Voo Singular para preservar contexto entre chats, commits e fases do projeto.

## Decisoes tomadas

- Usar `docs` como base oficial de contexto tecnico do projeto.
- Manter a aplicacao Next.js dentro de `painel-viagens`.
- Usar Firebase Authentication para identificar usuario autenticado.
- Usar Firestore para `cotacoes` e `clientes`.
- Gravar `ownerId` em novas cotacoes e novos clientes.
- Filtrar telas de historico e clientes por `ownerId`.
- Manter BilhetePreview sem valores internos.
- Manter Smart Paste global enquanto o Smart Paste Assistido nao estiver pronto.
- Planejar Smart Paste Assistido com conferencia humana.
- Preservar documentos antigos sem `ownerId` ate existir plano de migracao.

## Motivo de usar ownerId

`ownerId` e a fronteira atual de isolamento de dados por usuario.

Motivos:

- permite filtrar cotacoes e clientes do usuario autenticado;
- prepara o projeto para regras Firestore baseadas em `request.auth.uid`;
- reduz risco de um usuario visualizar dados de outro;
- cria uma base simples para seguranca antes de papeis administrativos mais avancados.

O `ownerId` deve continuar sendo gravado em toda nova cotacao e todo novo cliente.

## Motivo de manter BilhetePreview sem valores

O BilhetePreview e um material visual que pode ser enviado ao cliente.

Por isso, ele nao deve revelar:

- pontos/milhas internas;
- taxas internas;
- valor total;
- valor por trecho;
- margem;
- composicao de preco;
- qualquer regra comercial sensivel.

A decisao protege a estrategia comercial da Voo Singular e evita que dados internos sejam expostos em prints ou imagens compartilhadas.

## Motivo de manter Smart Paste global por enquanto

O Smart Paste global ja acelera a operacao atual e preenche dados a partir da area de transferencia.

Ele deve ser preservado enquanto o assistido nao estiver pronto porque:

- ja existe fluxo operacional apoiado nele;
- remover a funcao antes do substituto reduziria produtividade;
- o assistido ainda precisa de desenho de interface e validacao de fluxo;
- o Smart Paste por trecho tambem ja ajuda no preenchimento de ida e volta.

Mudancas nessa area devem manter compatibilidade operacional ate que o fluxo assistido seja confiavel.

## Decisao de Smart Paste Assistido com conferencia humana

O Smart Paste Assistido deve interpretar texto automaticamente, mas exigir confirmacao antes de alterar a cotacao.

Motivos:

- dados de voo podem vir em formatos diferentes por companhia ou programa de milhas;
- datas, horarios e taxas extraidas incorretamente podem gerar proposta errada;
- a conferencia humana reduz erro silencioso;
- o usuario continua ganhando velocidade sem abrir mao de controle.

O fluxo desejado e: colar texto, interpretar, apresentar dados estruturados, permitir revisao e aplicar somente apos confirmacao.

## Decisao de preservar documentos antigos ate plano de migracao

Documentos antigos sem `ownerId` nao devem ser alterados automaticamente.

Motivos:

- atribuir `ownerId` errado pode expor dados para usuario incorreto;
- regras Firestore baseadas em `ownerId` podem tornar documentos antigos inacessiveis;
- uma migracao precisa de criterio claro de propriedade;
- pode ser melhor migrar, arquivar ou aceitar inacessibilidade conforme decisao operacional.

Antes de aplicar regras de seguranca em producao, e necessario decidir explicitamente o destino desses documentos antigos.
