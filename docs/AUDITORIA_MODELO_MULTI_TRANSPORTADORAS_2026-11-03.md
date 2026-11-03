# Portal Frete | Modelo Multi-Transportadoras | Revisão técnica de 03/11/2026

## Objetivo e regra principal
A GNOVA TRANSPORTES é a empresa-modelo do sistema (ID estável: `teste-01`, slug existente: `transportadora-teste`). O nome exibido vem da sessão assinada pelo Worker; não deve ser gravado em `assets` nem usado como identificador dos dados.

As empresas usam as MESMAS `/pages/*.html` e `/assets`, acessando URLs privadas em `/pages/<slug>/*.html`. O login/autorização e a integração `Apps Script + Sheets` são resolvidos no Cloudflare Worker pela sessão e pelos parâmetros privados no R2. Nunca adicionar URL do Apps Script, gateway key ou ID do Sheets em JavaScript público.

## Compartilhado x isolado

| Elemento | Escopo | Fonte e regras |
|---|---|---|
| HTML, JS, CSS, módulos e UI | Compartilhado | Arquivos centrais `pages/` e `assets/`; aliases são shells pequenos |
| Nome da transportadora na barra | Individual | `transportadoraNome` da sessão assinada |
| Logo da transportadora / imagem impressa | Individual | R2 `TENANT_BRANDS`, apenas composição visual de artes e posições; sem logo na barra |
| Clientes comerciais: **somente nomes**, ordem e ativo | Compartilhado e somente leitura nos novos tenants | `GET /v1/tenant/catalogo/clientes` agrega a planilha mestre Nova Frota pelo Worker e elimina campos extras; cache 120 segundos |
| Logos de CLIENTES | Compartilhado | R2 `CLIENT_LOGOS`; GET/HEAD permitidos, mas PUT/DELETE continuam restritos ao administrador mestre |
| Modelo gráfico de divulgação | Compartilhado | A mesma estrutura de HTML/CSS/arte-base, com logo individual por tenant |
| Fretes, embarques, filiais, regionais, contatos, usuários, preços, pagamentos | EXCLUSIVOS | Planilha da transportadora, gateway assinado e permissões do Worker |
| Segredos do Apps Script e IDs de planilha | EXCLUSIVOS | R2 privado, nunca retornados ao navegador |

**Importante:** o catálogo de nomes e logos não equivale a compartilhar contatos, CPFs/CNPJs, contratos, dados comerciais, fretes ou registros operacionais. Novas empresas NÃO recebem esses dados por cópia. Os clientes compartilhados são administrados na fonte central; a empresa-modelo os consulta.

## Layout padronizado
- Barra superior: nome autenticado, sem logos; navegação entre módulos permanece no mesmo slug.
- Home clara: nome azul-marinho; Home escura: branco; barra global azul-escuro: branco.
- Controle de Embarque e Ordem de Carregamento: CSS Tailwind **compilado e hospedado no próprio portal** para os tenants. O HTML original da Nova Frota continua intacto.
- Arte/posição: o upload da logo individual já utiliza Super Admin/R2; quando existir, substituir apenas as imagens de identidade visual na arte.

## Como criar a próxima transportadora
1. Super Admin: criar tenant com ID próprio, ativar os módulos e configurar os usuários/perfis.
2. Copiar a planilha **modelo limpa** para a empresa e implantar um Apps Script próprio; configurar as Script Properties desta empresa.
3. Vincular a URL, planilha ID e chave no Super Admin; testar integração somente leitura antes de ativar.
4. Executar `node scripts/criar-transportadora-modelo.mjs <slug> <tenant-id> --dry-run`, validar o resultado e repetir sem `--dry-run`.
5. Publicar os novos shells no GitHub Pages. Nunca copiar HTMLs inteiros ou segredos; o shell utiliza o código compartilhado.
6. Verificar login, Home, Fretes, Fretes MT, Controle, BI, Ordem, Divulgação e os módulos liberados com a planilha da empresa. Confirmar bloqueio de acesso cruzado e que nenhuma informação da Nova Frota surgiu.

## Achados do pente-fino e riscos restantes

### Prioridade alta (antes de colocar outros clientes em produção)
- **Integração real de ponta a ponta:** o smoke em Chromium usa sessão e API simuladas. Testar no login real as operações criar, listar, editar, excluir e exportar de cada módulo habilitado, sem tocar na planilha original da Nova Frota.
- **Catálogo mestre de clientes:** confirmar `/v1/tenant/catalogo/clientes` em produção com o Apps Script mestre. Se o cadastro central estiver indisponível, deve mostrar erro ou ficar vazio, nunca ressuscitar registros hardcoded.
- **Artes por transportadora:** no momento há upload de logo individual, mas **não há um formulário próprio de upload de fundo/modelo de arte por empresa**. Projetar os quatro slots de artes no Super Admin, com arquivos R2 por tenant, mantendo o HTML como estrutura compartilhada.
- **Automação de novas URLs:** o gerador de 23 páginas evita cópia de código, porém a criação automática via Super Admin/CI ainda não foi implementada. O processo atual exige executar o gerador e publicar.

### Prioridade média
- **Padronização dos 22 módulos:** apenas Home, Fretes, Controle e Ordem têm testes UI de carregamento/cabeçalho. Testar também BI, Cadastros, Divulgação, Share Clientes, Administrativo, Estadia, Patrimônio, Relatórios e módulos restantes.
- **Bibliotecas externas:** Chart.js, html2canvas, XLSX e Leaflet ainda dependem de CDN em partes do portal. Fixar versões locais ou oferecer fallback verificável para evitar telas vazias quando CDN falhar.
- **Caches e sessão:** confirmar expiração de cookie, logout, troca de perfil/módulo, limpeza de caches e mudanças de tenant com janelas simultâneas. Garantir que nenhum dado entre empresas compartilhe chave de cache.
- **Validação mobile e acessibilidade:** testar Safari iPhone e Android além de Chromium desktop; verificar foco de teclado, contraste e cabeçalhos responsivos.
- **Auditoria:** monitorar atividades administrativas e falhas do gateway sem imprimir segredos. Conferir o workflow de ranking no GitHub, que pode falhar independentemente das alterações multi-tenant.

## Critérios mínimos para homologar novo cliente
- Identidade individual consistente em Home e módulos; nenhuma logo anterior visível durante loading.
- Cliente mestre compartilhado aparece só com nome/logo; contatos, regionais e filiais vêm da planilha individual.
- Apps Script e Sheets da empresa retornam os registros previstos e bloqueiam operações fora do perfil.
- Operações de outra transportadora não aparecem no navegador, cache, exportação nem na tabela atual.
- Imagens de arte usam a identidade da empresa selecionada; nenhum link de logo privada fica exposto como chave ou ID de planilha.
- Cobertura dos módulos liberados e smoke de produção aprovado após o deploy do GitHub Pages/Worker.

**Nota:** este documento é a base de trabalho, não uma certificação de que todos os 22 módulos foram homologados com sessões e planilhas reais.
