/* Pingo Chic — abelhinha animada que voa pelo site enquanto ele está em uso.
 * - Voa suavemente por pontos aleatórios da tela, com balanço e asas batendo.
 * - Às vezes vem "visitar" o cursor/toque e faz uma pausa.
 * - Clique nela: dá uma piruetinha e solta coraçõezinhos.
 * - Pausa quando a aba está em segundo plano; respeita "reduzir movimento".
 * - Não bloqueia cliques no site (pointer-events só na própria abelha).
 * - Pode ser escondida pelo visitante (fica salvo no navegador).
 */
(function () {
  "use strict";
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || "";
  if (window.__pcBee) return;
  window.__pcBee = true;

  const KEY = "pingochic.bee.off";
  const store = {
    get(k, area) { try { return (area || localStorage).getItem(k); } catch (e) { return null; } },
    set(k, v, area) { try { (area || localStorage).setItem(k, v); } catch (e) { /* ignora */ } }
  };
  const ss = (() => { try { return sessionStorage; } catch (e) { return null; } })();
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SVG = `
  <svg viewBox="0 0 64 56" width="100%" height="100%" aria-hidden="true">
    <defs>
      <radialGradient id="pcb-body" cx="55%" cy="40%" r="65%"><stop offset="0" stop-color="#FFE27A"/><stop offset=".7" stop-color="#FECA28"/><stop offset="1" stop-color="#F0AE12"/></radialGradient>
      <linearGradient id="pcb-wing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E4F4FD"/></linearGradient>
    </defs>
    <g class="pcb-wings">
      <ellipse class="pcb-w1" cx="26" cy="14" rx="9" ry="13" transform="rotate(-28 26 14)" fill="url(#pcb-wing)" stroke="#311E17" stroke-width="2.6"/>
      <ellipse class="pcb-w2" cx="36" cy="13" rx="8" ry="12" transform="rotate(14 36 13)" fill="url(#pcb-wing)" stroke="#311E17" stroke-width="2.6"/>
    </g>
    <path d="M8 34 L2 36 L8 39 Z" fill="#311E17"/>
    <ellipse cx="30" cy="35" rx="23" ry="16" fill="url(#pcb-body)" stroke="#311E17" stroke-width="3"/>
    <path d="M19 21.5c-3 8-3 19 0 27" fill="none" stroke="#311E17" stroke-width="5" stroke-linecap="round"/>
    <path d="M29 19.5c-2.5 9-2.5 21 0 31" fill="none" stroke="#311E17" stroke-width="5" stroke-linecap="round"/>
    <path d="M44 24c4 3 5 6 4 0" fill="none" stroke="#311E17" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M44 23 C46 14 49 10 53 8" fill="none" stroke="#311E17" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M48 24 C51 16 55 13 59 12" fill="none" stroke="#311E17" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="53" cy="8" r="3.2" fill="#FECA28" stroke="#311E17" stroke-width="1.6"/>
    <circle cx="59" cy="12" r="3.2" fill="#FECA28" stroke="#311E17" stroke-width="1.6"/>
    <g class="pcb-eye"><circle cx="42" cy="32" r="4.6" fill="#311E17"/><circle cx="43.4" cy="30.4" r="1.5" fill="#fff"/></g>
    <circle cx="38.5" cy="39" r="3" fill="#FF8C95" opacity=".85"/>
    <path d="M44 40.5c1.8 2 4.2 2 5.6-.2" fill="none" stroke="#311E17" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

  const CSS = `
  .pc-bee{position:fixed;left:0;top:0;width:42px;height:37px;z-index:9990;pointer-events:auto;cursor:pointer;will-change:transform;
    filter:drop-shadow(0 6px 6px rgba(49,30,23,.18));-webkit-tap-highlight-color:transparent;user-select:none;transition:opacity .4s}
  .pc-bee .pcb-flip{width:100%;height:100%;transition:transform .35s ease}
  .pc-bee.left .pcb-flip{transform:scaleX(-1)}
  .pc-bee .pcb-w1{transform-origin:30px 24px;animation:pcbFlap .11s ease-in-out infinite alternate}
  .pc-bee .pcb-w2{transform-origin:33px 24px;animation:pcbFlap2 .11s ease-in-out infinite alternate}
  .pc-bee .pcb-eye{transform-origin:42px 32px;animation:pcbBlink 4.2s infinite}
  .pc-bee.spin .pcb-flip{animation:pcbSpin .7s ease}
  .pc-bee.rest .pcb-w1,.pc-bee.rest .pcb-w2{animation-duration:.22s}
  @keyframes pcbFlap{from{transform:rotate(-28deg) scaleY(1)}to{transform:rotate(-8deg) scaleY(.55)}}
  @keyframes pcbFlap2{from{transform:rotate(14deg) scaleY(1)}to{transform:rotate(32deg) scaleY(.5)}}
  @keyframes pcbBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
  @keyframes pcbSpin{0%{transform:rotate(0) scale(1)}50%{transform:rotate(200deg) scale(1.25)}100%{transform:rotate(360deg) scale(1)}}
  .pc-bee-trail{position:fixed;width:4px;height:4px;border-radius:50%;background:#F4A6BA;pointer-events:none;z-index:9989;opacity:.55;transition:opacity 1.2s ease,transform 1.2s ease}
  .pc-bee-heart{position:fixed;pointer-events:none;z-index:9991;font-size:16px;line-height:1;color:#F0645E;animation:pcbHeart 1.1s ease-out forwards}
  @keyframes pcbHeart{from{opacity:1;transform:translate(0,0) scale(.6)}to{opacity:0;transform:translate(var(--dx),-46px) scale(1.2)}}
  .pc-bee-toggle{position:fixed;left:12px;bottom:12px;z-index:9988;width:36px;height:36px;border-radius:50%;border:1px solid #EADFD4;background:rgba(255,255,255,.92);
    box-shadow:0 4px 14px rgba(49,30,23,.10);display:grid;place-items:center;cursor:pointer;padding:0;opacity:.75;transition:opacity .2s,transform .2s}
  .pc-bee-toggle:hover{opacity:1;transform:scale(1.06)}
  .pc-bee-toggle img{width:22px;height:auto}
  .pc-bee-toggle.off img{filter:grayscale(1);opacity:.55}
  .pc-bee-tip{position:fixed;z-index:9991;background:#311E17;color:#fff;font:600 12px/1.2 'Plus Jakarta Sans',system-ui,sans-serif;padding:7px 10px;border-radius:10px;pointer-events:none;
    white-space:nowrap;opacity:0;transform:translateY(4px);transition:all .25s}
  .pc-bee-tip.show{opacity:1;transform:none}
  @media print{.pc-bee,.pc-bee-toggle,.pc-bee-trail,.pc-bee-tip{display:none!important}}
  `;

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const bee = document.createElement("div");
  bee.className = "pc-bee";
  bee.setAttribute("role", "img");
  bee.setAttribute("aria-label", "Abelhinha Pingo Chic");
  bee.innerHTML = `<div class="pcb-flip">${SVG}</div>`;

  const toggle = document.createElement("button");
  toggle.className = "pc-bee-toggle";
  toggle.type = "button";
  toggle.innerHTML = `<img src="${(SCRIPT_SRC ? new URL("img/bee-120.webp", SCRIPT_SRC).href : "../assets/pingochic/img/bee-120.webp")}" alt="">`;

  const tip = document.createElement("div");
  tip.className = "pc-bee-tip";

  let enabled = store.get(KEY) !== "1";
  let running = false, raf = 0;

  // estado do voo
  const W = () => innerWidth, H = () => innerHeight;
  const size = () => (innerWidth < 600 ? 32 : 42);
  let x = -60, y = H() * 0.35, vx = 0, vy = 0;
  let tx = 0, ty = 0, restUntil = 0, nextVisit = 0, t0 = performance.now(), last = t0, lastTrail = 0;
  let pointer = null;

  function pickTarget() {
    const s = size(), m = 20;
    // evita o cabeçalho (topo) e prefere as laterais, para não ficar na frente do conteúdo
    const side = Math.random();
    const w = W(), h = H();
    let nx;
    if (w > 900 && side < 0.7) nx = Math.random() < 0.5 ? m + Math.random() * w * 0.16 : w - s - m - Math.random() * w * 0.16;
    else nx = m + Math.random() * (w - s - m * 2);
    tx = nx;
    ty = 110 + Math.random() * Math.max(60, h - 110 - s - 70);
  }

  function setTip(text, ms = 2200) {
    tip.textContent = text;
    tip.classList.add("show");
    clearTimeout(setTip._t);
    setTip._t = setTimeout(() => tip.classList.remove("show"), ms);
  }

  const PHRASES = ["Bzz! Bem-vinda à Pingo Chic ♥", "Bzz… já viu as novidades?", "Frete grátis acima de R$ 199!", "Bzz! Que look fofo ♥", "Pix tem desconto! Bzz"];

  function hearts() {
    const r = bee.getBoundingClientRect();
    for (let i = 0; i < 5; i++) {
      const h = document.createElement("span");
      h.className = "pc-bee-heart";
      h.textContent = i % 2 ? "♥" : "✦";
      h.style.color = ["#F0645E", "#2BC4F5", "#FECA28", "#F09AB2", "#2BC4F5"][i];
      h.style.left = r.left + r.width / 2 + (Math.random() * 20 - 10) + "px";
      h.style.top = r.top + 6 + "px";
      h.style.setProperty("--dx", (Math.random() * 60 - 30) + "px");
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1200);
    }
  }

  function trail(now) {
    if (now - lastTrail < 140 || innerWidth < 600) return;
    lastTrail = now;
    const d = document.createElement("span");
    d.className = "pc-bee-trail";
    const left = bee.classList.contains("left");
    d.style.left = (x + (left ? size() * 0.85 : size() * 0.1)) + "px";
    d.style.top = (y + size() * 0.62) + "px";
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.opacity = "0"; d.style.transform = "scale(.3)"; });
    setTimeout(() => d.remove(), 1300);
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(48, now - last) / 16.67;
    last = now;
    const s = size();
    bee.style.width = s + "px";
    bee.style.height = s * 0.87 + "px";

    // às vezes visita o ponteiro
    if (pointer && now > nextVisit && now - pointer.at < 4000) {
      tx = Math.min(W() - s - 10, Math.max(10, pointer.x + 26));
      ty = Math.min(H() - s - 10, Math.max(90, pointer.y - 50));
      nextVisit = now + 14000 + Math.random() * 10000;
    }

    const dx = tx - x, dy = ty - y, dist = Math.hypot(dx, dy);
    if (now < restUntil) {
      bee.classList.add("rest");
      vx *= 0.9; vy *= 0.9;
    } else {
      bee.classList.remove("rest");
      if (dist < 24) {
        restUntil = now + (Math.random() < 0.35 ? 900 + Math.random() * 1600 : 0);
        pickTarget();
      }
      const speed = (innerWidth < 600 ? 1.3 : 1.8) * (reduce ? 0.55 : 1);
      const ax = (dx / (dist || 1)) * 0.11, ay = (dy / (dist || 1)) * 0.11;
      vx = (vx + ax * dt) * 0.965; vy = (vy + ay * dt) * 0.965;
      const v = Math.hypot(vx, vy);
      if (v > speed) { vx = vx / v * speed; vy = vy / v * speed; }
    }
    x += vx * dt; y += vy * dt;

    // balanço do voo
    const t = (now - t0) / 1000;
    const bob = Math.sin(t * 3.1) * 6 + Math.sin(t * 7.3) * 1.5;
    const tilt = Math.max(-14, Math.min(14, vy * 6)) + Math.sin(t * 2.2) * 3;
    if (Math.abs(vx) > 0.25) bee.classList.toggle("left", vx < 0);

    bee.style.transform = `translate3d(${x.toFixed(1)}px, ${(y + bob).toFixed(1)}px, 0) rotate(${(bee.classList.contains("left") ? -tilt : tilt).toFixed(1)}deg)`;
    tip.style.left = Math.min(W() - 200, Math.max(8, x - 30)) + "px";
    tip.style.top = Math.max(8, y + bob - 34) + "px";
    if (now >= restUntil) trail(now);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || !enabled) return;
    running = true;
    bee.style.opacity = "1";
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function setEnabled(on) {
    enabled = on;
    store.set(KEY, on ? "0" : "1");
    toggle.classList.toggle("off", !on);
    toggle.title = on ? "Esconder a abelhinha" : "Mostrar a abelhinha";
    toggle.setAttribute("aria-label", toggle.title);
    if (on) {
      bee.style.display = "";
      x = -60; y = H() * 0.4; vx = 2; vy = 0; pickTarget();
      start();
      setTimeout(() => setTip("Bzz! Voltei ♥"), 600);
    } else {
      stop();
      bee.style.display = "none";
      tip.classList.remove("show");
    }
  }

  bee.addEventListener("click", (e) => {
    e.stopPropagation();
    bee.classList.remove("spin"); void bee.offsetWidth; bee.classList.add("spin");
    hearts();
    setTip(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
    restUntil = performance.now() + 900;
    setTimeout(() => { bee.classList.remove("spin"); pickTarget(); }, 750);
  });
  toggle.addEventListener("click", () => setEnabled(!enabled));

  addEventListener("pointermove", (e) => { pointer = { x: e.clientX, y: e.clientY, at: performance.now() }; }, { passive: true });
  addEventListener("pointerdown", (e) => { pointer = { x: e.clientX, y: e.clientY, at: performance.now() }; }, { passive: true });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  addEventListener("resize", () => { x = Math.min(x, W() - size()); y = Math.min(y, H() - size()); pickTarget(); });

  function mount() {
    document.body.appendChild(bee);
    document.body.appendChild(tip);
    document.body.appendChild(toggle);
    toggle.classList.toggle("off", !enabled);
    toggle.title = enabled ? "Esconder a abelhinha" : "Mostrar a abelhinha";
    toggle.setAttribute("aria-label", toggle.title);
    if (!enabled) { bee.style.display = "none"; return; }
    pickTarget(); nextVisit = performance.now() + 6000;
    start();
    // primeira visita da sessão: uma saudação
    if (!ss || !store.get("pingochic.bee.hi", ss)) {
      if (ss) store.set("pingochic.bee.hi", "1", ss);
      setTimeout(() => running && setTip("Bzz! Bem-vinda à Pingo Chic ♥", 2800), 1800);
    }
  }

  // o app da loja recria o <body> ao iniciar; montamos depois e remontamos se precisar
  function ensure() {
    try { if (document.body && !document.body.contains(bee)) mount(); } catch (e) { /* nunca quebrar a loja */ }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(ensure, 50));
  else setTimeout(ensure, 50);
  addEventListener("load", ensure);
  setInterval(() => { if (document.body && !document.body.contains(toggle)) { stop(); ensure(); } }, 1200);

  window.PCBee = { show: () => setEnabled(true), hide: () => setEnabled(false) };
})();
