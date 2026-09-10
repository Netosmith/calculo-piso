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

  const PROPS = [
    { type: "barrier", x: 245, layer: "front", scale: 1.00 },
    { type: "pallet",  x: 340, layer: "front", scale: 1.06 },
    { type: "barrels", x: 470, layer: "front", scale: 1.00 },
    { type: "container", x: 615, layer: "back", scale: 1.08, color: "#208aa5" },
    { type: "crate",   x: 720, layer: "front", scale: 1.00 },
    { type: "barrier", x: 790, layer: "front", scale: 1.04 },
    { type: "tires",   x: 905, layer: "front", scale: 1.00 }
  ];

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

      if (msg.type === "hello") myId = msg.id;

      if (msg.type === "state") {
        state = msg.state;
        syncUI();
      }

      if (msg.type === "shot") playShot(msg);

      if (msg.type === "toast") toast(msg.message);

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

  function ridgeY(x, base, a1, s1, a2, s2) {
    return base + a1 * Math.sin(x / s1) + a2 * Math.sin((x + 130) / s2);
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#5aa2ff");
    sky.addColorStop(0.38, "#8ed7ff");
    sky.addColorStop(0.62, "#d7f4ff");
    sky.addColorStop(1, "#bce7ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sun = ctx.createRadialGradient(805, 96, 10, 805, 96, 70);
    sun.addColorStop(0, "rgba(255,247,190,.95)");
    sun.addColorStop(0.45, "rgba(255,217,120,.45)");
    sun.addColorStop(1, "rgba(255,217,120,0)");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(805, 96, 72, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 7; i++) {
      const x = 80 + i * 145;
      const y = 72 + (i % 3) * 26;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(x, y, 46, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 36, y + 2, 28, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 34, y + 3, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    function drawHill(base, c1, c2) {
      ctx.beginPath();
      ctx.moveTo(0, ridgeY(0, base, 22, 170, 11, 73));
      for (let x = 0; x <= canvas.width; x += 8) ctx.lineTo(x, ridgeY(x, base, 22, 170, 11, 73));
      ctx.lineTo(canvas.width, 310);
      ctx.lineTo(0, 310);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, base - 60, 0, 320);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.fill();
    }
    drawHill(250, "#7eaac0", "#5f889d");
    drawHill(285, "#9ec1b0", "#6f9b7d");

    for (let i = 0; i < 4; i++) {
      const x = 58 + i * 236;
      const y = 245 + (i % 2) * 10;
      ctx.fillStyle = "rgba(8, 18, 28, .12)";
      ctx.fillRect(x + 5, y + 5, 164, 102);

      const wall = ctx.createLinearGradient(x, y, x, y + 102);
      wall.addColorStop(0, "#879eab");
      wall.addColorStop(1, "#6b808d");
      ctx.fillStyle = wall;
      ctx.fillRect(x, y, 164, 102);

      ctx.fillStyle = "#5f7380";
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + 82, y - 47);
      ctx.lineTo(x + 172, y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = i % 2 ? "#f4c545" : "#2bc187";
      ctx.fillRect(x, y + 18, 164, 8);

      ctx.fillStyle = "#d8eef8";
      ctx.fillRect(x + 22, y + 42, 40, 44);
      ctx.fillRect(x + 74, y + 42, 40, 44);
      ctx.fillRect(x + 126, y + 42, 18, 44);
    }

    roundedRect(390, 224, 220, 32, 8);
    const sign = ctx.createLinearGradient(390, 224, 390, 256);
    sign.addColorStop(0, "#103457");
    sign.addColorStop(1, "#0a2340");
    ctx.fillStyle = sign;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.stroke();
    ctx.fillStyle = "#37f0a5";
    ctx.font = "800 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("NOVA FROTA BATTLE YARD", 500, 245);

    ctx.strokeStyle = "rgba(255,255,255,.22)";
    ctx.lineWidth = 2;
    for (let x = -20; x < canvas.width + 20; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 335);
      ctx.lineTo(x, 373);
      ctx.stroke();
    }
    for (let y = 347; y <= 366; y += 9) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  function drawTerrain() {
    ctx.beginPath();
    ctx.moveTo(0, 360);
    ctx.lineTo(canvas.width, 360);
    ctx.lineTo(canvas.width, 408);
    for (let x = canvas.width; x >= 0; x -= 8) {
      ctx.lineTo(x, terrainY(x) - 14);
    }
    ctx.closePath();
    const yard = ctx.createLinearGradient(0, 360, 0, 420);
    yard.addColorStop(0, "#788089");
    yard.addColorStop(1, "#59616a");
    ctx.fillStyle = yard;
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.setLineDash([14, 14]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 389);
    ctx.lineTo(canvas.width, 389);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(0, terrainY(0));
    for (let x = 0; x <= canvas.width; x += 6) ctx.lineTo(x, terrainY(x));
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();

    const grd = ctx.createLinearGradient(0, 382, 0, 560);
    grd.addColorStop(0, "#6f9845");
    grd.addColorStop(0.14, "#4f7132");
    grd.addColorStop(1, "#273a27");
    ctx.fillStyle = grd;
    ctx.fill();

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#19301f";
    for (let x = 0; x <= canvas.width; x += 24) {
      const y = terrainY(x);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 14, y + 18);
      ctx.lineTo(x + 8, y + 28);
      ctx.lineTo(x - 9, y + 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "#515861";
    ctx.lineWidth = 34;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 10) {
      const y = terrainY(x) + 48;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(0,0,0,.18)";
    ctx.lineWidth = 40;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 10) {
      const y = terrainY(x) + 52;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,.65)";
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 16]);
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 10) {
      const y = terrainY(x) + 48;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(218,255,188,.25)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 10) {
      const y = terrainY(x);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawShadow(x, y, rx, ry, alpha = 0.18) {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBarrier(x, ground, scale) {
    const w = 58 * scale;
    const h = 26 * scale;
    const y = ground - h - 4;
    drawShadow(x, ground + 11, w * 0.55, 7);
    const front = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y + h);
    front.addColorStop(0, "#c9d2da");
    front.addColorStop(1, "#9ba8b3");
    roundedRect(x - w / 2, y, w, h, 6);
    ctx.fillStyle = front;
    ctx.fill();
    ctx.fillStyle = "#e8eef2";
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 6, y + 4);
    ctx.lineTo(x + w / 2 - 6, y + 4);
    ctx.lineTo(x + w / 2 - 12, y - 2);
    ctx.lineTo(x - w / 2 + 12, y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#efb23e";
    ctx.fillRect(x - 18 * scale, y + 8 * scale, 10 * scale, 6 * scale);
    ctx.fillRect(x + 8 * scale, y + 8 * scale, 10 * scale, 6 * scale);
  }

  function drawPalletStack(x, ground, scale) {
    const y = ground - 28 * scale;
    drawShadow(x, ground + 11, 26 * scale, 6);
    ctx.fillStyle = "#7d552e";
    ctx.fillRect(x - 28 * scale, y + 18 * scale, 56 * scale, 7 * scale);
    ctx.fillRect(x - 26 * scale, y + 27 * scale, 52 * scale, 6 * scale);
    const cg = ctx.createLinearGradient(x, y - 8, x, y + 24);
    cg.addColorStop(0, "#cfa96a");
    cg.addColorStop(1, "#a97f43");
    ctx.fillStyle = cg;
    ctx.fillRect(x - 22 * scale, y - 2 * scale, 20 * scale, 20 * scale);
    ctx.fillRect(x + 2 * scale, y - 10 * scale, 22 * scale, 28 * scale);
    ctx.fillRect(x - 2 * scale, y + 4 * scale, 12 * scale, 14 * scale);
    ctx.strokeStyle = "rgba(69,44,20,.4)";
    ctx.strokeRect(x - 22 * scale, y - 2 * scale, 20 * scale, 20 * scale);
    ctx.strokeRect(x + 2 * scale, y - 10 * scale, 22 * scale, 28 * scale);
  }

  function drawBarrels(x, ground, scale) {
    drawShadow(x, ground + 10, 24 * scale, 6);
    const colors = [["#2da1ff","#1f5fb2"],["#ff6f61","#b8392f"],["#ffd15f","#b9861a"]];
    for (let i = 0; i < 3; i++) {
      const bx = x - 22 * scale + i * 22 * scale;
      const y = ground - 28 * scale + (i === 1 ? -6 * scale : 0);
      const g = ctx.createLinearGradient(bx - 8 * scale, y, bx + 8 * scale, y);
      g.addColorStop(0, colors[i][0]);
      g.addColorStop(1, colors[i][1]);
      ctx.fillStyle = g;
      ctx.fillRect(bx - 9 * scale, y, 18 * scale, 24 * scale);
      ctx.fillStyle = "rgba(255,255,255,.20)";
      ctx.fillRect(bx - 4 * scale, y + 4 * scale, 3 * scale, 16 * scale);
      ctx.strokeStyle = "rgba(0,0,0,.18)";
      ctx.strokeRect(bx - 9 * scale, y, 18 * scale, 24 * scale);
    }
  }

  function drawContainer(x, ground, scale, color) {
    const w = 126 * scale, h = 58 * scale;
    const y = ground - h - 10;
    drawShadow(x + 8, ground + 14, 58 * scale, 9);
    const body = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y);
    body.addColorStop(0, color || "#1f8ead");
    body.addColorStop(1, "#16627c");
    ctx.fillStyle = body;
    ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,.14)";
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x - w / 2 + 12, y - 8);
    ctx.lineTo(x + w / 2 + 12, y - 8);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2 + 12, y - 8);
    ctx.lineTo(x + w / 2 + 12, y + h - 8);
    ctx.lineTo(x + w / 2, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    for (let i = -5; i <= 5; i++) {
      const lx = x + i * 10 * scale;
      ctx.beginPath();
      ctx.moveTo(lx, y + 4);
      ctx.lineTo(lx, y + h - 4);
      ctx.stroke();
    }
  }

  function drawCrate(x, ground, scale) {
    const y = ground - 34 * scale;
    drawShadow(x, ground + 12, 28 * scale, 7);
    const box = ctx.createLinearGradient(x - 24 * scale, y, x + 24 * scale, y + 32 * scale);
    box.addColorStop(0, "#b78c52");
    box.addColorStop(1, "#886133");
    ctx.fillStyle = box;
    ctx.fillRect(x - 24 * scale, y, 48 * scale, 32 * scale);
    ctx.fillStyle = "rgba(255,255,255,.16)";
    ctx.fillRect(x - 24 * scale, y, 48 * scale, 4 * scale);
    ctx.strokeStyle = "rgba(77,45,17,.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 24 * scale, y, 48 * scale, 32 * scale);
    ctx.beginPath();
    ctx.moveTo(x - 20 * scale, y + 6 * scale);
    ctx.lineTo(x + 20 * scale, y + 26 * scale);
    ctx.moveTo(x + 20 * scale, y + 6 * scale);
    ctx.lineTo(x - 20 * scale, y + 26 * scale);
    ctx.stroke();
  }

  function drawTires(x, ground, scale) {
    drawShadow(x, ground + 10, 23 * scale, 7);
    for (let i = 0; i < 3; i++) {
      const tx = x - 16 * scale + i * 14 * scale;
      const ty = ground - 17 * scale - (i === 1 ? 12 * scale : 0);
      ctx.fillStyle = "#13171d";
      ctx.beginPath();
      ctx.arc(tx, ty, 12 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3b424c";
      ctx.beginPath();
      ctx.arc(tx, ty, 6 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.14)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx, ty, 10 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawProps(layer) {
    for (const prop of PROPS) {
      if (prop.layer !== layer) continue;
      const ground = terrainY(prop.x) + 4;
      switch (prop.type) {
        case "barrier": drawBarrier(prop.x, ground, prop.scale); break;
        case "pallet":  drawPalletStack(prop.x, ground, prop.scale); break;
        case "barrels": drawBarrels(prop.x, ground, prop.scale); break;
        case "container": drawContainer(prop.x, ground, prop.scale, prop.color); break;
        case "crate": drawCrate(prop.x, ground, prop.scale); break;
        case "tires": drawTires(prop.x, ground, prop.scale); break;
      }
    }
  }

  function playerPos(p) {
    return { x: p.x, y: terrainY(p.x) - 19 };
  }

  function drawPlayer(p, idx) {
    const pos = playerPos(p);
    ctx.save();
    if (p.hp <= 0) ctx.globalAlpha = 0.35;

    drawShadow(pos.x + 1, pos.y + 22, 26, 7);

    ctx.fillStyle = "#182436";
    ctx.fillRect(pos.x - 13, pos.y + 4, 9, 18);
    ctx.fillRect(pos.x + 4, pos.y + 4, 9, 18);

    ctx.fillStyle = "#091019";
    ctx.fillRect(pos.x - 15, pos.y + 19, 13, 5);
    ctx.fillRect(pos.x + 3, pos.y + 19, 13, 5);

    const body = ctx.createLinearGradient(pos.x - 18, pos.y - 20, pos.x + 18, pos.y + 15);
    if (idx === 0) {
      body.addColorStop(0, "#65b4ff");
      body.addColorStop(1, "#236cf4");
    } else {
      body.addColorStop(0, "#ff9baa");
      body.addColorStop(1, "#f54b63");
    }
    roundedRect(pos.x - 18, pos.y - 16, 36, 24, 8);
    ctx.fillStyle = body;
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(pos.x - 4, pos.y - 15, 8, 23);

    ctx.fillStyle = idx === 0 ? "#2d7ef8" : "#f15971";
    ctx.fillRect(pos.x - 23, pos.y - 11, 8, 17);
    ctx.fillRect(pos.x + 15, pos.y - 11, 8, 17);

    ctx.fillStyle = "#f5c99a";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 24, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = idx === 0 ? "#1d5df0" : "#e5435c";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 27, 12, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(pos.x - 10, pos.y - 27, 20, 4);

    const facing = idx === 0 ? 1 : -1;
    const a = (p.angle || 45) * Math.PI / 180;
    const bx = pos.x + facing * 4;
    const by = pos.y - 10;
    const ex = bx + facing * Math.cos(a) * 30;
    const ey = by - Math.sin(a) * 30;

    ctx.strokeStyle = "#1f2933";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx, by - 2);
    ctx.lineTo(ex, ey - 2);
    ctx.stroke();

    ctx.font = "700 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "#092138";
    ctx.fillText(p.name, pos.x, pos.y - 47);

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
    orb.addColorStop(0.35, "#ffce38");
    orb.addColorStop(0.7, "#ff5c26");
    orb.addColorStop(1, "rgba(255,49,37,.1)");
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,171,76,.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - 16, p.y + 3);
    ctx.lineTo(p.x - 34, p.y + 7);
    ctx.stroke();
    ctx.restore();
  }

  function explode(x, y) {
    screenShake = 12;
    for (let i = 0; i < 34; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 260,
        vy: (Math.random() - 0.5) * 260,
        life: 0.7 + Math.random() * 0.5,
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
      ctx.fillStyle = p.life > 0.55 ? "#ffd85a" : "#ff633b";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  let lastFrame = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - lastFrame) / 1000);
    lastFrame = now;
    updateParticles(dt);

    ctx.save();
    if (screenShake > 0.2) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
      screenShake *= 0.86;
    }

    drawBackground();
    drawTerrain();
    drawProps("back");
    state.players.forEach(drawPlayer);
    drawProjectile();
    drawParticles();
    drawProps("front");

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