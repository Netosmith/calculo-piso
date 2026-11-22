# Solicitações / Chamados: FILA antecipada com anexos em andamento

Implementação preparada em 22/11/2026 no Portal Frete.

## Fluxo anterior
`criar RASCUNHO → enviar cada documento → enviar solicitação → FILA`.
Com arquivos maiores, o cartão só aparecia após toda a transferência.

## Novo fluxo
`registrar protocolo + FILA → exibir cartão → enviar anexos → liberar execução`.

O usuário vê imediatamente a confirmação do protocolo **depois da gravação real da
solicitação na base**. O envio dos documentos continua em requisições separadas,
com o cartão indicando **Enviando anexos 0/N, 1/N, 2/N...**.
É possível criar outra solicitação enquanto a transferência prossegue.

Para os tipos que não exigem documentos (como Solicitação de Pagamento), não há
etapa de transferência. Para **CT-e complementar**, a liberação do cliente continua
obrigatória, mas é enviada depois da criação inicial do cartão.

O status do chamado é **FILA** e o estado dos arquivos fica **separado**.
Se a transferência estiver pendente ou interrompida, a Central de Execuções
pode consultar o cartão, mas não assumir ou mudar sua etapa. Ao confirmar todos
os documentos, a execução é liberada. Isso evita que um executor manifeste
ou conclua um pedido sem a documentação necessária.

## Persistência

Os eventos `ANEXOS_ENVIO`, `ANEXOS_PRONTOS` e `ANEXOS_FALHA` são
registrados no histórico do chamado com o total previsto e o total recebido.
Não foi necessário criar novas colunas no D1 ou no Google Sheets.
O Worker confirma número de documentos e, para CT-e complementar,
presença da liberação antes de marcar os anexos como completos.

Os anexos continuam sendo armazenados **no Google Drive privado da
transportadora**. O histórico, protocolo, perfis e permissões anteriores
permanecem preservados.

## Interrupções e retomada

A transferência ocorre em segundo plano **dentro da aba aberta do navegador**,
e não em um serviço permanente que funcione com o navegador fechado.
Se o usuário tenta sair durante o envio, o navegador pode emitir um alerta.
Se houver erro, o card permanece na Fila com o indicador de interrupção e
os documentos já salvos não são apagados.

Para retomar na mesma aba, abra o cartão e clique em
**Retomar anexos interrompidos**. Se a aba tiver sido fechada ou o celular
suspender o processo, abra o mesmo cartão e anexe manualmente os arquivos
faltantes; não crie um novo protocolo. Ao atingir o total esperado, o sistema
finaliza a transferência e libera a execução.

## Compatibilidade e implantação

A entrada antecipada só é ativada após confirmação de
`GET /v1/abertura-pedidos/capacidades?visao=solicitante`, com
`anexosEmFila:true`. Se a integração ainda usa uma implantação Apps Script
antiga, a tela **mantém o fluxo tradicional** até a atualização; ela não
marca uma solicitação como pronta sem a confirmação do backend.

Em transportadoras com Google Sheets ativo:
1. Abra o Apps Script **já vinculado** ao portal e faça backup do código.
2. Atualize-o com o arquivo
   [CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs](CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs).
3. Vá a **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar**
   para conservar a URL que o Worker utiliza.
4. Recarregue as páginas do portal no navegador (Ctrl+F5 no desktop).

A atualização do GitHub não altera, por si só, a implantação do Google Apps
Script. Também é necessário que a versão correspondente do Worker esteja
publicada.

## Testes

```bash
node --check assets/js/abertura-pedidos.js
node --check worker/src/controllers/abertura-pedidos.js
node --test worker/tests/chamados-fila-antecipada.test.mjs
node --test worker/tests/chamados-kanban-ui.test.mjs
node --test worker/tests/chamados-public-performance.test.mjs
```

A automação `.github/workflows/chamados-kanban-check.yml` foi atualizada
para executar os testes da fila antecipada.

Teste funcional recomendado: criar pedido com 3 documentos, confirmar que o
card já aparece na Fila com 0/3, 1/3 e 2/3, tentar assumir o card durante
a transferência (deve bloquear), confirmar que 3/3 libera a execução e
verificar o arquivo no detalhe. Simular falha e retomar no mesmo protocolo.
Repetir com CT-e complementar. **Ainda é necessário verificar em produção.**
