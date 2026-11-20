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

## Passo 1: criar/configurar o Apps Script (esclarecimento importante)

**A criação das planilhas no Google Drive NÃO cria ou publica Apps Script.**
Também **não cria automaticamente propriedades do script**, pastas de documentos
nem a integração privada no Worker. As três planilhas já estão prontas, mas
cada transportadora ainda precisa de um serviço Apps Script conectado.

**De onde vêm os nomes CADASTRO_*?** O arquivo integrado foi desenvolvido a
partir do serviço de documentos que já existe no Portal. Por compatibilidade
com a API atual, as propriedades se chamam
`CADASTRO_GATEWAY_KEY`, `CADASTRO_TENANT_ID` e
`CADASTRO_DRIVE_FOLDER_ID`, mesmo quando o mesmo serviço atende
Solicitações / Chamados. **Não presuma que elas já existem.**

### Cenário A: a transportadora já utiliza Apps Script para Cadastro

Em **Super Admin > Configurações > Google Drive: Solicitações de Cadastro**,
verifique se URL, pasta e chave já estão configuradas. Se sim,
faça backup do código desse serviço e atualize o **mesmo projeto**, utilizando
o arquivo [CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs](CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs),
pois ele inclui as operações de upload/download anteriores e as novas de
chamados. **Não substitua o serviço existente por um projeto novo sem
preservar o código e a configuração**: a integração de documentos é
compartilhada no Worker atual.

Se as propriedades já existirem, mantenha os valores, publique uma nova
versão na mesma implantação e confirme permissão de edição da planilha.

### Cenário B: a transportadora não tem Apps Script/propriedades configurados

1. Abra a **planilha de chamados daquela transportadora** e clique
   **Extensões > Apps Script**. Isso cria um **novo projeto**, vinculado
   àquela planilha.
2. No editor, substitua o conteúdo do `Código.gs` pelo arquivo completo
   [CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs](CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs).
   Mantenha apenas **um** `doPost` nesse projeto.
3. No Google Drive, crie uma **pasta privada de anexos exclusiva** para
   a transportadora. Copie o **ID da pasta** (não o ID da planilha).
   O script precisa ter permissão de acesso à pasta e de edição à planilha.
4. Em **Apps Script > Configurações do projeto > Propriedades do script**,
   clique em **Adicionar propriedade** e cadastre estas três:

   | Nome exato | Valor |
   | --- | --- |
   | `CADASTRO_GATEWAY_KEY` | Uma nova chave aleatória forte, com pelo menos 24 caracteres, que também será salva no Super Admin |
   | `CADASTRO_TENANT_ID` | ID técnico exato da transportadora no Portal (não o nome de exibição) |
   | `CADASTRO_DRIVE_FOLDER_ID` | ID da pasta privada de anexos criada no Google Drive |

   Salve as propriedades. **Nunca publique a chave no GitHub, HTML ou Sheets**.
   O `CADASTRO_DRIVE_FOLDER_ID` é um ID de **pasta Drive**,
   enquanto o `sheetId` da integração é o ID de **planilha**: são distintos.

5. Em **Implantar > Nova implantação > Aplicativo da Web**, configure
   a execução como a conta proprietária e acesso que permita ao Worker
   invocar a URL (o código exige a chave privada para autorizar a operação).
   Implante e copie a URL que termina em `/exec`.
6. No portal, entre em **Super Admin > Configurações >
   Google Drive: Solicitações de Cadastro** e salve
   **URL do Apps Script**, **ID da pasta privada do Drive** e
   **a mesma chave** definida nas propriedades do script.
   A API atual **compartilha essa integração privada** entre os anexos
   de Cadastro e de Solicitações / Chamados. Não substitua uma
   integração existente por outra sem reconciliar os dois módulos.
7. Em **Super Admin > Perfis e Acessos > Armazenamento de chamados**,
   clique em **Verificar integração** e siga a migração abaixo.

**Atenção:** embora as planilhas já tenham sido criadas, os projetos
Apps Script deste cenário B **ainda não foram criados ou implantados por
este assistente**. A conexão atual com Google Drive permite criar arquivos
e planilhas, mas não autoriza a publicação de projetos Apps Script.

## Passo 2: escolher Importar ou Começar do Zero

No Portal Frete, entre em:
**Super Admin > Perfis e Acessos > Armazenamento de chamados · Google Sheets + Drive**.

### Opção A: começar do zero, sem importar os chamados antigos

Se os chamados anteriores eram apenas testes e você **esvaziou voluntariamente** a planilha:

1. Verifique se as abas SOLICITACOES, ANEXOS, MENSAGENS e HISTORICO estão vazias.
2. Verifique `CONFIG!B4` (`ULTIMO_NUMERO`). Coloque `0` se deseja reiniciar a numeração. **Só faça isso antes da primeira ativação de uma base realmente vazia.**
3. Clique em **1. Verificar integração**. O painel indicará que a planilha está vazia.
4. Clique em **3B. Iniciar base vazia (sem importar)** e digite `INICIAR DO ZERO`.
5. O Worker verifica novamente os quatro conjuntos de dados e suas assinaturas vazias, confere o ID da transportadora e ativa a planilha. **O D1 anterior permanece intacto como arquivo histórico**, mas seus chamados antigos não aparecerão na nova fila.

**Nova Frota:** a planilha de testes foi verificada vazia e o `ULTIMO_NUMERO` foi redefinido de 3 para 0 em 20/11/2026. Ainda é necessário clicar no botão 3B para efetivar a troca. Não clique em "Importar chamados existentes" se deseja a base limpa.

### Opção B: importar os dados anteriores



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

- \`docs/CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs\`: código Apps Script integrado de Drive + Sheets.
- \`worker/src/services/chamados-sheets.js\`: gateway Worker autenticado.
- \`worker/src/controllers/abertura-pedidos.js\`: chaveamento entre D1 e Sheets.
- \`assets/js/super-admin-chamados-sheets.js\`: interface de migração.
- \`worker/tests/chamados-sheets.test.mjs\`: testes de fallback, permissões e integridade.
