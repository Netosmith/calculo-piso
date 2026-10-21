/* NOVA FROTA IA: chat compartilhado entre as páginas do Portal */
(() => {
  "use strict";
  if (window.NovaFrotaIA) return;
  const BASE = "https://api.portalfrete.net.br";
  const MAX_STORE = 10;
  const isHome = /\/home\.html$/i.test(location.pathname);
  const state = {messages: [], busy: false, sessionKey: "", ready: false, configured: false, open: false};
  const $ = id => document.getElementById(id);

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }
  function save() {
    if (!state.sessionKey) return;
    try { sessionStorage.setItem(state.sessionKey, JSON.stringify(state.messages.slice(-MAX_STORE))); } catch {}
  }
  function restore() {
    if (!state.sessionKey) return;
    try {
      const rows = JSON.parse(sessionStorage.getItem(state.sessionKey) || "[]");
      if (Array.isArray(rows)) state.messages = rows.filter(r =>
        (r.role === "user" || r.role === "assistant") && typeof r.content === "string"
      ).slice(-MAX_STORE);
    } catch { state.messages = []; }
  }
  function status(text, mode = "") {
    const node = $("nfaiStatus");
    if (!node) return;
    node.textContent = text;
    node.dataset.state = mode;
  }
  function chatBubble(role, text, target) {
    const box = el("div", "nfai-message");
    box.dataset.role = role;
    const who = el("small", "", role === "user" ? "Você" : role === "assistant" ? "NOVA FROTA IA" : "Sistema");
    box.append(who, el("div", "nfai-bubble", text));
    target.append(box);
  }
  function render() {
    const feed = $("nfaiFeed"), intro = $("nfaiIntro");
    if (!feed) return;
    feed.replaceChildren();
    intro.hidden = state.messages.length > 0;
    for (const item of state.messages) chatBubble(item.role, item.content, feed);
    if (state.busy) chatBubble("system", "Consultando o assistente...", feed);
    feed.parentNode.scrollTop = feed.parentNode.scrollHeight;
    $("nfaiSend").disabled = state.busy || !state.ready;
  }
  function toggle(open) {
    state.open = Boolean(open);
    document.body.classList.toggle("nfai-open", state.open);
    $("nfaiPanel").setAttribute("aria-hidden", String(!state.open));
    $("nfaiTop")?.setAttribute("aria-expanded", String(state.open));
    $("nfaiFab")?.setAttribute("aria-expanded", String(state.open));
    if (state.open) { render(); $("nfaiQuestion").focus(); }
  }
  async function api(path, options = {}) {
    const res = await fetch(BASE + path, {
      method: options.method || "GET",
      headers: {Accept: "application/json", ...(options.body ? {"Content-Type": "application/json"} : {})},
      credentials: "include", cache: "no-store",
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok !== true) {
      const err = new Error(data.error || "A solicitação não pôde ser concluída.");
      err.status = res.status; throw err;
    }
    return data;
  }
  async function connect() {
    try {
      const result = await api("/v1/ia/status");
      state.configured = Boolean(result.configured);
      state.ready = true;
      const identity = String(result.usuario || "usuario").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 70);
      state.sessionKey = "nf_ia_chat_v1_" + identity;
      restore();
      status(state.configured ? "● IA conectada • Consulta segura, conforme seu perfil." :
        "IA preparada. Falta configurar a chave OpenAI no Cloudflare.", state.configured ? "ready" : "error");
    } catch (error) {
      state.ready = false;
      status(error.status === 401 ? "Faça login no Portal Frete para usar a IA." :
        "Não foi possível consultar a IA. Atualize a página.", "error");
    }
    render();
  }
  async function send(question) {
    const text = String(question || "").trim().slice(0, 1800);
    if (!text || state.busy) return;
    if (!state.ready) {status("A sessão da IA não está conectada. Atualize o portal.", "error");return;}
    state.messages.push({role: "user", content: text});
    state.messages = state.messages.slice(-MAX_STORE);
    save();
    $("nfaiQuestion").value = "";
    state.busy = true;
    render();
    try {
      const result = await api("/v1/ia/chat", {method: "POST", body: {messages: state.messages}});
      state.messages.push({role: "assistant", content: result.answer || "Não consegui responder."});
      state.messages = state.messages.slice(-MAX_STORE);
      save();
      if (typeof result.remainingToday === "number")
        status("● IA conectada • " + result.remainingToday + " perguntas disponíveis hoje.", "ready");
    } catch (error) {
      if (error.status === 401) state.ready = false;
      const feed = $("nfaiFeed");
      if (feed) chatBubble("system", error.message, feed);
      status(error.message, "error");
    } finally {
      state.busy = false; render();
    }
  }

  function mount() {
    const controls = document.querySelector(".nf-actions");
    if (isHome && controls) {
      const btn = el("button", "nfai-launch nfai-topbtn");
      btn.type = "button"; btn.id = "nfaiTop"; btn.title = "Abrir NOVA FROTA IA";
      btn.setAttribute("aria-controls", "nfaiPanel"); btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = '<span class="nfai-star" aria-hidden="true">✦</span><span class="nfai-label">NOVA FROTA IA</span>';
      controls.insertBefore(btn, controls.firstChild);
      btn.addEventListener("click", () => toggle(!state.open));
    } else {
      const fab = el("button", "nfai-launch nfai-fab");fab.type = "button";fab.id = "nfaiFab";
      fab.setAttribute("aria-controls", "nfaiPanel");fab.setAttribute("aria-expanded", "false");
      fab.innerHTML = '<span class="nfai-star" aria-hidden="true">✦</span><span>Nova Frota IA</span>';
      document.body.append(fab); fab.addEventListener("click", () => toggle(!state.open));
    }
    const backdrop = el("div", "nfai-backdrop");
    backdrop.id = "nfaiBackdrop";
    backdrop.addEventListener("click", () => toggle(false));
    const panel = el("section", "nfai-panel");
    panel.id = "nfaiPanel";panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");panel.setAttribute("aria-hidden", "true");
    panel.setAttribute("aria-label", "NOVA FROTA IA");
    panel.innerHTML = `
      <header class="nfai-head">
        <div class="nfai-brandicon" aria-hidden="true">✦</div>
        <div><div class="nfai-name">NOVA FROTA IA</div><div class="nfai-subtitle">Assistente comercial e operacional</div></div>
        <div class="nfai-head-spacer"></div>
        <button class="nfai-iconbtn" id="nfaiClear" type="button" aria-label="Nova conversa" title="Nova conversa">↺</button>
        <button class="nfai-iconbtn" id="nfaiClose" type="button" aria-label="Fechar assistente" title="Fechar">×</button>
      </header>
      <div id="nfaiStatus" class="nfai-status" role="status">Conectando com o Portal Frete...</div>
      <div class="nfai-body" id="nfaiScroll">
        <div id="nfaiIntro">
          <div class="nfai-intro"><strong>Olá! Como posso ajudar? 👋</strong>
            <p>Pesquise fretes liberados, peça sugestões comerciais ou tire dúvidas sobre os módulos do Portal Frete.</p></div>
          <div class="nfai-quick">
            <button type="button" data-nfai-ask="Quais fretes liberados temos em Mato Grosso?">🚛 Buscar fretes disponíveis</button>
            <button type="button" data-nfai-ask="Que oportunidades comerciais podemos identificar com os fretes disponíveis no portal?">📈 Ideias de oportunidades comerciais</button>
            <button type="button" data-nfai-ask="Como faço para cadastrar e divulgar um frete no Portal Frete?">📚 Ajuda com o Portal Frete</button>
            <button type="button" data-nfai-ask="Como consultar os custos por placa na Gestão de Frota?">⛽ Custos de frota</button>
          </div>
        </div>
        <div id="nfaiFeed" aria-live="polite" aria-relevant="additions text"></div>
      </div>
      <footer class="nfai-composer">
        <form id="nfaiForm" class="nfai-form">
          <textarea id="nfaiQuestion" placeholder="Pergunte sobre sua operação..." rows="1" maxlength="1800" aria-label="Sua pergunta"></textarea>
          <button id="nfaiSend" type="submit" class="nfai-send" aria-label="Enviar pergunta" title="Enviar">➤</button>
        </form>
        <p class="nfai-note">A IA pode errar. Confirme os valores e dados nos módulos oficiais do portal.</p>
      </footer>`;
    document.body.append(backdrop, panel);
    $("nfaiClose").addEventListener("click", () => toggle(false));
    $("nfaiClear").addEventListener("click", () => {
      if (state.busy) return;
      state.messages = []; save(); render(); $("nfaiQuestion").focus();
    });
    $("nfaiForm").addEventListener("submit", event => {event.preventDefault(); send($("nfaiQuestion").value);});
    $("nfaiQuestion").addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {event.preventDefault(); $("nfaiForm").requestSubmit();}
    });
    panel.querySelectorAll("[data-nfai-ask]").forEach(button => button.addEventListener("click", () => send(button.dataset.nfaiAsk)));
    document.addEventListener("keydown", event => { if (event.key === "Escape" && state.open) toggle(false); });
    document.querySelectorAll("[data-logout]").forEach(button => button.addEventListener("click", () => {
      if (state.sessionKey) { try {sessionStorage.removeItem(state.sessionKey);} catch {} }
    }));
    window.NovaFrotaIA = {open: () => toggle(true), close: () => toggle(false)};
    connect();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, {once: true});
  else mount();
})();