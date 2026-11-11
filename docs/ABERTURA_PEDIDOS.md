# Abertura de Pedidos | Portal Frete

## Módulos
- **Solicitação de Abertura de Pedidos:** `pages/solicitacao-pedidos.html`
- **Execução de Abertura de Pedidos:** `pages/execucao-pedidos.html`
- **API:** `/v1/abertura-pedidos`, no Worker atual do Portal
- **D1:** `portal_pedidos_tickets`, `portal_pedidos_docs`, `portal_pedidos_messages`, `portal_pedidos_history`, `portal_pedidos_sequence`
- **Anexos:** integração Google Drive privada configurada no Super Admin para cada transportadora

As duas funções ficam **DESATIVADAS por padrão** para TODAS as transportadoras. A liberação individual é feita por meio dos dois checkboxes no Super Admin.

## Formulário
E-mail (opcional), Nome do Solicitante, Telefone/WhatsApp, Unidade de Embarque, Número de Pedido OC, NF-e a Ser Manifestada, Tomador/CNPJ, Coleta/IE, Entrega/CNPJ, Entrega/IE, Frete Empresa, Frete Motorista, Adiantamento %, ICMS (opcional), Produto, Espécie, TAG, Observações (opcional), Coordenadas Geográficas Coleta (opcional) e Coordenadas Geográficas Entrega (opcional).

Anexos de Nota, Nota de Coleta, Liberação, Print da Rota de Pedágio e Print da Tabela ANTT; opcionais conforme as imagens de referência (sem indicação de obrigatoriedade). Tipos PDF, JPG, PNG, WebP de até 6 MB por arquivo. Uploads são armazenados privadamente, não em links públicos.

O pedido tem protocolo curto (#00001 por transportadora) independente do Número OC. Os dados do rascunho podem ser corrigidos antes do envio.

## Execução
- **FILA:** disponível para executores autorizados assumirem.
- **ANDAMENTO:** executor responsável recebeu o pedido.
- **PENDENTE:** obriga motivo (mínimo 8 caracteres) e abre comunicação com o solicitante.
- **FINALIZADO:** obriga Número do Pedido no Sistema, exibido ao solicitante para continuidade do manifesto eletrônico.

A conclusão **não emite o manifesto eletrônico automaticamente**. Ela registra o número de pedido necessário para prosseguir no módulo externo. O chat e os anexos são isolados por `tenant_id`, e o endpoint verifica autorização do solicitante ou executor responsável.

## Implantação da integração Drive
O novo módulo reutiliza a integração privada já usada pela Central de Cadastros, com a mesma URL, pasta e chave de cada empresa. Contudo, para anexos funcionarem, é obrigatório atualizar o Apps Script dessa empresa com os cinco novos tipos de anexos. Código no arquivo `docs/CADASTRO_DRIVE_APPS_SCRIPT.gs`.

No Apps Script correspondente à transportadora, substitua pelo código atualizado, salve e vá a **Implantar > Gerenciar implantações > Editar > Nova versão > Implantar**. As propriedades atuais do script devem permanecer intactas. Não coloque chaves nem credenciais no HTML ou GitHub.

## Testes e publicação
O `Deploy Portal Hotfix` valida os scripts e testa o módulo, cria as tabelas via `worker/migrations/super-admin/0008_abertura_pedidos.sql` e publica o Worker. O GitHub Pages publica as duas páginas principais e os acessos isolados em `pages/gnova/`, `pages/transvale/`, `pages/modelo01/` e `pages/modelo02/`.
