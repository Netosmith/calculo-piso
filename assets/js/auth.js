// ======== CONFIG (troque as senhas aqui) ========
const AUTH = {
  HOME_PASSWORD: "1234",   // Login 1 (entrada geral)
  PISO_PASSWORD: "9999",   // Login 2 (somente cálculo piso)
};

// ======== KEYS ========
const KEY_HOME = "nf_auth_home";
const KEY_PISO = "nf_auth_piso";
const KEY_ESTADO = "nf_estado_ativo"; // ✅ estado escolhido

// ======== ESTADOS (ordem + rótulo) ========
const ESTADOS = [
  { uf: "GO", nome: "GOIÁS" },
  { uf: "MT", nome: "MATO GROSSO" },
  { uf: "MG", nome: "MINAS GERAIS" },
  { uf: "SP", nome: "SÃO PAULO" },
  { uf: "PR", nome: "PARANÁ" },
  { uf: "SC", nome: "SANTA CATARINA" },
  { uf: "TO", nome: "TOCANTINS" },
  { uf: "MA", nome: "MARANHÃO" },
  { uf: "BA", nome: "BAHIA" },
];

// ======== HELPERS ========
function setAuth(key, value=true){
  localStorage.setItem(key, value ? "1" : "0");
}
function isAuthed(key){
  return localStorage.getItem(key) === "1";
}
function logoutAll(){
  localStorage.removeItem(KEY_HOME);
  localStorage.removeItem(KEY_PISO);
  localStorage.removeItem(KEY_ESTADO);
}

// ======== ESTADO: get/set ========
function getEstadoAtivo(){
  return (localStorage.getItem(KEY_ESTADO) || "").toUpperCase().trim();
}
function setEstadoAtivo(uf){
  localStorage.setItem(KEY_ESTADO, String(uf || "").toUpperCase().trim());
}

// ======== MODAL/SELETOR ========
function ensureEstadoSelecionado(){
  const atual = getEstadoAtivo();
  if (atual) return atual;

  // cria overlay minimalista (sem mexer no seu HTML)
  const overlay = document.createElement("div");
  overlay.id = "estadoOverlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "99999";
  overlay.style.background = "rgba(15,23,42,.55)";
  overlay.style.backdropFilter = "blur(8px)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "16px";

  const card = document.createElement("div");
  card.style.width = "min(560px, 100%)";
  card.style.borderRadius = "18px";
  card.style.border = "1px solid rgba(255,255,255,.10)";
  card.style.background = "rgba(255,255,255,.08)";
  card.style.boxShadow = "0 18px 55px rgba(0,0,0,.35)";
  card.style.overflow = "hidden";

  const head = document.createElement("div");
  head.style.padding = "14px 16px";
  head.style.display = "flex";
  head.style.alignItems = "center";
  head.style.justifyContent = "space-between";
  head.style.gap = "10px";
  head.style.background = "rgba(15,23,42,.65)";
  head.style.color = "#fff";

  const titleWrap = document.createElement("div");
  titleWrap.innerHTML = `
    <div style="font-weight:950; font-size:14px; letter-spacing:.2px;">Selecione o Estado</div>
    <div style="font-size:12px; opacity:.85;">Você verá apenas os acessos liberados para sua UF.</div>
  `;

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Sair";
  close.style.height = "32px";
  close.style.padding = "0 12px";
  close.style.borderRadius = "12px";
  close.style.border = "1px solid rgba(255,255,255,.18)";
  close.style.background = "rgba(255,255,255,.10)";
  close.style.color = "#fff";
  close.style.fontWeight = "900";
  close.style.cursor = "pointer";
  close.onclick = () => {
    // sem estado => volta pro login
    logoutAll();
    window.location.href = "../pages/login.html";
  };

  head.appendChild(titleWrap);
  head.appendChild(close);

  const body = document.createElement("div");
  body.style.padding = "14px 16px 16px";
  body.style.display = "grid";
  body.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  body.style.gap = "10px";

  function mkBtn(uf, nome){
    const b = document.createElement("button");
    b.type = "button";
    b.style.height = "52px";
    b.style.borderRadius = "16px";
    b.style.border = "1px solid rgba(255,255,255,.16)";
    b.style.background = "rgba(255,255,255,.10)";
    b.style.color = "#fff";
    b.style.fontWeight = "950";
    b.style.cursor = "pointer";
    b.style.textAlign = "left";
    b.style.padding = "10px 12px";
    b.style.display = "flex";
    b.style.flexDirection = "column";
    b.style.gap = "2px";

    b.onmouseenter = () => { b.style.filter = "brightness(1.12)"; };
    b.onmouseleave = () => { b.style.filter = "none"; };

    b.innerHTML = `
      <div style="font-size:12px; opacity:.85;">${uf}</div>
      <div style="font-size:13px;">${nome}</div>
    `;

    b.onclick = () => {
      setEstadoAtivo(uf);
      overlay.remove();
      // opcional: força refresh em páginas que exibem o badge
      const ev = new CustomEvent("nf_estado_change", { detail: { uf } });
      window.dispatchEvent(ev);
    };

    return b;
  }

  ESTADOS.forEach((e) => body.appendChild(mkBtn(e.uf, e.nome)));

  // responsivo
  function applyCols(){
    const w = window.innerWidth;
    body.style.gridTemplateColumns = w < 520 ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))";
  }
  applyCols();
  window.addEventListener("resize", applyCols, { passive: true });

  card.appendChild(head);
  card.appendChild(body);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  return ""; // ainda não escolheu
}

// ======== GUARDS ========
function requireHomeAuth(){
  if(!isAuthed(KEY_HOME)){
    window.location.href = "../pages/login.html";
    return;
  }
  // ✅ exige estado após login (se não tiver, abre seletor)
  ensureEstadoSelecionado();
}

function requirePisoAuth(){
  if(!isAuthed(KEY_HOME)){
    window.location.href = "../pages/login.html";
    return;
  }
  ensureEstadoSelecionado();

  if(!isAuthed(KEY_PISO)){
    const ok = prompt("Acesso restrito: digite a senha do Cálculo de Piso:");
    if(ok === null) { window.location.href = "../pages/home.html"; return; }
    if(ok === AUTH.PISO_PASSWORD){
      setAuth(KEY_PISO, true);
      return;
    }
    alert("Senha do Piso inválida.");
    window.location.href = "../pages/home.html";
  }
}

// botão sair (se existir)
function bindLogoutButton(){
  const btn = document.querySelector("[data-logout]");
  if(btn){
    btn.addEventListener("click", () => {
      logoutAll();
      window.location.href = "../pages/login.html";
    });
  }
}

// ✅ helper pro login: faz login e já pede estado antes de ir pro home
function doHomeLogin(){
  setAuth(KEY_HOME, true);
  // abre seletor se ainda não tiver UF salva
  if(!getEstadoAtivo()){
    ensureEstadoSelecionado();
  }
}
