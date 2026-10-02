/**
 * Pingo Chic — backend da loja (Durable Object com SQLite).
 *
 * Um único objeto ("main") guarda catálogo, pedidos, clientes, administradores,
 * sessões e configurações. Imagens de produtos ficam no R2 (prefixo pingochic/).
 *
 * Rotas (todas com prefixo /v1/pingo):
 *   Público:   GET  /catalog · GET /products/:id · POST /quote · POST /orders
 *              POST /orders/track · GET /images/:key · GET /cep/:cep
 *   Cliente:   POST /auth/signup · /auth/login · /auth/logout · GET /auth/me
 *              PUT  /me · PUT /me/password · GET /me/orders · PUT /me/favorites
 *   Admin:     POST /admin/login · /admin/logout · GET /admin/me · PUT /admin/me/password
 *              GET  /admin/dashboard · GET|POST /admin/products · PUT|DELETE /admin/products/:id
 *              POST /admin/images · GET /admin/orders · PUT /admin/orders/:id
 *              GET  /admin/customers · GET|PUT /admin/settings · GET|PUT /admin/banners
 *              GET|PUT /admin/coupons · GET|POST /admin/admins · DELETE /admin/admins/:id
 */

const PREFIX = "/v1/pingo";
const CUSTOMER_COOKIE = "__Host-pc_c";
const ADMIN_COOKIE = "__Host-pc_a";
const CUSTOMER_TTL = 30 * 24 * 3600;      // 30 dias
const ADMIN_TTL = 12 * 3600;              // 12 horas
const PBKDF2_ITERATIONS = 100000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ORDER_STATUSES = ["aguardando_pagamento", "pago", "em_separacao", "enviado", "entregue", "cancelado"];

const DEFAULT_SETTINGS = {
  storeName: "Pingo Chic",
  announcement: "Frete grátis acima de R$ 199 para todo o Brasil · 5% OFF no Pix",
  heroTitle: "Moda infantil com charme e conforto",
  heroSubtitle: "Roupas e acessórios do bebê ao juvenil, com entrega para todo o Brasil.",
  whatsapp: "",
  instagram: "",
  email: "contato@pingochic.com.br",
  cnpj: "",
  pixKey: "",
  pixName: "PINGO CHIC",
  pixCity: "SAO PAULO",
  pixDiscount: 5,
  maxInstallments: 6,
  freeShippingMin: 199,
  shipping: [
    { prefix: "0", label: "SP capital e região", price: 14.9, days: "2 a 4 dias úteis" },
    { prefix: "1", label: "SP interior", price: 16.9, days: "3 a 5 dias úteis" },
    { prefix: "2", label: "RJ e ES", price: 19.9, days: "3 a 6 dias úteis" },
    { prefix: "3", label: "MG", price: 19.9, days: "3 a 6 dias úteis" },
    { prefix: "4", label: "BA e SE", price: 24.9, days: "5 a 8 dias úteis" },
    { prefix: "5", label: "PE, AL, PB e RN", price: 27.9, days: "6 a 9 dias úteis" },
    { prefix: "6", label: "CE, PI, MA, PA, AP, AM, RR e AC", price: 32.9, days: "7 a 12 dias úteis" },
    { prefix: "7", label: "DF, GO, TO, MT, MS e RO", price: 24.9, days: "4 a 8 dias úteis" },
    { prefix: "8", label: "PR e SC", price: 21.9, days: "4 a 7 dias úteis" },
    { prefix: "9", label: "RS", price: 24.9, days: "5 a 8 dias úteis" }
  ]
};

const DEFAULT_BANNERS = [
  { id: "b1", tag: "Nova coleção", title: "Verão Encantado", text: "Peças leves e floridas com até 20% OFF", gender: "menina", color: "#F0645E", active: true },
  { id: "b2", tag: "Entrega nacional", title: "Frete grátis acima de R$ 199", text: "Enviamos para todos os estados do Brasil", gender: "", color: "#E9A800", active: true },
  { id: "b3", tag: "Aventura", title: "Pequenos Exploradores", text: "Camisetas e bermudas resistentes para brincar", gender: "menino", color: "#1597C9", active: true }
];

const DEFAULT_COUPONS = [
  { code: "BEMVINDA10", type: "percent", value: 10, minSubtotal: 0, maxUses: 0, uses: 0, expires: "", active: true },
  { code: "PINGO20", type: "percent", value: 20, minSubtotal: 250, maxUses: 0, uses: 0, expires: "", active: true },
  { code: "FRETEGRATIS", type: "freeship", value: 0, minSubtotal: 99, maxUses: 0, uses: 0, expires: "", active: true }
];

const s = (arr) => arr.map(([size, stock]) => ({ size, stock }));
const SEED_PRODUCTS = [
  { name: "Vestido Florido Jardim", gender: "menina", category: "Vestidos", price: 89.9, compareAt: 109.9, color: "Rosa", sizes: s([["2", 4], ["4", 5], ["6", 6], ["8", 4], ["10", 3], ["12", 2]]), featured: true, icon: "dress", desc: "Vestido leve em viscose macia com estampa floral exclusiva. Forro em algodão, zíper invisível nas costas e caimento confortável para brincar à vontade." },
  { name: "Conjunto Tule Bailarina", gender: "menina", category: "Conjuntos", price: 129.9, compareAt: 0, color: "Rosa", sizes: s([["2", 3], ["4", 3], ["6", 3], ["8", 2], ["10", 1]]), featured: true, icon: "dress", desc: "Conjunto com saia de tule em camadas e blusa de malha canelada. Brilho na medida certa para festas e ocasiões especiais." },
  { name: "Saia Plissada Midi", gender: "menina", category: "Saias", price: 64.9, compareAt: 0, color: "Amarelo", sizes: s([["4", 1], ["6", 1], ["8", 1], ["10", 1], ["12", 0]]), featured: false, icon: "skirt", desc: "Saia plissada em tecido fluido, cintura com elástico embutido para máximo conforto. Combina com camisetas e blusinhas." },
  { name: "Laço Duplo de Cetim", gender: "menina", category: "Acessórios", price: 24.9, compareAt: 0, color: "Branco", sizes: s([["Único", 40]]), featured: false, icon: "bow", desc: "Laço duplo em fita de cetim com presilha jacaré revestida, que não puxa o cabelo. Acabamento à mão." },
  { name: "Camiseta Dino Explorer", gender: "menino", category: "Camisetas", price: 54.9, compareAt: 64.9, color: "Verde", sizes: s([["2", 5], ["4", 6], ["6", 6], ["8", 5], ["10", 5], ["12", 4]]), featured: true, icon: "shirt", desc: "Camiseta 100% algodão penteado com estampa de dinossauro em silk à base d'água. Macia, respirável e resistente às lavagens." },
  { name: "Bermuda Cargo Aventura", gender: "menino", category: "Bermudas", price: 69.9, compareAt: 0, color: "Azul", sizes: s([["4", 1], ["6", 1], ["8", 1], ["10", 0], ["12", 0]]), featured: false, icon: "shorts", desc: "Bermuda em sarja com elastano, bolsos laterais e cós com regulagem interna. Feita para acompanhar qualquer aventura." },
  { name: "Boné Pequeno Surfista", gender: "menino", category: "Acessórios", price: 39.9, compareAt: 0, color: "Azul", sizes: s([["Único", 15]]), featured: false, icon: "cap", desc: "Boné com ajuste traseiro e tecido com proteção UV 50+. Leve e confortável para os dias de sol." },
  { name: "Conjunto Explorador", gender: "menino", category: "Conjuntos", price: 99.9, compareAt: 119.9, color: "Cinza", sizes: s([["2", 2], ["4", 2], ["6", 2], ["8", 2], ["10", 2]]), featured: true, icon: "shirt", desc: "Camiseta + bermuda combinando, em malha de secagem rápida. Pensado para quem vive em movimento." },
  { name: "Body Manga Longa Nuvem", gender: "bebe", category: "Bodies", price: 44.9, compareAt: 0, color: "Branco", sizes: s([["RN", 6], ["P", 6], ["M", 6], ["G", 4]]), featured: true, icon: "body", desc: "Body em suedine 100% algodão com abertura por botões de pressão. Toque suave e macio para a pele sensível do bebê." },
  { name: "Macacão Ursinho Plush", gender: "bebe", category: "Macacões", price: 119.9, compareAt: 0, color: "Bege", sizes: s([["P", 3], ["M", 3], ["G", 2]]), featured: false, icon: "body", desc: "Macacão em plush antialérgico com capuz de orelhinhas e pezinho reversível. Quentinho para os dias frios." }
];

/* ======================================================================== */

export class PingoStore {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.ctx.blockConcurrencyWhile(async () => this.migrate());
  }

  migrate() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER, updated_at INTEGER);
      CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, number INTEGER UNIQUE, customer_id INTEGER, email TEXT, status TEXT, total REAL, created_at INTEGER, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, name TEXT, pass TEXT, created_at INTEGER, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, name TEXT, pass TEXT, created_at INTEGER);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, kind TEXT, user_id INTEGER, expires_at INTEGER);
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER, reset_at INTEGER);
      CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    `);
    if (!this.kvGet("seeded")) {
      const now = Date.now();
      SEED_PRODUCTS.forEach((p, i) => {
        const data = normalizeProduct({ ...p, images: [], sold: 0 });
        this.sql.exec("INSERT INTO products (data, active, created_at, updated_at) VALUES (?, 1, ?, ?)", JSON.stringify(data), now - i * 1000, now);
      });
      this.kvSet("settings", DEFAULT_SETTINGS);
      this.kvSet("banners", DEFAULT_BANNERS);
      this.kvSet("coupons", DEFAULT_COUPONS);
      this.kvSet("orderCounter", 1042);
      this.kvSet("seeded", true);
    }
  }

  /* ---------------- helpers de armazenamento ---------------- */
  kvGet(key, fallback = null) {
    const row = this.sql.exec("SELECT value FROM kv WHERE key = ?", key).toArray()[0];
    return row ? JSON.parse(row.value) : fallback;
  }
  kvSet(key, value) {
    this.sql.exec("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, JSON.stringify(value));
  }
  settings() { return { ...DEFAULT_SETTINGS, ...(this.kvGet("settings") || {}) }; }

  productRows(includeInactive = false) {
    const rows = this.sql.exec(`SELECT id, data, active, created_at FROM products ${includeInactive ? "" : "WHERE active = 1"} ORDER BY created_at DESC`).toArray();
    return rows.map(r => ({ ...JSON.parse(r.data), id: r.id, active: !!r.active, createdAt: r.created_at }));
  }
  getProduct(id) {
    const r = this.sql.exec("SELECT id, data, active, created_at FROM products WHERE id = ?", Number(id)).toArray()[0];
    return r ? { ...JSON.parse(r.data), id: r.id, active: !!r.active, createdAt: r.created_at } : null;
  }
  saveProduct(p) {
    const { id, active, createdAt, ...data } = p;
    this.sql.exec("UPDATE products SET data = ?, active = ?, updated_at = ? WHERE id = ?", JSON.stringify(data), active ? 1 : 0, Date.now(), id);
  }

  orderFromRow(r) { return r ? { ...JSON.parse(r.data), id: r.id, number: r.number, status: r.status, total: r.total, email: r.email, customerId: r.customer_id, createdAt: r.created_at } : null; }
  saveOrder(o) {
    const { id, number, status, total, email, customerId, createdAt, ...data } = o;
    this.sql.exec("UPDATE orders SET status = ?, data = ? WHERE id = ?", status, JSON.stringify(data), id);
  }

  /* ---------------- sessões ---------------- */
  createSession(kind, userId) {
    const id = randomHex(32);
    const ttl = kind === "admin" ? ADMIN_TTL : CUSTOMER_TTL;
    this.sql.exec("INSERT INTO sessions (id, kind, user_id, expires_at) VALUES (?, ?, ?, ?)", id, kind, userId, Date.now() + ttl * 1000);
    this.sql.exec("DELETE FROM sessions WHERE expires_at < ?", Date.now());
    return { id, cookie: buildCookie(kind === "admin" ? ADMIN_COOKIE : CUSTOMER_COOKIE, id, ttl) };
  }
  sessionUser(request, kind) {
    const id = readCookie(request, kind === "admin" ? ADMIN_COOKIE : CUSTOMER_COOKIE);
    if (!id) return null;
    const sess = this.sql.exec("SELECT * FROM sessions WHERE id = ? AND kind = ?", id, kind).toArray()[0];
    if (!sess || sess.expires_at < Date.now()) return null;
    if (kind === "admin") {
      const a = this.sql.exec("SELECT id, email, name FROM admins WHERE id = ?", sess.user_id).toArray()[0];
      return a ? { ...a, sessionId: id } : null;
    }
    const c = this.sql.exec("SELECT * FROM customers WHERE id = ?", sess.user_id).toArray()[0];
    return c ? { ...publicCustomer(c), sessionId: id } : null;
  }
  destroySession(request, kind) {
    const id = readCookie(request, kind === "admin" ? ADMIN_COOKIE : CUSTOMER_COOKIE);
    if (id) this.sql.exec("DELETE FROM sessions WHERE id = ?", id);
    return buildCookie(kind === "admin" ? ADMIN_COOKIE : CUSTOMER_COOKIE, "", 0);
  }

  /* ---------------- limite de tentativas ---------------- */
  checkAttempts(key) {
    const r = this.sql.exec("SELECT * FROM attempts WHERE key = ?", key).toArray()[0];
    if (r && r.reset_at > Date.now() && r.count >= 6) {
      const min = Math.ceil((r.reset_at - Date.now()) / 60000);
      throw new HttpError(429, `Muitas tentativas. Tente novamente em ${min} min.`);
    }
  }
  failAttempt(key) {
    const r = this.sql.exec("SELECT * FROM attempts WHERE key = ?", key).toArray()[0];
    if (!r || r.reset_at < Date.now()) {
      this.sql.exec("INSERT OR REPLACE INTO attempts (key, count, reset_at) VALUES (?, 1, ?)", key, Date.now() + 15 * 60000);
    } else {
      this.sql.exec("UPDATE attempts SET count = count + 1 WHERE key = ?", key);
    }
  }
  clearAttempts(key) { this.sql.exec("DELETE FROM attempts WHERE key = ?", key); }

  /* ======================================================================
     ROTEAMENTO
     ====================================================================== */
  async fetch(request) {
    try {
      return await this.route(request);
    } catch (err) {
      if (err instanceof HttpError) return json({ ok: false, error: err.message }, err.status);
      console.error("[pingochic]", err && err.stack || err);
      return json({ ok: false, error: "Erro interno da loja." }, 500);
    }
  }

  async route(request) {
    const url = new URL(request.url);
    const path = url.pathname.slice(PREFIX.length).replace(/\/+$/, "") || "/";
    const m = request.method;
    const seg = path.split("/").filter(Boolean);

    /* ---------- público ---------- */
    if (path === "/catalog" && m === "GET") return this.catalog();
    if (seg[0] === "products" && seg[1] && m === "GET") {
      const p = this.getProduct(seg[1]);
      if (!p || !p.active) throw new HttpError(404, "Produto não encontrado.");
      return json({ ok: true, product: publicProduct(p) });
    }
    if (seg[0] === "images" && seg[1] && (m === "GET" || m === "HEAD")) return this.serveImage(seg.slice(1).join("/"));
    if (seg[0] === "cep" && seg[1] && m === "GET") return this.lookupCep(seg[1]);
    if (path === "/quote" && m === "POST") {
      const body = await readBody(request);
      return json({ ok: true, quote: this.quote(body) });
    }
    if (path === "/orders" && m === "POST") return this.createOrder(request, await readBody(request));
    if (path === "/orders/track" && m === "POST") {
      const body = await readBody(request);
      const r = this.sql.exec("SELECT * FROM orders WHERE number = ? AND email = ?", Number(String(body.number || "").replace(/\D/g, "")), normEmail(body.email)).toArray()[0];
      if (!r) throw new HttpError(404, "Pedido não encontrado. Confira o número e o e-mail usados na compra.");
      return json({ ok: true, order: this.publicOrder(this.orderFromRow(r)) });
    }

    /* ---------- cliente ---------- */
    if (seg[0] === "auth") return this.customerAuth(request, seg[1], m);
    if (seg[0] === "me") return this.customerArea(request, seg[1], m);

    /* ---------- admin ---------- */
    if (seg[0] === "admin") return this.adminRoutes(request, seg.slice(1), m, url);

    throw new HttpError(404, "Rota não encontrada.");
  }

  /* ======================================================================
     PÚBLICO
     ====================================================================== */
  catalog() {
    const st = this.settings();
    const products = this.productRows().map(publicProduct);
    const banners = (this.kvGet("banners") || []).filter(b => b.active);
    return json({
      ok: true,
      settings: publicSettings(st),
      products,
      banners,
      categories: [...new Set(products.map(p => p.category).filter(Boolean))].sort()
    }, 200, { "Cache-Control": "no-store" });
  }

  async serveImage(key) {
    if (!this.env.CLIENT_LOGOS) throw new HttpError(404, "Imagem indisponível.");
    if (!/^[a-z0-9-]+\.(webp|jpg|jpeg|png)$/i.test(key)) throw new HttpError(400, "Chave inválida.");
    const obj = await this.env.CLIENT_LOGOS.get("pingochic/" + key);
    if (!obj) throw new HttpError(404, "Imagem não encontrada.");
    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType || "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Cross-Origin-Resource-Policy": "cross-origin"
      }
    });
  }

  async lookupCep(raw) {
    const cep = String(raw).replace(/\D/g, "");
    if (cep.length !== 8) throw new HttpError(400, "CEP inválido.");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { headers: { Accept: "application/json" } });
      const d = await r.json();
      if (d.erro) throw new Error("not found");
      return json({ ok: true, address: { cep, rua: d.logradouro || "", bairro: d.bairro || "", cidade: d.localidade || "", uf: d.uf || "" } });
    } catch {
      throw new HttpError(404, "CEP não encontrado.");
    }
  }

  /** Cálculo de totais SEMPRE no servidor (preço, estoque, cupom, frete). */
  quote(body, { strict = false } = {}) {
    const st = this.settings();
    const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
    const lines = [];
    const problems = [];
    for (const it of items) {
      const p = this.getProduct(it.id);
      const qty = Math.max(1, Math.min(20, parseInt(it.qty) || 1));
      if (!p || !p.active) { problems.push("Um produto do carrinho não está mais disponível."); continue; }
      const sz = (p.sizes || []).find(x => x.size === String(it.size));
      if (!sz) { problems.push(`Tamanho indisponível para ${p.name}.`); continue; }
      if (sz.stock < qty) problems.push(sz.stock === 0 ? `${p.name} (tam. ${sz.size}) esgotou.` : `${p.name} (tam. ${sz.size}): restam só ${sz.stock} unidade(s).`);
      lines.push({ id: p.id, name: p.name, size: sz.size, qty, price: p.price, image: p.images?.[0] || "", icon: p.icon, lineTotal: round2(p.price * qty), available: sz.stock });
    }
    const subtotal = round2(lines.reduce((a, l) => a + l.lineTotal, 0));

    // cupom
    let coupon = null, couponError = "", discount = 0, freeship = false;
    const code = String(body.coupon || "").trim().toUpperCase();
    if (code) {
      const c = (this.kvGet("coupons") || []).find(x => x.code === code);
      if (!c || !c.active) couponError = "Cupom inválido.";
      else if (c.expires && new Date(c.expires + "T23:59:59-03:00").getTime() < Date.now()) couponError = "Este cupom expirou.";
      else if (c.maxUses && c.uses >= c.maxUses) couponError = "Este cupom atingiu o limite de usos.";
      else if (subtotal < (c.minSubtotal || 0)) couponError = `Cupom válido para compras a partir de ${brl(c.minSubtotal)}.`;
      else {
        coupon = { code: c.code, type: c.type, value: c.value };
        if (c.type === "percent") discount = round2(subtotal * Math.min(100, c.value) / 100);
        else if (c.type === "fixed") discount = Math.min(subtotal, round2(c.value));
        else if (c.type === "freeship") freeship = true;
      }
    }

    // frete
    const cep = String(body.cep || "").replace(/\D/g, "");
    let shipping = null;
    if (cep.length === 8) {
      const reg = [...(st.shipping || [])].sort((a, b) => String(b.prefix).length - String(a.prefix).length).find(r => r.prefix && cep.startsWith(String(r.prefix))) || { price: 24.9, days: "5 a 10 dias úteis", label: "Brasil" };
      const free = freeship || (st.freeShippingMin > 0 && subtotal - discount >= st.freeShippingMin);
      shipping = { price: free ? 0 : round2(reg.price), days: reg.days, region: reg.label, free };
    }

    const base = Math.max(0, round2(subtotal - discount));
    const pixDiscount = body.payment === "pix" ? round2(base * (Number(st.pixDiscount) || 0) / 100) : 0;
    const total = round2(base - pixDiscount + (shipping ? shipping.price : 0));
    const missingToFree = st.freeShippingMin > 0 ? Math.max(0, round2(st.freeShippingMin - (subtotal - discount))) : 0;

    if (strict && problems.length) throw new HttpError(409, problems[0]);
    return { lines, subtotal, discount, coupon, couponError, shipping, pixDiscount, total, problems, missingToFree, installments: installmentOptions(total, st.maxInstallments) };
  }

  async createOrder(request, body) {
    const st = this.settings();
    const customer = this.sessionUser(request, "customer");
    const c = body.customer || {};
    const a = body.address || {};
    const name = clean(c.name, 120), email = normEmail(c.email || customer?.email), phone = clean(c.phone, 30), cpf = String(c.cpf || "").replace(/\D/g, "");
    if (name.length < 3) throw new HttpError(400, "Informe o nome completo.");
    if (!isEmail(email)) throw new HttpError(400, "Informe um e-mail válido.");
    if (phone.replace(/\D/g, "").length < 10) throw new HttpError(400, "Informe um telefone/WhatsApp com DDD.");
    if (!validCpf(cpf)) throw new HttpError(400, "CPF inválido.");
    const address = {
      cep: String(a.cep || "").replace(/\D/g, ""), rua: clean(a.rua, 150), numero: clean(a.numero, 20), complemento: clean(a.complemento, 80),
      bairro: clean(a.bairro, 80), cidade: clean(a.cidade, 80), uf: clean(a.uf, 2).toUpperCase()
    };
    if (address.cep.length !== 8 || !address.rua || !address.numero || !address.bairro || !address.cidade || address.uf.length !== 2) {
      throw new HttpError(400, "Endereço de entrega incompleto.");
    }
    const payment = body.payment === "cartao" ? "cartao" : "pix";
    if (!body.items?.length) throw new HttpError(400, "Seu carrinho está vazio.");

    const q = this.quote({ ...body, cep: address.cep, payment }, { strict: true });
    if (q.couponError) throw new HttpError(400, q.couponError);
    if (!q.lines.length) throw new HttpError(400, "Seu carrinho está vazio.");

    // baixa de estoque (atômica dentro do Durable Object)
    for (const l of q.lines) {
      const p = this.getProduct(l.id);
      const sz = p.sizes.find(x => x.size === l.size);
      sz.stock -= l.qty;
      p.sold = (p.sold || 0) + l.qty;
      this.saveProduct(p);
    }
    if (q.coupon) {
      const coupons = this.kvGet("coupons") || [];
      const cc = coupons.find(x => x.code === q.coupon.code);
      if (cc) { cc.uses = (cc.uses || 0) + 1; this.kvSet("coupons", coupons); }
    }

    const number = (this.kvGet("orderCounter") || 1042) + 1;
    this.kvSet("orderCounter", number);
    const now = Date.now();
    const data = {
      customer: { name, email, phone, cpf },
      address, payment,
      items: q.lines.map(({ available, ...l }) => l),
      subtotal: q.subtotal, discount: q.discount, coupon: q.coupon, pixDiscount: q.pixDiscount,
      shipping: q.shipping, installments: payment === "cartao" ? Math.max(1, Math.min(st.maxInstallments || 1, parseInt(body.installments) || 1)) : 1,
      notes: clean(body.notes, 500), tracking: "", history: [{ status: "aguardando_pagamento", at: now }], stockRestored: false
    };
    if (payment === "pix" && st.pixKey) {
      data.pix = { payload: pixPayload({ key: st.pixKey, name: st.pixName, city: st.pixCity, amount: q.total, txid: "PC" + number }) };
    }
    const res = this.sql.exec("INSERT INTO orders (number, customer_id, email, status, total, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
      number, customer?.id || null, email, "aguardando_pagamento", q.total, now, JSON.stringify(data)).toArray()[0];

    // guarda endereço/telefone no cadastro do cliente logado
    if (customer) {
      const row = this.sql.exec("SELECT data FROM customers WHERE id = ?", customer.id).toArray()[0];
      const cd = JSON.parse(row.data);
      cd.address = address; cd.phone = phone; cd.cpf = cpf;
      this.sql.exec("UPDATE customers SET data = ? WHERE id = ?", JSON.stringify(cd), customer.id);
    }
    const order = this.orderFromRow(this.sql.exec("SELECT * FROM orders WHERE id = ?", res.id).toArray()[0]);
    return json({ ok: true, order: this.publicOrder(order) }, 201);
  }

  publicOrder(o) {
    const st = this.settings();
    return {
      number: o.number, status: o.status, total: o.total, createdAt: o.createdAt, email: o.email,
      customer: { name: o.customer.name, phone: o.customer.phone }, address: o.address, payment: o.payment,
      items: o.items, subtotal: o.subtotal, discount: o.discount, coupon: o.coupon, pixDiscount: o.pixDiscount,
      shipping: o.shipping, installments: o.installments, tracking: o.tracking, history: o.history,
      pix: o.status === "aguardando_pagamento" ? o.pix || null : null,
      whatsapp: st.whatsapp
    };
  }

  /* ======================================================================
     CLIENTE
     ====================================================================== */
  async customerAuth(request, action, m) {
    if (action === "me" && m === "GET") {
      const u = this.sessionUser(request, "customer");
      return json({ ok: true, user: u ? stripSession(u) : null });
    }
    if (m !== "POST") throw new HttpError(405, "Método não permitido.");
    const ip = request.headers.get("CF-Connecting-IP") || "local";

    if (action === "logout") {
      return json({ ok: true }, 200, { "Set-Cookie": this.destroySession(request, "customer") });
    }
    const body = await readBody(request);
    const email = normEmail(body.email);
    const password = String(body.password || "");

    if (action === "signup") {
      const name = clean(body.name, 120);
      if (name.length < 3) throw new HttpError(400, "Informe seu nome completo.");
      if (!isEmail(email)) throw new HttpError(400, "E-mail inválido.");
      if (password.length < 8) throw new HttpError(400, "A senha precisa ter pelo menos 8 caracteres.");
      this.checkAttempts("signup:" + ip);
      if (this.sql.exec("SELECT id FROM customers WHERE email = ?", email).toArray().length) {
        throw new HttpError(409, "Já existe uma conta com este e-mail. Faça login.");
      }
      this.failAttempt("signup:" + ip); // conta cadastros por IP (anti-abuso)
      const pass = await hashPassword(password);
      const data = { phone: clean(body.phone, 30), cpf: "", address: null, favorites: Array.isArray(body.favorites) ? body.favorites.map(Number).filter(Boolean).slice(0, 200) : [], newsletter: !!body.newsletter };
      const row = this.sql.exec("INSERT INTO customers (email, name, pass, created_at, data) VALUES (?, ?, ?, ?, ?) RETURNING id", email, name, pass, Date.now(), JSON.stringify(data)).toArray()[0];
      // vincula pedidos feitos como convidado com o mesmo e-mail
      this.sql.exec("UPDATE orders SET customer_id = ? WHERE email = ? AND customer_id IS NULL", row.id, email);
      const sess = this.createSession("customer", row.id);
      const user = publicCustomer(this.sql.exec("SELECT * FROM customers WHERE id = ?", row.id).toArray()[0]);
      return json({ ok: true, user }, 201, { "Set-Cookie": sess.cookie });
    }

    if (action === "login") {
      const key = "c:" + email;
      this.checkAttempts(key);
      const row = this.sql.exec("SELECT * FROM customers WHERE email = ?", email).toArray()[0];
      if (!row || !(await verifyPassword(password, row.pass))) {
        this.failAttempt(key);
        throw new HttpError(401, "E-mail ou senha incorretos.");
      }
      this.clearAttempts(key);
      this.sql.exec("UPDATE orders SET customer_id = ? WHERE email = ? AND customer_id IS NULL", row.id, email);
      // mescla favoritos do visitante
      if (Array.isArray(body.favorites) && body.favorites.length) {
        const d = JSON.parse(row.data);
        d.favorites = [...new Set([...(d.favorites || []), ...body.favorites.map(Number).filter(Boolean)])].slice(0, 200);
        this.sql.exec("UPDATE customers SET data = ? WHERE id = ?", JSON.stringify(d), row.id);
      }
      const sess = this.createSession("customer", row.id);
      const user = publicCustomer(this.sql.exec("SELECT * FROM customers WHERE id = ?", row.id).toArray()[0]);
      return json({ ok: true, user }, 200, { "Set-Cookie": sess.cookie });
    }
    throw new HttpError(404, "Rota não encontrada.");
  }

  async customerArea(request, action, m) {
    const u = this.sessionUser(request, "customer");
    if (!u) throw new HttpError(401, "Faça login para continuar.");
    const row = this.sql.exec("SELECT * FROM customers WHERE id = ?", u.id).toArray()[0];
    const data = JSON.parse(row.data);

    if (!action && m === "PUT") {
      const body = await readBody(request);
      const name = clean(body.name ?? row.name, 120);
      if (name.length < 3) throw new HttpError(400, "Informe seu nome completo.");
      if (body.phone !== undefined) data.phone = clean(body.phone, 30);
      if (body.cpf !== undefined) data.cpf = String(body.cpf).replace(/\D/g, "").slice(0, 11);
      if (body.address !== undefined) data.address = body.address ? {
        cep: String(body.address.cep || "").replace(/\D/g, ""), rua: clean(body.address.rua, 150), numero: clean(body.address.numero, 20),
        complemento: clean(body.address.complemento, 80), bairro: clean(body.address.bairro, 80), cidade: clean(body.address.cidade, 80), uf: clean(body.address.uf, 2).toUpperCase()
      } : null;
      if (body.newsletter !== undefined) data.newsletter = !!body.newsletter;
      this.sql.exec("UPDATE customers SET name = ?, data = ? WHERE id = ?", name, JSON.stringify(data), u.id);
      return json({ ok: true, user: publicCustomer(this.sql.exec("SELECT * FROM customers WHERE id = ?", u.id).toArray()[0]) });
    }
    if (action === "password" && m === "PUT") {
      const body = await readBody(request);
      if (!(await verifyPassword(String(body.current || ""), row.pass))) throw new HttpError(400, "Senha atual incorreta.");
      if (String(body.password || "").length < 8) throw new HttpError(400, "A nova senha precisa ter pelo menos 8 caracteres.");
      this.sql.exec("UPDATE customers SET pass = ? WHERE id = ?", await hashPassword(String(body.password)), u.id);
      this.sql.exec("DELETE FROM sessions WHERE kind = 'customer' AND user_id = ? AND id != ?", u.id, u.sessionId);
      return json({ ok: true });
    }
    if (action === "orders" && m === "GET") {
      const rows = this.sql.exec("SELECT * FROM orders WHERE customer_id = ? OR email = ? ORDER BY created_at DESC LIMIT 100", u.id, u.email).toArray();
      return json({ ok: true, orders: rows.map(r => this.publicOrder(this.orderFromRow(r))) });
    }
    if (action === "favorites" && m === "PUT") {
      const body = await readBody(request);
      data.favorites = Array.isArray(body.favorites) ? [...new Set(body.favorites.map(Number).filter(Boolean))].slice(0, 200) : [];
      this.sql.exec("UPDATE customers SET data = ? WHERE id = ?", JSON.stringify(data), u.id);
      return json({ ok: true, favorites: data.favorites });
    }
    throw new HttpError(404, "Rota não encontrada.");
  }

  /* ======================================================================
     ADMINISTRAÇÃO
     ====================================================================== */
  async adminRoutes(request, seg, m, url) {
    const action = seg[0] || "";
    const ip = request.headers.get("CF-Connecting-IP") || "local";

    if (action === "login" && m === "POST") {
      const body = await readBody(request);
      const email = normEmail(body.email);
      const password = String(body.password || "");
      const key = "a:" + ip;
      this.checkAttempts(key);
      let row = this.sql.exec("SELECT * FROM admins WHERE email = ?", email).toArray()[0];
      // Primeiro acesso: cria o administrador inicial a partir dos secrets do Worker.
      const noAdmins = !this.sql.exec("SELECT id FROM admins LIMIT 1").toArray().length;
      if (!row && noAdmins && this.env.PINGO_ADMIN_EMAIL && this.env.PINGO_ADMIN_PASSWORD &&
          email === normEmail(this.env.PINGO_ADMIN_EMAIL) && timingSafeEqual(password, String(this.env.PINGO_ADMIN_PASSWORD))) {
        const created = this.sql.exec("INSERT INTO admins (email, name, pass, created_at) VALUES (?, ?, ?, ?) RETURNING *", email, "Administrador", await hashPassword(password), Date.now()).toArray()[0];
        row = created;
      } else if (!row || !(await verifyPassword(password, row.pass))) {
        this.failAttempt(key);
        throw new HttpError(401, noAdmins && !this.env.PINGO_ADMIN_EMAIL
          ? "Nenhum administrador configurado. Defina os secrets PINGO_ADMIN_EMAIL e PINGO_ADMIN_PASSWORD no Worker."
          : "Credenciais inválidas.");
      }
      this.clearAttempts(key);
      const sess = this.createSession("admin", row.id);
      return json({ ok: true, admin: { id: row.id, email: row.email, name: row.name } }, 200, { "Set-Cookie": sess.cookie });
    }

    const admin = this.sessionUser(request, "admin");
    if (action === "me" && m === "GET") return json({ ok: true, admin: admin ? stripSession(admin) : null });
    if (!admin) throw new HttpError(401, "Sessão administrativa expirada. Entre novamente.");

    if (action === "logout" && m === "POST") return json({ ok: true }, 200, { "Set-Cookie": this.destroySession(request, "admin") });

    if (action === "me" && seg[1] === "password" && m === "PUT") {
      const body = await readBody(request);
      const row = this.sql.exec("SELECT * FROM admins WHERE id = ?", admin.id).toArray()[0];
      if (!(await verifyPassword(String(body.current || ""), row.pass))) throw new HttpError(400, "Senha atual incorreta.");
      if (String(body.password || "").length < 10) throw new HttpError(400, "A nova senha precisa ter pelo menos 10 caracteres.");
      this.sql.exec("UPDATE admins SET pass = ? WHERE id = ?", await hashPassword(String(body.password)), admin.id);
      this.sql.exec("DELETE FROM sessions WHERE kind = 'admin' AND user_id = ? AND id != ?", admin.id, admin.sessionId);
      return json({ ok: true });
    }

    if (action === "dashboard" && m === "GET") return this.dashboard();

    /* ---- produtos ---- */
    if (action === "products") {
      if (!seg[1] && m === "GET") return json({ ok: true, products: this.productRows(true) });
      if (!seg[1] && m === "POST") {
        const p = normalizeProduct(await readBody(request));
        const now = Date.now();
        const { active, ...data } = p;
        const r = this.sql.exec("INSERT INTO products (data, active, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING id", JSON.stringify({ ...data, sold: 0 }), active ? 1 : 0, now, now).toArray()[0];
        return json({ ok: true, product: this.getProduct(r.id) }, 201);
      }
      if (seg[1] && m === "PUT") {
        const cur = this.getProduct(seg[1]);
        if (!cur) throw new HttpError(404, "Produto não encontrado.");
        const p = normalizeProduct({ ...cur, ...(await readBody(request)) });
        this.saveProduct({ ...p, id: cur.id, sold: cur.sold || 0 });
        return json({ ok: true, product: this.getProduct(cur.id) });
      }
      if (seg[1] && m === "DELETE") {
        const cur = this.getProduct(seg[1]);
        if (!cur) throw new HttpError(404, "Produto não encontrado.");
        this.sql.exec("DELETE FROM products WHERE id = ?", cur.id);
        if (this.env.CLIENT_LOGOS) {
          for (const img of cur.images || []) {
            const k = String(img).split("/images/")[1];
            if (k) await this.env.CLIENT_LOGOS.delete("pingochic/" + k).catch(() => {});
          }
        }
        return json({ ok: true });
      }
    }

    /* ---- imagens ---- */
    if (action === "images" && m === "POST") {
      if (!this.env.CLIENT_LOGOS) throw new HttpError(500, "Armazenamento de imagens (R2) não configurado.");
      const type = (request.headers.get("Content-Type") || "").split(";")[0].trim();
      const ext = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" }[type];
      if (!ext) throw new HttpError(400, "Formato de imagem não suportado (use JPG, PNG ou WEBP).");
      const buf = await request.arrayBuffer();
      if (buf.byteLength > MAX_IMAGE_BYTES) throw new HttpError(413, "Imagem muito grande (máx. 4 MB).");
      const key = `${Date.now().toString(36)}-${randomHex(8)}.${ext}`;
      await this.env.CLIENT_LOGOS.put("pingochic/" + key, buf, { httpMetadata: { contentType: type } });
      return json({ ok: true, url: `${PREFIX}/images/${key}` }, 201);
    }

    /* ---- pedidos ---- */
    if (action === "orders") {
      if (!seg[1] && m === "GET") {
        const rows = this.sql.exec("SELECT * FROM orders ORDER BY created_at DESC LIMIT 1000").toArray();
        return json({ ok: true, orders: rows.map(r => this.orderFromRow(r)) });
      }
      if (seg[1] && m === "PUT") {
        const o = this.orderFromRow(this.sql.exec("SELECT * FROM orders WHERE id = ?", Number(seg[1])).toArray()[0]);
        if (!o) throw new HttpError(404, "Pedido não encontrado.");
        const body = await readBody(request);
        if (body.tracking !== undefined) o.tracking = clean(body.tracking, 60);
        if (body.adminNote !== undefined) o.adminNote = clean(body.adminNote, 1000);
        if (body.status && body.status !== o.status) {
          if (!ORDER_STATUSES.includes(body.status)) throw new HttpError(400, "Status inválido.");
          if (o.status === "cancelado") throw new HttpError(400, "Pedido cancelado não pode ser reaberto.");
          if (body.status === "cancelado" && !o.stockRestored) {
            for (const l of o.items) {
              const p = this.getProduct(l.id);
              if (!p) continue;
              const sz = p.sizes.find(x => x.size === l.size);
              if (sz) sz.stock += l.qty;
              p.sold = Math.max(0, (p.sold || 0) - l.qty);
              this.saveProduct(p);
            }
            o.stockRestored = true;
          }
          o.status = body.status;
          o.history = [...(o.history || []), { status: body.status, at: Date.now(), by: admin.email }];
        }
        this.saveOrder(o);
        return json({ ok: true, order: this.orderFromRow(this.sql.exec("SELECT * FROM orders WHERE id = ?", o.id).toArray()[0]) });
      }
    }

    /* ---- clientes ---- */
    if (action === "customers" && m === "GET") {
      const stats = {};
      this.sql.exec("SELECT email, COUNT(*) n, SUM(CASE WHEN status != 'cancelado' THEN total ELSE 0 END) t, MAX(created_at) last FROM orders GROUP BY email").toArray()
        .forEach(r => { stats[r.email] = r; });
      const rows = this.sql.exec("SELECT * FROM customers ORDER BY created_at DESC").toArray().map(r => {
        const c = publicCustomer(r); const st = stats[c.email] || {};
        return { ...c, orders: st.n || 0, spent: round2(st.t || 0), lastOrder: st.last || null, registered: true };
      });
      const registered = new Set(rows.map(r => r.email));
      const guests = this.sql.exec("SELECT email, data, created_at FROM orders WHERE customer_id IS NULL ORDER BY created_at DESC").toArray()
        .filter(r => !registered.has(r.email) && (registered.add(r.email) || true))
        .map(r => { const d = JSON.parse(r.data); const st = stats[r.email] || {}; return { id: null, email: r.email, name: d.customer.name, phone: d.customer.phone, createdAt: r.created_at, orders: st.n || 0, spent: round2(st.t || 0), lastOrder: st.last, registered: false }; });
      return json({ ok: true, customers: [...rows, ...guests] });
    }

    /* ---- configurações, banners, cupons ---- */
    if (action === "settings") {
      if (m === "GET") return json({ ok: true, settings: this.settings() });
      if (m === "PUT") {
        const b = await readBody(request);
        const cur = this.settings();
        const next = { ...cur };
        for (const k of ["storeName", "announcement", "heroTitle", "heroSubtitle", "whatsapp", "instagram", "email", "cnpj", "pixKey", "pixName", "pixCity"]) {
          if (b[k] !== undefined) next[k] = clean(b[k], 300);
        }
        for (const k of ["pixDiscount", "maxInstallments", "freeShippingMin"]) if (b[k] !== undefined) next[k] = Math.max(0, Number(b[k]) || 0);
        next.maxInstallments = Math.min(12, Math.max(1, Math.round(next.maxInstallments)));
        next.pixDiscount = Math.min(30, next.pixDiscount);
        if (Array.isArray(b.shipping)) next.shipping = b.shipping.slice(0, 30).map(r => ({ prefix: String(r.prefix || "").replace(/\D/g, "").slice(0, 5), label: clean(r.label, 80), price: Math.max(0, Number(r.price) || 0), days: clean(r.days, 40) })).filter(r => r.prefix);
        this.kvSet("settings", next);
        return json({ ok: true, settings: next });
      }
    }
    if (action === "banners") {
      if (m === "GET") return json({ ok: true, banners: this.kvGet("banners") || [] });
      if (m === "PUT") {
        const b = await readBody(request);
        const list = (Array.isArray(b.banners) ? b.banners : []).slice(0, 20).map(x => ({
          id: clean(x.id, 20) || randomHex(4), tag: clean(x.tag, 40), title: clean(x.title, 80), text: clean(x.text, 140),
          gender: ["menina", "menino", "bebe", ""].includes(x.gender) ? x.gender : "", color: /^#[0-9a-f]{6}$/i.test(x.color) ? x.color : "#2E3A59",
          image: clean(x.image, 300), active: !!x.active
        }));
        this.kvSet("banners", list);
        return json({ ok: true, banners: list });
      }
    }
    if (action === "coupons") {
      if (m === "GET") return json({ ok: true, coupons: this.kvGet("coupons") || [] });
      if (m === "PUT") {
        const b = await readBody(request);
        const prev = this.kvGet("coupons") || [];
        const list = (Array.isArray(b.coupons) ? b.coupons : []).slice(0, 100).map(x => {
          const code = String(x.code || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30);
          return {
            code, type: ["percent", "fixed", "freeship"].includes(x.type) ? x.type : "percent", value: Math.max(0, Number(x.value) || 0),
            minSubtotal: Math.max(0, Number(x.minSubtotal) || 0), maxUses: Math.max(0, parseInt(x.maxUses) || 0),
            uses: (prev.find(p => p.code === code) || {}).uses || 0, expires: /^\d{4}-\d{2}-\d{2}$/.test(x.expires || "") ? x.expires : "", active: !!x.active
          };
        }).filter(x => x.code);
        this.kvSet("coupons", list);
        return json({ ok: true, coupons: list });
      }
    }

    /* ---- administradores ---- */
    if (action === "admins") {
      if (!seg[1] && m === "GET") return json({ ok: true, admins: this.sql.exec("SELECT id, email, name, created_at FROM admins ORDER BY id").toArray() });
      if (!seg[1] && m === "POST") {
        const b = await readBody(request);
        const email = normEmail(b.email);
        if (!isEmail(email)) throw new HttpError(400, "E-mail inválido.");
        if (String(b.password || "").length < 10) throw new HttpError(400, "A senha precisa ter pelo menos 10 caracteres.");
        if (this.sql.exec("SELECT id FROM admins WHERE email = ?", email).toArray().length) throw new HttpError(409, "Este e-mail já é administrador.");
        this.sql.exec("INSERT INTO admins (email, name, pass, created_at) VALUES (?, ?, ?, ?)", email, clean(b.name, 80) || "Administrador", await hashPassword(String(b.password)), Date.now());
        return json({ ok: true }, 201);
      }
      if (seg[1] && m === "DELETE") {
        const id = Number(seg[1]);
        if (id === admin.id) throw new HttpError(400, "Você não pode remover o próprio acesso.");
        this.sql.exec("DELETE FROM admins WHERE id = ?", id);
        this.sql.exec("DELETE FROM sessions WHERE kind = 'admin' AND user_id = ?", id);
        return json({ ok: true });
      }
    }

    throw new HttpError(404, "Rota não encontrada.");
  }

  dashboard() {
    const now = new Date();
    const tz = -3 * 3600 * 1000; // horário de Brasília
    const local = new Date(now.getTime() + tz);
    const startToday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - tz;
    const startMonth = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - tz;
    const paid = "status IN ('pago','em_separacao','enviado','entregue')";
    const one = (q, ...b) => this.sql.exec(q, ...b).toArray()[0] || {};
    const today = one(`SELECT COUNT(*) n, COALESCE(SUM(total),0) t FROM orders WHERE ${paid} AND created_at >= ?`, startToday);
    const month = one(`SELECT COUNT(*) n, COALESCE(SUM(total),0) t FROM orders WHERE ${paid} AND created_at >= ?`, startMonth);
    const all = one(`SELECT COUNT(*) n, COALESCE(SUM(total),0) t FROM orders WHERE ${paid}`);
    const pending = one("SELECT COUNT(*) n FROM orders WHERE status = 'aguardando_pagamento'");
    const toShip = one("SELECT COUNT(*) n FROM orders WHERE status IN ('pago','em_separacao')");
    const customers = one("SELECT COUNT(*) n FROM customers");

    const days = [];
    for (let i = 13; i >= 0; i--) {
      const start = startToday - i * 86400000;
      const r = one(`SELECT COALESCE(SUM(total),0) t, COUNT(*) n FROM orders WHERE ${paid} AND created_at >= ? AND created_at < ?`, start, start + 86400000);
      days.push({ date: start, total: round2(r.t), orders: r.n });
    }
    const products = this.productRows(true);
    const low = [];
    products.forEach(p => (p.sizes || []).forEach(sz => { if (p.active && sz.stock <= 2) low.push({ id: p.id, name: p.name, size: sz.size, stock: sz.stock }); }));
    const top = products.filter(p => p.sold).sort((a, b) => b.sold - a.sold).slice(0, 5).map(p => ({ id: p.id, name: p.name, sold: p.sold, image: p.images?.[0] || "", icon: p.icon }));
    const recent = this.sql.exec("SELECT * FROM orders ORDER BY created_at DESC LIMIT 6").toArray().map(r => this.orderFromRow(r));
    return json({
      ok: true,
      stats: {
        todayTotal: round2(today.t), todayOrders: today.n, monthTotal: round2(month.t), monthOrders: month.n,
        avgTicket: all.n ? round2(all.t / all.n) : 0, pending: pending.n, toShip: toShip.n, customers: customers.n,
        activeProducts: products.filter(p => p.active).length
      },
      days, low: low.slice(0, 15), top, recent
    });
  }
}

/* ======================================================================== */
/* Utilitários                                                              */
/* ======================================================================== */

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers }
  });
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > 1024 * 1024) throw new HttpError(413, "Requisição muito grande.");
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new HttpError(400, "JSON inválido."); }
}

function clean(v, max = 200) { return String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max); }
function normEmail(v) { return String(v || "").trim().toLowerCase().slice(0, 160); }
function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function brl(n) { return "R$ " + round2(n).toFixed(2).replace(".", ","); }

function validCpf(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +cpf[i] * (10 - i);
  let d = (sum * 10) % 11; if (d === 10) d = 0;
  if (d !== +cpf[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += +cpf[i] * (11 - i);
  d = (sum * 10) % 11; if (d === 10) d = 0;
  return d === +cpf[10];
}

function installmentOptions(total, max) {
  const out = [];
  const n = Math.max(1, Math.min(12, max || 1));
  for (let i = 1; i <= n; i++) {
    const v = round2(total / i);
    if (i > 1 && v < 20) break; // parcela mínima de R$ 20
    out.push({ n: i, value: v });
  }
  return out;
}

const GENDERS = ["menina", "menino", "unissex", "bebe"];
function normalizeProduct(b) {
  const sizes = (Array.isArray(b.sizes) ? b.sizes : []).slice(0, 30)
    .map(x => ({ size: clean(x.size, 10), stock: Math.max(0, parseInt(x.stock) || 0) }))
    .filter(x => x.size);
  if (!sizes.length) sizes.push({ size: "Único", stock: 0 });
  const name = clean(b.name, 120);
  if (!name) throw new HttpError(400, "Informe o nome do produto.");
  const price = round2(b.price);
  if (!(price > 0)) throw new HttpError(400, "Informe um preço válido.");
  return {
    name,
    gender: GENDERS.includes(b.gender) ? b.gender : "unissex",
    category: clean(b.category, 40) || "Diversos",
    price,
    compareAt: round2(b.compareAt) > price ? round2(b.compareAt) : 0,
    sku: clean(b.sku, 40),
    color: clean(b.color, 30),
    sizes,
    images: (Array.isArray(b.images) ? b.images : []).map(x => clean(x, 300)).filter(Boolean).slice(0, 8),
    desc: clean(b.desc, 3000),
    composition: clean(b.composition, 300),
    featured: !!b.featured,
    icon: ["dress", "skirt", "bow", "shirt", "shorts", "cap", "body", "shoe"].includes(b.icon) ? b.icon : (b.gender === "menina" ? "dress" : b.gender === "bebe" ? "body" : "shirt"),
    active: b.active === undefined ? true : !!b.active,
    sold: Number(b.sold) || 0
  };
}

function publicProduct(p) {
  return {
    id: p.id, name: p.name, gender: p.gender, category: p.category, price: p.price, compareAt: p.compareAt, color: p.color,
    sizes: p.sizes.map(x => ({ size: x.size, stock: Math.min(x.stock, 99) })), images: p.images, desc: p.desc,
    composition: p.composition, featured: p.featured, icon: p.icon, sold: p.sold || 0, createdAt: p.createdAt
  };
}

function publicSettings(st) {
  return {
    storeName: st.storeName, announcement: st.announcement, heroTitle: st.heroTitle, heroSubtitle: st.heroSubtitle,
    whatsapp: st.whatsapp, instagram: st.instagram, email: st.email, cnpj: st.cnpj,
    pixEnabled: !!st.pixKey, pixDiscount: st.pixDiscount, maxInstallments: st.maxInstallments, freeShippingMin: st.freeShippingMin
  };
}

function publicCustomer(row) {
  const d = JSON.parse(row.data || "{}");
  return { id: row.id, email: row.email, name: row.name, phone: d.phone || "", cpf: d.cpf || "", address: d.address || null, favorites: d.favorites || [], newsletter: !!d.newsletter, createdAt: row.created_at };
}
function stripSession(u) { const { sessionId, ...rest } = u; return rest; }

/* ---------------- cookies ---------------- */
function buildCookie(name, value, maxAge) {
  return [`${name}=${value}`, "Path=/", "HttpOnly", "Secure", "SameSite=Lax", `Max-Age=${maxAge}`].join("; ");
}
function readCookie(request, name) {
  const h = request.headers.get("Cookie") || "";
  for (const part of h.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return "";
}

/* ---------------- senhas (PBKDF2-SHA256) ---------------- */
function randomHex(bytes) {
  const b = new Uint8Array(bytes); crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function pbkdf2(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(password) {
  const salt = randomHex(16);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${await pbkdf2(password, salt, PBKDF2_ITERATIONS)}`;
}
async function verifyPassword(password, stored) {
  const [alg, it, salt, hash] = String(stored || "").split("$");
  if (alg !== "pbkdf2" || !salt || !hash) return false;
  return timingSafeEqual(await pbkdf2(password, salt, Number(it)), hash);
}
function timingSafeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/* ---------------- Pix "copia e cola" (BR Code / EMV) ---------------- */
function ascii(s, max) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 .\-@+]/g, "").toUpperCase().trim().slice(0, max);
}
function emv(id, value) { return id + String(value.length).padStart(2, "0") + value; }
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
export function pixPayload({ key, name, city, amount, txid }) {
  const k = String(key).trim();
  const payload =
    emv("00", "01") +
    emv("26", emv("00", "br.gov.bcb.pix") + emv("01", k)) +
    emv("52", "0000") + emv("53", "986") +
    emv("54", round2(amount).toFixed(2)) +
    emv("58", "BR") + emv("59", ascii(name, 25) || "PINGO CHIC") + emv("60", ascii(city, 15) || "SAO PAULO") +
    emv("62", emv("05", String(txid).replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***")) +
    "6304";
  return payload + crc16(payload);
}
