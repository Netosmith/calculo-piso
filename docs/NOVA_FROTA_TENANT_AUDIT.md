# Auditoria inicial: identidade Nova Frota e isolamento multi-transportadora

Data: 2026-11-01. Base pesquisada: `main` do repositório `Netosmith/calculo-piso`.
**Este documento é um levantamento inicial por busca de código, não uma auditoria exaustiva de todas as linhas nem do Apps Script publicado.**

## Identidade proposta
- `transportadora_id`: `nova-frota` (identificador técnico estável; pode evoluir para UUID antes da migração).
- Nome de exibição: `Nova Frota Logística`.
- Dados legados sem `transportadora_id` pertencem à Nova Frota **somente após inventário, backup e migração verificada**; não criar fallback global que atribua qualquer dado desconhecido à Nova Frota.
- Cada nova empresa deve receber identificador interno próprio, independente de nome, CNPJ, filial ou estado.
- O login `LUZIANO` é o bootstrap do Super Admin; a autorização definitiva deverá vincular um ID imutável de usuário.

## Evidências de acoplamento à Nova Frota
1. **Identidade visual**: `logo-novafrota.png` aparece em pelo menos 21 páginas e scripts, incluindo `pages/home.html`, `pages/cadastros.html`, `pages/fretes.html`, `pages/fretes2.html`, `pages/bi.html`, `pages/divulgacao.html`, `pages/ordem.html`, `assets/js/auth.js` e `assets/js/divulgacao.js`.
2. **Nomes e marcas no HTML/JS**: títulos e textos `NOVA FROTA` em diversas páginas e nos módulos de IA, monitoramento e games. Distinguir textos de marca do nome de projetos próprios, sem renomear automaticamente pastas, apps Android ou APIs.
3. **Armazenamento no navegador**: prefixo `nf_auth_` em `assets/js/auth.js`, `assets/js/cadastros.js`, `assets/js/portal-preferences*.js` e outros. Evitar mistura de preferências e caches entre contas/empresas; não usar localStorage como fonte de autorização.
4. **Sessões**: `worker/src/controllers/session.js` não inclui `transportadora_id` no objeto assinado. Necessário vincular identidade e escopo da sessão no servidor.
5. **Cache KV**: `worker/src/controllers/portal-gateway.js` constrói chaves de fretes e métricas a partir de módulo/estado, sem tenant. O prefixo de regionais `cadastros:regional-base:v1:` também precisa de escopo por empresa.
6. **R2 logos de clientes**: `worker/src/controllers/client-logos.js` usa `clientes/<nome>`, sem tenant. Mesmo nome de cliente pode colidir entre transportadoras.
7. **Apps Script**: `worker/src/services/appscript.js` usa uma única `env.APPS_SCRIPT_URL`. Definir roteamento confiável por empresa e segregação das planilhas antes de ativar novos tenants.
8. **Frota**: inspecionar tabelas D1, documentos R2, cadastros de placas e motoristas, e APIs de monitoramento para incluir tenant no armazenamento e nas consultas.
9. **Projetos não diretamente relacionados**: `games/`, `android/nova-frota-rastreamento/`, `assets/pingochic/` e `worker/src/pingochic/` exigem inventário separado; não excluir nem renomear sem confirmar dependências.
10. **Apps Script histórico**: várias versões `apps-script-*.gs` coexistem. Confirmar qual implantação está ativa antes de migrar dados ou remover cópias.

## Plano de migração sem conflito
1. Inventariar todas as coleções (Sheets, D1, KV, R2, armazenamento local), origens e responsáveis.
2. Fazer backup verificável dos dados existentes da Nova Frota.
3. Criar registro de tenant da Nova Frota e mapear recursos existentes ao seu ID.
4. Introduzir `transportadora_id` no cadastro de usuários, sessão, políticas e rotas; super admin fica fora do escopo de empresa, com acesso auditado.
5. Aplicar filtros de tenant em **todas** as leituras, gravações, exclusões, caches e uploads. Negar acesso quando o escopo estiver ausente ou inválido.
6. Migrar chaves KV/R2 e registros D1 com compatibilidade temporária somente para Nova Frota; não fazer fallback genérico.
7. Centralizar configuração de nome/logo/arte e usar o tenant autenticado nas páginas e nos documentos impressos.
8. Testar isolamento entre duas empresas fictícias com mesmos nomes de filiais/clientes/placas e verificar bloqueio de acesso cruzado.
9. Somente então habilitar criação de novas transportadoras no painel Super Admin.

## Regra de segurança
A aparência de um card ou logo não garante isolamento. Toda ação deve validar `transportadora_id` e permissão no backend. Não reutilizar a mesma planilha ou cache global entre transportadoras sem segmentação rigorosa.

## Estado
Levantamento inicial documentado. **Nenhum dado, cache, logo ou registro da Nova Frota foi migrado ou alterado nesta etapa.**
