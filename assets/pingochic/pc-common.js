/* Pingo Chic — utilidades compartilhadas entre a loja e o painel administrativo. */
(function () {
  "use strict";

  // Em produção o front fica em portalfrete.net.br e a API em api.portalfrete.net.br.
  // Em ambientes de teste a API é servida na mesma origem (proxy).
  const host = location.hostname;
  const API_BASE = window.PC_API_BASE ||
    (/(^|\.)portalfrete\.(net\.br|pages\.dev)$/.test(host) ? "https://api.portalfrete.net.br" : "");
  const PREFIX = API_BASE + "/v1/pingo";

  async function api(path, opts = {}) {
    const init = { method: opts.method || "GET", credentials: "include", headers: {} };
    if (opts.body instanceof Blob) {
      init.body = opts.body;
      init.headers["Content-Type"] = opts.body.type;
    } else if (opts.body !== undefined) {
      init.body = JSON.stringify(opts.body);
      init.headers["Content-Type"] = "application/json";
    }
    let res;
    try {
      res = await fetch(PREFIX + path, init);
    } catch (e) {
      throw new ApiError("Sem conexão com o servidor. Verifique sua internet e tente novamente.", 0);
    }
    let data = {};
    try { data = await res.json(); } catch { /* sem corpo */ }
    if (!res.ok || data.ok === false) throw new ApiError(data.error || `Erro ${res.status}`, res.status);
    return data;
  }
  class ApiError extends Error { constructor(m, s) { super(m); this.status = s; } }

  const imgUrl = (u) => !u ? "" : /^(https?:|data:|blob:)/.test(u) ? u : API_BASE + u;

  const money = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (ts, withTime = false) => ts ? new Date(ts).toLocaleString("pt-BR", withTime
    ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  const onlyDigits = (v) => String(v || "").replace(/\D/g, "");

  const masks = {
    cep: (v) => onlyDigits(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2"),
    cpf: (v) => onlyDigits(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"),
    phone: (v) => {
      const d = onlyDigits(v).slice(0, 11);
      if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
      return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
    }
  };
  function bindMasks(root = document) {
    root.querySelectorAll("[data-mask]").forEach((el) => {
      if (el._masked) return;
      el._masked = true;
      el.addEventListener("input", () => { el.value = masks[el.dataset.mask](el.value); });
      if (el.value) el.value = masks[el.dataset.mask](el.value);
    });
  }

  function validCpf(v) {
    const cpf = onlyDigits(v);
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
    let s = 0; for (let i = 0; i < 9; i++) s += +cpf[i] * (10 - i);
    let d = (s * 10) % 11; if (d === 10) d = 0; if (d !== +cpf[9]) return false;
    s = 0; for (let i = 0; i < 10; i++) s += +cpf[i] * (11 - i);
    d = (s * 10) % 11; if (d === 10) d = 0; return d === +cpf[10];
  }

  const STATUS = {
    aguardando_pagamento: { label: "Aguardando pagamento", tone: "warn" },
    pago: { label: "Pagamento aprovado", tone: "ok" },
    em_separacao: { label: "Em separação", tone: "info" },
    enviado: { label: "Enviado", tone: "info" },
    entregue: { label: "Entregue", tone: "ok" },
    cancelado: { label: "Cancelado", tone: "bad" }
  };
  const GENDER_LABEL = { menina: "Menina", menino: "Menino", bebe: "Bebê", unissex: "Unissex" };

  const ICONS = {
    dress: '<path d="M9 3h6l1 4-2 1.5L18 21H6l4-12.5L8 7z"/><path d="M10 3c0 1.5.9 2.5 2 2.5S14 4.5 14 3"/>',
    skirt: '<path d="M8 4h8l3 16H5z"/><path d="M8 7h8"/><path d="M10 7l-1.5 13M14 7l1.5 13M12 7v13"/>',
    bow: '<path d="M12 12L4 7v10zM12 12l8-5v10z"/><circle cx="12" cy="12" r="1.8"/>',
    shirt: '<path d="M8 4L4 7l2 3.5 2-1V20h8V9.5l2 1L20 7l-4-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z"/>',
    shorts: '<path d="M6 4h12l1.5 10-5 1-2.5-6-2.5 6-5-1z"/><path d="M6 6.5h12"/>',
    cap: '<path d="M4 15c0-5 3.6-8.5 8-8.5S20 10 20 15z"/><path d="M4 15h17.5"/><circle cx="12" cy="6" r=".8"/>',
    body: '<path d="M8.5 3.5L4 6.5l1.8 3 2.2-1V15l1.5 4.5h5L16 15V8.5l2.2 1 1.8-3-4.5-3c-.5 1.4-1.9 2.3-3.5 2.3s-3-.9-3.5-2.3z"/><path d="M10 19.5h4"/>',
    shoe: '<path d="M3 16v-5l4-.5 3 2 5 1 5 1.5V18H3z"/><path d="M3 16h17"/>',
    gift: '<path d="M4 9h16v4H4zM6 13h12v8H6zM12 9v12"/><path d="M12 9C9 9 7.5 7.8 7.5 6.3S9.2 4 12 9zm0 0c3 0 4.5-1.2 4.5-2.7S14.8 4 12 9z"/>'
  };
  const UI = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    heart: '<path d="M12 20s-7.5-4.6-9-9.3C2 7.4 4.3 4.5 7.4 4.5c1.9 0 3.4 1 4.6 2.6 1.2-1.6 2.7-2.6 4.6-2.6 3.1 0 5.4 2.9 4.4 6.2C19.5 15.4 12 20 12 20z"/>',
    bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    truck: '<path d="M3 6h11v10H3zM14 9h4l3 3.5V16h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    refresh: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
    pix: '<path d="M12 3l3.5 3.5L12 10 8.5 6.5zM12 14l3.5 3.5L12 21l-3.5-3.5zM3 12l3.5-3.5L10 12l-3.5 3.5zM14 12l3.5-3.5L21 12l-3.5 3.5z"/>',
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    chevronL: '<path d="M15 6l-6 6 6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    box: '<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.8 2.9-6 6.5-6s6.5 2.2 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.2.6 3.5 2.6 3.5 5.7"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    ticket: '<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 0 0-4V6H3z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8.5 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8c-1-.4-1.8-1.2-2.2-2.2l.8-1-1-2z"/>',
    instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".8"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><path d="M7 14h10v7H7z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
    store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3"/>'
  };
  const svg = (name, size = 20, extra = "") =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${UI[name] || ICONS[name] || ""}</svg>`;
  const productIcon = (name, size = 64) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.gift}</svg>`;

  let toastTimer;
  function toast(msg, tone = "ok") {
    let el = document.getElementById("pc-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "pc-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.className = "pc-toast " + tone;
    el.innerHTML = svg(tone === "bad" ? "close" : "check", 16) + `<span>${esc(msg)}</span>`;
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  /** Redimensiona e converte imagem para WEBP antes do upload (economiza espaço e acelera a loja). */
  function compressImage(file, maxSide = 1400, quality = 0.84) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => b ? resolve(b) : reject(new Error("Falha ao processar imagem.")), "image/webp", quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Arquivo de imagem inválido.")); };
      img.src = url;
    });
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    }
  }

  const waLink = (phone, text) => {
    let d = onlyDigits(phone);
    if (d && d.length <= 11) d = "55" + d;
    return `https://wa.me/${d}?text=${encodeURIComponent(text || "")}`;
  };

  window.PC = { api, ApiError, API_BASE, imgUrl, money, esc, fmtDate, onlyDigits, masks, bindMasks, validCpf, STATUS, GENDER_LABEL, svg, productIcon, toast, compressImage, copyText, waLink };
})();
