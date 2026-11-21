# Barra de títulos: navegação automática do Portal Frete

## Diagnóstico (21/11/2026)

A Home possuía cards por `data-feature`, enquanto `assets/js/auth.js`
usava uma lista independente de links e `assets/js/tenant-route.js`
aceitava apenas uma lista estática de destinos. O item **Leitura de
Documentos** estava cadastrado na barra, mas seu arquivo não constava no
roteador das transportadoras. Isso gerava links diferentes dependendo da
página e da transportadora.

## Fonte de autorização

- Para transportadoras, a sessão **assinada** contém `session.modules`,
  calculado no Worker com transportadora, ativação do módulo e perfil.
- Na Nova Frota, `GET /v1/nova-frota/modules` fornece os módulos efetivos
  autorizados pelo Worker para aquele usuário.
- A navegação usa essas chaves. Nenhum item novo é disponibilizado por
  simples presença de um HTML. O acesso real continua validado no backend.
- As centrais de Cadastro, Notas e Pedidos mantêm a confirmação operacional
  adicional, de forma independente.
- O Super Admin aparece na barra **somente após confirmação autenticada**.
- A Home permanece sem barra de módulos por decisão de layout.

## Ao criar um módulo novo

1. Criar `pages/<chave>.html` e carregar
   `../assets/js/auth.js` (além das proteções específicas da página).
2. Registrar a chave na configuração correspondente do Worker:
   `worker/src/config/tenant-modules.js` para transportadoras;
   `worker/src/services/nova-frota-modules.js` para a Nova Frota.
   Se o módulo for para ambas, registrar nos dois. Usar chave
   `minuscula-com-hifens` e arquivo `<chave>.html`.
3. Incluir o card na Home com `data-feature="<chave>"` e o link
   `./<chave>.html`. Manter as liberações e perfis no Super Admin.
4. Fazer push no GitHub. `.github/workflows/sync-portal-navigation.yml`
   audita as páginas e cria automaticamente os pequenos arquivos de entrada
   para as transportadoras existentes, inclusive o modelo reutilizável.
5. A barra lê o módulo da sessão e o acrescenta automaticamente ao menu
   **Todos os módulos**, caso ainda não tenha um atalho legado personalizado.

**Não é mais necessário editar `PORTAL_NAV_ITEMS` manualmente para
cada módulo canônico novo.** Só é necessário alterar o mapa de aliases se o
arquivo não usar o nome `<chave>.html`, como `piso2` → `calculo-antt.html`.

## Auditoria automática

Executar no repositório:

```bash
node --check assets/js/auth.js
node --check assets/js/tenant-page.js
node --check assets/js/tenant-route.js
node .github/scripts/sync-portal-navigation.mjs
node .github/scripts/sync-portal-navigation.mjs --check
```

O auditor impede cards sem chave no Worker ou módulos registrados sem
página compartilhada com autenticação. Ao executar sem `--check`, gera
somente os atalhos ainda ausentes, sem sobrescrever páginas existentes.

Páginas autônomas não registradas como módulos, como a página pública do
motorista e a integração local de checklist, continuam fora da barra.

## Diagnóstico de um item não exibido

Conferir, nesta ordem: (1) sessão e transportadora corretas, (2) chave
ativa no Super Admin, (3) módulo liberado ao perfil, (4) confirmação
específica da central, quando aplicável, (5) arquivo HTML e sua rota.
Em telas estreitas ou com muitos itens, abrir **Todos os módulos**: a
gaveta exibe todos os acessos efetivamente liberados.

A navegação não substitui, em nenhum caso, a autorização de cada API.
