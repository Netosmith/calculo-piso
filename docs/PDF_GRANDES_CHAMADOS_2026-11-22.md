# Portal Frete | PDFs grandes e aviso de protocolo

Atualização em **22/11/2026**.

## Problema identificado

O fluxo antigo de Abertura de Pedido com documentos aguardava a conclusão
de todos os arquivos antes de mudar o status para FILA. A mensagem
"Enviando solicitação. Aguardando confirmação do protocolo" permanecia
visível durante essa espera. Além disso, o tamanho de 6 MB era aplicado
pelo formulário, pelo Worker, pelo Apps Script e no download.

A presença simultânea de um card em FILA e de "Rascunhos (1)" pode ocorrer
porque o card pertence a uma solicitação já enviada e o rascunho a outra
solicitação anterior. Não remover rascunhos automaticamente sem verificar
o conteúdo.

## Implementação

- Formulários de solicitações: arquivos PDF, JPG, PNG e WebP de **até
  20 MB por arquivo**.
- Até 6 MB, mantém envio tradicional por uma única requisição.
- Acima de 6 MB, o navegador divide o arquivo em partes de **2 MB**;
  a cada confirmação de bloco o card atualiza a barra de progresso.
- O Apps Script armazena temporariamente as partes em uma pasta privada
  do Drive, reconstitui o documento original e remove as partes temporárias
  quando o documento está confirmado.
- D1 e Google Sheets gravam apenas o anexo completo nos registros de
  documentos, com ID e tamanho real, nunca blocos incompletos.
- Visualização e download de arquivos acima de 6 MB também utilizam
  partes de até 2 MB, reconstruídas como um único Blob no navegador.
- A FILA é confirmada após criar o protocolo; os anexos continuam
  sendo enviados sem impedir outra solicitação. A execução só é liberada
  quando todos os arquivos planejados foram recebidos.
- A mensagem genérica foi substituída por "Registrando protocolo..." e,
  quando o backend antigo estiver ativo, por um aviso explícito de
  fluxo tradicional.
- Falhas mantêm o card na FILA e permitem a retomada no mesmo protocolo
  sem perder os anexos já confirmados.

**Limitações conhecidas:** o envio prossegue apenas enquanto a aba estiver
aberta e o navegador não suspender o JavaScript. O limite por arquivo é
20 MB, não ilimitado. Para retomada após fechar o navegador, será necessário
selecionar novamente os arquivos faltantes no mesmo card. A reconstrução
de um PDF grande no Apps Script ainda precisa ser validada com arquivos
reais no Google Drive da transportadora.

## Implantação necessária

O frontend, Worker e arquivo-fonte do Apps Script foram atualizados no
GitHub. Isso **não altera uma implantação ativa do Apps Script**.
Se a transportadora usa Google Sheets:

1. Abra o projeto Apps Script já associado à transportadora, na conta
   proprietária da integração. Faça backup do script implantado.
2. Substitua o código pelo conteúdo atualizado de
   [CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs](CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs).
3. Use **Implantar → Gerenciar implantações → Editar → Nova versão →
   Implantar** para conservar a mesma URL utilizada pelo Portal.
4. Confirme as permissões de Drive e de planilha; preserve as
   propriedades privadas já configuradas.
5. Verifique se o Worker correspondente foi publicado e atualize
   o portal no celular ou computador.
6. A chamada `/v1/abertura-pedidos/capacidades?visao=solicitante`
   deve retornar `anexosEmFila:true` e `anexosGrandes:true`.
   A consulta é autenticada.

Antes da implantação do Apps Script, o navegador deve usar o fluxo
tradicional e bloquear arquivos acima de 6 MB com uma explicação, em vez
de tentar uma operação incompatível.

## Testes sugeridos em produção

Com um executor e solicitante da mesma transportadora:
- Criar Abertura de Pedido com um PDF de 8 a 12 MB e outro de 1 MB.
- Conferir protocolo na FILA antes da conclusão dos anexos.
- Conferir o avanço em partes e o contador de documentos.
- Abrir o card na Execução durante o envio; deve impedir assumir.
- Após 2/2, conferir tamanho, conteúdo e visualização do PDF no Drive
  e no portal; então assumir o chamado.
- Verificar um PDF de cerca de 19 a 20 MB, sem extrapolar o limite.
- Simular desconexão no envio e retomar no mesmo protocolo.
- Conferir que a listagem e o histórico não perderam anexos menores.

O repositório inclui `worker/tests/chamados-pdf-20mb.test.mjs` e
o workflow `.github/workflows/chamados-kanban-check.yml`.

Esses testes estáticos não substituem um teste de envio real no ambiente
Google Drive da transportadora.
