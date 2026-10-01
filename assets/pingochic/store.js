/* Pingo Chic — loja pública (visitantes e clientes logados) */
(function () {
  "use strict";
  const { api, money, esc, svg, productIcon, toast, imgUrl, masks, bindMasks, validCpf, onlyDigits, STATUS, GENDER_LABEL, fmtDate, copyText, waLink } = PC;

  const COLOR_HEX = { Rosa: "#E99BB8", Azul: "#7FA9C9", Amarelo: "#F2CF73", Verde: "#8DBF9E", Cinza: "#B8B3AC", Branco: "#F7F4EE", Bege: "#E7D7C1", Preto: "#2B2B2B", Vermelho: "#D9645B", Lilás: "#B9A3D6", Marrom: "#9B7458", Laranja: "#F0A266", Estampado: "linear-gradient(135deg,#E99BB8,#F2CF73,#7FA9C9)" };
  const GENDERS = [
    { key: "menina", label: "Menina", cls: "menina", icon: "dress", text: "Vestidos, saias e conjuntos" },
    { key: "menino", label: "Menino", cls: "menino", icon: "shirt", text: "Camisetas, bermudas e conjuntos" },
    { key: "bebe", label: "Bebê", cls: "bebe", icon: "body", text: "Bodies, macacões e enxoval" },
    { key: "acessorios", label: "Acessórios", cls: "acess", icon: "bow", text: "Laços, bonés e mais" }
  ];
  const BEE = "../assets/pingochic/img/bee-120.webp", LOGO = "../assets/pingochic/img/logo-256.webp", LOGO_LG = "../assets/pingochic/img/logo-512.webp";
  const LS_CART = "pingochic.cart.v2", LS_FAV = "pingochic.fav.v2";

  const S = {
    settings: {}, products: [], banners: [], categories: [],
    user: null,
    cart: load(LS_CART, []),
    favs: load(LS_FAV, []),
    coupon: "",
    lastOrder: null,
    quote: null
  };
  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }
  function save() {
    localStorage.setItem(LS_CART, JSON.stringify(S.cart));
    if (!S.user) localStorage.setItem(LS_FAV, JSON.stringify(S.favs));
  }
  const $ = (sel, root = document) => root.querySelector(sel);
  const app = () => $("#app");
  const byId = (id) => S.products.find((p) => p.id === Number(id));
  const isNew = (p) => Date.now() - (p.createdAt || 0) < 30 * 86400000;
  const stockOf = (p) => (p.sizes || []).reduce((a, s) => a + s.stock, 0);
  const isAccessory = (p) => /acess/i.test(p.category);
  const media = (p, size = 72) => p.images?.[0]
    ? `<img src="${esc(imgUrl(p.images[0]))}" alt="${esc(p.name)}" loading="lazy">`
    : productIcon(p.icon, size);
  const installText = (price) => {
    const max = S.settings.maxInstallments || 1;
    let n = max; while (n > 1 && price / n < 20) n--;
    return n > 1 ? `ou ${n}x de ${money(price / n)} sem juros` : "";
  };

  /* ===================================================== */
  /* Inicialização                                         */
  /* ===================================================== */
  async function init() {
    renderShell();
    try {
      const [cat, me] = await Promise.all([api("/catalog"), api("/auth/me").catch(() => ({ user: null }))]);
      Object.assign(S, { settings: cat.settings, products: cat.products, banners: cat.banners, categories: cat.categories });
      setUser(me.user, false);
    } catch (e) {
      app().innerHTML = `<div class="wrap empty"><div class="ic">${svg("refresh", 28)}</div><h3>Não foi possível carregar a loja</h3><p>${esc(e.message)}</p><button class="btn btn-dark" onclick="location.reload()">Tentar novamente</button></div>`;
      return;
    }
    // remove do carrinho itens que não existem mais
    S.cart = S.cart.filter((c) => byId(c.id));
    save();
    applySettings();
    updateBadges();
    window.addEventListener("hashchange", route);
    route();
  }

  function setUser(user, rerender = true) {
    S.user = user;
    if (user) {
      // mescla favoritos do visitante com a conta
      const merged = [...new Set([...(user.favorites || []), ...S.favs])];
      if (merged.length !== (user.favorites || []).length) api("/me/favorites", { method: "PUT", body: { favorites: merged } }).catch(() => {});
      S.favs = merged;
      localStorage.removeItem(LS_FAV);
    } else {
      S.favs = load(LS_FAV, []);
    }
    renderAccountChip();
    updateBadges();
    if (rerender) route();
  }

  function applySettings() {
    const st = S.settings;
    $("#announce").textContent = st.announcement || "";
    $("#announce").style.display = st.announcement ? "" : "none";
    document.title = `${st.storeName || "Pingo Chic"} — Moda infantil para todo o Brasil`;
    $("#footer").innerHTML = footerHtml();
  }

  /* ===================================================== */
  /* Estrutura fixa                                        */
  /* ===================================================== */
  function renderShell() {
    document.body.innerHTML = `
      <div class="announce" id="announce"></div>
      <header class="header">
        <div class="wrap header-in">
          <button class="tool menu-btn" aria-label="Menu" data-act="mnav">${svg("menu", 22)}</button>
          <a class="logo" href="#/" aria-label="Pingo Chic — início">
            <img class="logo-bee" src="${BEE}" alt="" width="62" height="53">
            <span><span class="logo-word">Pingo<em>Chic</em></span><span class="logo-sub">Moda infantil</span></span>
          </a>
          <nav class="nav" id="nav">
            <a href="#/loja?g=menina">Menina</a>
            <a href="#/loja?g=menino">Menino</a>
            <a href="#/loja?g=bebe">Bebê</a>
            <a href="#/loja?g=acessorios">Acessórios</a>
            <a href="#/loja?novidades=1">Novidades</a>
            <a href="#/loja?ofertas=1" class="sale">Ofertas</a>
          </nav>
          <div class="tools">
            <button class="tool" aria-label="Buscar" data-act="search">${svg("search", 21)}</button>
            <a class="tool" href="#/favoritos" aria-label="Favoritos">${svg("heart", 21)}<span class="count" id="fav-count"></span></a>
            <div style="position:relative" id="acct-wrap"></div>
            <button class="tool" aria-label="Sacola" data-act="cart">${svg("bag", 21)}<span class="count" id="cart-count"></span></button>
          </div>
        </div>
        <div class="searchbar" id="searchbar">
          <div class="wrap">
            ${svg("search", 20)}
            <input id="search-input" type="search" placeholder="O que você procura? Ex: vestido, body, tamanho 4..." autocomplete="off">
            <button class="tool" data-act="search" aria-label="Fechar busca">${svg("close", 20)}</button>
          </div>
        </div>
      </header>
      <main id="app"><div class="wrap" style="padding:60px 0"><div class="grid">${'<div class="skeleton" style="aspect-ratio:4/5"></div>'.repeat(8)}</div></div></main>
      <footer class="footer" id="footer"></footer>
      <div class="scrim" id="scrim" data-act="close-all"></div>
      <aside class="drawer" id="drawer" aria-label="Sacola de compras"></aside>
      <nav class="mnav" id="mnav">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <span class="mnav-logo"><img src="${BEE}" alt="" style="border-radius:0;width:46px;height:auto"><span class="logo-word" style="font-size:24px">Pingo<em>Chic</em></span></span>
          <button class="tool" data-act="close-all">${svg("close", 20)}</button>
        </div>
        <a href="#/loja?g=menina">Menina ${svg("chevron", 18)}</a>
        <a href="#/loja?g=menino">Menino ${svg("chevron", 18)}</a>
        <a href="#/loja?g=bebe">Bebê ${svg("chevron", 18)}</a>
        <a href="#/loja?g=acessorios">Acessórios ${svg("chevron", 18)}</a>
        <a href="#/loja?novidades=1">Novidades ${svg("chevron", 18)}</a>
        <a href="#/loja?ofertas=1" style="color:var(--rose-d)">Ofertas ${svg("chevron", 18)}</a>
        <a href="#/rastrear">Acompanhar pedido ${svg("chevron", 18)}</a>
        <a href="#/conta">Minha conta ${svg("chevron", 18)}</a>
      </nav>
      <div class="modal-wrap" id="modal"><div class="modal" id="modal-box"></div></div>`;

    document.addEventListener("click", onClick);
    let t;
    $("#search-input").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => { location.hash = "#/loja?q=" + encodeURIComponent(e.target.value.trim()); }, 300);
    });
    $("#modal").addEventListener("mousedown", (e) => { if (e.target.id === "modal") closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); closeAll(); } });
  }

  function renderAccountChip() {
    const w = $("#acct-wrap");
    if (!w) return;
    if (S.user) {
      const first = S.user.name.split(" ")[0];
      w.innerHTML = `
        <button class="acct-chip" data-act="acct-menu" aria-haspopup="true"><span class="av">${esc(first[0].toUpperCase())}</span><span class="nm">Olá, ${esc(first)}</span></button>
        <div class="dropdown" id="acct-dd">
          <div class="who"><b>${esc(S.user.name)}</b><span>${esc(S.user.email)}</span></div>
          <a href="#/conta/pedidos">${svg("box", 18)} Meus pedidos</a>
          <a href="#/favoritos">${svg("heart", 18)} Favoritos</a>
          <a href="#/conta/dados">${svg("user", 18)} Meus dados</a>
          <a href="#/conta/endereco">${svg("home", 18)} Endereço</a>
          <button data-act="logout">${svg("logout", 18)} Sair</button>
        </div>`;
    } else {
      w.innerHTML = `<button class="tool" aria-label="Entrar" data-act="login">${svg("user", 21)}</button>`;
    }
  }

  function updateBadges() {
    const n = S.cart.reduce((a, c) => a + c.qty, 0);
    const cc = $("#cart-count"); if (cc) { cc.textContent = n || ""; cc.dataset.n = n; }
    const fc = $("#fav-count"); if (fc) { fc.textContent = S.favs.length || ""; fc.dataset.n = S.favs.length; }
  }

  /* ===================================================== */
  /* Eventos                                               */
  /* ===================================================== */
  function onClick(e) {
    const el = e.target.closest("[data-act]");
    const dd = $("#acct-dd");
    if (dd && !e.target.closest("#acct-wrap")) dd.classList.remove("open");
    if (!el) return;
    const act = el.dataset.act, id = Number(el.dataset.id);
    switch (act) {
      case "search": {
        const sb = $("#searchbar"); sb.classList.toggle("open");
        if (sb.classList.contains("open")) $("#search-input").focus();
        break;
      }
      case "cart": openCart(); break;
      case "mnav": $("#mnav").classList.add("open"); $("#scrim").classList.add("open"); break;
      case "close-all": closeAll(); break;
      case "login": openAuth("login"); break;
      case "signup": openAuth("signup"); break;
      case "acct-menu": $("#acct-dd").classList.toggle("open"); break;
      case "logout": logout(); break;
      case "fav": e.preventDefault(); e.stopPropagation(); toggleFav(id); break;
      case "quick": {
        e.preventDefault(); e.stopPropagation();
        const p = byId(id);
        const avail = p.sizes.filter((s) => s.stock > 0);
        if (avail.length === 1) addToCart(id, avail[0].size, 1);
        else location.hash = "#/p/" + id;
        break;
      }
      case "qty": changeQty(el.dataset.key, Number(el.dataset.d)); break;
      case "rm": removeLine(el.dataset.key); break;
      case "go-checkout": closeAll(); location.hash = "#/checkout"; break;
      case "close-modal": closeModal(); break;
    }
  }
  function closeAll() {
    ["#drawer", "#scrim", "#mnav", "#filters"].forEach((s) => $(s)?.classList.remove("open"));
    document.body.style.overflow = "";
  }

  /* ===================================================== */
  /* Rotas                                                 */
  /* ===================================================== */
  function parseHash() {
    const h = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = h.split("?");
    return { parts: path.split("/").filter(Boolean), q: new URLSearchParams(qs || "") };
  }
  function route() {
    closeAll();
    closeModal();
    const { parts, q } = parseHash();
    const r = parts[0] || "";
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", location.hash && a.getAttribute("href") === location.hash));
    if (r !== "loja") { $("#searchbar").classList.remove("open"); }
    window.scrollTo(0, 0);
    if (!r) return renderHome();
    if (r === "loja") return renderList(q);
    if (r === "p") return renderProduct(Number(parts[1]));
    if (r === "favoritos") return renderFavorites();
    if (r === "checkout") return renderCheckout();
    if (r === "pedido") return renderOrderDone(Number(parts[1]));
    if (r === "rastrear") return renderTrack();
    if (r === "conta") return renderAccount(parts[1] || "pedidos");
    if (r === "ajuda") return renderHelp(parts[1]);
    renderHome();
  }

  /* ===================================================== */
  /* Home                                                  */
  /* ===================================================== */
  function renderHome() {
    const st = S.settings;
    const featured = S.products.filter((p) => p.featured).slice(0, 8);
    const best = [...S.products].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 8);
    const news = [...S.products].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
    const imgs = S.products.filter((p) => p.images?.length).slice(0, 3);
    const tile = (cls, i, icon) => `<div class="tile ${cls}">${imgs[i] ? `<img src="${esc(imgUrl(imgs[i].images[0]))}" alt="">` : productIcon(icon, i ? 90 : 150)}</div>`;
    const title = esc(st.heroTitle || "").replace(/(charme)/i, "<em>$1</em>").replace(/(conforto)/i, '<em class="blue">$1</em>');
    app().innerHTML = `
      <section class="hero">
        <div class="blob" style="width:380px;height:380px;background:#F7C9D8;left:-120px;top:-80px"></div>
        <div class="blob" style="width:300px;height:300px;background:#CFE3EE;right:-60px;bottom:-120px"></div>
        <div class="wrap hero-in" style="position:relative">
          <div>
            <span class="eyebrow">Coleção ${new Date().getFullYear()}</span>
            <h1>${title}</h1>
            <p>${esc(st.heroSubtitle)}</p>
            <div class="hero-ctas">
              <a class="btn btn-dark btn-lg" href="#/loja?g=menina">Moda menina</a>
              <a class="btn btn-line btn-lg" href="#/loja?g=menino">Moda menino</a>
            </div>
            <div class="hero-stats">
              <div><b>27 UFs</b><span>Entregamos em todo o Brasil</span></div>
              <div><b>${st.maxInstallments || 1}x</b><span>Sem juros no cartão</span></div>
              <div><b>${st.pixDiscount || 0}% OFF</b><span>Pagando no Pix</span></div>
            </div>
          </div>
          <div class="collage" aria-hidden="true">
            ${imgs[0] ? tile("t1", 0, "dress") : `<div class="tile t1 brand-tile"><img src="${LOGO_LG}" alt="Pingo Chic"></div>`}${tile("t2", imgs[0] ? 1 : 0, "dress")}${tile("t3", imgs[0] ? 2 : 1, "shirt")}
            <div class="badge"><span class="ic">${svg("truck", 22)}</span><div><b>Frete grátis</b>acima de ${money(st.freeShippingMin)}</div></div>
          </div>
        </div>
      </section>

      <div class="wrap">${trustHtml()}</div>

      ${S.banners.length ? `<section class="section tight"><div class="wrap"><div class="promos">${S.banners.slice(0, 3).map(bannerHtml).join("")}</div></div></section>` : ""}

      <section class="section tight">
        <div class="wrap">
          <div class="sec-head"><div><h2>Compre por categoria</h2><p>Do primeiro body ao look de festa.</p></div></div>
          <div class="cats">${GENDERS.map((g) => `
            <a class="cat ${g.cls}" href="#/loja?g=${g.key}">
              <span class="ic">${productIcon(g.icon, 56)}</span>
              <div><h3>${g.label}</h3><span>${g.text} ${svg("chevron", 14)}</span></div>
            </a>`).join("")}
          </div>
        </div>
      </section>

      ${featured.length ? `<section class="section"><div class="wrap">
        <div class="sec-head"><div><h2>Destaques da estação</h2><p>As peças queridinhas das nossas clientes.</p></div><a class="btn btn-line btn-sm" href="#/loja">Ver tudo ${svg("chevron", 16)}</a></div>
        <div class="grid">${featured.map(cardHtml).join("")}</div>
      </div></section>` : ""}

      <section class="section tight"><div class="wrap">
        <div class="sec-head"><div><h2>Acabou de chegar</h2><p>Novidades fresquinhas toda semana.</p></div><a class="btn btn-line btn-sm" href="#/loja?novidades=1">Novidades ${svg("chevron", 16)}</a></div>
        <div class="grid">${news.map(cardHtml).join("")}</div>
      </div></section>

      ${best.some((p) => p.sold) ? `<section class="section tight"><div class="wrap">
        <div class="sec-head"><div><h2>Mais vendidos</h2></div></div>
        <div class="grid">${best.slice(0, 4).map(cardHtml).join("")}</div>
      </div></section>` : ""}

      <section class="section"><div class="wrap">
        <div class="news">
          <div><h2>Ganhe <em>10% OFF</em> na primeira compra</h2><p>Crie sua conta e use o cupom <b style="color:#fff">BEMVINDA10</b>. Você ainda acompanha pedidos e salva seus favoritos.</p></div>
          <div>${S.user
            ? `<a class="btn btn-rose btn-lg btn-block" href="#/loja">Aproveitar agora</a>`
            : `<button class="btn btn-rose btn-lg btn-block" data-act="signup">Criar minha conta</button>`}</div>
        </div>
      </div></section>`;
  }

  function trustHtml() {
    return `<div class="trust">
      <div><span class="ic">${svg("truck", 22)}</span><div><b>Entrega para todo o Brasil</b><span>Envio rastreável para os 27 estados</span></div></div>
      <div><span class="ic">${svg("card", 22)}</span><div><b>Até ${S.settings.maxInstallments || 1}x sem juros</b><span>ou ${S.settings.pixDiscount || 0}% de desconto no Pix</span></div></div>
      <div><span class="ic">${svg("refresh", 22)}</span><div><b>Primeira troca grátis</b><span>Em até 30 dias após o recebimento</span></div></div>
      <div><span class="ic">${svg("shield", 22)}</span><div><b>Compra 100% segura</b><span>Seus dados protegidos</span></div></div>
    </div>`;
  }

  function bannerHtml(b) {
    const href = b.gender ? `#/loja?g=${b.gender}` : "#/loja";
    return `<a class="promo" href="${href}" style="background:${esc(b.color)}">
      ${b.image ? `<img class="bgimg" src="${esc(imgUrl(b.image))}" alt="">` : ""}
      <span class="go">${svg("chevron", 18)}</span>
      <div style="position:relative"><span class="tag">${esc(b.tag)}</span><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></div>
    </a>`;
  }

  function cardHtml(p) {
    const off = p.compareAt > p.price ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
    const out = stockOf(p) === 0;
    const fav = S.favs.includes(p.id);
    return `<article class="card">
      <a class="media g-${p.gender}" href="#/p/${p.id}" aria-label="${esc(p.name)}">
        <div class="flags">${out ? '<span class="flag out">Esgotado</span>' : ""}${off ? `<span class="flag sale">-${off}%</span>` : ""}${isNew(p) && !off ? '<span class="flag new">Novo</span>' : ""}</div>
        ${media(p, 90)}
        ${out ? "" : `<button class="btn btn-dark btn-sm btn-block quick" data-act="quick" data-id="${p.id}">${svg("bag", 16)} Adicionar à sacola</button>`}
      </a>
      <button class="fav ${fav ? "on" : ""}" data-act="fav" data-id="${p.id}" aria-label="${fav ? "Remover dos" : "Adicionar aos"} favoritos">${svg("heart", 18)}</button>
      <a class="info" href="#/p/${p.id}">
        <div class="cat-l">${esc(p.category)}</div>
        <h3>${esc(p.name)}</h3>
        <div class="price"><b>${money(p.price)}</b>${off ? `<s>${money(p.compareAt)}</s>` : ""}<span class="inst">${installText(p.price)}</span></div>
      </a>
    </article>`;
  }

  /* ===================================================== */
  /* Listagem com filtros                                  */
  /* ===================================================== */
  function renderList(q) {
    const g = q.get("g") || "", term = (q.get("q") || "").trim();
    const f = {
      sizes: q.getAll("t"), colors: q.getAll("c"), cats: q.getAll("cat"),
      price: q.get("preco") || "", sort: q.get("ord") || "relevancia",
      sale: q.get("ofertas") === "1", news: q.get("novidades") === "1"
    };
    let base = S.products;
    if (g === "acessorios") base = base.filter(isAccessory);
    else if (g) base = base.filter((p) => p.gender === g || p.gender === "unissex");
    if (f.sale) base = base.filter((p) => p.compareAt > p.price);
    if (f.news) base = base.filter(isNew).length ? base.filter(isNew) : [...base].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
    if (term) {
      const t = norm(term);
      base = base.filter((p) => norm(`${p.name} ${p.category} ${p.color} ${p.desc} ${GENDER_LABEL[p.gender]} ${p.sizes.map((s) => "tamanho " + s.size).join(" ")}`).includes(t));
    }
    const sizes = uniq(base.flatMap((p) => p.sizes.map((s) => s.size))).sort(sizeSort);
    const colors = uniq(base.map((p) => p.color).filter(Boolean)).sort();
    const cats = uniq(base.map((p) => p.category)).sort();

    let items = base.filter((p) =>
      (!f.sizes.length || p.sizes.some((s) => f.sizes.includes(s.size) && s.stock > 0)) &&
      (!f.colors.length || f.colors.includes(p.color)) &&
      (!f.cats.length || f.cats.includes(p.category)) &&
      (!f.price || inRange(p.price, f.price)));
    const sorters = {
      relevancia: (a, b) => (stockOf(b) > 0) - (stockOf(a) > 0) || b.featured - a.featured || (b.sold || 0) - (a.sold || 0),
      menor: (a, b) => a.price - b.price, maior: (a, b) => b.price - a.price,
      novos: (a, b) => b.createdAt - a.createdAt, vendidos: (a, b) => (b.sold || 0) - (a.sold || 0)
    };
    items.sort(sorters[f.sort] || sorters.relevancia);

    const title = term ? `Resultados para “${esc(term)}”` : f.sale ? "Ofertas" : f.news ? "Novidades" : g === "acessorios" ? "Acessórios" : g ? `Moda ${GENDER_LABEL[g].toLowerCase()}` : "Todos os produtos";
    const link = (mut) => { const n = new URLSearchParams(q); mut(n); return "#/loja?" + n.toString(); };
    const toggle = (key, val) => link((n) => { const all = n.getAll(key); n.delete(key); (all.includes(val) ? all.filter((x) => x !== val) : [...all, val]).forEach((v) => n.append(key, v)); });
    const prices = [["0-50", "Até R$ 50"], ["50-100", "R$ 50 a R$ 100"], ["100-200", "R$ 100 a R$ 200"], ["200-9999", "Acima de R$ 200"]];
    const hasFilters = f.sizes.length || f.colors.length || f.cats.length || f.price;

    app().innerHTML = `
      <div class="wrap">
        <div class="crumbs"><a href="#/">Início</a> ${svg("chevron", 12)} <span>${title}</span></div>
        <div class="list-head"><div><h1>${title}</h1><p>${items.length} ${items.length === 1 ? "produto" : "produtos"}</p></div></div>
        <div class="list-layout">
          <aside class="filters" id="filters">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px" class="filter-toggle-head">
              <b style="font-size:15px">Filtrar</b>
              ${hasFilters ? `<a class="link" href="${link((n) => ["t", "c", "cat", "preco"].forEach((k) => n.delete(k)))}">Limpar</a>` : ""}
              <button class="tool filter-toggle" data-act="close-all">${svg("close", 20)}</button>
            </div>
            ${cats.length > 1 ? `<div class="fgroup"><h4>Categoria</h4>${cats.map((c) => `<a class="opt ${f.cats.includes(c) ? "on" : ""}" href="${toggle("cat", c)}"><span class="bx">${f.cats.includes(c) ? svg("check", 12) : ""}</span>${esc(c)}<span class="n">${base.filter((p) => p.category === c).length}</span></a>`).join("")}</div>` : ""}
            ${sizes.length ? `<div class="fgroup"><h4>Tamanho</h4><div class="chips">${sizes.map((s) => `<a class="chip ${f.sizes.includes(s) ? "on" : ""}" href="${toggle("t", s)}">${esc(s)}</a>`).join("")}</div></div>` : ""}
            ${colors.length ? `<div class="fgroup"><h4>Cor</h4><div class="chips">${colors.map((c) => `<a class="chip ${f.colors.includes(c) ? "on" : ""}" href="${toggle("c", c)}"><span class="sw" style="background:${COLOR_HEX[c] || "#ddd"}"></span>${esc(c)}</a>`).join("")}</div></div>` : ""}
            <div class="fgroup"><h4>Preço</h4>${prices.map(([v, l]) => `<a class="opt ${f.price === v ? "on" : ""}" href="${link((n) => f.price === v ? n.delete("preco") : n.set("preco", v))}"><span class="bx">${f.price === v ? svg("check", 12) : ""}</span>${l}</a>`).join("")}</div>
            <button class="btn btn-dark btn-block filter-toggle" style="margin-top:20px" data-act="close-all">Ver ${items.length} produtos</button>
          </aside>
          <div>
            <div class="toolbar">
              <button class="btn btn-line btn-sm filter-toggle" id="open-filters">${svg("filter", 16)} Filtrar</button>
              <span class="count">${hasFilters ? "Filtros ativos" : ""}</span>
              <select id="sort" aria-label="Ordenar">
                ${[["relevancia", "Mais relevantes"], ["vendidos", "Mais vendidos"], ["novos", "Lançamentos"], ["menor", "Menor preço"], ["maior", "Maior preço"]].map(([v, l]) => `<option value="${v}" ${f.sort === v ? "selected" : ""}>${l}</option>`).join("")}
              </select>
            </div>
            ${items.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">${items.map(cardHtml).join("")}</div>`
              : `<div class="empty"><div class="ic">${svg("search", 28)}</div><h3>Nenhum produto encontrado</h3><p>Tente remover alguns filtros ou buscar por outro termo.</p><a class="btn btn-dark" href="#/loja">Ver todos os produtos</a></div>`}
          </div>
        </div>
      </div>`;
    $("#sort").onchange = (e) => { location.hash = link((n) => n.set("ord", e.target.value)); };
    $("#open-filters").onclick = () => $("#filters").classList.add("open");
    if (term) { $("#searchbar").classList.add("open"); const si = $("#search-input"); if (si.value !== term) si.value = term; }
  }
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const uniq = (a) => [...new Set(a)];
  const SIZE_ORDER = ["RN", "P", "M", "G", "GG", "1", "2", "3", "4", "6", "8", "10", "12", "14", "16", "Único"];
  const sizeSort = (a, b) => (SIZE_ORDER.indexOf(a) + 1 || 99) - (SIZE_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b, "pt", { numeric: true });
  const inRange = (v, r) => { const [a, b] = r.split("-").map(Number); return v >= a && v <= b; };

  /* ===================================================== */
  /* Página de produto                                     */
  /* ===================================================== */
  function renderProduct(id) {
    const p = byId(id);
    if (!p) { app().innerHTML = `<div class="wrap empty"><h3>Produto não encontrado</h3><p>Ele pode ter saído do catálogo.</p><a class="btn btn-dark" href="#/loja">Ver produtos</a></div>`; return; }
    const off = p.compareAt > p.price ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
    const sizes = [...p.sizes].sort((a, b) => sizeSort(a.size, b.size));
    const avail = sizes.filter((s) => s.stock > 0);
    let sel = avail.length === 1 ? avail[0].size : null, qty = 1, imgIdx = 0;
    const imgs = p.images || [];
    const related = S.products.filter((x) => x.id !== p.id && (x.gender === p.gender || x.category === p.category)).slice(0, 4);
    const gLabel = isAccessory(p) ? "Acessórios" : GENDER_LABEL[p.gender];
    const gKey = isAccessory(p) ? "acessorios" : p.gender;

    app().innerHTML = `
      <div class="wrap">
        <div class="crumbs"><a href="#/">Início</a> ${svg("chevron", 12)} <a href="#/loja?g=${gKey}">${gLabel}</a> ${svg("chevron", 12)} <span>${esc(p.name)}</span></div>
        <div class="pdp">
          <div class="gallery">
            <div class="thumbs" id="thumbs">${imgs.length > 1 ? imgs.map((src, i) => `<button class="${i ? "" : "on"}" data-i="${i}"><img src="${esc(imgUrl(src))}" alt=""></button>`).join("") : ""}</div>
            <div class="main-media card"><div class="media g-${p.gender}" style="aspect-ratio:4/5;width:100%;border-radius:24px;cursor:default" id="main-media">${imgs[0] ? `<img src="${esc(imgUrl(imgs[0]))}" alt="${esc(p.name)}">` : productIcon(p.icon, 180)}</div></div>
          </div>
          <div>
            <div class="cat-l" style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-weight:700">${esc(gLabel)} · ${esc(p.category)}</div>
            <h1>${esc(p.name)}</h1>
            <div class="price"><b>${money(p.price)}</b>${off ? `<s>${money(p.compareAt)}</s><span class="flag sale">-${off}%</span>` : ""}</div>
            <div style="font-size:14px;color:var(--ink-2);margin-top:4px">${installText(p.price)}</div>
            ${S.settings.pixEnabled !== false && S.settings.pixDiscount ? `<div class="pix-line">${svg("pix", 16)} ${money(p.price * (1 - S.settings.pixDiscount / 100))} no Pix (${S.settings.pixDiscount}% OFF)</div>` : ""}
            ${p.color ? `<div class="opt-title">Cor <span>${esc(p.color)}</span></div><div class="swatches"><span class="swatch" style="width:30px;height:30px;background:${COLOR_HEX[p.color] || "#ddd"};box-shadow:0 0 0 2px #fff,0 0 0 3px var(--ink)"></span></div>` : ""}
            <div class="opt-title">Tamanho <a class="link" href="#/ajuda/tamanhos" style="font-size:13px">Guia de tamanhos</a></div>
            <div class="sizes" id="sizes">${sizes.map((s) => `<button class="size ${s.stock <= 0 ? "out" : ""} ${sel === s.size ? "on" : ""}" data-s="${esc(s.size)}">${esc(s.size)}</button>`).join("")}</div>
            <div class="stock-note" id="stock-note"></div>
            <div class="buy-row">
              <div class="qty"><button id="qdec" aria-label="Diminuir">${svg("minus", 16)}</button><span id="qv">1</span><button id="qinc" aria-label="Aumentar">${svg("plus", 16)}</button></div>
              <button class="btn btn-dark btn-lg" id="add" ${avail.length ? "" : "disabled"}>${avail.length ? `${svg("bag", 18)} Adicionar à sacola` : "Esgotado"}</button>
              <button class="fav-lg ${S.favs.includes(p.id) ? "on" : ""}" data-act="fav" data-id="${p.id}" aria-label="Favoritar">${svg("heart", 20)}</button>
            </div>
            <div class="ship-calc">
              <h4>${svg("truck", 18)} Calcule o frete e o prazo</h4>
              <form id="ship-form"><input data-mask="cep" id="ship-cep" placeholder="Digite seu CEP" inputmode="numeric" value="${esc(masks.cep(S.user?.address?.cep || localStorage.getItem("pingochic.cep") || ""))}"><button class="btn btn-line btn-sm">Calcular</button></form>
              <div class="ship-res" id="ship-res"></div>
            </div>
            <div class="perks">
              <div class="perk">${svg("refresh", 20)}<div><b>Troca fácil</b>30 dias para trocar</div></div>
              <div class="perk">${svg("shield", 20)}<div><b>Compra segura</b>Dados protegidos</div></div>
              <div class="perk">${svg("truck", 20)}<div><b>Todo o Brasil</b>Envio rastreável</div></div>
            </div>
            <div class="acc">
              <details open><summary>Descrição</summary><div class="body">${esc(p.desc || "—")}</div></details>
              ${p.composition ? `<details><summary>Composição e cuidados</summary><div class="body">${esc(p.composition)}</div></details>` : ""}
              <details><summary>Trocas e devoluções</summary><div class="body">A primeira troca é gratuita em até 30 dias após o recebimento. A peça deve estar sem uso, com etiqueta. Para arrependimento, você tem 7 dias corridos (Código de Defesa do Consumidor, art. 49).</div></details>
            </div>
          </div>
        </div>
        ${related.length ? `<section class="section tight" style="padding-top:0"><div class="sec-head"><h2>Combine com</h2></div><div class="grid">${related.map(cardHtml).join("")}</div></section>` : ""}
      </div>`;

    const refreshSize = () => {
      document.querySelectorAll("#sizes .size").forEach((b) => b.classList.toggle("on", b.dataset.s === sel));
      const s = p.sizes.find((x) => x.size === sel);
      $("#stock-note").textContent = s && s.stock <= 3 ? `Restam apenas ${s.stock} ${s.stock === 1 ? "unidade" : "unidades"} neste tamanho!` : "";
      if (s && qty > s.stock) { qty = s.stock; $("#qv").textContent = qty; }
    };
    refreshSize();
    $("#sizes").onclick = (e) => { const b = e.target.closest(".size"); if (b) { sel = b.dataset.s; refreshSize(); } };
    $("#qdec").onclick = () => { qty = Math.max(1, qty - 1); $("#qv").textContent = qty; };
    $("#qinc").onclick = () => { const s = p.sizes.find((x) => x.size === sel); qty = Math.min(s ? s.stock : 10, qty + 1, 20); $("#qv").textContent = qty; };
    $("#add").onclick = () => {
      if (!sel) { $("#stock-note").textContent = "Selecione um tamanho."; $("#sizes").animate([{ transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "none" }], 250); return; }
      addToCart(p.id, sel, qty);
    };
    $("#thumbs").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      imgIdx = Number(b.dataset.i);
      $("#main-media").innerHTML = `<img src="${esc(imgUrl(imgs[imgIdx]))}" alt="${esc(p.name)}">`;
      document.querySelectorAll("#thumbs button").forEach((x, i) => x.classList.toggle("on", i === imgIdx));
    };
    bindMasks(app());
    $("#ship-form").onsubmit = async (e) => {
      e.preventDefault();
      const cep = onlyDigits($("#ship-cep").value);
      const out = $("#ship-res");
      if (cep.length !== 8) { out.textContent = "Digite um CEP válido."; return; }
      localStorage.setItem("pingochic.cep", cep);
      out.textContent = "Calculando…";
      try {
        const { quote } = await api("/quote", { method: "POST", body: { items: [{ id: p.id, size: sel || avail[0]?.size, qty }], cep } });
        out.innerHTML = quote.shipping.free
          ? `<b style="color:var(--sage)">Frete grátis</b> · ${esc(quote.shipping.days)} <span style="color:var(--muted)">(${esc(quote.shipping.region)})</span>`
          : `<b>${money(quote.shipping.price)}</b> · ${esc(quote.shipping.days)} <span style="color:var(--muted)">(${esc(quote.shipping.region)})</span><br><span style="color:var(--muted)">Frete grátis em compras acima de ${money(S.settings.freeShippingMin)}</span>`;
      } catch (err) { out.textContent = err.message; }
    };
  }

  /* ===================================================== */
  /* Favoritos                                             */
  /* ===================================================== */
  function toggleFav(id) {
    const on = S.favs.includes(id);
    S.favs = on ? S.favs.filter((x) => x !== id) : [...S.favs, id];
    save(); updateBadges();
    document.querySelectorAll(`[data-act="fav"][data-id="${id}"]`).forEach((b) => b.classList.toggle("on", !on));
    if (S.user) api("/me/favorites", { method: "PUT", body: { favorites: S.favs } }).catch(() => {});
    toast(on ? "Removido dos favoritos" : "Salvo nos favoritos");
    if (parseHash().parts[0] === "favoritos") renderFavorites();
  }
  function renderFavorites() {
    const items = S.favs.map(byId).filter(Boolean);
    app().innerHTML = `<div class="wrap">
      <div class="crumbs"><a href="#/">Início</a> ${svg("chevron", 12)} <span>Favoritos</span></div>
      <div class="list-head"><div><h1>Meus favoritos</h1><p>${items.length} ${items.length === 1 ? "peça salva" : "peças salvas"}</p></div></div>
      ${!S.user && items.length ? `<div class="guest-note"><span>Seus favoritos estão salvos só neste aparelho. <b>Entre na sua conta</b> para acessá-los de qualquer lugar.</span><button class="btn btn-dark btn-sm" data-act="login">Entrar</button></div>` : ""}
      ${items.length ? `<div class="grid" style="padding-bottom:80px">${items.map(cardHtml).join("")}</div>`
        : `<div class="empty"><div class="ic">${svg("heart", 28)}</div><h3>Nenhum favorito ainda</h3><p>Toque no coração das peças que você amar para salvar aqui.</p><a class="btn btn-dark" href="#/loja">Explorar produtos</a></div>`}
    </div>`;
  }

  /* ===================================================== */
  /* Sacola                                                */
  /* ===================================================== */
  const lineKey = (c) => `${c.id}|${c.size}`;
  function addToCart(id, size, qty) {
    const p = byId(id), s = p.sizes.find((x) => x.size === size);
    const ex = S.cart.find((c) => c.id === id && c.size === size);
    const cur = ex ? ex.qty : 0;
    if (cur + qty > s.stock) { toast(`Temos só ${s.stock} unidade(s) desse tamanho.`, "bad"); return; }
    if (ex) ex.qty += qty; else S.cart.push({ id, size, qty });
    save(); updateBadges(); openCart();
  }
  function changeQty(key, d) {
    const c = S.cart.find((x) => lineKey(x) === key); if (!c) return;
    const p = byId(c.id), s = p?.sizes.find((x) => x.size === c.size);
    c.qty = Math.max(1, Math.min(s ? s.stock : c.qty, c.qty + d));
    save(); updateBadges(); renderCart();
    if (parseHash().parts[0] === "checkout") refreshQuote();
  }
  function removeLine(key) {
    S.cart = S.cart.filter((x) => lineKey(x) !== key);
    save(); updateBadges(); renderCart();
    if (parseHash().parts[0] === "checkout") renderCheckout();
  }
  function cartLines() {
    return S.cart.map((c) => {
      const p = byId(c.id); if (!p) return null;
      const s = p.sizes.find((x) => x.size === c.size);
      return { ...c, p, stock: s ? s.stock : 0, total: p.price * c.qty };
    }).filter(Boolean);
  }
  function openCart() {
    renderCart();
    $("#drawer").classList.add("open"); $("#scrim").classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function renderCart() {
    const lines = cartLines();
    const sub = lines.reduce((a, l) => a + l.total, 0);
    const min = S.settings.freeShippingMin || 0;
    const pct = min ? Math.min(100, (sub / min) * 100) : 100;
    $("#drawer").innerHTML = `
      <div class="drawer-head"><h3>Sua sacola ${lines.length ? `<span style="font-family:var(--sans);font-size:14px;color:var(--muted)">(${lines.reduce((a, l) => a + l.qty, 0)})</span>` : ""}</h3><button class="tool" data-act="close-all" aria-label="Fechar">${svg("close", 20)}</button></div>
      <div class="drawer-body">
        ${lines.length ? `
          ${min ? `<div class="freebar">${sub >= min ? `${svg("check", 14)} <b>Parabéns!</b> Você ganhou frete grátis.` : `Faltam <b>${money(min - sub)}</b> para ganhar <b>frete grátis</b>`}<div class="bar"><i style="width:${pct}%"></i></div></div>` : ""}
          ${lines.map((l) => `
            <div class="line">
              <a class="th" href="#/p/${l.p.id}" style="color:var(--rose)">${media(l.p, 34)}</a>
              <div>
                <h4>${esc(l.p.name)}</h4>
                <div class="meta">Tam. ${esc(l.size)}${l.p.color ? " · " + esc(l.p.color) : ""}</div>
                <div class="qty"><button data-act="qty" data-key="${esc(lineKey(l))}" data-d="-1" aria-label="Diminuir">${svg("minus", 14)}</button><span>${l.qty}</span><button data-act="qty" data-key="${esc(lineKey(l))}" data-d="1" aria-label="Aumentar">${svg("plus", 14)}</button></div>
                ${l.stock < l.qty ? `<div class="warn">${l.stock ? `Só ${l.stock} disponível(is)` : "Esgotado"}</div>` : ""}
                <div><button class="rm" data-act="rm" data-key="${esc(lineKey(l))}">Remover</button></div>
              </div>
              <div class="lp">${money(l.total)}</div>
            </div>`).join("")}`
        : `<div class="empty"><div class="ic">${svg("bag", 28)}</div><h3>Sua sacola está vazia</h3><p>Que tal dar uma olhada nas novidades?</p><a class="btn btn-dark" href="#/loja" data-act="close-all">Começar a comprar</a></div>`}
      </div>
      ${lines.length ? `<div class="drawer-foot">
        <div class="sum"><div><span>Subtotal</span><b>${money(sub)}</b></div><div class="muted" style="font-size:12.5px"><span>Frete e cupons calculados no checkout</span></div></div>
        <button class="btn btn-dark btn-lg btn-block" style="margin-top:16px" data-act="go-checkout">Finalizar compra ${svg("chevron", 18)}</button>
        <button class="btn btn-ghost btn-block" style="margin-top:6px" data-act="close-all">Continuar comprando</button>
      </div>` : ""}`;
  }

  /* ===================================================== */
  /* Login / cadastro (clientes)                           */
  /* ===================================================== */
  function openModal(html, wide = false) {
    const box = $("#modal-box");
    box.className = "modal" + (wide ? " wide" : "");
    box.innerHTML = `<button class="modal-x" data-act="close-modal" aria-label="Fechar">${svg("close", 18)}</button>` + html;
    $("#modal").classList.add("open");
    bindMasks(box);
    setTimeout(() => box.querySelector("input")?.focus(), 50);
  }
  function closeModal() { $("#modal").classList.remove("open"); }

  function openAuth(tab = "login", after) {
    openModal(`
      <h2>${tab === "login" ? "Bem-vinda de volta" : "Crie sua conta"}</h2>
      <p class="sub">${tab === "login" ? "Entre para acompanhar pedidos e comprar mais rápido." : "Ganhe 10% OFF na primeira compra com o cupom BEMVINDA10."}</p>
      <div class="tabs"><button class="${tab === "login" ? "on" : ""}" data-tab="login">Entrar</button><button class="${tab === "signup" ? "on" : ""}" data-tab="signup">Criar conta</button></div>
      <div class="form-err" id="auth-err"></div>
      <form id="auth-form" novalidate>
        ${tab === "signup" ? `<div class="field"><label for="a-name">Nome completo</label><input id="a-name" autocomplete="name" required></div>` : ""}
        <div class="field"><label for="a-email">E-mail</label><input id="a-email" type="email" autocomplete="email" required></div>
        ${tab === "signup" ? `<div class="field"><label for="a-phone">Celular / WhatsApp <span style="font-weight:400;color:var(--muted)">(opcional)</span></label><input id="a-phone" data-mask="phone" inputmode="tel" autocomplete="tel"></div>` : ""}
        <div class="field"><label for="a-pass">Senha</label><input id="a-pass" type="password" autocomplete="${tab === "login" ? "current-password" : "new-password"}" required>${tab === "signup" ? '<div class="hint">Mínimo de 8 caracteres.</div>' : ""}</div>
        ${tab === "signup" ? `<label class="check" style="margin-bottom:16px"><input type="checkbox" id="a-news" checked> Quero receber novidades e ofertas exclusivas por e-mail.</label>` : ""}
        <button class="btn btn-dark btn-lg btn-block" id="auth-btn">${tab === "login" ? "Entrar" : "Criar conta"}</button>
      </form>
      ${tab === "login" ? `<p style="font-size:13px;color:var(--muted);text-align:center;margin:16px 0 0">Esqueceu a senha? Fale com a gente pelo ${S.settings.whatsapp ? `<a class="link" target="_blank" rel="noopener" href="${waLink(S.settings.whatsapp, "Olá! Esqueci a senha da minha conta Pingo Chic.")}">WhatsApp</a>` : `e-mail <b>${esc(S.settings.email)}</b>`}.</p>` : ""}
      <div class="divider">ou</div>
      <button class="btn btn-line btn-block" data-act="close-modal">Continuar sem conta</button>`);
    $("#modal-box .tabs").onclick = (e) => { const b = e.target.closest("[data-tab]"); if (b) openAuth(b.dataset.tab, after); };
    $("#auth-form").onsubmit = async (e) => {
      e.preventDefault();
      const err = $("#auth-err"), btn = $("#auth-btn");
      err.classList.remove("show");
      const body = { email: $("#a-email").value, password: $("#a-pass").value, favorites: S.favs };
      if (tab === "signup") Object.assign(body, { name: $("#a-name").value, phone: $("#a-phone").value, newsletter: $("#a-news").checked });
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      try {
        const r = await api(tab === "login" ? "/auth/login" : "/auth/signup", { method: "POST", body });
        closeModal();
        setUser(r.user, !after);
        toast(tab === "login" ? `Olá, ${r.user.name.split(" ")[0]}!` : "Conta criada com sucesso!");
        if (after) after();
      } catch (ex) {
        err.textContent = ex.message; err.classList.add("show");
        btn.disabled = false; btn.textContent = tab === "login" ? "Entrar" : "Criar conta";
      }
    };
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    S.favs = []; localStorage.removeItem(LS_FAV);
    setUser(null);
    toast("Você saiu da sua conta.");
    if (parseHash().parts[0] === "conta") location.hash = "#/";
  }

  /* ===================================================== */
  /* Checkout (visitante ou cliente logado)                */
  /* ===================================================== */
  const CO = { step: 1, data: {}, payment: "pix", installments: 1 };
  function renderCheckout() {
    const lines = cartLines();
    if (!lines.length) {
      app().innerHTML = `<div class="wrap empty"><div class="ic">${svg("bag", 28)}</div><h3>Sua sacola está vazia</h3><p>Adicione produtos para finalizar a compra.</p><a class="btn btn-dark" href="#/loja">Ver produtos</a></div>`;
      return;
    }
    const u = S.user || {};
    const d = CO.data;
    d.name ??= u.name || ""; d.email ??= u.email || ""; d.phone ??= u.phone || ""; d.cpf ??= u.cpf || "";
    const a = (d.address ??= { ...(u.address || {}), cep: u.address?.cep || localStorage.getItem("pingochic.cep") || "" });
    if (!S.settings.pixEnabled && CO.payment === "pix") CO.payment = "cartao";

    app().innerHTML = `
      <div class="wrap">
        <div class="co">
          <div>
            <h1 style="font-size:32px;font-weight:500;margin:4px 0 8px">Finalizar compra</h1>
            <div class="secure" style="margin-bottom:22px">${svg("lock", 16)} Ambiente seguro · seus dados são protegidos</div>
            ${!S.user ? `<div class="guest-note"><span>Já tem conta? Entre para preencher seus dados automaticamente.</span><span style="display:flex;gap:8px"><button class="btn btn-dark btn-sm" id="co-login">Entrar</button></span></div>` : ""}

            <section class="co-box ${CO.step > 1 ? "done" : ""}" id="box1">
              <h3><span class="n">${CO.step > 1 ? svg("check", 14) : 1}</span> Identificação</h3>
              ${CO.step > 1 ? `<div class="resume"><div><b>${esc(d.name)}</b><br>${esc(d.email)} · ${esc(masks.phone(d.phone))}<br>CPF ${esc(masks.cpf(d.cpf))}</div><button class="link" data-step="1">Alterar</button></div>` : `
              <form id="f1" novalidate>
                <div class="field"><label>Nome completo</label><input id="c-name" value="${esc(d.name)}" autocomplete="name"></div>
                <div class="field"><label>E-mail</label><input id="c-email" type="email" value="${esc(d.email)}" autocomplete="email" ${S.user ? "readonly" : ""}><div class="hint">Usado para identificar e acompanhar o seu pedido.</div></div>
                <div class="row">
                  <div class="field"><label>CPF</label><input id="c-cpf" data-mask="cpf" inputmode="numeric" value="${esc(d.cpf)}"><div class="hint">Necessário para emissão da nota fiscal.</div></div>
                  <div class="field"><label>Celular / WhatsApp</label><input id="c-phone" data-mask="phone" inputmode="tel" value="${esc(d.phone)}" autocomplete="tel"></div>
                </div>
                <div class="form-err" id="e1"></div>
                <button class="btn btn-dark btn-lg">Continuar para entrega</button>
              </form>`}
            </section>

            <section class="co-box ${CO.step < 2 ? "locked" : ""} ${CO.step > 2 ? "done" : ""}" id="box2">
              <h3><span class="n">${CO.step > 2 ? svg("check", 14) : 2}</span> Entrega</h3>
              ${CO.step > 2 ? `<div class="resume"><div>${esc(a.rua)}, ${esc(a.numero)}${a.complemento ? " – " + esc(a.complemento) : ""}<br>${esc(a.bairro)} · ${esc(a.cidade)}/${esc(a.uf)} · CEP ${esc(masks.cep(a.cep))}<br><span style="color:var(--sage);font-weight:600" id="ship-resume"></span></div><button class="link" data-step="2">Alterar</button></div>` : CO.step === 2 ? `
              <form id="f2" novalidate>
                <div class="row">
                  <div class="field" style="flex:0 0 170px"><label>CEP</label><input id="c-cep" data-mask="cep" inputmode="numeric" value="${esc(a.cep)}" autocomplete="postal-code"></div>
                  <div class="field" style="align-self:end"><a class="link" style="font-size:13px" href="https://buscacepinter.correios.com.br/" target="_blank" rel="noopener">Não sei meu CEP</a></div>
                </div>
                <div class="field"><label>Rua / Avenida</label><input id="c-rua" value="${esc(a.rua || "")}" autocomplete="address-line1"></div>
                <div class="row">
                  <div class="field" style="flex:0 0 130px"><label>Número</label><input id="c-num" value="${esc(a.numero || "")}"></div>
                  <div class="field"><label>Complemento <span style="font-weight:400;color:var(--muted)">(opcional)</span></label><input id="c-comp" value="${esc(a.complemento || "")}" autocomplete="address-line2"></div>
                </div>
                <div class="row">
                  <div class="field"><label>Bairro</label><input id="c-bairro" value="${esc(a.bairro || "")}"></div>
                  <div class="field"><label>Cidade</label><input id="c-cidade" value="${esc(a.cidade || "")}" autocomplete="address-level2"></div>
                  <div class="field" style="flex:0 0 90px"><label>UF</label><input id="c-uf" maxlength="2" value="${esc(a.uf || "")}" style="text-transform:uppercase" autocomplete="address-level1"></div>
                </div>
                <div id="ship-opt"></div>
                <div class="form-err" id="e2"></div>
                <button class="btn btn-dark btn-lg">Continuar para pagamento</button>
              </form>` : ""}
            </section>

            <section class="co-box ${CO.step < 3 ? "locked" : ""}" id="box3">
              <h3><span class="n">3</span> Pagamento</h3>
              ${CO.step === 3 ? `
              <div class="payopts">
                ${S.settings.pixEnabled ? `<button class="payopt ${CO.payment === "pix" ? "on" : ""}" data-pay="pix"><span class="ic" style="color:#32BCAD">${svg("pix", 22)}</span><div><b>Pix</b><span>Aprovação imediata · QR Code e copia-e-cola</span></div>${S.settings.pixDiscount ? `<span class="pill">${S.settings.pixDiscount}% OFF</span>` : ""}</button>` : ""}
                <button class="payopt ${CO.payment === "cartao" ? "on" : ""}" data-pay="cartao"><span class="ic">${svg("card", 22)}</span><div><b>Cartão de crédito</b><span>Em até ${S.settings.maxInstallments}x sem juros · link de pagamento seguro</span></div></button>
              </div>
              <div id="pay-extra" style="margin-top:16px"></div>
              <div class="field" style="margin-top:14px"><label>Observações <span style="font-weight:400;color:var(--muted)">(opcional)</span></label><textarea id="c-notes" rows="2" placeholder="Ex: é para presente, embalar separado…">${esc(d.notes || "")}</textarea></div>
              <label class="check" style="margin:6px 0 16px"><input type="checkbox" id="c-terms" checked> Li e concordo com a <a class="link" href="#/ajuda/trocas" target="_blank">política de trocas</a> e a <a class="link" href="#/ajuda/privacidade" target="_blank">política de privacidade</a>.</label>
              <div class="form-err" id="e3"></div>
              <button class="btn btn-rose btn-lg btn-block" id="place">${svg("lock", 18)} Confirmar pedido</button>` : ""}
            </section>
          </div>
          <aside class="co-side" id="co-side"></aside>
        </div>
      </div>`;
    bindMasks(app());
    $("#co-login")?.addEventListener("click", () => openAuth("login", () => { CO.data = {}; renderCheckout(); }));
    app().querySelectorAll("[data-step]").forEach((b) => b.onclick = () => { CO.step = Number(b.dataset.step); renderCheckout(); });

    $("#f1")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = { name: $("#c-name").value.trim(), email: $("#c-email").value.trim(), cpf: onlyDigits($("#c-cpf").value), phone: onlyDigits($("#c-phone").value) };
      const err = v.name.split(" ").filter(Boolean).length < 2 ? "Informe nome e sobrenome." : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email) ? "Informe um e-mail válido." : !validCpf(v.cpf) ? "CPF inválido. Confira os números." : v.phone.length < 10 ? "Informe o celular com DDD." : "";
      if (err) { $("#e1").textContent = err; $("#e1").classList.add("show"); return; }
      Object.assign(d, v); CO.step = 2; renderCheckout();
      setTimeout(() => $("#c-cep")?.focus(), 30);
    });

    if (CO.step === 2) {
      const cepEl = $("#c-cep");
      const lookup = async () => {
        const cep = onlyDigits(cepEl.value);
        if (cep.length !== 8) return;
        localStorage.setItem("pingochic.cep", cep);
        try {
          const { address } = await api("/cep/" + cep);
          if (address.rua) $("#c-rua").value = address.rua;
          if (address.bairro) $("#c-bairro").value = address.bairro;
          $("#c-cidade").value = address.cidade; $("#c-uf").value = address.uf;
          (address.rua ? $("#c-num") : $("#c-rua")).focus();
        } catch { /* usuário preenche manualmente */ }
        a.cep = cep; refreshQuote();
      };
      cepEl.addEventListener("input", () => { if (onlyDigits(cepEl.value).length === 8) lookup(); });
      $("#f2").addEventListener("submit", (e) => {
        e.preventDefault();
        Object.assign(a, { cep: onlyDigits(cepEl.value), rua: $("#c-rua").value.trim(), numero: $("#c-num").value.trim(), complemento: $("#c-comp").value.trim(), bairro: $("#c-bairro").value.trim(), cidade: $("#c-cidade").value.trim(), uf: $("#c-uf").value.trim().toUpperCase() });
        const err = a.cep.length !== 8 ? "CEP inválido." : !a.rua ? "Informe a rua." : !a.numero ? "Informe o número (ou S/N)." : !a.bairro ? "Informe o bairro." : !a.cidade ? "Informe a cidade." : !/^[A-Z]{2}$/.test(a.uf) ? "Informe a UF (ex: SP)." : "";
        if (err) { $("#e2").textContent = err; $("#e2").classList.add("show"); return; }
        CO.step = 3; renderCheckout();
      });
    }

    if (CO.step === 3) {
      app().querySelectorAll("[data-pay]").forEach((b) => b.onclick = () => { CO.payment = b.dataset.pay; app().querySelectorAll("[data-pay]").forEach((x) => x.classList.toggle("on", x === b)); refreshQuote(); });
      $("#place").onclick = placeOrder;
    }
    refreshQuote();
  }

  let quoteSeq = 0;
  async function refreshQuote() {
    const side = $("#co-side"); if (!side) return;
    const seq = ++quoteSeq;
    const body = { items: S.cart, cep: CO.data.address?.cep || "", coupon: S.coupon, payment: CO.step === 3 ? CO.payment : "" };
    let q;
    try { q = (await api("/quote", { method: "POST", body })).quote; }
    catch (e) { side.innerHTML = `<div class="form-err show">${esc(e.message)}</div>`; return; }
    if (seq !== quoteSeq) return;
    S.quote = q;
    side.innerHTML = `
      <h3>Resumo do pedido</h3>
      ${q.lines.map((l) => `<div class="line"><div class="th" style="color:var(--rose)">${l.image ? `<img src="${esc(imgUrl(l.image))}" alt="">` : productIcon(l.icon, 26)}<span class="q">${l.qty}</span></div><div><h4>${esc(l.name)}</h4><div class="meta">Tam. ${esc(l.size)}</div>${l.available < l.qty ? `<div class="warn" style="color:var(--bad);font-size:12px">${l.available ? `Só ${l.available} disponível(is)` : "Esgotado"}</div>` : ""}</div><div class="lp">${money(l.lineTotal)}</div></div>`).join("")}
      <form class="coupon" id="coupon-f"><input id="coupon-in" placeholder="Cupom de desconto" value="${esc(S.coupon)}"><button class="btn btn-line btn-sm">${S.coupon && !q.couponError ? "Trocar" : "Aplicar"}</button></form>
      <div class="coupon-msg ${q.couponError ? "err" : q.coupon ? "ok" : ""}">${q.couponError ? esc(q.couponError) : q.coupon ? `Cupom ${esc(q.coupon.code)} aplicado ${svg("check", 12)} <button class="link" id="coupon-rm" style="font-size:12px;margin-left:6px">remover</button>` : ""}</div>
      <div class="sum">
        <div><span>Subtotal</span><span>${money(q.subtotal)}</span></div>
        ${q.discount ? `<div class="disc"><span>Desconto (${esc(q.coupon.code)})</span><span>−${money(q.discount)}</span></div>` : ""}
        ${q.pixDiscount ? `<div class="disc"><span>Desconto Pix</span><span>−${money(q.pixDiscount)}</span></div>` : ""}
        <div><span>Frete</span><span>${q.shipping ? (q.shipping.free ? '<b style="color:var(--sage)">Grátis</b>' : money(q.shipping.price)) : '<span class="muted">Informe o CEP</span>'}</span></div>
        ${q.shipping ? `<div class="muted" style="font-size:12.5px"><span>Prazo</span><span>${esc(q.shipping.days)}</span></div>` : ""}
        <div class="tot"><span>Total</span><span>${money(q.total)}</span></div>
        ${CO.payment === "cartao" && q.installments.length > 1 ? `<div class="muted" style="font-size:12.5px;justify-content:flex-end">ou ${q.installments.at(-1).n}x de ${money(q.installments.at(-1).value)} sem juros</div>` : ""}
      </div>
      ${q.missingToFree > 0 && !q.shipping?.free ? `<div class="freebar" style="background:#fff">Faltam <b>${money(q.missingToFree)}</b> para frete grátis</div>` : ""}`;
    $("#coupon-f").onsubmit = (e) => { e.preventDefault(); S.coupon = $("#coupon-in").value.trim().toUpperCase(); refreshQuote(); };
    $("#coupon-rm")?.addEventListener("click", () => { S.coupon = ""; refreshQuote(); });

    const so = $("#ship-opt");
    if (so) so.innerHTML = q.shipping ? `<div class="payopt on" style="margin-bottom:16px;cursor:default"><span class="ic">${svg("truck", 22)}</span><div><b>Entrega padrão · ${esc(q.shipping.region)}</b><span>${esc(q.shipping.days)} após a confirmação do pagamento</span></div><span class="pill" style="${q.shipping.free ? "" : "background:var(--cream);color:var(--ink)"}">${q.shipping.free ? "Grátis" : money(q.shipping.price)}</span></div>` : "";
    const sr = $("#ship-resume"); if (sr && q.shipping) sr.textContent = `${q.shipping.free ? "Frete grátis" : money(q.shipping.price)} · ${q.shipping.days}`;
    const pe = $("#pay-extra");
    if (pe) {
      if (CO.payment === "cartao") {
        CO.installments = Math.min(CO.installments, q.installments.at(-1)?.n || 1);
        pe.innerHTML = `<div class="field"><label>Parcelamento</label><select id="c-inst">${q.installments.map((i) => `<option value="${i.n}" ${CO.installments === i.n ? "selected" : ""}>${i.n}x de ${money(i.value)} sem juros</option>`).join("")}</select><div class="hint">Após confirmar, nossa equipe envia um link de pagamento seguro pelo WhatsApp.</div></div>`;
        $("#c-inst").onchange = (e) => { CO.installments = Number(e.target.value); };
      } else {
        pe.innerHTML = `<div class="guest-note" style="margin:0">${svg("pix", 20)}<span style="flex:1">O QR Code e o código copia-e-cola aparecem na próxima tela. O pedido é aprovado assim que identificarmos o pagamento.</span></div>`;
      }
    }
  }

  async function placeOrder() {
    const btn = $("#place"), err = $("#e3");
    err.classList.remove("show");
    if (!$("#c-terms").checked) { err.textContent = "É preciso aceitar as políticas para continuar."; err.classList.add("show"); return; }
    CO.data.notes = $("#c-notes").value;
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Processando…';
    try {
      const d = CO.data;
      const { order } = await api("/orders", {
        method: "POST",
        body: { items: S.cart, coupon: S.coupon, payment: CO.payment, installments: CO.installments, notes: d.notes, customer: { name: d.name, email: d.email, phone: d.phone, cpf: d.cpf }, address: d.address }
      });
      S.lastOrder = order;
      sessionStorage.setItem("pingochic.last", JSON.stringify(order));
      // atualiza estoque local
      order.items.forEach((l) => { const p = byId(l.id); const s = p?.sizes.find((x) => x.size === l.size); if (s) s.stock = Math.max(0, s.stock - l.qty); });
      S.cart = []; S.coupon = ""; CO.step = 1; CO.data = {}; save(); updateBadges();
      location.hash = "#/pedido/" + order.number;
    } catch (e) {
      err.textContent = e.message; err.classList.add("show");
      btn.disabled = false; btn.innerHTML = `${svg("lock", 18)} Confirmar pedido`;
      api("/catalog").then((c) => { S.products = c.products; refreshQuote(); }).catch(() => {});
    }
  }

  /* ===================================================== */
  /* Pedido confirmado / acompanhamento                    */
  /* ===================================================== */
  function renderOrderDone(number) {
    const o = S.lastOrder?.number === number ? S.lastOrder : JSON.parse(sessionStorage.getItem("pingochic.last") || "null");
    if (!o || o.number !== number) { location.hash = "#/rastrear"; return; }
    const st = S.settings;
    const wa = st.whatsapp ? waLink(st.whatsapp, `Olá! Fiz o pedido #${o.number} na Pingo Chic (${money(o.total)}).${o.payment === "cartao" ? " Gostaria de receber o link de pagamento." : " Segue o comprovante do Pix."}`) : "";
    app().innerHTML = `
      <div class="wrap"><div class="done-wrap">
        <img class="done-logo" src="${BEE}" alt="" style="width:110px;height:auto;border-radius:0">
        <h1>Pedido #${o.number} recebido!</h1>
        <p>Obrigada pela compra, ${esc(o.customer.name.split(" ")[0])}! Guarde o número do pedido — você pode acompanhá-lo em <a class="link" href="#/rastrear">Acompanhar pedido</a> com o e-mail <b>${esc(o.email)}</b>.</p>
        ${o.payment === "pix" && o.pix ? `
          <div class="pixbox">
            <div class="qr" id="qr"></div>
            <div>
              <h3>Pague ${money(o.total)} com Pix</h3>
              <ol><li>Abra o app do seu banco e escolha <b>Pix › Ler QR Code</b> ou <b>Pix copia e cola</b>.</li><li>Confira o valor e o recebedor <b>${esc(st.storeName)}</b>.</li><li>Pronto! Assim que identificarmos o pagamento, seu pedido entra em separação.</li></ol>
              <div class="code" id="pix-code">${esc(o.pix.payload)}</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-dark" id="copy-pix">${svg("copy", 16)} Copiar código Pix</button>${wa ? `<a class="btn btn-line" href="${wa}" target="_blank" rel="noopener">${svg("whatsapp", 16)} Enviar comprovante</a>` : ""}</div>
            </div>
          </div>` : `
          <div class="order-card" style="margin-top:28px">
            <b>${o.payment === "cartao" ? `Pagamento no cartão em ${o.installments}x` : "Pagamento"}</b>
            <p style="color:var(--ink-2);margin:8px 0 14px">${o.payment === "cartao" ? "Nossa equipe enviará um link de pagamento seguro para o seu WhatsApp." : "Nossa equipe entrará em contato com as instruções de pagamento."}</p>
            ${wa ? `<a class="btn btn-dark" href="${wa}" target="_blank" rel="noopener">${svg("whatsapp", 16)} Falar no WhatsApp</a>` : ""}
          </div>`}
        ${orderCard(o)}
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:24px">
          <a class="btn btn-dark" href="#/loja">Continuar comprando</a>
          ${S.user ? `<a class="btn btn-line" href="#/conta/pedidos">Ver meus pedidos</a>` : `<button class="btn btn-line" data-act="signup">Criar conta para acompanhar</button>`}
        </div>
      </div></div>`;
    if (o.pix) {
      drawQr($("#qr"), o.pix.payload);
      $("#copy-pix").onclick = async () => { if (await copyText(o.pix.payload)) toast("Código Pix copiado!"); };
    }
  }

  function drawQr(el, text) {
    if (!el) return;
    if (window.qrcode) {
      const qr = window.qrcode(0, "M"); qr.addData(text); qr.make();
      el.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
    } else {
      el.innerHTML = `<span style="font-size:12px;color:var(--muted);text-align:center">Use o código copia-e-cola ao lado</span>`;
    }
  }

  const FLOW = ["aguardando_pagamento", "pago", "em_separacao", "enviado", "entregue"];
  function orderCard(o, compact = false) {
    const s = STATUS[o.status] || { label: o.status, tone: "info" };
    const idx = FLOW.indexOf(o.status);
    return `<div class="order-card">
      <div class="top"><div><b>Pedido #${o.number}</b><div style="font-size:13px;color:var(--muted)">${fmtDate(o.createdAt, true)} · ${o.items.reduce((a, i) => a + i.qty, 0)} itens</div></div><span class="status ${s.tone}">${s.label}</span></div>
      ${o.status !== "cancelado" ? `<div class="timeline">${["Pedido feito", "Pago", "Separação", "Enviado", "Entregue"].map((l, i) => `<div class="${i <= idx ? "on" : ""}"><i></i>${l}</div>`).join("")}</div>` : ""}
      ${o.tracking ? `<div class="guest-note" style="margin:10px 0">${svg("truck", 18)}<span style="flex:1">Código de rastreio: <b>${esc(o.tracking)}</b></span><a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(o.tracking)}">Rastrear</a></div>` : ""}
      ${compact ? `<div class="mini-items">${o.items.map((i) => `<div class="th" style="color:var(--rose)" title="${esc(i.name)}">${i.image ? `<img src="${esc(imgUrl(i.image))}" alt="">` : productIcon(i.icon, 22)}</div>`).join("")}</div>` : `
      <div>${o.items.map((i) => `<div class="line" style="grid-template-columns:56px 1fr auto"><div class="th" style="width:56px;color:var(--rose)">${i.image ? `<img src="${esc(imgUrl(i.image))}" alt="">` : productIcon(i.icon, 24)}</div><div><h4>${esc(i.name)}</h4><div class="meta">Tam. ${esc(i.size)} · Qtd. ${i.qty}</div></div><div class="lp">${money(i.lineTotal)}</div></div>`).join("")}</div>
      <div class="sum" style="margin-top:14px">
        <div><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
        ${o.discount ? `<div class="disc"><span>Cupom ${esc(o.coupon?.code || "")}</span><span>−${money(o.discount)}</span></div>` : ""}
        ${o.pixDiscount ? `<div class="disc"><span>Desconto Pix</span><span>−${money(o.pixDiscount)}</span></div>` : ""}
        <div><span>Frete (${esc(o.shipping?.days || "")})</span><span>${o.shipping?.free ? "Grátis" : money(o.shipping?.price)}</span></div>
        <div class="tot"><span>Total</span><span>${money(o.total)}</span></div>
      </div>
      <div style="font-size:13px;color:var(--ink-2);margin-top:14px;padding-top:14px;border-top:1px solid var(--line-2)"><b>Entrega:</b> ${esc(o.address.rua)}, ${esc(o.address.numero)}${o.address.complemento ? " – " + esc(o.address.complemento) : ""}, ${esc(o.address.bairro)} – ${esc(o.address.cidade)}/${esc(o.address.uf)} · CEP ${esc(masks.cep(o.address.cep))}</div>`}
      ${compact ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px"><b>${money(o.total)}</b><button class="btn btn-line btn-sm" data-order="${o.number}">Ver detalhes</button></div>` : ""}
    </div>`;
  }

  function renderTrack() {
    app().innerHTML = `<div class="wrap"><div class="done-wrap" style="text-align:left;max-width:560px">
      <h1 style="text-align:center">Acompanhe seu pedido</h1>
      <p style="text-align:center;color:var(--muted)">Informe o número do pedido e o e-mail usado na compra.</p>
      <form class="panel" id="track-f" style="margin-top:24px">
        <div class="field"><label>Número do pedido</label><input id="t-num" inputmode="numeric" placeholder="Ex: 1043"></div>
        <div class="field"><label>E-mail</label><input id="t-email" type="email" placeholder="voce@email.com" value="${esc(S.user?.email || "")}"></div>
        <div class="form-err" id="t-err"></div>
        <button class="btn btn-dark btn-lg btn-block">Consultar</button>
      </form>
      <div id="t-res" style="margin-top:20px"></div>
    </div></div>`;
    $("#track-f").onsubmit = async (e) => {
      e.preventDefault();
      $("#t-err").classList.remove("show");
      try {
        const { order } = await api("/orders/track", { method: "POST", body: { number: $("#t-num").value, email: $("#t-email").value } });
        $("#t-res").innerHTML = orderCard(order);
      } catch (ex) { $("#t-err").textContent = ex.message; $("#t-err").classList.add("show"); $("#t-res").innerHTML = ""; }
    };
  }

  /* ===================================================== */
  /* Minha conta                                           */
  /* ===================================================== */
  async function renderAccount(tab) {
    if (!S.user) {
      app().innerHTML = `<div class="wrap empty"><div class="ic">${svg("user", 28)}</div><h3>Entre na sua conta</h3><p>Acompanhe pedidos, salve endereços e favoritos.</p><div style="display:flex;gap:10px;justify-content:center"><button class="btn btn-dark" data-act="login">Entrar</button><button class="btn btn-line" data-act="signup">Criar conta</button></div><p style="margin-top:22px">Comprou sem conta? <a class="link" href="#/rastrear">Acompanhe pelo número do pedido</a>.</p></div>`;
      return;
    }
    const tabs = [["pedidos", "box", "Meus pedidos"], ["dados", "user", "Meus dados"], ["endereco", "home", "Endereço"], ["senha", "lock", "Senha"]];
    app().innerHTML = `<div class="wrap">
      <div class="crumbs"><a href="#/">Início</a> ${svg("chevron", 12)} <span>Minha conta</span></div>
      <div class="acct">
        <nav class="acct-nav">${tabs.map(([k, ic, l]) => `<button class="${tab === k ? "on" : ""}" onclick="location.hash='#/conta/${k}'">${svg(ic, 18)} ${l}</button>`).join("")}<button data-act="logout">${svg("logout", 18)} Sair</button></nav>
        <div id="acct-body"></div>
      </div></div>`;
    const body = $("#acct-body");
    const u = S.user;
    if (tab === "pedidos") {
      body.innerHTML = `<h2>Meus pedidos</h2><div class="skeleton" style="height:160px"></div>`;
      try {
        const { orders } = await api("/me/orders");
        body.innerHTML = `<h2>Meus pedidos</h2>` + (orders.length ? `<div style="max-width:720px">${orders.map((o) => orderCard(o, true)).join("")}</div>`
          : `<div class="empty" style="text-align:left;padding:20px 0"><p>Você ainda não fez nenhum pedido.</p><a class="btn btn-dark" href="#/loja">Começar a comprar</a></div>`);
        body.onclick = (e) => { const b = e.target.closest("[data-order]"); if (b) { const o = orders.find((x) => x.number === Number(b.dataset.order)); openModal(orderCard(o), true); } };
      } catch (e) { body.innerHTML = `<div class="form-err show">${esc(e.message)}</div>`; }
    } else if (tab === "dados") {
      body.innerHTML = `<h2>Meus dados</h2><form class="panel" id="pf">
        <div class="field"><label>Nome completo</label><input id="p-name" value="${esc(u.name)}"></div>
        <div class="field"><label>E-mail</label><input value="${esc(u.email)}" readonly style="background:var(--cream)"></div>
        <div class="row"><div class="field"><label>CPF</label><input id="p-cpf" data-mask="cpf" value="${esc(u.cpf)}"></div><div class="field"><label>Celular / WhatsApp</label><input id="p-phone" data-mask="phone" value="${esc(u.phone)}"></div></div>
        <label class="check" style="margin-bottom:16px"><input type="checkbox" id="p-news" ${u.newsletter ? "checked" : ""}> Receber novidades e ofertas por e-mail</label>
        <div class="form-err" id="p-err"></div><button class="btn btn-dark">Salvar alterações</button></form>`;
      bindMasks(body);
      $("#pf").onsubmit = (e) => saveProfile(e, { name: $("#p-name").value, cpf: onlyDigits($("#p-cpf").value), phone: $("#p-phone").value, newsletter: $("#p-news").checked });
    } else if (tab === "endereco") {
      const a = u.address || {};
      body.innerHTML = `<h2>Endereço de entrega</h2><form class="panel" id="pf">
        <div class="field" style="max-width:200px"><label>CEP</label><input id="e-cep" data-mask="cep" value="${esc(a.cep || "")}"></div>
        <div class="field"><label>Rua</label><input id="e-rua" value="${esc(a.rua || "")}"></div>
        <div class="row"><div class="field"><label>Número</label><input id="e-num" value="${esc(a.numero || "")}"></div><div class="field"><label>Complemento</label><input id="e-comp" value="${esc(a.complemento || "")}"></div></div>
        <div class="row"><div class="field"><label>Bairro</label><input id="e-bairro" value="${esc(a.bairro || "")}"></div><div class="field"><label>Cidade</label><input id="e-cidade" value="${esc(a.cidade || "")}"></div><div class="field" style="flex:0 0 90px"><label>UF</label><input id="e-uf" maxlength="2" value="${esc(a.uf || "")}"></div></div>
        <div class="form-err" id="p-err"></div><button class="btn btn-dark">Salvar endereço</button></form>`;
      bindMasks(body);
      $("#e-cep").addEventListener("input", async (ev) => {
        const cep = onlyDigits(ev.target.value); if (cep.length !== 8) return;
        try { const { address } = await api("/cep/" + cep); $("#e-rua").value = address.rua; $("#e-bairro").value = address.bairro; $("#e-cidade").value = address.cidade; $("#e-uf").value = address.uf; $("#e-num").focus(); } catch { }
      });
      $("#pf").onsubmit = (e) => saveProfile(e, { address: { cep: onlyDigits($("#e-cep").value), rua: $("#e-rua").value, numero: $("#e-num").value, complemento: $("#e-comp").value, bairro: $("#e-bairro").value, cidade: $("#e-cidade").value, uf: $("#e-uf").value } });
    } else if (tab === "senha") {
      body.innerHTML = `<h2>Alterar senha</h2><form class="panel" id="pf">
        <div class="field"><label>Senha atual</label><input id="s-cur" type="password" autocomplete="current-password"></div>
        <div class="field"><label>Nova senha</label><input id="s-new" type="password" autocomplete="new-password"><div class="hint">Mínimo de 8 caracteres.</div></div>
        <div class="field"><label>Confirmar nova senha</label><input id="s-new2" type="password" autocomplete="new-password"></div>
        <div class="form-err" id="p-err"></div><button class="btn btn-dark">Alterar senha</button></form>`;
      $("#pf").onsubmit = async (e) => {
        e.preventDefault();
        const err = $("#p-err"); err.classList.remove("show");
        if ($("#s-new").value !== $("#s-new2").value) { err.textContent = "As senhas não conferem."; err.classList.add("show"); return; }
        try { await api("/me/password", { method: "PUT", body: { current: $("#s-cur").value, password: $("#s-new").value } }); toast("Senha alterada!"); e.target.reset(); }
        catch (ex) { err.textContent = ex.message; err.classList.add("show"); }
      };
    }
  }
  async function saveProfile(e, body) {
    e.preventDefault();
    const err = $("#p-err"); err.classList.remove("show");
    try { const r = await api("/me", { method: "PUT", body }); S.user = { ...S.user, ...r.user }; renderAccountChip(); toast("Dados salvos!"); }
    catch (ex) { err.textContent = ex.message; err.classList.add("show"); }
  }

  /* ===================================================== */
  /* Ajuda / institucional                                 */
  /* ===================================================== */
  function renderHelp(topic) {
    const st = S.settings;
    const pages = {
      tamanhos: ["Guia de tamanhos", `<table style="width:100%;border-collapse:collapse;font-size:14px">${[["Tamanho", "Idade", "Altura", "Peso"], ["RN", "0–1 mês", "até 50 cm", "até 4 kg"], ["P", "1–3 meses", "50–60 cm", "4–6 kg"], ["M", "3–6 meses", "60–68 cm", "6–8 kg"], ["G", "6–9 meses", "68–74 cm", "8–10 kg"], ["1", "1 ano", "74–80 cm", "10–11 kg"], ["2", "2 anos", "86–92 cm", "12–13 kg"], ["4", "3–4 anos", "98–104 cm", "15–17 kg"], ["6", "5–6 anos", "110–116 cm", "18–21 kg"], ["8", "7–8 anos", "122–128 cm", "23–26 kg"], ["10", "9–10 anos", "134–140 cm", "28–32 kg"], ["12", "11–12 anos", "146–152 cm", "35–40 kg"]].map((r, i) => `<tr>${r.map((c) => i ? `<td style="padding:10px;border-bottom:1px solid var(--line)">${c}</td>` : `<th style="padding:10px;text-align:left;border-bottom:2px solid var(--ink)">${c}</th>`).join("")}</tr>`).join("")}</table><p style="color:var(--muted);font-size:13px">Medidas aproximadas. Na dúvida entre dois tamanhos, escolha o maior.</p>`],
      trocas: ["Trocas e devoluções", `<p><b>Primeira troca grátis</b> em até 30 dias corridos após o recebimento, para outro tamanho, cor ou produto.</p><p><b>Direito de arrependimento:</b> você pode desistir da compra em até 7 dias corridos após o recebimento (CDC, art. 49), com reembolso integral.</p><p>A peça deve estar sem uso, sem lavagem e com a etiqueta. Para solicitar, fale conosco informando o número do pedido.</p>`],
      entrega: ["Entrega e frete", `<p>Enviamos para <b>todos os 27 estados do Brasil</b> com código de rastreio.</p><p>O prazo começa a contar após a confirmação do pagamento. Pedidos pagos até 14h em dias úteis são postados no mesmo dia.</p><p><b>Frete grátis</b> em compras acima de ${money(st.freeShippingMin)}.</p>`],
      privacidade: ["Política de privacidade", `<p>Coletamos apenas os dados necessários para processar e entregar seu pedido (nome, CPF, contato e endereço), em conformidade com a <b>LGPD (Lei nº 13.709/2018)</b>.</p><p>Suas senhas são armazenadas com criptografia e nunca são compartilhadas. Não vendemos nem cedemos seus dados a terceiros.</p><p>Você pode solicitar a exclusão dos seus dados a qualquer momento pelo e-mail ${esc(st.email)}.</p>`],
      contato: ["Fale conosco", `<p>Estamos aqui para ajudar!</p><ul style="line-height:2">${st.whatsapp ? `<li>WhatsApp: <a class="link" target="_blank" rel="noopener" href="${waLink(st.whatsapp, "Olá, Pingo Chic!")}">${esc(masks.phone(st.whatsapp))}</a></li>` : ""}${st.email ? `<li>E-mail: <a class="link" href="mailto:${esc(st.email)}">${esc(st.email)}</a></li>` : ""}${st.instagram ? `<li>Instagram: <a class="link" target="_blank" rel="noopener" href="https://instagram.com/${esc(st.instagram.replace("@", ""))}">${esc(st.instagram)}</a></li>` : ""}</ul><p>Atendimento de segunda a sexta, das 9h às 18h.</p>`]
    };
    const [title, html] = pages[topic] || pages.contato;
    app().innerHTML = `<div class="wrap"><div class="crumbs"><a href="#/">Início</a> ${svg("chevron", 12)} <span>${title}</span></div>
      <div style="max-width:760px;padding:20px 0 60px"><h1 style="font-size:40px;font-weight:500;margin-bottom:20px">${title}</h1><div style="font-size:15.5px;color:var(--ink-2);line-height:1.7">${html}</div></div></div>`;
  }

  function footerHtml() {
    const st = S.settings;
    return `<div class="wrap">
      <div class="foot-grid">
        <div>
          <a class="foot-logo" href="#/"><img src="${LOGO}" alt="Pingo Chic — Moda infantil" width="88" height="88" loading="lazy"><span><span class="logo-word" style="font-size:30px">Pingo<em>Chic</em></span><span class="logo-sub">Moda infantil</span></span></a>
          <p class="about">Moda infantil com charme, conforto e qualidade — do bebê ao juvenil. Enviamos com carinho para todo o Brasil.</p>
          <div class="social">
            ${st.instagram ? `<a href="https://instagram.com/${esc(st.instagram.replace("@", ""))}" target="_blank" rel="noopener" aria-label="Instagram">${svg("instagram", 18)}</a>` : ""}
            ${st.whatsapp ? `<a href="${waLink(st.whatsapp, "Olá, Pingo Chic!")}" target="_blank" rel="noopener" aria-label="WhatsApp">${svg("whatsapp", 18)}</a>` : ""}
            ${st.email ? `<a href="mailto:${esc(st.email)}" aria-label="E-mail">${svg("mail", 18)}</a>` : ""}
          </div>
        </div>
        <div><h4>Comprar</h4><ul><li><a href="#/loja?g=menina">Menina</a></li><li><a href="#/loja?g=menino">Menino</a></li><li><a href="#/loja?g=bebe">Bebê</a></li><li><a href="#/loja?g=acessorios">Acessórios</a></li><li><a href="#/loja?ofertas=1">Ofertas</a></li></ul></div>
        <div><h4>Ajuda</h4><ul><li><a href="#/rastrear">Acompanhar pedido</a></li><li><a href="#/ajuda/tamanhos">Guia de tamanhos</a></li><li><a href="#/ajuda/entrega">Entrega e frete</a></li><li><a href="#/ajuda/trocas">Trocas e devoluções</a></li><li><a href="#/ajuda/contato">Fale conosco</a></li></ul></div>
        <div><h4>Pagamento</h4><div class="pay-icons"><span>PIX</span><span>VISA</span><span>MASTER</span><span>ELO</span><span>AMEX</span><span>HIPER</span></div><h4 style="margin-top:22px">Segurança</h4><div style="display:flex;gap:8px;align-items:center;color:var(--ink-2)">${svg("shield", 20)} Site protegido · SSL</div></div>
      </div>
      <div class="foot-bottom"><span>© ${new Date().getFullYear()} ${esc(st.storeName)}${st.cnpj ? " · CNPJ " + esc(st.cnpj) : ""} · Todos os direitos reservados.</span><span><a href="#/ajuda/privacidade">Privacidade</a> · <a href="#/ajuda/trocas">Trocas</a></span></div>
    </div>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
