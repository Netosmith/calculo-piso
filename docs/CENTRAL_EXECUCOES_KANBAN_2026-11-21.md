# Central de Execuções | Kanban com movimentação livre
Atualização: 21/11/2026 · Portal Frete

## Movimentação em qualquer direção

Na **Central de Execuções**, um executor autorizado pode mover um chamado
de qualquer etapa para outra: FILA, ANDAMENTO, PENDENTE e FINALIZADO.
Inclusive FILA → FINALIZADO, FINALIZADO → PENDENTE ou ANDAMENTO → FILA.

O drag-and-drop não exige confirmação nos destinos FILA, ANDAMENTO e
FINALIZADO. Ao entrar em PENDENTE:
- Se houver motivo salvo no chamado com ao menos 8 caracteres, a operação
  ocorre diretamente e reutiliza o motivo, sem abrir nova janela.
- Se não houver, abre-se apenas a janela "Motivo ou justificativa".
- Se o motivo for digitado dentro do detalhe do chamado e enviado com a mudança
  para PENDENTE, nenhuma janela adicional aparece.

Na visão **Solicitações**, a correção de pendência permanece colaborativa e o
movimento PENDENTE → FILA abre o formulário para validar os dados corrigidos.
Usuários solicitantes não recebem poderes de execução.

## Persistência e segurança

O frontend chama `POST /v1/abertura-pedidos/:id/mover`, enviando:
- `origem`: a etapa exibida na tela;
- `status`: etapa de destino;
- `motivo`: justificativa opcional, obrigatória somente se entrar em PENDENTE
  sem motivo anteriormente salvo;
- `numeroPedidoSistema`: opcional quando disponível.

O Worker verifica sessão, transportadora, tipo autorizado do executor, estado
anterior e se o chamado está ativo (não excluído). Em D1, o UPDATE confirma
`status=origem`, evitando a sobrescrita silenciosa de movimentações
concorrentes. Na integração Sheets, as gravações são serializadas pelo
Apps Script. Cada movimento grava uma entrada no histórico, preservando
mensagens, anexos e número do pedido já preenchido.

Ao voltar à FILA, o executor é limpo para que outro colaborador possa assumir.
Ao mover para outro estado, o responsável passa a ser quem executou a ação.
Isso garante que o comprovante de pagamento, quando cabível, continue sob
a responsabilidade do executor ativo.

A conclusão de pedidos pelo **arraste** não exige o número do pedido no
sistema. Caso ainda não tenha sido informado, ele ficará vazio e deverá ser
preenchido posteriormente para o fluxo que exige esse número. O botão legado
de situação ainda conserva suas validações próprias.

## Interface e desempenho

- Painel centralizado com indicadores por etapa e fluxo da operação.
- Drop zones destacam etapas permitidas; clique no card abre o detalhe.
- Indicador "Motivo já registrado" no card PENDENTE.
- Formulário de detalhe permite todas as etapas, inclusive FILA.
- A posição da coluna só muda após resposta de sucesso do servidor.
- A listagem retorna campos essenciais; detalhes, mensagens e anexos
  são consultados sob demanda.
- Atualização automática nominal: D1 a cada 15 s; Sheets a cada 30 s,
  condicionada à aba visível, sem modais e sem requisições em andamento.
- Histórico permanente permanece disponível para consulta.

## Arquivos alterados

- `assets/js/abertura-pedidos.js`
- `assets/css/abertura-pedidos.css`
- `pages/execucao-pedidos.html` e `pages/solicitacao-pedidos.html`
- `worker/src/controllers/abertura-pedidos.js`
- `worker/src/services/chamados-sheets.js`
- `docs/CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs`
- `worker/tests/chamados-kanban-ui.test.mjs`

## Publicação e verificação

O GitHub recebe o frontend e o Worker; o despliegue do Worker depende do
GitHub Actions do repositório. Para transportadoras que usam **Google Sheets**
como fonte principal, a implementação do `mover` precisa também estar na
**implantação ativa do Apps Script**. Sem republicar a implantação existente,
a API pode retornar "Operação desconhecida".

Verificar usando executor autorizado: arrastar FILA → FINALIZADO,
FINALIZADO → ANDAMENTO, ANDAMENTO → PENDENTE com novo motivo,
PENDENTE → FILA, FINALIZADO → PENDENTE com motivo previamente salvo,
além de comparar etapas e histórico em duas sessões simultâneas.
Não confundir verificações estáticas com teste em produção.
