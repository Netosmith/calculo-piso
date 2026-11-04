# Portal Frete | Procedimento para novas transportadoras (MODELO-01)

> Padrão vigente em 04/11/2026. A GNOVA é a primeira transportadora oficial; seu código interno continua **`teste-01`**.

## 1. Organização

| Local | Função |
| --- | --- |
| `pages/gnova/` | 50 entradas oficiais da GNOVA, inclusive a rota antiga e inativa `fretes2.html` |
| `pages/modelo01/` | 49 entradas genéricas, sem acesso real ou dados de nenhuma empresa |
| `pages/<slug>/` | Novo endereço público gerado para cada empresa |
| `pages/transportadora-teste/` | Redirecionamentos dos antigos endereços da GNOVA para `pages/gnova/` |
| `assets/` e `pages/*.html` | Código de interface compartilhado entre todas as transportadoras |
| Cloudflare D1 / R2 | Cadastro, sessões, permissões, identidade visual e configurações privadas |
| Google Sheets + Apps Script | Base operacional individual por transportadora, vinculada pelo Super Admin |

**ATENÇÃO:** slug da URL e ID interno são coisas diferentes. Alterar o slug **não** exige alterar o tenant no D1. Nunca renomeie o `teste-01` da GNOVA apenas para mudar a URL.

## 2. Modelo de planilha

Use o Google Sheets **MODELO-01 | PORTAL FRETE | BASE LIMPA**:

https://docs.google.com/spreadsheets/d/1dLfLSclNU60YWQ-PvIRJY2dnVYDLnT83V9GKoinbgEo/edit

A planilha foi copiada de `TRANSPORTADORA-TESTE` e teve **os conteúdos das linhas 2 em diante removidos em todas as 30 abas**. Foram preservados cabeçalhos, estrutura, fórmulas e formatação fora das linhas de dados. Não deve conter usuários, senhas ou fretes da GNOVA.

Para uma nova empresa, use **Arquivo > Fazer uma cópia** do MODELO-01 e renomeie a cópia para o nome da nova transportadora. Cada empresa terá seu próprio ID de planilha. Não substitua nem reaproveite o ID da GNOVA.

## 3. Apps Script privado

Abra a **cópia da planilha da nova empresa** e verifique em **Extensões > Apps Script** se o projeto vinculado foi copiado e se executa a versão atual da API operacional. Uma cópia da planilha **não deve ser considerada um novo deployment válido** antes dessa conferência.

Se o projeto não estiver presente, copie manualmente o código funcional do Apps Script de referência para um projeto **vinculado somente à planilha da nova transportadora**. Configure as propriedades e o token individual fora do GitHub. Implante como **aplicativo da Web** com as permissões necessárias ao Worker. Guarde a URL de execução no Super Admin, nunca no HTML estático.

**Esta etapa não foi automatizada neste repositório:** não há autorização para copiar projetos Apps Script/deployments diretamente pela API disponível. Não anuncie a integração como ativa sem testar leitura e gravação no Worker.

## 4. Cadastrar a empresa no Super Admin

1. Acesse `https://portalfrete.net.br/pages/super-admin.html` com o login global LUZIANO.
2. Crie a nova transportadora com **nome empresarial** e **ID interno único**, por exemplo `empresa-02`, inicialmente inativa.
3. Habilite apenas os módulos autorizados (Fretes Operacional unificado, bases Fretes-GO/SP/MT, BI, Divulgação, Cadastros, etc.). `fretes2.html` permanece exclusivo da Nova Frota.
4. Informe a nova **URL de Apps Script**, **ID da planilha** e **chave privada de integração**; por base UF, vincule sua própria origem quando necessário. Os dados permanecem no R2 privado.
5. Defina a identidade individual: Logo 1 (escura), Logo 2 (clara), Hero das Artes e Hero da Home.
6. Crie a conta inicial **ADMINISTRADOR** no D1 com senha própria. A partir desse acesso, a transportadora pode cadastrar usuários em **Cadastros > Usuários**.
7. Ative a empresa após validar que cada módulo tem integração própria.

O usuário global **LUZIANO** acessa como suporte usando sua sessão da Nova Frota; ele não deve aparecer no cadastro D1 de usuários da empresa.

## 5. Gerar as páginas pelo MODELO-01

No repositório `Netosmith/calculo-piso`, execute:

```bash
node scripts/criar-transportadora-modelo.mjs empresa-exemplo empresa-02 --dry-run
node scripts/criar-transportadora-modelo.mjs empresa-exemplo empresa-02
```

O gerador lê **`pages/modelo01/`**, substitui `__TENANT_ID__` pelo ID da empresa e cria `pages/empresa-exemplo/` com 49 páginas, sem tocar na GNOVA.

- URL de login: `https://portalfrete.net.br/pages/empresa-exemplo/login.html`.
- URL da Home: `https://portalfrete.net.br/pages/empresa-exemplo/home.html`.
- As páginas são atalhos para o código compartilhado, **não cópias da planilha, credenciais ou backend**.
- `pages/modelo01/` é um **modelo inativo**, que contém um ID-placeholder e não deve ser distribuído como link de cliente.
- O gerador recusa sobrepor pastas existentes e IDs ou slugs reservados (`gnova`, `modelo01`, `nova-frota`, `teste-01`, `transportadora-teste`).

Faça commit da nova pasta e aguarde publicação do GitHub Pages.

## 6. Testar antes de liberar o cliente

- Login e Home da empresa: nome, logotipo, métricas e mapa sem dados de outras empresas.
- `fretes.html`: inclusão, alteração, exclusão e integração com **a planilha da empresa**.
- Bases habilitadas: cada `fretes-UF.html` contabiliza somente sua própria fonte, sem cair automaticamente na base geral.
- `cadastros.html`: administrador cria e testa login de usuário D1.
- `divulgacao.html`: logo e Hero das Artes individuais; verifique modelos 3 e 4A a 4C.
- Home: Hero da Home, Logo 2 e permissões corretas.
- Perfil PISO: somente `calculo-antt` quando habilitado, sem dados operacionais, solicitações ou cards.
- Login LUZIANO: acesso de suporte à empresa sem criar usuário local.
- Isolamento: outro tenant não vê usuários, fretes, imagens nem integrações desta empresa.
- Execute `node --test worker/tests/*.test.mjs` e os testes GitHub Actions.
- Não entregue a senha ou chave privada por chat nem registre dados operacionais no repositório público.

## 7. Migração GNOVA e compatibilidade

**Novo endereço oficial:** `https://portalfrete.net.br/pages/gnova/login.html`.

O endereço antigo `/pages/transportadora-teste/<pagina>.html` continua funcionando como **redirecionamento permanente de navegação** para `/pages/gnova/<pagina>.html`, preservando os parâmetros e o fragmento da URL.

A GNOVA continua usando ID interno **`teste-01`**, suas integrações privadas, sessões, usuários, dados e identidade visual. Nenhum dado do Google Sheets ou do Apps Script foi renomeado na migração de endereço.

## 8. Checklist de entrega

- [ ] Copiar **MODELO-01** do Google Sheets, renomear a cópia e conferir cabeçalhos e ausência de dados da GNOVA.
- [ ] Preparar/duplicar o Apps Script correto, fazer novo deployment e testar a URL e chave privadamente.
- [ ] Criar empresa no Super Admin com ID único.
- [ ] Configurar módulos, bases, identidade visual e integração.
- [ ] Gerar páginas com o comando do item 5.
- [ ] Publicar e validar URLs.
- [ ] Criar conta inicial ADMINISTRADOR e testar acesso real.
- [ ] Confirmar isolamento com outro tenant e perfil PISO.
- [ ] Entregar apenas o link de login da nova empresa.
