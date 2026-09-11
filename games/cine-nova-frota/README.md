# Cine Nova Frota

Player HLS com busca, categorias, favoritos locais, controles de volume e tela cheia. A central está em `/games/`; Guerra de Escritório permanece em `/games/guerra-de-escritorio.html`. A HOME do Portal continua sem o card de Games.

## Ativação

Em GitHub → Settings → Secrets and variables → Actions, adicione:

- `CINE_PLAYLIST_URL`: URL HTTPS completa da playlist M3U com canais HLS (`.m3u8`). Preserve os parâmetros de autenticação somente neste secret.
- `CINE_TOKEN_KEY`: segredo aleatório de pelo menos 32 caracteres. Gere, por exemplo, com `openssl rand -hex 32` e salve como secret; não faça commit.
- `CINE_ALLOWED_ORIGINS`: opcional, origens HTTPS adicionais fornecidas pelo provedor, separadas por vírgula. Exemplo fictício: `https://cdn.example.com`. Sem curingas. O domínio da playlist já está permitido.

Execute o workflow **Deploy Games Worker**. Ele mantém a configuração existente do Portal e adiciona os secrets do Cine quando disponíveis. Alternativamente, cadastre os secrets diretamente no Worker `portalfrete-api` e publique o código atualizado. Os secrets GAMES_ACCESS_PASSWORD, CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID continuam necessários para o workflow.

O arquivo Webarchive recebido contém um link autenticado HTTP com saída MPEG-TS, não o conteúdo de uma playlist. Nenhuma credencial desse anexo foi incorporada ao código. Solicite ao provedor uma URL HTTPS com saída HLS; não basta trocar a extensão dos canais. O catálogo mostra somente entradas HTTPS com caminho `.m3u8`. MPEG-TS contínuo, DRM e conversão/transcodificação não fazem parte desta versão.

## Proteção e operação

Todas as rotas de catálogo e mídia passam pelo mesmo controle de sessão ADMINISTRADOR + senha do Games. O servidor entrega apenas nomes, categorias e IDs opacos no catálogo. As URLs de reprodução e suas credenciais ficam em tickets AES-GCM autenticados, vinculados à sessão e com validade máxima de quatro horas. Playlists HLS, variantes, chaves e segmentos são servidos pelo Worker; URLs de origem e cabeçalhos de autenticação não são enviados em claro ao cliente. O navegador continua recebendo a mídia para reprodução, portanto isto não é DRM.

Redirecionamentos só podem alcançar origens HTTPS explicitamente autorizadas. Nenhuma URL arbitrária enviada pelo navegador é aceita. O catálogo fica em memória por cinco minutos, com limite de 15 MB e 20 mil entradas. Playlists de mídia têm limite de 2 MB. Os favoritos guardam apenas IDs neste navegador. Não há gravação, downloads ou compartilhamento de credenciais.

O Worker transfere o tráfego de vídeo; valide capacidade, plano e condições de uso da Cloudflare e do provedor antes de ampliar o acesso. CDN adicional precisa constar na allowlist. Para AES-128, o servidor deve fornecer as chaves como application/octet-stream. Fluxos com metadados HLS não suportados falham fechados.

## Validação

`node --test games/tests/*.test.js`

Após configurar os secrets e publicar: acessar com administrador, informar a senha, abrir Cine, buscar canal, reproduzir, alternar, parar, favoritar, testar tela cheia e expiração de sessão. Confirmar com um canal real do provedor. A integração real não foi validada sem URL HTTPS/HLS e configuração de produção.

HLS.js 1.7.2 distribuído localmente em vendor/ sob licença Apache-2.0 (LICENSE-hls.txt). O player é carregado apenas na tela Cine.

## Dez acessos independentes

A tela do Cine apresenta Acesso 01 até Acesso 10. Cada um deve ter uma **assinatura/lista independente**, com uma conexão disponível. Não use a mesma assinatura com URLs diferentes para multiplicar acessos; isso não aumenta o limite do provedor.

Cadastre as URLs como secrets de GitHub Actions `CINE_PLAYLIST_01`, `CINE_PLAYLIST_02`, …, `CINE_PLAYLIST_10`. Cada valor é a URL HTTPS completa da lista HLS/M3U; nunca faça commit desses valores. Você pode preencher aos poucos. O secret anterior `CINE_PLAYLIST_URL` funciona como alternativa apenas para Acesso 01. `CINE_TOKEN_KEY` continua obrigatório. Origens de CDNs adicionais podem ser configuradas com `CINE_ALLOWED_ORIGINS` ou, diretamente no Worker, `CINE_ALLOWED_ORIGINS_01` até `CINE_ALLOWED_ORIGINS_10`.

Execute **Deploy Games Worker** após cadastrar os secrets. O workflow publica o binding `CINE_ACCESS` e a migração `cine-access-v1`, preservando a migração de Games. Não exclua migrações anteriores. Apenas secrets preenchidos são enviados; remover um valor do GitHub não apaga o secret existente da Cloudflare. Para desativar uma lista já instalada, remova o secret correspondente no Worker.

Estados: **Livre**, **Em uso**, **Em configuração**. Cards sem URL HTTPS ou sem chave de tickets não permitem entrada. Isso verifica a configuração básica, não comprova que a conta está ativa no provedor. URLs idênticas configuradas em cards diferentes só habilitam o primeiro.

O Durable Object mantém as dez reservas de forma atômica e persistente. Apenas um usuário pode ocupar cada card, e cada conta do Portal só pode reservar um card por vez. A reserva pertence à sessão e a um identificador aleatório; outra aba não recebe a reserva existente. A interface renova a reserva a cada 15 segundos e os pedidos de mídia também a renovam. Sem atividade, a reserva expira em 90 segundos. Sair libera imediatamente quando o pedido chega ao servidor; ao fechar uma aba, a liberação é tentada com keepalive e a expiração cobre falhas. Ao retornar de uma página em cache, a tela consulta novamente as reservas.

Cada pedido de catálogo, playlist, chave e segmento verifica a reserva. Trocar de canal invalida os tickets do canal anterior. Ao sair ou expirar, tickets antigos deixam de obter novos dados. Trechos já carregados e pedidos em andamento podem terminar; isto não é DRM. A proteção coordena os acessos **dentro do Cine** e não bloqueia o uso da mesma assinatura em aplicativos externos. Evite utilizar as dez contas em outros aparelhos simultaneamente.

Sem as dez listas configuradas e o backend publicado, não há dez acessos de reprodução ativos. A HOME do Portal continua sem o card de Games.
