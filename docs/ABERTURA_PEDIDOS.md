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

## Atualização: SOLICITAÇÕES / CHAMADOS (20/11/2026)
O módulo de solicitações de pedidos foi unificado sob o título **SOLICITAÇÕES / CHAMADOS**, mas mantém URLs, protocolo, chat, histórico, formulário original de abertura e os quatro tipos anteriores. A mudança não altera os módulos **Solicitação / Execução de Cadastros** e **Solicitação / Execução de Troca de Notas**.

### Tipos disponíveis
- Abertura de pedido (`PEDIDO`), Correção de pedido (`CORRECAO_PEDIDO`), CT-e complementar (`CTE_COMPLEMENTAR`) e Carta de correção (`CARTA_CORRECAO`).
- Solicitação de pagamento (`PAGAMENTO`): CT-e, placa, nome do beneficiário, CPF/CNPJ, PIX IRION **ou** depósito, com banco, agência e conta obrigatórios em ambos; a chave PIX só é exigida em PIX IRION. Classificação: adiantamento, saldo ou adiantamento e saldo.
- Pagamento de GUIA (`PAGAMENTO_GUIA`): CT-e e NF.

O acompanhamento possui filtros independentes por **situação** e **tipo**. Dados específicos de cada categoria ficam no JSON existente, sem renumerar chamados.

### Fluxo de comprovantes
- Os chamados financeiros passam por `FILA`, `ANDAMENTO`, `PENDENTE` e `FINALIZADO`.
- **Somente o executor responsável**, na tela de execução, pode anexar o comprovante de pagamento ou de guia **após a finalização**. O solicitante o visualiza ou baixa nos documentos do protocolo.
- Formatos: PDF, JPEG, PNG, WebP (até 6 MB por arquivo). O Worker envia os comprovantes usando o slot privado já existente `liberacao` e os identifica pelo campo `tipo_anexo`, evitando reimplantar o Apps Script só por causa desses dois tipos de comprovante.
- A finalização do chamado não significa confirmação automática de transferência bancária: a plataforma registra solicitação e comprovante fornecido.

### Perfil Pedido Execução por usuário
No **Super Admin > Perfis e Acessos > Perfil: Pedido Execução**, vincule o login do executor a um ou mais dos seis tipos. A API mantém a fila filtrada e também impede acessar detalhes de categorias não liberadas, mesmo pelo ID/link direto. Configuração segregada por transportadora em `tenant/{id}/private/pedidos-exec-access-v1.json`. Exige também o módulo `execucao-pedidos` ativo para a empresa e liberado na matriz do perfil.

**Compatibilidade:** até a primeira gravação do subperfil, os executores antigos conservam apenas os quatro tipos anteriores. Quando os tipos são configurados, apenas usuários presentes na lista podem executar as categorias atribuídas. Não confundir subperfil de classificação com o perfil de login geral.

### D1, migração compatível com registros existentes
A migração `worker/migrations/super-admin/0010_chamados_financeiro.sql` adiciona `categoria_chamado` em `portal_pedidos_tickets` e `tipo_anexo` em `portal_pedidos_docs`, sem recriar tabelas, para respeitar os CHECKs históricos da migração 0009. Para as categorias financeiras, a coluna `tipo_solicitacao` mantém o valor de compatibilidade `PEDIDO` e `categoria_chamado` guarda a categoria efetiva. Para comprovantes financeiros, `slot` mantém `liberacao` e `tipo_anexo` identifica o comprovante efetivo. O Worker consulta e expõe os valores efetivos. O workflow `Deploy Portal Hotfix` aplica os novos campos uma única vez, antes de publicar o Worker.
