# Nova Frota Games — Portal Frete

Jogo em `games/`, com treino, mapa ampliado, supervelocidade, papel duplo e bola de fogo. HOME possui card exclusivo ADMINISTRADOR. A página verifica a sessão real do Portal e exige uma segunda senha antes de iniciar. Salas e WebSocket também exigem sessão válida ADMINISTRADOR e liberação da senha no servidor. Os arquivos frontend e o repositório continuam públicos; a autorização protege a entrada pelo Portal e o multiplayer, não impede cópia do código público.

## Multiplayer

Cada sala usa um Durable Object `GamesRoom` com até seis jogadores. O criador escolhe 1x1, 2x2 ou 3x3. Os participantes entram pelo convite/código, marcam Pronto, e o criador inicia com equipes completas. Sem bots no modo online. O servidor simula a 30 Hz e envia o mesmo estado aos participantes. O navegador envia comandos, nunca vida/posição/placar. Há limites de mensagens, ações de uso único e expiração de comandos para evitar personagem andando sozinho após perda de conexão.

Desconexão cancela a partida em andamento e retorna os outros à sala. É possível entrar novamente pelo código e começar outra partida. Revanche retorna à mesma sala. Sessão é revalidada a cada 30 segundos. Reinício do processo durante uma partida pode retornar a sala ao lobby; partida em curso não é persistida. Salas vazias expiram após 15 minutos; validade máxima de quatro horas. Não há recuperação automática de uma partida interrompida nem compensação avançada de latência nesta primeira implementação.

## Publicação

Frontend: publicação existente do Portal, com `/games/` e HOME no repositório. Backend: `worker/`, classe exportada no entrypoint e binding `GAMES_ROOMS` com migração `games-v1` já configurados em `worker/wrangler.jsonc`. O segredo `GAMES_ACCESS_PASSWORD` guarda a senha somente na Cloudflare; nunca coloque a senha diretamente no HTML ou JavaScript público.

O workflow **Deploy Games Worker** publica ao alterar games/worker na main. Ele precisa de `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` e `GAMES_ACCESS_PASSWORD` em GitHub → Settings → Secrets and variables → Actions. Também é possível publicar com a integração Git da Cloudflare: diretório raiz `worker`, comando `npx wrangler deploy`; nesse caso, configure `GAMES_ACCESS_PASSWORD` como Worker secret no painel da Cloudflare. Preserve os secrets APPS_SCRIPT_URL/PORTAL_KEY e o KV já existentes. Não apague a migração games-v1 após publicar.

Depois da publicação, abra `https://portalfrete.net.br/pages/home.html` com ADMINISTRADOR, entre em Nova Frota Games e crie uma sala. Abra o convite em outro computador usando OUTRO usuário ADMINISTRADOR; uma mesma conta ocupa uma única vaga. Ambos marcam Pronto e o dono inicia. Valide o teste com duas conexões reais antes de ampliar o uso. Perfis COMERCIAL/OPERACIONAL/PISO devem receber 403 mesmo acessando a API diretamente.

## Testes

`node --test games/tests/*.test.js` verifica autorização, isolamento das entradas, troca de estados entre dois clientes simulados, bloqueio de início por não-dono e cancelamento por desconexão. Isso não substitui o teste ponta a ponta em Cloudflare com dois navegadores.
