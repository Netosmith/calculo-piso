# Corrigir "Operação de chamados desconhecida"

**Diagnóstico confirmado em 21/11/2026:** o portal envia o comando
`chamados.mover`, mas a implantação ativa de Google Apps Script da
transportadora ainda usa uma versão anterior sem `if(op==="mover")`.
Também falha o salvamento de observações feito por esse comando.

## Correções já adicionadas ao Portal Frete

- A Central detecta versões antigas do Apps Script pela consulta
  autenticada `GET /v1/abertura-pedidos/capacidades?visao=execucao`.
- Quando a versão antiga não possui `mover`, ações compatíveis passam a
  utilizar os comandos `assumir` e `situacao` existentes. Por exemplo,
  o executor responsável pode salvar a observação em **Em andamento** ou
  **Pendente** com o comando anterior.
- Movimentos que a implantação antiga não suporta, como **Finalizado
  → Fila**, **Pendente → Fila** e **Finalizado → Em andamento**, não são
  simulados ou gravados no D1 para evitar divergência com o Google Sheets.
  O portal mostra uma mensagem específica indicando que o Apps Script
  precisa ser atualizado.
- Observações curtas são aceitas e preservadas sem alterar o status.
  Para **colocar em Pendente**, continua sendo exigida justificativa
  de ao menos 8 caracteres, reutilizada quando já registrada.
- O frontend foi versionado para atualizar o cache do navegador.

## Publicar a versão correta do Apps Script

1. Abra a conta Google proprietária da integração que a transportadora
   usa em **Super Admin → Configurações → Google Drive: Solicitações de Cadastro**.
   O script de Cadastro é compartilhado com os chamados.
2. Abra o **projeto Apps Script já implantado**, faça uma cópia de segurança
   do código atual e confirme qual implantação tem a URL usada pelo Portal.
3. No GitHub, abra o arquivo completo
   [CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs](CHAMADOS_PEDIDOS_SHEETS_APPS_SCRIPT.gs)
   e copie todo seu conteúdo para o editor do **mesmo projeto**, substituindo
   a versão antiga. Não deixe dois `doPost` no mesmo projeto.
4. Mantenha as propriedades já configuradas:
   `CADASTRO_GATEWAY_KEY`, `CADASTRO_TENANT_ID` e
   `CADASTRO_DRIVE_FOLDER_ID`. **Não publique nenhuma chave ou token.**
5. Clique em **Implantar → Gerenciar implantações → Editar** (ícone lápis)
   na implantação já usada pelo Portal → escolha **Nova versão** →
   **Implantar**. Não crie outra URL se não for necessário.
6. Reabra a Central de Execuções e atualize a página. O diagnóstico
   automático deixará de informar versão incompatível quando a operação
   `capabilities` e a função `mover` estiverem implantadas.

O fluxo se aplica **separadamente a cada transportadora** que usa sua
própria implantação Apps Script e o modo Google Sheets. Alterar apenas
o GitHub não muda o código de uma implantação Apps Script já publicada.

## Verificação funcional

- **Em andamento → Fila:** deve voltar sem pedir confirmação.
- **Fila → Finalizado:** deve mudar diretamente, inclusive em solicitações de pagamento.
- **Finalizado → Pendente:** abre justificativa somente se não houver
  motivo salvo.
- Abra um chamado, escreva uma **observação curta** mantendo a etapa
  atual, salve, feche e reabra: o texto deve continuar registrado.
- Após mover, confirme que a mudança aparece em outra sessão e no
  histórico da mesma transportadora.

Todas as operações continuam autenticadas e registradas na mesma
planilha; não apague abas, não migre a fonte principal e não recrie
chamados para corrigir uma implantação desatualizada.
