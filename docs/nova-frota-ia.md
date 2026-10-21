# NOVA FROTA IA | Implantação segura

A interface está instalada na Home (cabeçalho, ao lado do Suporte) e em 16 páginas internas (botão flutuante). O chat abre painel lateral de até 440 px e mantém o histórico **somente na sessão da aba do navegador**, separado por usuário.

## Arquivos
- `assets/css/nova-frota-ia.css`: tema responsivo.
- `assets/js/nova-frota-ia.js`: interface de chat.
- `worker/src/controllers/ia.js`: autenticação, modelo, limite de perguntas e busca de fretes.
- `worker/src/router.js`: `GET /v1/ia/status` e `POST /v1/ia/chat`.
- `worker/src/controllers/portal-gateway.js`: exporta consulta sanitizada do mapa de fretes.

## Ativar o modelo
1. Crie uma API key no painel de desenvolvedores da OpenAI e configure limites de cobrança para o projeto.
2. No **Cloudflare Dashboard > Workers & Pages > portalfrete-api > Configurações > Variáveis e segredos**, escolha **Adicionar variável**, tipo **Segredo**, nome `OPENAI_API_KEY` e informe o valor por lá.
3. Salve/implante a configuração no ambiente de **Produção** (e na prévia apenas se realmente for usar lá).
4. Confira a implantação automática a partir da branch `main` do repositório.
5. Faça login no Portal, abra a NOVA FROTA IA na Home e pergunte: **"Como cadastrar e divulgar um frete?"**.
6. Como ADMINISTRADOR, COMERCIAL ou OPERACIONAL, teste uma busca: **"Mostre fretes liberados de Mato Grosso para Minas Gerais"**. Para PISO, a busca de fretes deve ser bloqueada.

Nunca coloque a chave no HTML, no repositório, em `wrangler.jsonc` nem em capturas enviadas ao chat.

## Checagens
- `GET https://api.portalfrete.net.br/v1/ia/status`: retorna `configured: true` após criar o segredo (exige sessão válida).
- `POST /v1/ia/chat`: aceita `{ "messages": [ { "role": "user", "content": "..." } ] }` com cookies da sessão.
- Se a chave não existir, retorna erro 503 informativo. Não utiliza qualquer token de autenticação no frontend.
- Em falha de consulta a fretes, o assistente deve comunicar a indisponibilidade, não inventar cargas.
- O fluxo usa OpenAI Responses API com `store:false`; os dados consultados e mensagens ainda são enviados ao provedor para gerar respostas, então evite dados pessoais sensíveis.

## Limites e segurança
- Modelo `gpt-6-luna`.
- 40 solicitações por usuário/dia (controle inicial via KV, suficiente para uso controlado, não rate limit transacional de alta concorrência).
- Consulta a fretes usa a versão sanitizada **somente de leitura** já usada no mapa da Home. Não envia telefone, nome do contato ou documentos do motorista ao modelo.
- PISO não recebe ferramenta de fretes e não pode consultar o mapa por meio da IA.
- O assistente não pode criar, alterar, publicar ou excluir registros.
- Respostas são exibidas com `textContent` (sem executar HTML retornado pelo modelo).
- Histórico do chat fica em `sessionStorage`, limitado e separado por usuário, e é limpo ao clicar em Sair.

## Evolução
Após validar em produção, adicionar filtros mais ricos por UF, filial e produto, documentos oficiais do Portal como fonte de respostas, telemetria de erros e rate limiter transacional caso o volume cresça.
