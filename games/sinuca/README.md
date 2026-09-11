# Sinuca Nova Frota

Jogo Canvas 2D sem dependências externas. Abra `/games/sinuca/` depois de entrar no Portal como ADMINISTRADOR, selecionar o estado e desbloquear o Nova Frota Games. O card da HOME permanece oculto.

- Treino livre: mirar com o mouse, fixar a direção com o clique esquerdo, diminuir/aumentar a força com A/D e disparar com ESPAÇO. Outro clique solta a mira. A mira também é liberada após cada tacada. O controle de força e o botão continuam disponíveis. Clique na mesa para recolocar a branca após ela cair. Recomeçar treino monta a mesa novamente.
- Online: crie uma sala e compartilhe o convite com outro administrador autorizado. São dois lugares por sala e a partida começa quando o colega entra. A sala dura duas horas. Reabrir o convite com a mesma conta recupera seu lugar. Não é possível jogar enquanto o adversário está desconectado; ele pode retornar pelo convite.
- Bola 8 simplificada: primeira bola encaçapada sem falta define o grupo; acertar primeiro seu grupo e encaçapá-lo mantém a vez. Depois de limpar o grupo, jogue a 8. Bola 8 antecipada ou com falta perde, inclusive na saída. Não exige caçapa anunciada. Sem contato, contato inicial errado, branca encaçapada ou ausência de caçapa/tabela após contato são faltas com bola na mão para o adversário.

## Publicação

O frontend continua estático, compatível com GitHub Pages. O Worker existente exporta `SinucaRoom`, com binding `SINUCA_ROOMS` e migração `sinuca-v1`. O workflow existente publica a migração no push; não é necessário um novo segredo para sinuca. Ele depende dos secrets Cloudflare e senha dos Games já usados no portal.

O servidor autentica sessão, perfil e desbloqueio a cada requisição. Cada Durable Object serializa os comandos, limita a dois usuários e valida vez e revisão. Simula toda a tacada em passos de 1/120 segundo e envia a animação a 30 quadros/segundo. O cliente consulta a sala a cada dois segundos e reproduz os quadros do servidor; não envia posições de bolas. Estado e tacada ficam no armazenamento durável até expirar a sala. Há espera até o fim da animação antes de aceitar outra tacada. A física usa atrito, colisões e caçapas circulares; não inclui efeito, salto ou sinuca profissional.

Validação: `node --test games/tests/*.test.js` na raiz. Testes cobrem física determinística, parada, caçapas, faltas, vitória, identidade, lotação e recuperação de estado. O teste com duas pessoas reais exige o Worker publicado e duas sessões autorizadas.
