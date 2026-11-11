# Painel de Solicitações de Cadastro | implantação

O novo módulo **não substitui** o cadastro de clientes/usuários `cadastros.html` nem os chamados de suporte `chamados.html`.

## Estrutura implementada

- Portal compartilhado: `pages/cadastro-solicitacoes.html`; CSS e JavaScript em `assets/`.
- Links de empresas: `pages/gnova/`, `pages/transvale/`, `pages/modelo01/`, `pages/modelo02/`.
- API: `/v1/cadastro-solicitacoes`, autenticada por sessão no Worker.
- Banco: **D1 TENANTS_DB** para protocolos, dados, mensagens, histórico e metadados. Todas as consultas filtram `tenant_id`. Os arquivos binários são exclusivos da pasta privada no **Google Drive de cada transportadora**.
- Configuração privada: objeto R2 `tenant/<id>/private/cadastro-drive-v1.json`, visível em resumo no **Super Admin > Transportadora > Configurações**.
- Perfil de solicitação: qualquer perfil autenticado, inclusive PISO, acessa somente seus protocolos.
- Perfil de execução: ADMINISTRADOR, GOADM ou usuários da lista privada de executores configurada para aquela empresa. Pode acompanhar os chamados, assumir um da fila, mudar situação e etapa, conversar e acessar anexos.
- Cadastro efetivo permanece fora do Portal Frete; o Portal não faz alterações no sistema de terceiros.

## 1. Banco Cloudflare D1

Antes de executar, confirme o projeto Cloudflare correto, backup e ambiente. O banco configurado em `worker/wrangler.jsonc` é `portal-super-admin-tenants-staging` no binding `TENANTS_DB`.

No terminal, na pasta `worker`, com Wrangler autenticado:

```bash
npx wrangler d1 export portal-super-admin-tenants-staging --remote --output=backup-tickets-antes.sql
npx wrangler d1 execute portal-super-admin-tenants-staging --remote --file=migrations/super-admin/0003_cadastro_solicitacoes.sql
```

As tabelas são criadas com `IF NOT EXISTS`. Não execute o SQL em `FLEET_DB`; os cadastros usam somente `TENANTS_DB`. O comando deve ser executado **uma vez por ambiente**. Faça os testes antes de aceitar documentos pessoais reais.

## 2. Configurar o Google Drive de CADA transportadora

1. Na conta Google própria da empresa, crie uma **pasta privada** para o recebimento de documentos. Evite compartilhamento público. Copie o ID dessa pasta da URL.
2. Crie um projeto exclusivo em <https://script.google.com/> para esta empresa. Cole o conteúdo de `docs/CADASTRO_DRIVE_APPS_SCRIPT.gs`.
3. Em **Configurações do projeto > Propriedades do script**, configure:
    - `CADASTRO_TENANT_ID`: identificador real da empresa no Portal. Atenção: o nome da pasta URL não é necessariamente o ID. Exemplos do sistema atual: `nova-frota`, `teste-01` (GNOVA), `transvale-01`.
    - `CADASTRO_DRIVE_FOLDER_ID`: ID da pasta Drive da empresa.
    - `CADASTRO_GATEWAY_KEY`: senha aleatória EXCLUSIVA, com ao menos 24 caracteres. Armazene fora do GitHub.
4. Faça implantação **Aplicativo da Web**, executando como o proprietário da pasta. O acesso remoto à implantação é protegido pela chave compartilhada, validada no Apps Script. Configure a visibilidade mínima que permita ao Worker invocar a implantação e **não publique a pasta ou arquivos**. Recomenda-se revisar com a equipe de TI a política de acesso e retenção por conter dados pessoais.
5. Copie a URL `https://script.google.com/macros/s/.../exec`.
6. Em `https://portalfrete.net.br/pages/super-admin.html`, escolha a empresa > **Configurações > Google Drive: Solicitações de Cadastro** e preencha URL, pasta, chave e logins dos executores adicionais. Clique **Salvar**.
7. Faça o processo **separadamente para cada transportadora**. Uma chave, uma pasta e uma implantação não devem ser reaproveitadas por outra.

> A chave do Drive **não** é a API key pública do Google. Arquivos privados exigem autorização. A integração usa um Apps Script que tem permissão da conta da transportadora; o Worker chama o Apps Script usando segredo guardado no R2. Os HTMLs não recebem esse segredo.

## 3. Publicar o Worker

Depois da migração, a partir de `worker`:

```bash
npm install
npm test
npx wrangler deploy
```

Confirme que os bindings `TENANTS_DB` e `TENANT_BRANDS` no Worker publicado apontam para os recursos desejados, que as variáveis de sessão e Super Admin estão configuradas e que a hospedagem estática do GitHub Pages publicou o commit.

**Importante:** gravar arquivos no GitHub **não implanta automaticamente** o Worker da Cloudflare nem aplica SQL ao D1. Sem esses passos o painel poderá aparecer no menu mas a API responderá com erro ou "Banco não provisionado".

## 4. Testes de homologação

1. Logue em uma empresa com um usuário OPERACIONAL. Confira que vê somente as próprias solicitações.
2. Abra nova solicitação, informe dados e referências e envie todos os 8 grupos de anexos (permita múltiplos arquivos no grupo carretas). O protocolo surge como FILA.
3. Logue com executor da MESMA empresa. Assuma a solicitação e confira ANDAMENTO. Avance pelas etapas.
4. Marque PENDENTE, registre motivo. No login do solicitante, abra o chat e envie a documentação complementar. Depois o executor pode continuar e marcar APROVADO ou REPROVADO.
5. Repita com usuário de outra empresa: não deve ver documentos, mensagens nem protocolos da primeira.
6. Teste acesso com PISO: apenas seus chamados e o módulo já permitido Piso 2, sem vazamento da Home operacional.
7. No Drive, confirme arquivo privado criado dentro da pasta específica da transportadora e sem compartilhamento público.

## Privacidade e retenção

CNH, fotos, telefone, endereço e referências são dados pessoais. Defina política de retenção e exclusão antes de operação real, informe a finalidade ao motorista, garanta acesso somente aos envolvidos e faça cópias/backup conforme a política da empresa e a LGPD. O código atual **não contém rotina automática de descarte**.

## Checklist de execução

A migração `0004_cadastro_checklist.sql` adiciona nove verificações por chamado e transportadora. Só o executor responsável pode marcar uma como **PENDENTE**, **REVISAR** ou **OK**. As alterações são auditadas no histórico. Para aprovar, todas as nove verificações devem estar OK. O workflow faz a migração antes do deploy.

## Protocolo curto por transportadora

A migração `0005_cadastro_numero_curto.sql` atribui números sequenciais por transportadora, a partir de `00001`. Os cadastros anteriores recebem números na ordem de criação. O novo número é gerado dentro do banco (trigger atômico). O protocolo interno antigo, o UUID, o histórico e os documentos permanecem intactos. Não reinicie o contador apagando dados.

## Produto no cartão compacto de cadastro

O produto é informado na abertura da solicitação e armazenado exclusivamente no banco D1 da transportadora. Para cadastros anteriores à migração `0006_cadastro_produto.sql`, o campo permanece vazio, sem atribuição fictícia. O executor responsável pode corrigir o produto pelo detalhamento e a ação fica registrada no histórico. A migração é aplicada antes da publicação do Worker.
