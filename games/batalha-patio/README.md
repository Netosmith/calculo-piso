# Nova Frota Games - Batalha de Pátio

MVP de um jogo 2D de artilharia por turnos, inspirado no gênero de jogos como DDTank, mas com identidade própria.

## O que já existe

- 2 jogadores por sala
- Sala por código
- WebSocket
- Cloudflare Durable Objects
- Turnos
- Mira por ângulo
- Controle de força
- Vento
- Trajetória balística
- Dano por explosão
- Barra de vida
- Reinício automático após fim da partida
- Canvas puro, sem engine externa
- Layout responsivo

## Backend

Os arquivos do backend ficam em:

`workers/batalha-patio/`

Para publicar:

```bash
cd workers/batalha-patio
npx wrangler deploy
```

Depois copie o endereço do Worker, por exemplo:

```text
https://nova-frota-batalha-patio.seu-subdominio.workers.dev
```

No arquivo `games/batalha-patio/game.js`, altere:

```js
const WS_ENDPOINT = "wss://SEU-WORKER.workers.dev/ws";
```

para o endereço real do Worker, mantendo `wss://` e `/ws`.

## Frontend

O jogo fica em:

`games/batalha-patio/`

Com a publicação atual do repositório, a rota prevista é:

`https://portalfrete.net.br/games/batalha-patio/`

## Teste multiplayer

1. Abra o jogo em dois computadores ou duas abas.
2. No primeiro, informe o nome e clique em **Criar sala**.
3. Copie o código criado.
4. No segundo, informe outro nome e entre com o mesmo código.
5. O servidor sorteia o primeiro turno.

## Próximas evoluções

- Destruição real do terreno
- Diferentes armas
- Teleporte
- Tiro duplo
- Escudo
- Bola de fogo especial
- Movimento antes do disparo
- 2x2
- Avatares
- Ranking interno
- Integração com o login do Portal Fretes / Nova Frota Games
