const GAME_WIDTH = 1000;
const GAME_HEIGHT = 560;

function terrainY(x) {
  return 420 + 42 * Math.sin(x / 125) + 22 * Math.sin(x / 58);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function newWind() {
  return Math.round((Math.random() * 80 - 40) * 10) / 10;
}

function uuid() {
  return crypto.randomUUID().slice(0, 8);
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "nova-frota-batalha-patio" });
    }

    if (url.pathname !== "/ws") {
      return new Response("Nova Frota Games - Batalha de Pátio", { status: 200 });
    }

    const room = (url.searchParams.get("room") || "").trim().toUpperCase().slice(0, 12);
    if (!room) return new Response("Sala obrigatória.", { status: 400 });

    const id = env.GAME_ROOMS.idFromName(room);
    const stub = env.GAME_ROOMS.get(id);
    return stub.fetch(request);
  }
};

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Map();
    this.game = {
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      wind: newWind(),
      turn: null,
      players: []
    };
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket only", { status: 426 });
    }

    if (this.game.players.length >= 2) {
      return new Response("Sala cheia.", { status: 409 });
    }

    const url = new URL(request.url);
    const name = (url.searchParams.get("name") || "Jogador").trim().slice(0, 18);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const id = uuid();
    const index = this.game.players.length;
    const player = {
      id,
      name,
      x: index === 0 ? 150 : 850,
      hp: 100,
      angle: 45,
      power: 65
    };

    this.game.players.push(player);
    this.clients.set(id, server);

    server.send(JSON.stringify({ type: "hello", id }));
    this.broadcast({ type: "toast", message: `${name} entrou na sala.` });

    if (this.game.players.length === 2 && !this.game.turn) {
      this.game.turn = this.game.players[Math.floor(Math.random() * 2)].id;
      this.game.wind = newWind();
    }

    this.broadcastState();

    server.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.onMessage(id, msg);
      } catch {
        server.send(JSON.stringify({ type: "toast", message: "Mensagem inválida." }));
      }
    });

    const cleanup = () => this.removePlayer(id);
    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }

  onMessage(id, msg) {
    const player = this.game.players.find(p => p.id === id);
    if (!player) return;

    if (msg.type === "aim") {
      if (this.game.turn !== id) return;
      player.angle = clamp(Number(msg.angle) || 45, 10, 80);
      player.power = clamp(Number(msg.power) || 65, 20, 100);
      this.broadcastState();
      return;
    }

    if (msg.type === "shoot") {
      if (this.game.players.length < 2) return;
      if (this.game.turn !== id) return;
      if (player.hp <= 0) return;

      player.angle = clamp(Number(msg.angle) || player.angle, 10, 80);
      player.power = clamp(Number(msg.power) || player.power, 20, 100);

      const result = this.simulateShot(player);

      for (const p of this.game.players) {
        const dx = p.x - result.impact.x;
        const py = terrainY(p.x) - 19;
        const dy = py - result.impact.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 88) {
          const damage = Math.round(clamp(62 - dist * .62, 8, 62));
          p.hp = Math.max(0, p.hp - damage);
        }
      }

      const alive = this.game.players.filter(p => p.hp > 0);
      if (alive.length <= 1) {
        this.game.turn = null;
      } else {
        const other = this.game.players.find(p => p.id !== id && p.hp > 0);
        this.game.turn = other?.id || alive[0].id;
        this.game.wind = newWind();
      }

      this.broadcast({
        type: "shot",
        path: result.path,
        impact: result.impact,
        state: this.publicState()
      });

      if (alive.length <= 1 && this.game.players.length === 2) {
        this.broadcast({ type: "gameover", winnerId: alive[0]?.id || null });
        setTimeout(() => {
          this.game.players.forEach(p => p.hp = 100);
          this.game.wind = newWind();
          this.game.turn = this.game.players[Math.floor(Math.random() * this.game.players.length)]?.id || null;
          this.broadcastState();
        }, 4500);
      }
    }
  }

  simulateShot(player) {
    const index = this.game.players.findIndex(p => p.id === player.id);
    const dir = index === 0 ? 1 : -1;
    const rad = player.angle * Math.PI / 180;
    const speed = 210 + player.power * 5.2;

    let x = player.x + dir * 24;
    let y = terrainY(player.x) - 31;
    let vx = dir * Math.cos(rad) * speed;
    let vy = -Math.sin(rad) * speed;

    const gravity = 285;
    const wind = this.game.wind * 1.35;
    const dt = 1 / 60;
    const path = [];
    let impact = { x, y };

    for (let i = 0; i < 60 * 7; i++) {
      vx += wind * dt;
      vy += gravity * dt;
      x += vx * dt;
      y += vy * dt;

      if (i % 3 === 0) path.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });

      for (const target of this.game.players) {
        if (target.id === player.id || target.hp <= 0) continue;
        const tx = target.x;
        const ty = terrainY(target.x) - 19;
        if (Math.hypot(x - tx, y - ty) < 24) {
          impact = { x, y };
          return { path, impact };
        }
      }

      if (x < 0 || x > GAME_WIDTH || y > GAME_HEIGHT) {
        impact = { x: clamp(x, 0, GAME_WIDTH), y: clamp(y, 0, GAME_HEIGHT) };
        return { path, impact };
      }

      if (y >= terrainY(x)) {
        impact = { x, y: terrainY(x) };
        return { path, impact };
      }
    }

    impact = { x: clamp(x, 0, GAME_WIDTH), y: clamp(y, 0, GAME_HEIGHT) };
    return { path, impact };
  }

  publicState() {
    return {
      width: this.game.width,
      height: this.game.height,
      wind: this.game.wind,
      turn: this.game.turn,
      players: this.game.players.map(p => ({ ...p }))
    };
  }

  broadcastState() {
    this.broadcast({ type: "state", state: this.publicState() });
  }

  broadcast(payload) {
    const data = JSON.stringify(payload);
    for (const [id, ws] of this.clients) {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  removePlayer(id) {
    const existing = this.game.players.find(p => p.id === id);
    this.clients.delete(id);
    this.game.players = this.game.players.filter(p => p.id !== id);

    if (this.game.turn === id) {
      this.game.turn = this.game.players[0]?.id || null;
    }

    if (this.game.players.length < 2) {
      this.game.turn = null;
      this.game.players.forEach((p, idx) => {
        p.hp = 100;
        p.x = idx === 0 ? 150 : 850;
      });
    }

    if (existing) this.broadcast({ type: "toast", message: `${existing.name} saiu da sala.` });
    this.broadcastState();
  }
}
