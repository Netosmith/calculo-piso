/* Pingo Chic — painel administrativo (acesso restrito) */
(function () {
  "use strict";
  const { api, money, esc, svg, productIcon, toast, imgUrl, masks, onlyDigits, STATUS, GENDER_LABEL, fmtDate, compressImage, copyText, waLink } = PC;
  const LOGO = "../assets/pingochic/img/logo-256.webp", BEE = "../assets/pingochic/img/bee-120.webp";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const A = { admin: null, view: "dashboard", products: [], orders: [], customers: [], settings: null, banners: [], coupons: [], filters: {} };
  window.PCAdminState = A;
  const ORDER_FLOW = ["aguardando_pagamento", "pago", "em_separacao", "enviado", "entregue", "cancelado"];
  const COLORS = ["Rosa", "Azul", "Amarelo", "Verde", "Cinza", "Branco", "Bege", "Preto", "Vermelho", "Lilás", "Marrom", "Laranja", "Estampado"];
  const SIZE_PRESETS = { "Bebê": ["RN", "P", "M", "G"], "Infantil": ["1", "2", "3", "4", "6", "8"], "Juvenil": ["10", "12", "14", "16"], "Único": ["Único"] };
  const ICONS = [["dress", "Vestido"], ["skirt", "Saia"], ["shirt", "Camiseta"], ["shorts", "Bermuda"], ["body", "Body"], ["bow", "Laço"], ["cap", "Boné"], ["shoe", "Calçado"]];

  /* ============================== LOGIN ============================== */
  async function init() {
    try {
      const { admin } = await api("/admin/me");
      if (admin) { A.admin = admin; return renderShell(); }
    } catch { /* sem sessão */ }
    renderLogin();
  }

  function renderLogin(msg = "") {
    document.body.innerHTML = `
      <div class="login">
        <div class="login-art">
          <div class="brand"><img class="mk bee" src="${BEE}" alt=""><span class="wm">Pingo<em>Chic</em></span><small>Admin</small></div>
          <div><img class="login-logo" src="../assets/pingochic/img/logo-512.webp" alt="Pingo Chic"><h1>Gestão da sua loja em <em>um só lugar</em>.</h1><p>Produtos, estoque por tamanho, pedidos, clientes, cupons e frete para todo o Brasil.</p></div>
          <p style="font-size:12px;color:#6C7181">${svg("lock", 14)} Área restrita a administradores autorizados. Todos os acessos são registrados.</p>
          <div class="blob"></div>
        </div>
        <div class="login-form">
          <form id="lf" novalidate>
            <img class="mobile-logo" src="${LOGO}" alt="Pingo Chic">
            <h2>Acesso administrativo</h2>
            <p class="sub">Entre com seu e-mail e senha de administrador.</p>
            <div class="form-err ${msg ? "show" : ""}" id="le">${esc(msg)}</div>
            <div class="field"><label>E-mail</label><input id="l-email" type="email" autocomplete="username" required></div>
            <div class="field"><label>Senha</label><input id="l-pass" type="password" autocomplete="current-password" required></div>
            <button class="btn btn-dark btn-lg btn-block" id="lb">Entrar no painel</button>
            <p style="text-align:center;margin-top:22px"><a href="pingochic.html" class="muted" style="font-size:13px">← Voltar para a loja</a></p>
          </form>
        </div>
      </div>`;
    $("#l-email").focus();
    $("#lf").onsubmit = async (e) => {
      e.preventDefault();
      const btn = $("#lb"), err = $("#le");
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        const r = await api("/admin/login", { method: "POST", body: { email: $("#l-email").value, password: $("#l-pass").value } });
        A.admin = r.admin; renderShell();
      } catch (ex) {
        err.textContent = ex.message; err.classList.add("show");
        btn.disabled = false; btn.textContent = "Entrar no painel";
      }
    };
  }

  /* ============================== SHELL ============================== */
  const NAV = [
    ["dashboard", "chart", "Visão geral"], ["pedidos", "box", "Pedidos"], ["produtos", "tag", "Produtos"], ["clientes", "users", "Clientes"],
    "Marketing", ["banners", "image", "Banners"], ["cupons", "ticket", "Cupons"],
    "Loja", ["config", "gear", "Configurações"], ["admins", "lock", "Administradores"]
  ];
  function renderShell() {
    document.body.innerHTML = `
      <div class="mobile-top"><button class="icon-btn" id="mm" style="background:none;border-color:#333;color:#fff">${svg("menu", 18)}</button><div class="brand" style="font-size:18px"><img class="mk bee" src="${BEE}" alt="" style="width:36px"><span class="wm">Pingo<em>Chic</em></span></div><a class="icon-btn" href="pingochic.html" target="_blank" style="background:none;border-color:#333;color:#fff">${svg("store", 18)}</a></div>
      <div class="shell">
        <aside class="side" id="side">
          <div class="brand"><img class="mk bee" src="${BEE}" alt=""><span class="wm">Pingo<em>Chic</em></span><small>Admin</small></div>
          <nav id="nav">${NAV.map((n) => typeof n === "string" ? `<div class="sep">${n}</div>` : `<button data-view="${n[0]}">${svg(n[1], 18)} ${n[2]}${n[0] === "pedidos" ? '<span class="badge" id="pend-badge" style="display:none"></span>' : ""}</button>`).join("")}
            <div class="sep">Atalhos</div>
            <button onclick="window.open('pingochic.html','_blank')">${svg("store", 18)} Ver loja</button>
          </nav>
          <div class="me"><span class="av">${esc((A.admin.name || "A")[0])}</span><div><b>${esc(A.admin.name)}</b><span>${esc(A.admin.email)}</span></div><button id="logout" title="Sair">${svg("logout", 18)}</button></div>
        </aside>
        <main class="main" id="main"></main>
      </div>
      <div class="ov" id="ov"></div>
      <aside class="sheet" id="sheet"></aside>`;
    $("#nav").onclick = (e) => { const b = e.target.closest("[data-view]"); if (b) go(b.dataset.view); };
    $("#mm").onclick = () => $("#side").classList.toggle("open");
    $("#ov").onclick = closeSheet;
    $("#logout").onclick = async () => { await api("/admin/logout", { method: "POST" }).catch(() => {}); A.admin = null; renderLogin(); };
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
    window.addEventListener("hashchange", () => go(location.hash.slice(1) || "dashboard", false));
    go(location.hash.slice(1) || "dashboard", false);
  }

  function go(view, push = true) {
    if (!NAV.some((n) => n[0] === view)) view = "dashboard";
    A.view = view;
    if (push && location.hash.slice(1) !== view) history.replaceState(null, "", "#" + view);
    $$("#nav [data-view]").forEach((b) => b.classList.toggle("on", b.dataset.view === view));
    $("#side").classList.remove("open");
    closeSheet();
    ({ dashboard: viewDashboard, pedidos: viewOrders, produtos: viewProducts, clientes: viewCustomers, banners: viewBanners, cupons: viewCoupons, config: viewConfig, admins: viewAdmins })[view]();
  }

  const main = () => $("#main");
  function loading(title) { main().innerHTML = `<div class="topbar"><div><h1>${title}</h1></div></div><div class="skeleton" style="height:320px"></div>`; }
  function fail(e) {
    if (e.status === 401) { renderLogin("Sua sessão expirou. Entre novamente."); return; }
    main().innerHTML = `<div class="card empty"><b>Não foi possível carregar.</b><p>${esc(e.message)}</p><button class="btn btn-dark" onclick="location.reload()">Recarregar</button></div>`;
  }
  async function guard(fn) { try { return await fn(); } catch (e) { if (e.status === 401) { renderLogin("Sua sessão expirou. Entre novamente."); throw e; } toast(e.message, "bad"); throw e; } }
  const statusPill = (s) => { const x = STATUS[s] || { label: s, tone: "mute" }; return `<span class="status ${x.tone}">${x.label}</span>`; };
  const thumb = (p, size = 22) => p.images?.[0] || p.image ? `<img src="${esc(imgUrl(p.images?.[0] || p.image))}" alt="">` : productIcon(p.icon, size);
  const stockOf = (p) => (p.sizes || []).reduce((a, s) => a + s.stock, 0);
  function setPending(n) { const b = $("#pend-badge"); if (b) { b.textContent = n; b.style.display = n ? "" : "none"; } }

  function openSheet(html) {
    $("#sheet").innerHTML = html;
    $("#sheet").classList.add("open"); $("#ov").classList.add("open");
  }
  function closeSheet() { $("#sheet")?.classList.remove("open"); $("#ov")?.classList.remove("open"); }

  /* ============================== DASHBOARD ============================== */
  async function viewDashboard() {
    loading("Visão geral");
    let d;
    try { d = await api("/admin/dashboard"); } catch (e) { return fail(e); }
    const s = d.stats; setPending(s.pending);
    const max = Math.max(1, ...d.days.map((x) => x.total));
    const h = new Date().getHours();
    main().innerHTML = `
      <div class="topbar"><div><h1>${h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"}, ${esc(A.admin.name.split(" ")[0])}</h1><p>Resumo da sua loja hoje, ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}.</p></div>
        <div style="display:flex;gap:8px"><button class="btn btn-line" data-go="pedidos">${svg("box", 16)} Pedidos</button><button class="btn btn-dark" id="new-p">${svg("plus", 16)} Novo produto</button></div></div>
      <div class="stats">
        ${stat("Vendas hoje", money(s.todayTotal), `${s.todayOrders} pedido(s) pago(s)`, "chart", "var(--rose-s)", "var(--rose)")}
        ${stat("Vendas no mês", money(s.monthTotal), `${s.monthOrders} pedido(s) · ticket médio ${money(s.avgTicket)}`, "card", "var(--sky-s)", "var(--sky)")}
        ${stat("Aguardando pagamento", s.pending, "Confirme os Pix recebidos", "pix", "var(--warn-s)", "var(--warn)")}
        ${stat("Para enviar", s.toShip, `${s.customers} cliente(s) cadastrado(s)`, "truck", "var(--sage-s)", "var(--sage)")}
      </div>
      <div class="grid-2">
        <div class="card"><h3>Vendas dos últimos 14 dias <span class="muted" style="font-weight:500;font-size:12.5px">pedidos pagos</span></h3>
          <div class="chart">${d.days.map((x) => `<div class="b"><i style="height:${(x.total / max) * 100}%" data-v="${money(x.total)} · ${x.orders} ped."></i><span>${new Date(x.date).getDate()}</span></div>`).join("")}</div>
        </div>
        <div class="card"><h3>Mais vendidos</h3>${d.top.length ? d.top.map((p, i) => `<div class="list-row"><div class="pcell"><span class="muted" style="width:14px">${i + 1}</span><div class="th" style="width:36px;height:42px">${thumb(p, 18)}</div><b>${esc(p.name)}</b></div><b>${p.sold} un.</b></div>`).join("") : `<p class="muted">As vendas aparecerão aqui.</p>`}</div>
      </div>
      <div class="grid-2" style="margin-top:18px">
        <div class="card"><h3>Pedidos recentes <button class="btn btn-line btn-sm" data-go="pedidos">Ver todos</button></h3>
          ${d.recent.length ? `<div style="overflow:auto"><table style="min-width:520px"><tbody>${d.recent.map((o) => `<tr class="click" data-order="${o.id}"><td><b>#${o.number}</b><div class="muted" style="font-size:12px">${fmtDate(o.createdAt, true)}</div></td><td>${esc(o.customer.name)}<div class="muted" style="font-size:12px">${esc(o.address.cidade)}/${esc(o.address.uf)}</div></td><td>${statusPill(o.status)}</td><td class="right"><b>${money(o.total)}</b></td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">Nenhum pedido ainda.</p>`}
        </div>
        <div class="card"><h3>Estoque baixo <span class="muted" style="font-weight:500;font-size:12.5px">≤ 2 un.</span></h3>${d.low.length ? d.low.map((x) => `<div class="list-row"><span>${esc(x.name)} <span class="muted">· Tam. ${esc(x.size)}</span></span><span class="status ${x.stock ? "warn" : "bad"}">${x.stock ? x.stock + " un." : "Esgotado"}</span></div>`).join("") : `<p class="muted">Tudo certo com o estoque.</p>`}</div>
      </div>`;
    $("#new-p").onclick = async () => { await ensureProducts(); productForm(); };
    main().onclick = async (e) => {
      const g = e.target.closest("[data-go]"); if (g) return go(g.dataset.go);
      const r = e.target.closest("[data-order]"); if (r) { await ensureOrders(true); orderDetail(Number(r.dataset.order)); }
    };
  }
  const stat = (l, v, d, ic, bg, fg) => `<div class="stat"><div class="l"><i style="background:${bg};color:${fg}">${svg(ic, 16)}</i>${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;

  /* ============================== PEDIDOS ============================== */
  async function ensureOrders(force = false) { if (force || !A.orders.length) A.orders = (await api("/admin/orders")).orders; }
  async function viewOrders() {
    loading("Pedidos");
    try { await ensureOrders(true); } catch (e) { return fail(e); }
    setPending(A.orders.filter((o) => o.status === "aguardando_pagamento").length);
    const f = A.filters.orders ||= { status: "", q: "" };
    const counts = Object.fromEntries(ORDER_FLOW.map((s) => [s, A.orders.filter((o) => o.status === s).length]));
    main().innerHTML = `
      <div class="topbar"><div><h1>Pedidos</h1><p>${A.orders.length} pedido(s) no total</p></div><button class="btn btn-line" id="csv">${svg("download", 16)} Exportar CSV</button></div>
      <div class="filters">
        <div class="seg" id="seg"><button data-s="" class="${!f.status ? "on" : ""}">Todos</button>${ORDER_FLOW.map((s) => `<button data-s="${s}" class="${f.status === s ? "on" : ""}">${STATUS[s].label} (${counts[s]})</button>`).join("")}</div>
        <input class="inp" id="oq" placeholder="Buscar por nº, nome, e-mail, CPF ou cidade…" value="${esc(f.q)}">
      </div>
      <div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Destino</th><th>Pagamento</th><th>Status</th><th class="right">Total</th></tr></thead><tbody id="orows"></tbody></table></div>`;
    const draw = () => {
      const q = f.q.toLowerCase().trim();
      const rows = A.orders.filter((o) => (!f.status || o.status === f.status) && (!q || `${o.number} ${o.customer.name} ${o.email} ${o.customer.cpf} ${o.address.cidade} ${o.address.uf}`.toLowerCase().includes(q)));
      $("#orows").innerHTML = rows.length ? rows.map((o) => `<tr class="click" data-order="${o.id}">
        <td><b>#${o.number}</b><div class="muted" style="font-size:12px">${fmtDate(o.createdAt, true)}</div></td>
        <td>${esc(o.customer.name)}<div class="muted" style="font-size:12px">${esc(o.email)}</div></td>
        <td>${esc(o.address.cidade)}/${esc(o.address.uf)}<div class="muted" style="font-size:12px">${o.items.reduce((a, i) => a + i.qty, 0)} item(ns)</div></td>
        <td>${o.payment === "pix" ? "Pix" : `Cartão ${o.installments}x`}</td>
        <td>${statusPill(o.status)}</td><td class="right"><b>${money(o.total)}</b></td></tr>`).join("") : `<tr><td colspan="6" class="empty">Nenhum pedido encontrado.</td></tr>`;
    };
    draw();
    $("#seg").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; f.status = b.dataset.s; $$("#seg button").forEach((x) => x.classList.toggle("on", x === b)); draw(); };
    $("#oq").oninput = (e) => { f.q = e.target.value; draw(); };
    $("#orows").onclick = (e) => { const r = e.target.closest("[data-order]"); if (r) orderDetail(Number(r.dataset.order)); };
    $("#csv").onclick = exportOrders;
  }

  function orderDetail(id) {
    const o = A.orders.find((x) => x.id === id); if (!o) return;
    const a = o.address, c = o.customer;
    const next = { aguardando_pagamento: "pago", pago: "em_separacao", em_separacao: "enviado", enviado: "entregue" }[o.status];
    const nextLabel = { pago: "Confirmar pagamento", em_separacao: "Iniciar separação", enviado: "Marcar como enviado", entregue: "Marcar como entregue" }[next];
    const waMsg = `Olá, ${c.name.split(" ")[0]}! Aqui é da Pingo Chic 💕 Sobre o seu pedido #${o.number}: `;
    openSheet(`
      <div class="sheet-head"><div><h2>Pedido #${o.number}</h2><div class="muted" style="font-size:12.5px">${fmtDate(o.createdAt, true)}</div></div><div style="display:flex;gap:8px;align-items:center">${statusPill(o.status)}<button class="icon-btn" id="print" title="Imprimir">${svg("print", 16)}</button><button class="icon-btn" data-close>${svg("close", 16)}</button></div></div>
      <div class="sheet-body">
        ${next && o.status !== "cancelado" ? `<div class="card" style="background:#FAFAFB;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><b>Próxima etapa</b><div class="muted" style="font-size:12.5px">${o.status === "aguardando_pagamento" ? (o.payment === "pix" ? "Confira no extrato o Pix de " + money(o.total) : "Envie o link de pagamento do cartão ao cliente") : "Atualize o status para o cliente acompanhar"}</div></div><button class="btn btn-dark" data-status="${next}">${svg("check", 16)} ${nextLabel}</button></div>` : ""}
        <div class="sec-t">Itens</div>
        ${o.items.map((i) => `<div class="oline"><div class="pcell"><div class="th">${thumb(i, 20)}</div></div><div><b>${esc(i.name)}</b><div class="muted" style="font-size:12.5px">Tam. ${esc(i.size)} · ${i.qty} × ${money(i.price)}</div></div><b>${money(i.lineTotal)}</b></div>`).join("")}
        <dl class="kv" style="margin-top:14px">
          <dt>Subtotal</dt><dd>${money(o.subtotal)}</dd>
          ${o.discount ? `<dt>Cupom ${esc(o.coupon?.code)}</dt><dd style="color:var(--sage)">−${money(o.discount)}</dd>` : ""}
          ${o.pixDiscount ? `<dt>Desconto Pix</dt><dd style="color:var(--sage)">−${money(o.pixDiscount)}</dd>` : ""}
          <dt>Frete</dt><dd>${o.shipping?.free ? "Grátis" : money(o.shipping?.price)} · ${esc(o.shipping?.region || "")} (${esc(o.shipping?.days || "")})</dd>
          <dt><b>Total</b></dt><dd><b style="font-size:16px">${money(o.total)}</b> · ${o.payment === "pix" ? "Pix" : `Cartão em ${o.installments}x`}</dd>
        </dl>
        <div class="grid-2e" style="margin-top:6px">
          <div><div class="sec-t">Cliente</div><dl class="kv" style="grid-template-columns:70px 1fr">
            <dt>Nome</dt><dd>${esc(c.name)} ${o.customerId ? '<span class="status ok" style="font-size:10px">Cadastrado</span>' : '<span class="status mute" style="font-size:10px">Convidado</span>'}</dd>
            <dt>E-mail</dt><dd><a href="mailto:${esc(o.email)}">${esc(o.email)}</a></dd>
            <dt>Celular</dt><dd>${esc(masks.phone(c.phone))}</dd><dt>CPF</dt><dd>${esc(masks.cpf(c.cpf))}</dd></dl>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="${waLink(c.phone, waMsg)}">${svg("whatsapp", 14)} WhatsApp</a><a class="btn btn-line btn-sm" href="mailto:${esc(o.email)}?subject=${encodeURIComponent("Seu pedido Pingo Chic #" + o.number)}">${svg("mail", 14)} E-mail</a></div>
          </div>
          <div><div class="sec-t">Entrega</div><div style="font-size:13.5px;line-height:1.6" id="addr">${esc(c.name)}<br>${esc(a.rua)}, ${esc(a.numero)}${a.complemento ? " – " + esc(a.complemento) : ""}<br>${esc(a.bairro)} – ${esc(a.cidade)}/${esc(a.uf)}<br>CEP ${esc(masks.cep(a.cep))}</div>
            <button class="btn btn-line btn-sm" id="copy-addr" style="margin-top:10px">${svg("copy", 14)} Copiar endereço</button></div>
        </div>
        ${o.notes ? `<div class="sec-t">Observação do cliente</div><div class="card" style="padding:14px;background:var(--warn-s);border-color:#F1DFC0">${esc(o.notes)}</div>` : ""}
        <div class="sec-t">Gestão</div>
        <div class="row">
          <div class="field"><label>Status</label><select id="o-status" ${o.status === "cancelado" ? "disabled" : ""}>${ORDER_FLOW.map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${STATUS[s].label}</option>`).join("")}</select></div>
          <div class="field"><label>Código de rastreio</label><input id="o-track" value="${esc(o.tracking || "")}" placeholder="Ex: AA123456789BR" style="text-transform:uppercase"></div>
        </div>
        <div class="field"><label>Anotação interna <span class="muted" style="font-weight:400">(o cliente não vê)</span></label><textarea id="o-note" rows="2">${esc(o.adminNote || "")}</textarea></div>
        <div class="sec-t">Histórico</div>
        <div class="hist">${(o.history || []).map((h) => `<div><b>${STATUS[h.status]?.label || h.status}</b> <span class="muted">· ${fmtDate(h.at, true)}${h.by ? " · " + esc(h.by) : ""}</span></div>`).join("")}</div>
      </div>
      <div class="sheet-foot"><button class="btn btn-line" data-close>Fechar</button><button class="btn btn-dark" id="o-save">Salvar alterações</button></div>`);
    const sheet = $("#sheet");
    sheet.onclick = async (e) => {
      if (e.target.closest("[data-close]")) return closeSheet();
      const st = e.target.closest("[data-status]");
      if (st) {
        if (st.dataset.status === "enviado" && !$("#o-track").value.trim() && !confirm("Marcar como enviado sem código de rastreio?")) return;
        await saveOrder(o.id, { status: st.dataset.status, tracking: $("#o-track").value.trim().toUpperCase() });
      }
    };
    $("#copy-addr").onclick = async () => { await copyText($("#addr").innerText); toast("Endereço copiado"); };
    $("#print").onclick = () => window.print();
    $("#o-save").onclick = async () => {
      const status = $("#o-status").value;
      if (status === "cancelado" && o.status !== "cancelado" && !confirm(`Cancelar o pedido #${o.number}? Os itens voltarão ao estoque.`)) return;
      await saveOrder(o.id, { status, tracking: $("#o-track").value.trim().toUpperCase(), adminNote: $("#o-note").value });
    };
  }
  async function saveOrder(id, body) {
    try {
      const { order } = await guard(() => api("/admin/orders/" + id, { method: "PUT", body }));
      A.orders = A.orders.map((x) => x.id === id ? order : x);
      toast("Pedido atualizado");
      if (A.view === "pedidos") { await viewOrders(); } else if (A.view === "dashboard") { viewDashboard(); }
      orderDetail(id);
    } catch { /* toast já exibido */ }
  }
  function exportOrders() {
    const head = ["Pedido", "Data", "Status", "Cliente", "E-mail", "Celular", "CPF", "CEP", "Endereço", "Cidade", "UF", "Itens", "Subtotal", "Desconto", "Frete", "Total", "Pagamento", "Rastreio"];
    const rows = A.orders.map((o) => [o.number, fmtDate(o.createdAt, true), STATUS[o.status]?.label, o.customer.name, o.email, o.customer.phone, o.customer.cpf, o.address.cep, `${o.address.rua}, ${o.address.numero} ${o.address.complemento || ""} - ${o.address.bairro}`, o.address.cidade, o.address.uf,
      o.items.map((i) => `${i.qty}x ${i.name} (${i.size})`).join(" | "), o.subtotal, (o.discount || 0) + (o.pixDiscount || 0), o.shipping?.price || 0, o.total, o.payment === "pix" ? "Pix" : `Cartão ${o.installments}x`, o.tracking || ""]);
    downloadCsv("pedidos-pingochic.csv", [head, ...rows]);
  }
  function downloadCsv(name, rows) {
    const csv = "\ufeff" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }

  /* ============================== PRODUTOS ============================== */
  async function ensureProducts(force = false) { if (force || !A.products.length) A.products = (await api("/admin/products")).products; }
  async function viewProducts() {
    loading("Produtos");
    try { await ensureProducts(true); } catch (e) { return fail(e); }
    const f = A.filters.products ||= { q: "", g: "", st: "" };
    main().innerHTML = `
      <div class="topbar"><div><h1>Produtos</h1><p>${A.products.length} produto(s) · ${A.products.filter((p) => p.active).length} visível(is) na loja</p></div><button class="btn btn-dark" id="new-p">${svg("plus", 16)} Novo produto</button></div>
      <div class="filters">
        <input class="inp" id="pq" placeholder="Buscar por nome, SKU ou categoria…" value="${esc(f.q)}">
        <select class="inp" id="pg"><option value="">Todos os públicos</option>${Object.entries(GENDER_LABEL).map(([k, v]) => `<option value="${k}" ${f.g === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <select class="inp" id="ps"><option value="">Qualquer situação</option><option value="on" ${f.st === "on" ? "selected" : ""}>Ativos</option><option value="off" ${f.st === "off" ? "selected" : ""}>Ocultos</option><option value="low" ${f.st === "low" ? "selected" : ""}>Estoque baixo</option><option value="out" ${f.st === "out" ? "selected" : ""}>Esgotados</option></select>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Produto</th><th>Público</th><th>Preço</th><th>Estoque por tamanho</th><th>Vendidos</th><th>Visível</th><th></th></tr></thead><tbody id="prows"></tbody></table></div>`;
    const draw = () => {
      const q = f.q.toLowerCase().trim();
      const rows = A.products.filter((p) => (!q || `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(q)) && (!f.g || p.gender === f.g) &&
        (!f.st || (f.st === "on" && p.active) || (f.st === "off" && !p.active) || (f.st === "low" && p.sizes.some((s) => s.stock > 0 && s.stock <= 2)) || (f.st === "out" && stockOf(p) === 0)));
      $("#prows").innerHTML = rows.length ? rows.map((p) => `<tr>
        <td><div class="pcell"><div class="th" style="${p.gender === "menino" ? "background:var(--sky-s);color:var(--sky)" : p.gender === "bebe" ? "background:#FDF5E4;color:#E7B04A" : ""}">${thumb(p)}</div><div><b>${esc(p.name)}</b><span>${esc(p.category)}${p.sku ? " · " + esc(p.sku) : ""}${p.featured ? " · ★ Destaque" : ""}</span></div></div></td>
        <td>${GENDER_LABEL[p.gender] || "—"}</td>
        <td><b>${money(p.price)}</b>${p.compareAt ? `<div class="muted" style="font-size:12px;text-decoration:line-through">${money(p.compareAt)}</div>` : ""}</td>
        <td><div style="display:flex;gap:4px;flex-wrap:wrap">${p.sizes.map((s) => `<span class="status ${s.stock === 0 ? "bad" : s.stock <= 2 ? "warn" : "mute"}" style="padding:3px 8px" title="Tamanho ${esc(s.size)}">${esc(s.size)}: ${s.stock}</span>`).join("")}</div></td>
        <td>${p.sold || 0}</td>
        <td><label class="switch"><input type="checkbox" data-toggle="${p.id}" ${p.active ? "checked" : ""}><span></span></label></td>
        <td class="right" style="white-space:nowrap"><button class="icon-btn" data-edit="${p.id}" title="Editar">${svg("edit", 16)}</button> <button class="icon-btn" data-dup="${p.id}" title="Duplicar">${svg("copy", 16)}</button></td></tr>`).join("") : `<tr><td colspan="7" class="empty">Nenhum produto encontrado.</td></tr>`;
    };
    draw();
    $("#pq").oninput = (e) => { f.q = e.target.value; draw(); };
    $("#pg").onchange = (e) => { f.g = e.target.value; draw(); };
    $("#ps").onchange = (e) => { f.st = e.target.value; draw(); };
    $("#new-p").onclick = () => productForm();
    $("#prows").onclick = (e) => {
      const ed = e.target.closest("[data-edit]"); if (ed) return productForm(A.products.find((p) => p.id === Number(ed.dataset.edit)));
      const du = e.target.closest("[data-dup]"); if (du) { const p = A.products.find((x) => x.id === Number(du.dataset.dup)); productForm({ ...p, id: null, name: p.name + " (cópia)", sizes: p.sizes.map((s) => ({ ...s, stock: 0 })), active: false }); }
    };
    $("#prows").onchange = async (e) => {
      const t = e.target.closest("[data-toggle]"); if (!t) return;
      try {
        const { product } = await guard(() => api("/admin/products/" + t.dataset.toggle, { method: "PUT", body: { active: t.checked } }));
        A.products = A.products.map((p) => p.id === product.id ? product : p);
        toast(t.checked ? "Produto visível na loja" : "Produto ocultado da loja");
      } catch { t.checked = !t.checked; }
    };
  }

  function productForm(p = null) {
    const editing = p && p.id;
    const P = p ? JSON.parse(JSON.stringify(p)) : { name: "", gender: "menina", category: "", price: "", compareAt: "", sku: "", color: "Rosa", sizes: SIZE_PRESETS.Infantil.map((s) => ({ size: s, stock: 0 })), images: [], desc: "", composition: "", featured: false, active: true, icon: "dress" };
    const cats = [...new Set(A.products.map((x) => x.category).filter(Boolean))].sort();
    openSheet(`
      <div class="sheet-head"><h2>${editing ? "Editar produto" : "Novo produto"}</h2><button class="icon-btn" data-close>${svg("close", 16)}</button></div>
      <div class="sheet-body">
        <div class="sec-t">Fotos <span style="text-transform:none;letter-spacing:0;font-weight:500">· a primeira é a capa · JPG/PNG/WEBP, otimizadas automaticamente</span></div>
        <div class="imgs" id="imgs"></div>
        <div class="sec-t">Informações</div>
        <div class="field"><label>Nome do produto *</label><input id="f-name" value="${esc(P.name)}" placeholder="Ex: Vestido Florido Jardim"></div>
        <div class="row">
          <div class="field"><label>Público</label><select id="f-gender">${Object.entries(GENDER_LABEL).map(([k, v]) => `<option value="${k}" ${P.gender === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
          <div class="field"><label>Categoria</label><input id="f-cat" list="cats" value="${esc(P.category)}" placeholder="Ex: Vestidos, Bodies, Acessórios"><datalist id="cats">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist><div class="hint">Use "Acessórios" para aparecer na seção de acessórios.</div></div>
        </div>
        <div class="row">
          <div class="field"><label>Preço de venda (R$) *</label><input id="f-price" inputmode="decimal" value="${P.price ? Number(P.price).toFixed(2).replace(".", ",") : ""}" placeholder="89,90"></div>
          <div class="field"><label>Preço "de" (R$)</label><input id="f-compare" inputmode="decimal" value="${P.compareAt ? Number(P.compareAt).toFixed(2).replace(".", ",") : ""}" placeholder="Opcional — exibe como oferta"></div>
          <div class="field"><label>SKU / Código</label><input id="f-sku" value="${esc(P.sku || "")}" placeholder="Opcional"></div>
        </div>
        <div class="row">
          <div class="field"><label>Cor</label><input id="f-color" list="colors" value="${esc(P.color || "")}"><datalist id="colors">${COLORS.map((c) => `<option value="${c}">`).join("")}</datalist></div>
          <div class="field"><label>Ícone (quando não houver foto)</label><select id="f-icon">${ICONS.map(([k, l]) => `<option value="${k}" ${P.icon === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        </div>
        <div class="sec-t">Tamanhos e estoque</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${Object.keys(SIZE_PRESETS).map((k) => `<button class="btn btn-line btn-sm" data-preset="${k}">+ ${k}</button>`).join("")}<input class="inp" id="new-size" placeholder="Outro tamanho" style="max-width:140px;padding:6px 10px"><button class="btn btn-line btn-sm" id="add-size">${svg("plus", 14)}</button></div>
        <div class="size-grid" id="sizes"></div>
        <div class="hint muted" style="font-size:12px;margin-top:8px" id="stock-total"></div>
        <div class="sec-t">Descrição</div>
        <div class="field"><textarea id="f-desc" rows="5" placeholder="Conte os detalhes: tecido, modelagem, ocasião de uso…">${esc(P.desc || "")}</textarea></div>
        <div class="field"><label>Composição e cuidados</label><input id="f-comp" value="${esc(P.composition || "")}" placeholder="Ex: 100% algodão · Lavar à mão · Não usar alvejante"></div>
        <div class="sec-t">Exibição</div>
        <label class="check" style="margin-bottom:10px"><input type="checkbox" id="f-active" ${P.active ? "checked" : ""}> Visível na loja</label>
        <label class="check"><input type="checkbox" id="f-feat" ${P.featured ? "checked" : ""}> Mostrar em "Destaques da estação" na página inicial</label>
        <div class="form-err" id="f-err" style="margin-top:16px"></div>
      </div>
      <div class="sheet-foot">${editing ? `<button class="btn btn-bad" id="del" style="margin-right:auto">${svg("trash", 16)} Excluir</button>` : ""}<button class="btn btn-line" data-close>Cancelar</button><button class="btn btn-dark" id="save">${editing ? "Salvar alterações" : "Cadastrar produto"}</button></div>`);

    const drawImgs = () => {
      $("#imgs").innerHTML = P.images.map((src, i) => `<div class="im"><img src="${esc(imgUrl(src))}" alt="">${i === 0 ? '<span class="cv">Capa</span>' : ""}<button class="x" data-rm="${i}" title="Remover">${svg("close", 12)}</button><div class="mv">${i > 0 ? `<button data-mv="${i}" data-d="-1" title="Mover para a esquerda">${svg("chevronL", 12)}</button>` : ""}${i < P.images.length - 1 ? `<button data-mv="${i}" data-d="1" title="Mover para a direita">${svg("chevron", 12)}</button>` : ""}</div></div>`).join("")
        + (P.images.length < 8 ? `<label class="upload"><input type="file" accept="image/jpeg,image/png,image/webp" multiple id="up">${svg("image", 22)}<span>Adicionar fotos</span></label>` : "");
      $("#up")?.addEventListener("change", upload);
    };
    const drawSizes = () => {
      $("#sizes").innerHTML = P.sizes.map((s, i) => `<div class="size-item"><b>${esc(s.size)}</b><input type="number" min="0" value="${s.stock}" data-stock="${i}" aria-label="Estoque tamanho ${esc(s.size)}"><button data-rms="${i}" title="Remover">${svg("close", 12)}</button></div>`).join("");
      $("#stock-total").textContent = `Estoque total: ${P.sizes.reduce((a, s) => a + (Number(s.stock) || 0), 0)} unidade(s)`;
    };
    async function upload(e) {
      const files = [...e.target.files].slice(0, 8 - P.images.length);
      const lbl = e.target.closest(".upload"); lbl.innerHTML = '<span class="spinner" style="border-color:#ccc;border-top-color:#333"></span>';
      for (const f of files) {
        try {
          const blob = await compressImage(f);
          const { url } = await guard(() => api("/admin/images", { method: "POST", body: blob }));
          P.images.push(url);
        } catch { /* toast exibido */ }
      }
      drawImgs();
    }
    drawImgs(); drawSizes();

    const sheet = $("#sheet");
    sheet.onclick = (e) => {
      if (e.target.closest("[data-close]")) return closeSheet();
      const rm = e.target.closest("[data-rm]"); if (rm) { P.images.splice(Number(rm.dataset.rm), 1); return drawImgs(); }
      const mv = e.target.closest("[data-mv]"); if (mv) { const i = Number(mv.dataset.mv), j = i + Number(mv.dataset.d); [P.images[i], P.images[j]] = [P.images[j], P.images[i]]; return drawImgs(); }
      const pr = e.target.closest("[data-preset]"); if (pr) { SIZE_PRESETS[pr.dataset.preset].forEach((s) => { if (!P.sizes.some((x) => x.size === s)) P.sizes.push({ size: s, stock: 0 }); }); return drawSizes(); }
      const rs = e.target.closest("[data-rms]"); if (rs) { P.sizes.splice(Number(rs.dataset.rms), 1); return drawSizes(); }
    };
    sheet.oninput = (e) => { const s = e.target.closest("[data-stock]"); if (s) { P.sizes[Number(s.dataset.stock)].stock = Math.max(0, parseInt(s.value) || 0); $("#stock-total").textContent = `Estoque total: ${P.sizes.reduce((a, x) => a + x.stock, 0)} unidade(s)`; } };
    $("#add-size").onclick = () => { const v = $("#new-size").value.trim(); if (v && !P.sizes.some((x) => x.size === v)) { P.sizes.push({ size: v, stock: 0 }); drawSizes(); } $("#new-size").value = ""; };
    $("#f-gender").onchange = (e) => { if (!editing) $("#f-icon").value = { menina: "dress", menino: "shirt", bebe: "body", unissex: "shirt" }[e.target.value]; };
    $("#save").onclick = async () => {
      const num = (v) => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0;
      const body = {
        ...P, name: $("#f-name").value.trim(), gender: $("#f-gender").value, category: $("#f-cat").value.trim(), price: num($("#f-price").value), compareAt: num($("#f-compare").value),
        sku: $("#f-sku").value.trim(), color: $("#f-color").value.trim(), icon: $("#f-icon").value, desc: $("#f-desc").value, composition: $("#f-comp").value,
        active: $("#f-active").checked, featured: $("#f-feat").checked
      };
      const err = $("#f-err"); err.classList.remove("show");
      if (!body.name) { err.textContent = "Informe o nome do produto."; err.classList.add("show"); return; }
      if (!(body.price > 0)) { err.textContent = "Informe um preço válido."; err.classList.add("show"); return; }
      if (body.compareAt && body.compareAt <= body.price) { err.textContent = 'O preço "de" precisa ser maior que o preço de venda.'; err.classList.add("show"); return; }
      const btn = $("#save"); btn.disabled = true;
      try {
        await guard(() => api(editing ? "/admin/products/" + P.id : "/admin/products", { method: editing ? "PUT" : "POST", body }));
        toast(editing ? "Produto atualizado" : "Produto cadastrado");
        closeSheet(); A.view === "produtos" ? viewProducts() : ensureProducts(true);
      } catch { btn.disabled = false; }
    };
    $("#del")?.addEventListener("click", async () => {
      if (!confirm(`Excluir "${P.name}" definitivamente? Dica: para apenas tirar da loja, desmarque "Visível na loja".`)) return;
      try { await guard(() => api("/admin/products/" + P.id, { method: "DELETE" })); toast("Produto excluído"); closeSheet(); viewProducts(); } catch { }
    });
  }

  /* ============================== CLIENTES ============================== */
  async function viewCustomers() {
    loading("Clientes");
    try { A.customers = (await api("/admin/customers")).customers; } catch (e) { return fail(e); }
    const f = A.filters.customers ||= { q: "", t: "" };
    main().innerHTML = `
      <div class="topbar"><div><h1>Clientes</h1><p>${A.customers.filter((c) => c.registered).length} com conta · ${A.customers.filter((c) => !c.registered).length} compraram como convidado</p></div><button class="btn btn-line" id="csv">${svg("download", 16)} Exportar CSV</button></div>
      <div class="filters"><input class="inp" id="cq" placeholder="Buscar por nome, e-mail ou telefone…" value="${esc(f.q)}">
        <div class="seg" id="ct"><button data-t="" class="${!f.t ? "on" : ""}">Todos</button><button data-t="reg" class="${f.t === "reg" ? "on" : ""}">Com conta</button><button data-t="guest" class="${f.t === "guest" ? "on" : ""}">Convidados</button><button data-t="news" class="${f.t === "news" ? "on" : ""}">Aceitam e-mail</button></div></div>
      <div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Contato</th><th>Cidade</th><th>Desde</th><th>Pedidos</th><th class="right">Total gasto</th></tr></thead><tbody id="crows"></tbody></table></div>`;
    const draw = () => {
      const q = f.q.toLowerCase();
      const rows = A.customers.filter((c) => (!q || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q)) && (!f.t || (f.t === "reg" && c.registered) || (f.t === "guest" && !c.registered) || (f.t === "news" && c.newsletter)));
      $("#crows").innerHTML = rows.length ? rows.map((c) => `<tr>
        <td><div class="pcell"><div class="th" style="width:36px;height:36px;border-radius:50%;font-weight:700">${esc((c.name || "?")[0].toUpperCase())}</div><div><b>${esc(c.name)}</b><span>${c.registered ? "Conta cadastrada" : "Convidado"}${c.newsletter ? " · aceita e-mails" : ""}</span></div></div></td>
        <td>${esc(c.email)}<div class="muted" style="font-size:12px">${c.phone ? `<a target="_blank" rel="noopener" href="${waLink(c.phone, "Olá, " + (c.name || "").split(" ")[0] + "! Aqui é da Pingo Chic.")}">${esc(masks.phone(c.phone))}</a>` : "—"}</div></td>
        <td>${c.address ? `${esc(c.address.cidade)}/${esc(c.address.uf)}` : "—"}</td>
        <td>${fmtDate(c.createdAt)}</td><td>${c.orders}</td><td class="right"><b>${money(c.spent)}</b></td></tr>`).join("") : `<tr><td colspan="6" class="empty">Nenhum cliente encontrado.</td></tr>`;
    };
    draw();
    $("#cq").oninput = (e) => { f.q = e.target.value; draw(); };
    $("#ct").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; f.t = b.dataset.t; $$("#ct button").forEach((x) => x.classList.toggle("on", x === b)); draw(); };
    $("#csv").onclick = () => downloadCsv("clientes-pingochic.csv", [["Nome", "E-mail", "Celular", "Tipo", "Aceita e-mail", "Cidade", "UF", "Pedidos", "Total gasto", "Desde"], ...A.customers.map((c) => [c.name, c.email, c.phone, c.registered ? "Conta" : "Convidado", c.newsletter ? "Sim" : "Não", c.address?.cidade || "", c.address?.uf || "", c.orders, c.spent, fmtDate(c.createdAt)])]);
  }

  /* ============================== BANNERS ============================== */
  async function viewBanners() {
    loading("Banners");
    try { A.banners = (await api("/admin/banners")).banners; } catch (e) { return fail(e); }
    const draw = () => {
      main().innerHTML = `
        <div class="topbar"><div><h1>Banners da página inicial</h1><p>Até 3 banners ativos aparecem abaixo do destaque principal.</p></div><div style="display:flex;gap:8px"><button class="btn btn-line" id="add">${svg("plus", 16)} Novo banner</button><button class="btn btn-dark" id="save">Salvar banners</button></div></div>
        <div style="display:grid;gap:14px">${A.banners.map((b, i) => `
          <div class="card" style="display:grid;grid-template-columns:280px 1fr;gap:20px;align-items:start">
            <div class="banner-prev" style="background:${esc(b.color)}"><small>${esc(b.tag)}</small><b>${esc(b.title)}</b><span>${esc(b.text)}</span></div>
            <div>
              <div class="row"><div class="field"><label>Etiqueta</label><input data-b="${i}" data-k="tag" value="${esc(b.tag)}"></div><div class="field"><label>Título</label><input data-b="${i}" data-k="title" value="${esc(b.title)}"></div></div>
              <div class="field"><label>Texto</label><input data-b="${i}" data-k="text" value="${esc(b.text)}"></div>
              <div class="row" style="align-items:end">
                <div class="field"><label>Leva para</label><select data-b="${i}" data-k="gender"><option value="">Todos os produtos</option>${["menina", "menino", "bebe"].map((g) => `<option value="${g}" ${b.gender === g ? "selected" : ""}>${GENDER_LABEL[g]}</option>`).join("")}</select></div>
                <div class="field" style="flex:0 0 110px"><label>Cor</label><input type="color" data-b="${i}" data-k="color" value="${esc(b.color)}" style="height:41px;padding:4px"></div>
                <div class="field" style="flex:0 0 auto;display:flex;gap:10px;align-items:center;padding-bottom:8px"><label class="switch"><input type="checkbox" data-b="${i}" data-k="active" ${b.active ? "checked" : ""}><span></span></label> Ativo</div>
                <div class="field" style="flex:0 0 auto"><button class="icon-btn" data-del="${i}" title="Excluir">${svg("trash", 16)}</button></div>
              </div>
            </div>
          </div>`).join("") || `<div class="card empty">Nenhum banner cadastrado.</div>`}</div>`;
      $("#add").onclick = () => { A.banners.push({ id: "", tag: "Nova coleção", title: "Título do banner", text: "Descrição curta", gender: "", color: "#C9567E", active: true }); draw(); };
      $("#save").onclick = async () => { try { A.banners = (await guard(() => api("/admin/banners", { method: "PUT", body: { banners: A.banners } }))).banners; toast("Banners salvos"); draw(); } catch { } };
      main().oninput = main().onchange = (e) => {
        const el = e.target.closest("[data-b]"); if (!el) return;
        A.banners[el.dataset.b][el.dataset.k] = el.type === "checkbox" ? el.checked : el.value;
        const prev = el.closest(".card").querySelector(".banner-prev"); const b = A.banners[el.dataset.b];
        prev.style.background = b.color; prev.innerHTML = `<small>${esc(b.tag)}</small><b>${esc(b.title)}</b><span>${esc(b.text)}</span>`;
      };
      main().onclick = (e) => { const d = e.target.closest("[data-del]"); if (d && confirm("Excluir este banner?")) { A.banners.splice(Number(d.dataset.del), 1); draw(); } };
    };
    draw();
  }

  /* ============================== CUPONS ============================== */
  async function viewCoupons() {
    loading("Cupons");
    try { A.coupons = (await api("/admin/coupons")).coupons; } catch (e) { return fail(e); }
    const draw = () => {
      main().innerHTML = `
        <div class="topbar"><div><h1>Cupons de desconto</h1><p>Os descontos são validados no servidor no momento da compra.</p></div><div style="display:flex;gap:8px"><button class="btn btn-line" id="add">${svg("plus", 16)} Novo cupom</button><button class="btn btn-dark" id="save">Salvar cupons</button></div></div>
        <div class="table-wrap"><table><thead><tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Compra mínima</th><th>Limite de usos</th><th>Validade</th><th>Usos</th><th>Ativo</th><th></th></tr></thead><tbody>
        ${A.coupons.map((c, i) => `<tr>
          <td><input class="inp" data-c="${i}" data-k="code" value="${esc(c.code)}" style="text-transform:uppercase;font-weight:700;min-width:130px"></td>
          <td><select class="inp" data-c="${i}" data-k="type"><option value="percent" ${c.type === "percent" ? "selected" : ""}>% do subtotal</option><option value="fixed" ${c.type === "fixed" ? "selected" : ""}>R$ fixo</option><option value="freeship" ${c.type === "freeship" ? "selected" : ""}>Frete grátis</option></select></td>
          <td><input class="inp" type="number" min="0" step="0.01" data-c="${i}" data-k="value" value="${c.value}" style="width:90px" ${c.type === "freeship" ? "disabled" : ""}></td>
          <td><input class="inp" type="number" min="0" step="0.01" data-c="${i}" data-k="minSubtotal" value="${c.minSubtotal}" style="width:100px"></td>
          <td><input class="inp" type="number" min="0" data-c="${i}" data-k="maxUses" value="${c.maxUses}" style="width:90px" title="0 = ilimitado"></td>
          <td><input class="inp" type="date" data-c="${i}" data-k="expires" value="${esc(c.expires)}"></td>
          <td>${c.uses || 0}</td>
          <td><label class="switch"><input type="checkbox" data-c="${i}" data-k="active" ${c.active ? "checked" : ""}><span></span></label></td>
          <td><button class="icon-btn" data-del="${i}">${svg("trash", 16)}</button></td></tr>`).join("") || `<tr><td colspan="9" class="empty">Nenhum cupom.</td></tr>`}
        </tbody></table></div>
        <p class="muted" style="font-size:12.5px;margin-top:10px">Limite de usos 0 = ilimitado. Validade em branco = sem data de expiração.</p>`;
      $("#add").onclick = () => { A.coupons.push({ code: "", type: "percent", value: 10, minSubtotal: 0, maxUses: 0, uses: 0, expires: "", active: true }); draw(); };
      $("#save").onclick = async () => {
        const codes = A.coupons.map((c) => c.code.toUpperCase());
        if (codes.some((c, i) => !c || codes.indexOf(c) !== i)) return toast("Há cupons sem código ou repetidos.", "bad");
        try { A.coupons = (await guard(() => api("/admin/coupons", { method: "PUT", body: { coupons: A.coupons } }))).coupons; toast("Cupons salvos"); draw(); } catch { }
      };
      main().onchange = (e) => {
        const el = e.target.closest("[data-c]"); if (!el) return;
        const c = A.coupons[el.dataset.c];
        c[el.dataset.k] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.dataset.k === "code" ? el.value.toUpperCase() : el.value;
        if (el.dataset.k === "type") draw();
      };
      main().onclick = (e) => { const d = e.target.closest("[data-del]"); if (d && confirm("Excluir este cupom?")) { A.coupons.splice(Number(d.dataset.del), 1); draw(); } };
    };
    draw();
  }

  /* ============================== CONFIGURAÇÕES ============================== */
  async function viewConfig() {
    loading("Configurações");
    try { A.settings = (await api("/admin/settings")).settings; } catch (e) { return fail(e); }
    const s = A.settings;
    const inp = (k, label, extra = "", hint = "") => `<div class="field"><label>${label}</label><input data-s="${k}" value="${esc(s[k] ?? "")}" ${extra}>${hint ? `<div class="hint">${hint}</div>` : ""}</div>`;
    main().innerHTML = `
      <div class="topbar"><div><h1>Configurações da loja</h1><p>Informações exibidas na loja, pagamento e tabela de frete.</p></div><button class="btn btn-dark" id="save">Salvar configurações</button></div>
      <div class="grid-2e">
        <div class="card"><h3>Loja e contato</h3>
          ${inp("storeName", "Nome da loja")}
          ${inp("announcement", "Faixa de aviso no topo", "", "Deixe em branco para ocultar.")}
          ${inp("heroTitle", "Título principal da home")}
          <div class="field"><label>Subtítulo da home</label><textarea data-s="heroSubtitle" rows="2">${esc(s.heroSubtitle)}</textarea></div>
          <div class="row">${inp("whatsapp", "WhatsApp (com DDD)", 'inputmode="tel" placeholder="11999999999"')}${inp("instagram", "Instagram", 'placeholder="@pingochic"')}</div>
          <div class="row">${inp("email", "E-mail de atendimento", 'type="email"')}${inp("cnpj", "CNPJ", 'placeholder="00.000.000/0001-00"')}</div>
        </div>
        <div class="card"><h3>Pagamento</h3>
          ${inp("pixKey", "Chave Pix", 'placeholder="CNPJ, e-mail, celular ou chave aleatória"', "Com a chave preenchida, o cliente recebe QR Code e Pix copia-e-cola com o valor exato do pedido.")}
          <div class="row">${inp("pixName", "Nome do recebedor", 'maxlength="25"')}${inp("pixCity", "Cidade do recebedor", 'maxlength="15"')}</div>
          <div class="row">${inp("pixDiscount", "Desconto no Pix (%)", 'type="number" min="0" max="30"')}${inp("maxInstallments", "Parcelas sem juros (cartão)", 'type="number" min="1" max="12"', "Parcela mínima de R$ 20.")}</div>
          <h3 style="margin-top:22px">Frete</h3>
          ${inp("freeShippingMin", "Frete grátis a partir de (R$)", 'type="number" min="0" step="0.01"', "Use 0 para desativar o frete grátis.")}
        </div>
      </div>
      <div class="card" style="margin-top:18px"><h3>Tabela de frete por região (faixa de CEP) <button class="btn btn-line btn-sm" id="add-ship">${svg("plus", 14)} Faixa</button></h3>
        <p class="muted" style="margin-top:-8px;font-size:12.5px">O CEP do cliente é comparado com o início da faixa — a faixa mais específica (mais dígitos) tem prioridade. Ex: "0" = CEPs 00000-000 a 09999-999; "01" = 01000-000 a 01999-999.</p>
        <div class="table-wrap" style="border:none"><table style="min-width:600px"><thead><tr><th>Início do CEP</th><th>Região</th><th>Valor (R$)</th><th>Prazo</th><th></th></tr></thead><tbody id="ship"></tbody></table></div>
      </div>
      <div class="card" style="margin-top:18px"><h3>Minha senha de administrador</h3>
        <div class="row" style="max-width:720px"><div class="field"><label>Senha atual</label><input type="password" id="pw-cur" autocomplete="current-password"></div><div class="field"><label>Nova senha</label><input type="password" id="pw-new" autocomplete="new-password"><div class="hint">Mínimo de 10 caracteres.</div></div><div class="field" style="flex:0 0 auto;align-self:start;padding-top:24px"><button class="btn btn-line" id="pw-save">Alterar senha</button></div></div>
      </div>`;
    const drawShip = () => {
      $("#ship").innerHTML = s.shipping.map((r, i) => `<tr><td><input class="inp" data-r="${i}" data-k="prefix" value="${esc(r.prefix)}" style="width:100px" inputmode="numeric"></td><td><input class="inp" data-r="${i}" data-k="label" value="${esc(r.label)}"></td><td><input class="inp" type="number" step="0.01" min="0" data-r="${i}" data-k="price" value="${r.price}" style="width:110px"></td><td><input class="inp" data-r="${i}" data-k="days" value="${esc(r.days)}" style="width:170px"></td><td><button class="icon-btn" data-delr="${i}">${svg("trash", 16)}</button></td></tr>`).join("");
    };
    drawShip();
    main().onchange = (e) => {
      const el = e.target;
      if (el.dataset.s) s[el.dataset.s] = el.type === "number" ? Number(el.value) : el.value;
      if (el.dataset.r) s.shipping[el.dataset.r][el.dataset.k] = el.type === "number" ? Number(el.value) : el.value;
    };
    main().onclick = (e) => { const d = e.target.closest("[data-delr]"); if (d) { s.shipping.splice(Number(d.dataset.delr), 1); drawShip(); } };
    $("#add-ship").onclick = () => { s.shipping.push({ prefix: "", label: "", price: 0, days: "" }); drawShip(); };
    $("#save").onclick = async () => {
      s.shipping.sort((a, b) => String(b.prefix).length - String(a.prefix).length);
      try { A.settings = (await guard(() => api("/admin/settings", { method: "PUT", body: s }))).settings; toast("Configurações salvas"); viewConfig(); } catch { }
    };
    $("#pw-save").onclick = async () => {
      try { await guard(() => api("/admin/me/password", { method: "PUT", body: { current: $("#pw-cur").value, password: $("#pw-new").value } })); toast("Senha alterada"); $("#pw-cur").value = $("#pw-new").value = ""; } catch { }
    };
  }

  /* ============================== ADMINISTRADORES ============================== */
  async function viewAdmins() {
    loading("Administradores");
    let admins;
    try { admins = (await api("/admin/admins")).admins; } catch (e) { return fail(e); }
    main().innerHTML = `
      <div class="topbar"><div><h1>Administradores</h1><p>Pessoas com acesso a este painel. Clientes da loja <b>não</b> têm acesso aqui.</p></div></div>
      <div class="grid-2">
        <div class="table-wrap"><table style="min-width:480px"><thead><tr><th>Nome</th><th>E-mail</th><th>Desde</th><th></th></tr></thead><tbody>
          ${admins.map((a) => `<tr><td><b>${esc(a.name)}</b>${a.id === A.admin.id ? ' <span class="status ok" style="font-size:10px">Você</span>' : ""}</td><td>${esc(a.email)}</td><td>${fmtDate(a.created_at)}</td><td class="right">${a.id !== A.admin.id ? `<button class="btn btn-bad btn-sm" data-del="${a.id}">Remover</button>` : ""}</td></tr>`).join("")}
        </tbody></table></div>
        <form class="card" id="af"><h3>Adicionar administrador</h3>
          <div class="field"><label>Nome</label><input id="ad-name"></div>
          <div class="field"><label>E-mail</label><input id="ad-email" type="email"></div>
          <div class="field"><label>Senha inicial</label><input id="ad-pass" type="password" autocomplete="new-password"><div class="hint">Mínimo de 10 caracteres. Peça para a pessoa trocar no primeiro acesso.</div></div>
          <button class="btn btn-dark btn-block">Adicionar</button>
        </form>
      </div>`;
    $("#af").onsubmit = async (e) => {
      e.preventDefault();
      try { await guard(() => api("/admin/admins", { method: "POST", body: { name: $("#ad-name").value, email: $("#ad-email").value, password: $("#ad-pass").value } })); toast("Administrador adicionado"); viewAdmins(); } catch { }
    };
    main().onclick = async (e) => {
      const d = e.target.closest("[data-del]");
      if (d && confirm("Remover o acesso deste administrador?")) { try { await guard(() => api("/admin/admins/" + d.dataset.del, { method: "DELETE" })); toast("Acesso removido"); viewAdmins(); } catch { } }
    };
  }

  document.addEventListener("DOMContentLoaded", init);
})();
