(() => {
  "use strict";

  const WS_ENDPOINT = "wss://nova-frota-batalha-patio.luziano-transportes.workers.dev/ws";

  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");

  const ui = {
    lobby: $("lobby"),
    gameArea: $("gameArea"),
    waiting: $("waitingOverlay"),
    name: $("nameInput"),
    room: $("roomInput"),
    create: $("createBtn"),
    join: $("joinBtn"),
    connDot: $("connDot"),
    connText: $("connText"),
    roomLabel: $("roomLabel"),
    wind: $("windLabel"),
    turn: $("turnLabel"),
    turnPill: $("turnPill"),
    angle: $("angleSlider"),
    power: $("powerSlider"),
    angleValue: $("angleValue"),
    powerValue: $("powerValue"),
    fire: $("fireBtn"),
    copy: $("copyRoomBtn"),
    p1Name: $("p1Name"), p2Name: $("p2Name"),
    p1Hp: $("p1Hp"), p2Hp: $("p2Hp"),
    p1HpText: $("p1HpText"), p2HpText: $("p2HpText"),
    toast: $("toast"),
  };

  let ws = null;
  let myId = null;
  let roomCode = "";
  let state = {
    width: 1000, height: 560, wind: 0, turn: null,
    players: []
  };

  let anim = null;
  let particles = [];
  let screenShake = 0;

  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add("show");
    setTimeout(() => ui.toast.classList.remove("show"), 1800);
  }

  function randomRoom() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "NF";
    for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function connect(room, name) {
    roomCode = room.trim().toUpperCase();
    const url = new URL(WS_ENDPOINT);
    url.searchParams.set("room", roomCode);
    url.searchParams.set("name", name.trim() || "Jogador");

    ws = new WebSocket(url.toString());
    setConnection(false, "Conectando...");

    ws.addEventListener("open", () => {
      setConnection(true, "Conectado");
      ui.lobby.classList.add("hidden");
      ui.gameArea.classList.remove("hidden");
      ui.roomLabel.textContent = roomCode;
    });

    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "hello") {
        myId = msg.id;
      }

      if (msg.type === "state") {
        state = msg.state;
        syncUI();
      }

      if (msg.type === "shot") {
        playShot(msg);
      }

      if (msg.type === "toast") {
        toast(msg.message);
      }

      if (msg.type === "gameover") {
        const meWinner = msg.winnerId === myId;
        toast(meWinner ? "🏆 Você venceu!" : "💥 Partida encerrada.");
      }
    });

    ws.addEventListener("close", () => {
      setConnection(false, "Desconectado");
      ui.fire.disabled = true;
      toast("Conexão encerrada.");
    });

    ws.addEventListener("error", () => toast("Falha ao conectar ao servidor."));
  }

  function setConnection(online, text) {
    ui.connDot.classList.toggle("online", online);
    ui.connDot.classList.toggle("offline", !online);
    ui.connText.textContent = text;
  }

  function syncUI() {
    const p1 = state.players[0];
    const p2 = state.players[1];

    ui.waiting.classList.toggle("hidden", state.players.length >= 2);

    if (p1) {
      ui.p1Name.textContent = p1.name + (p1.id === myId ? " (você)" : "");
      ui.p1Hp.style.width = Math.max(0, p1.hp) + "%";
      ui.p1HpText.textContent = `${Math.max(0, p1.hp)} HP`;
    }
    if (p2) {
      ui.p2Name.textContent = p2.name + (p2.id === myId ? " (você)" : "");
      ui.p2Hp.style.width = Math.max(0, p2.hp) + "%";
      ui.p2HpText.textContent = `${Math.max(0, p2.hp)} HP`;
    } else {
      ui.p2Name.textContent = "Aguardando...";
      ui.p2Hp.style.width = "100%";
      ui.p2HpText.textContent = "100 HP";
    }

    const isMyTurn = state.turn === myId && state.players.length >= 2 && !anim;
    ui.turn.textContent = state.turn
      ? (isMyTurn ? "Sua vez" : (state.players.find(p => p.id === state.turn)?.name || "Adversário"))
      : "Aguardando";
    ui.turnPill.textContent = isMyTurn ? "SUA VEZ" : "AGUARDE";
    ui.turnPill.classList.toggle("go", isMyTurn);
    ui.fire.disabled = !isMyTurn;
    ui.angle.disabled = !isMyTurn;
    ui.power.disabled = !isMyTurn;
    ui.wind.textContent = `${state.wind > 0 ? "→" : state.wind < 0 ? "←" : "•"} ${Math.abs(state.wind).toFixed(0)}`;
  }

  function send(type, payload = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type, ...payload }));
  }

  function playShot(msg) {
    anim = {
      path: msg.path,
      index: 0,
      impact: msg.impact,
      nextState: msg.state,
      lastTime: performance.now()
    };
    ui.fire.disabled = true;
  }

  function terrainY(x) {
    return 420 + 42 * Math.sin(x / 125) + 22 * Math.sin(x / 58);
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#75c8ff");
    sky.addColorStop(.55, "#bdeeff");
    sky.addColorStop(.56, "#dff5ff");
    sky.addColorStop(1, "#8bb67b");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = .22;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 8; i++) {
      const x = 70 + i * 145;
      const y = 75 + (i % 3) * 32;
      ctx.beginPath();
      ctx.ellipse(x, y, 42, 15, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 32, y + 2, 28, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < 4; i++) {
      const x = 70 + i * 245;
      ctx.fillStyle = "#7f99a8";
      ctx.fillRect(x, 245, 150, 105);
      ctx.fillStyle = "#5d7380";
      ctx.beginPath();
      ctx.moveTo(x - 8, 245);
      ctx.lineTo(x + 75, 200);
      ctx.lineTo(x + 158, 245);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#d7edf7";
      ctx.fillRect(x + 18, 275, 44, 45);
      ctx.fillRect(x + 87, 275, 44, 45);
    }
  }

  function drawTerrain() {
    ctx.beginPath();
    ctx.moveTo(0, terrainY(0));
    for (let x = 0; x <= canvas.width; x += 6) ctx.lineTo(x, terrainY(x));
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();

    const grd = ctx.createLinearGradient(0, 390, 0, 560);
    grd.addColorStop(0, "#597a3b");
    grd.addColorStop(.12, "#425f31");
    grd.addColorStop(1, "#273a27");
    ctx.fillStyle = grd;
    ctx.fill();

    ctx.strokeStyle = "#5b6169";
    ctx.lineWidth = 30;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 10) {
      const y = terrainY(x) + 48;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 16]);
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 10) {
      const y = terrainY(x) + 48;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function playerPos(p) {
    return { x: p.x, y: terrainY(p.x) - 19 };
  }

  function drawPlayer(p, idx) {
    const pos = playerPos(p);
    ctx.save();
    if (p.hp <= 0) ctx.globalAlpha = .35;

    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y + 21, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = idx === 0 ? "#2479ff" : "#ff5268";
    ctx.fillRect(pos.x - 17, pos.y - 17, 34, 30);
    ctx.fillStyle = "#0b1725";
    ctx.fillRect(pos.x - 19, pos.y + 8, 12, 12);
    ctx.fillRect(pos.x + 7, pos.y + 8, 12, 12);
    ctx.fillStyle = "#f5c99a";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 24, 12, 0, Math.PI * 2);
    ctx.fill();

    const facing = idx === 0 ? 1 : -1;
    const a = (p.angle || 45) * Math.PI / 180;
    ctx.strokeStyle = "#1f2933";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - 10);
    ctx.lineTo(pos.x + facing * Math.cos(a) * 28, pos.y - 10 - Math.sin(a) * 28);
    ctx.stroke();

    ctx.font = "700 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "#06223a";
    ctx.fillText(p.name, pos.x, pos.y - 45);

    ctx.restore();
  }

  function drawProjectile() {
    if (!anim || !anim.path.length) return;

    const now = performance.now();
    const speed = 85;
    const elapsed = (now - anim.lastTime) / 1000;
    if (elapsed > 1 / speed) {
      const advance = Math.max(1, Math.floor(elapsed * speed));
      anim.index += advance;
      anim.lastTime = now;
    }

    if (anim.index >= anim.path.length) {
      explode(anim.impact.x, anim.impact.y);
      state = anim.nextState;
      anim = null;
      syncUI();
      return;
    }

    const p = anim.path[Math.min(anim.index, anim.path.length - 1)];
    ctx.save();
    ctx.shadowColor = "#ff641e";
    ctx.shadowBlur = 22;
    const orb = ctx.createRadialGradient(p.x - 3, p.y - 3, 2, p.x, p.y, 13);
    orb.addColorStop(0, "#fff9b5");
    orb.addColorStop(.35, "#ffce38");
    orb.addColorStop(.7, "#ff5c26");
    orb.addColorStop(1, "rgba(255,49,37,.1)");
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function explode(x, y) {
    screenShake = 12;
    for (let i = 0; i < 34; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - .5) * 260,
        vy: (Math.random() - .5) * 260,
        life: .7 + Math.random() * .5,
        r: 2 + Math.random() * 6
      });
    }
  }

  function updateParticles(dt) {
    particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      p.life -= dt;
    });
    particles = particles.filter(p => p.life > 0);
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.life > .55 ? "#ffd85a" : "#ff633b";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  let lastFrame = performance.now();
  function frame(now) {
    const dt = Math.min(.033, (now - lastFrame) / 1000);
    lastFrame = now;
    updateParticles(dt);

    ctx.save();
    if (screenShake > .2) {
      ctx.translate((Math.random() - .5) * screenShake, (Math.random() - .5) * screenShake);
      screenShake *= .86;
    }

    drawBackground();
    drawTerrain();
    state.players.forEach(drawPlayer);
    drawProjectile();
    drawParticles();
    ctx.restore();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  ui.angle.addEventListener("input", () => {
    ui.angleValue.textContent = ui.angle.value;
    send("aim", { angle: Number(ui.angle.value), power: Number(ui.power.value) });
  });
  ui.power.addEventListener("input", () => {
    ui.powerValue.textContent = ui.power.value;
    send("aim", { angle: Number(ui.angle.value), power: Number(ui.power.value) });
  });

  ui.fire.addEventListener("click", () => {
    send("shoot", { angle: Number(ui.angle.value), power: Number(ui.power.value) });
    ui.fire.disabled = true;
  });

  ui.create.addEventListener("click", () => {
    const name = ui.name.value.trim();
    if (!name) return toast("Digite seu nome.");
    const room = randomRoom();
    ui.room.value = room;
    connect(room, name);
  });

  ui.join.addEventListener("click", () => {
    const name = ui.name.value.trim();
    const room = ui.room.value.trim();
    if (!name) return toast("Digite seu nome.");
    if (!room) return toast("Digite o código da sala.");
    connect(room, name);
  });

  ui.copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(roomCode);
    toast("Código copiado.");
  });
})();
