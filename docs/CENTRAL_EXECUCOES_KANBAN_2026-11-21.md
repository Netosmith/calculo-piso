# Central de Execuções | Kanban de Chamados

Atualização: 21/11/2026. Módulos: `pages/solicitacao-pedidos.html` e
`pages/execucao-pedidos.html`.

## Fluxos validados pela API

| Origem | Destino | Resultado |
| --- | --- | --- |
| FILA | ANDAMENTO | O executor assume o chamado pelo endpoint `/:id/assumir`. |
| ANDAMENTO | PENDENTE | Requer motivo com pelo menos 8 caracteres; grava histórico. |
| ANDAMENTO | FINALIZADO | Finaliza o chamado. Abertura de pedido exige número do pedido do sistema. |
| PENDENTE | ANDAMENTO | Somente o executor responsável retoma o atendimento. |
| PENDENTE | FILA | Abre o formulário de correção na tela Solicitações; somente após salvar volta à fila e limpa o executor. |
| FINALIZADO | Qualquer etapa | Não permitido; permanece no histórico permanente. |

Não existe movimentação direta de FILA para FINALIZADO ou PENDENTE. A operação
por arrastar e soltar **não substitui** a validação do Worker. Cada movimento é
confirmado por uma requisição autenticada. O card só muda de coluna depois
que a API confirma a transação. Falhas preservam a posição anterior.

## Interface

- Cabeçalho dedicado à Central de Execuções, centrado, com etapas do processo.
- Indicadores de FILA, ANDAMENTO, PENDENTE e FINALIZADO (hoje), clicáveis para filtrar.
- Soltar na coluna válida destaca o destino; destinos inválidos ficam atenuados.
- Janela de confirmação para assumir, justificar pendência, retomar ou finalizar.
- Na tela de Solicitações, arrastar PENDENTE para FILA abre a correção colaborativa.
- Clicar no card continua abrindo o detalhe, inclusive em celular, com botões
  de status, chat e anexos já existentes. Não depender do drag em touchscreen.
- Área **Meu foco** compacta substitui a duplicação de cards da fila.
- Arquivo permanente continua carregado somente quando solicitado.

## Latência e carga

- Status confirmados atualizam o Kanban localmente, sem segundo GET de detalhes.
- As colunas só reconstroem os cards quando os dados exibidos mudaram.
- Os GETs completos de detalhes, anexos e histórico ficam sob demanda.
- D1 seleciona apenas as colunas de resumo da Execução, sem `SELECT *`.
- O Apps Script passa a construir um resumo leve das solicitações na listagem;
  a rota `/:id` continua retornando os dados completos e protegidos.
- A sincronização automática ocorre a cada 15 segundos no modo D1 e a cada
  30 segundos no modo Sheets, desde que a aba esteja visível e sem modal aberto.
  A periodicidade não garante tempo máximo de resposta da rede.

## Publicação e testes

Frontend e Worker estão versionados no repositório. O Worker usa o fluxo
existente de deploy pelo GitHub Actions. **A otimização de Google Sheets**
incluída no arquivo `docs/CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs` só fica
ativa em produção depois de atualizar a implantação existente do Google Apps
Script da transportadora.

Validação local:

```bash
node --check assets/js/abertura-pedidos.js
node --check worker/src/controllers/abertura-pedidos.js
node --test worker/tests/chamados-kanban-ui.test.mjs worker/tests/chamados-public-performance.test.mjs
```

A automação `.github/workflows/chamados-kanban-check.yml` repete esses
testes nas alterações do Kanban. Testes unitários não substituem a verificação
manual em desktop/celular com os perfis COMERCIAL, OPERACIONAL, executor e
Super Admin de cada transportadora.
