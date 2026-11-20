# Migração: Solicitações / Chamados para Google Sheets + Drive

## Implantação atual (20/11/2026)

**Importante:** A migração foi preparada em ambiente real, mas o D1 permanece como
**fonte principal** até que cada transportadora tenha seu Apps Script atualizado,
tenha seus dados importados, e o Super Admin clique em **Ativar Google Sheets**.
Essa proteção impede perder dados e documentos. Não apague o D1.

### Planilhas criadas, privadas, separadas por transportadora

| Transportadora | ID usado no portal | Planilha |
| --- | --- | --- |
| Nova Frota | nova-frota | https://docs.google.com/spreadsheets/d/11bdFewENA_lUZ2pwIb295RmlubnW_cvVYRZKbo1vWa4/edit |
| GNOVA | teste-01 | https://docs.google.com/spreadsheets/d/1Lh8vkY5-8YUesv6xxPdhfFGpko3lVV8h5iT4cc4Gb6Y/edit |
| TRANSVALE | transvale-01 | https://docs.google.com/spreadsheets/d/13c8NE0P7SqURuvOvSJ3yRQhyxBpoGZUqrAMbazquQGY/edit |

Planilhas na pasta privada "ChatGPT" do Google Drive da conta conectada,
sem compartilhamento público. Cada planilha possui onze abas:
SOLICITACOES, PEDIDOS_DETALHES, CORRECOES, PAGAMENTOS, ANEXOS,
MENSAGENS, HISTORICO, AUDITORIA, EXCLUIDOS, USUARIOS e CONFIG.

### O que permanece como estava

- Os módulos **Solicitação/Execução de Cadastro** e **Solicitação/Execução de Troca de Notas** não são modificados.
- O visual de **Solicitações / Chamados** e **Execução de Solicitações** não muda.
- O Google Drive existente continua armazenando PDF, JPEG, PNG e WebP.
- Os perfis autorizados e segregação de empresa ainda são verificados pelo Cloudflare Worker e pelo Super Admin.
- D1 preserva toda a cópia original dos chamados migrados e não é apagado.

## Passo 1: atualizar o Apps Script privado de cada empresa

Esta é a única etapa que depende da conta proprietária de cada projeto
Google Apps Script. Os conectores de Google Drive não conseguem publicar
novas versões do Apps Script automaticamente.

1. Acesse o projeto Apps Script que já faz upload/download de documentos
   daquela transportadora e abra seu editor.
2. Faça uma cópia do código anterior e **substitua o código completo da
   implantação de documentos** pelo conteúdo de
   [CHAMADOS_SHEETS_APPS_SCRIPT.gs](CHAMADOS_SHEETS_APPS_SCRIPT.gs).
   Atenção: não deixe dois métodos \`doPost\` conflitantes no projeto.
3. Em **Configurações do projeto > Propriedades do script**, mantenha
   \`CADASTRO_GATEWAY_KEY\`, \`CADASTRO_TENANT_ID\` e
   \`CADASTRO_DRIVE_FOLDER_ID\` como estão. **Não copie essas propriedades
   para HTML, GitHub ou planilhas**.
4. Confirme que a conta executora do Apps Script tem **acesso de editor**
   à planilha dessa transportadora.
5. Em **Implantar > Gerenciar implantações > Editar**, escolha
   **Nova versão > Implantar**. Conserve a mesma URL /exec já registrada
   no Super Admin. Caso publique uma nova URL, atualize-a no local
   privado de integração do Super Admin, sem revelar a chave.

O código novo inclui as operações anteriores de upload e download,
para que documentos de Cadastro e Troca de Notas continuem funcionando.

## Passo 2: importar os dados com segurança

No Portal Frete, entre em:
**Super Admin > Perfis e Acessos > Armazenamento de chamados · Google Sheets + Drive**.

Para **cada transportadora**:
1. Selecione a transportadora e clique em **1. Verificar integração**.
2. Se a conexão estiver pronta, clique **2. Importar chamados existentes**.
   O Worker lê no D1 lotes de no máximo 20 chamados e os envia ao Google
   com todas as informações, referências dos anexos, mensagens e histórico.
   Os arquivos PDF/imagens continuam na pasta privada atual do Drive.
3. Clique novamente em **Verificar integração**.
   Serão comparadas quantidade e assinatura SHA-256 dos registros,
   além de quantidade e assinaturas dos anexos, mensagens e histórico.
4. Apenas quando **todos** os resultados coincidirem, clique em
   **3. Ativar Google Sheets**. O modo de armazenamento fica registrado
   no R2 daquela transportadora, fora do GitHub.

A importação é idempotente: repetir um lote antes da ativação atualiza
o mesmo ID de chamado, evitando duplicação de números de protocolo.

**Nunca apague chamados no D1 para forçar a comparação.**
Se a integração não estiver pronta ou a contagem não conferir, o sistema
continua operando no D1, sem perda de dados.

## Passo 3: edição direta da planilha

Na planilha da transportadora:
- **SOLICITACOES**: tipo, responsável, situação, protocolo, datas.
- **PEDIDOS_DETALHES**: campos do pedido, NF, coleta, descarga, fretes.
- **CORRECOES**: correções de pedido, CT-e e cartas de correção.
- **PAGAMENTOS**: beneficiário, CT-e, placa, CPF/CNPJ, PIX, banco, agência,
  conta e adiantamento/saldo.
- **ANEXOS**: IDs e metadados dos arquivos privados. O documento físico
  fica no Google Drive, não na célula.
- **MENSAGENS / HISTORICO / AUDITORIA**: comunicação e rastreabilidade.
- **EXCLUIDOS**: controle de retirada e restauração.
- **USUARIOS**: aba reservada para futura conciliação, sem substituir
  a matriz de permissões segura do Super Admin, que continua no R2.
- **CONFIG**: valores técnicos do sistema. Não alterar manualmente.

A ligação entre as abas é feita pelo **CHAMADO_ID** (UUID), não pelo
número da linha. **Nunca apague/edite CHAMADO_ID, ID, TRANSPORTADORA,
PROTOCOLO ou ULTIMO_NUMERO**. Evite cortar e colar uma linha entre abas.
Para excluir um chamado de teste, use o botão do Super Admin no portal:
a exclusão é reversível, e comprovantes/histórico permanecem guardados.

Para auditar edições feitas **diretamente na planilha**, execute uma vez no
Apps Script a função:
\`instalarAuditoriaChamados("ID_DA_PLANILHA")\`
com o identificador dessa transportadora e conceda as permissões.
Ela cria um gatilho instalável onEdit que registra mudanças na aba AUDITORIA.
Quando uma edição múltipla não tem valor anterior disponível, isso fica
indicado na auditoria.

## Proteções e limites

- A API continua validando a sessão, transportadora e escopo de execução.
- O Apps Script exige a chave privada que já existe para os anexos.
- Cada script verifica o ID da planilha e o \`TENANT_ID\` da aba CONFIG.
- \`LockService\` serializa operações para impedir numeração duplicada.
- As consultas históricas são paginadas e os finalizados permanecem acessíveis.
- Google Apps Script tem cotas de tempo e simultaneidade. Se ficar
  indisponível após a ativação, uma requisição falha de forma explícita:
  **nunca grava silenciosamente no D1 antigo**, o que criaria divergências.
- Não publique as planilhas nem compartilhe links de acesso irrestrito.
  Elas contêm CPF/CNPJ, contatos e dados de pagamentos.
- Recomendável fazer backups periódicos do Sheets/Drive.

## Novas transportadoras

Copie uma das planilhas vazias (não uma planilha com dados reais), altere
\`CONFIG!B2\` para o verdadeiro tenant ID, sem mexer em cabeçalhos.
No Super Admin > Perfis e Acessos use **Vincular planilha** com seu ID.
O Worker só aceita a vinculação se o Apps Script confirmar o tenant ID
correspondente. Em seguida repita Verificar, Importar e Ativar.

## Repositório técnico

- \`docs/CHAMADOS_SHEETS_APPS_SCRIPT.gs\`: código Apps Script integrado de Drive + Sheets.
- \`worker/src/services/chamados-sheets.js\`: gateway Worker autenticado.
- \`worker/src/controllers/abertura-pedidos.js\`: chaveamento entre D1 e Sheets.
- \`assets/js/super-admin-chamados-sheets.js\`: interface de migração.
- \`worker/tests/chamados-sheets.test.mjs\`: testes de fallback, permissões e integridade.
