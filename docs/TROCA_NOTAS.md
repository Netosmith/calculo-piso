# Módulo Troca de Notas | Portal Frete

## Ambientes
- Solicitação: `pages/solicitacao-troca-notas.html`
- Execução: `pages/execucao-troca-notas.html`
- API: `/v1/troca-notas` no Worker existente
- Banco: `TENANTS_DB` (D1), tabelas `portal_troca_*` com escopo `tenant_id`
- Anexos: a integração privada de Google Drive já cadastrada para a transportadora no Super Admin (a mesma das Solicitações de Cadastro).

## Permissões
Ambos os módulos começam **desativados**. Liberar separadamente no Super Admin:
`solicitacao-troca-notas` para a equipe solicitante e `execucao-troca-notas` para a equipe executora. A execução requer ADMINISTRADOR, GOADM ou usuário adicionado como executor na configuração da integração de cadastros daquela empresa. O Worker exige os módulos habilitados por empresa em cada requisição, inclusive quando alguém acessa diretamente o endereço. A Nova Frota também recebe duas opções individuais, desativadas por padrão; não modifica os demais módulos legados.

## Catálogos e documentos
O cliente é selecionado a partir do catálogo global central de nomes cadastrados; a filial é consultada na planilha privada da transportadora no recurso `cadastros/filiais`. Não há lista de filiais ou clientes inventada no frontend. O backend valida ambas as escolhas no momento de criar o protocolo.

Quatro documentos obrigatórios por solicitação: `nota_origem`, `laudo`, `ticket_pesagem` e `ordem`. PDFs/JPG/PNG/WEBP até 6 MB por arquivo. O rascunho é preservado se o upload falhar. Quando concluída a execução, o executor anexa `nf_trocada` e só então pode marcar `TROCADA`. O status `PENDENTE` exige motivo e permite mensagens e complementação de documentos pelo solicitante.

**Atenção antes de liberar:** cada transportadora precisa atualizar a implantação do Apps Script de documentos usando a versão ampliada de `docs/CADASTRO_DRIVE_APPS_SCRIPT.gs`. Essa versão aceita os cinco slots de Troca de Notas e mantém todos os slots de Cadastro. No Apps Script, cole o código, Salve, Implantar > Gerenciar implantações > Editar > Nova versão > Implantar. Não crie outra chave nem outra pasta para esse módulo se a ideia é compartilhar a integração da transportadora.

## Implantação
O workflow `Deploy Portal Hotfix` executa `worker/migrations/super-admin/0007_troca_notas.sql` na base `portal-super-admin-tenants-staging`, roda validações do módulo e depois publica o Worker. O GitHub Pages disponibiliza os arquivos HTML/JS para os slugs `gnova`, `transvale`, `modelo01` e `modelo02`. Não habilite os módulos em produção antes de confirmar integração Drive e seleção de filiais pelo cliente real.
