// ======== CONFIG (troque as senhas aqui) ========
const AUTH = {
  HOME_PASSWORD: "1234",   // Login 1 (entrada geral)
  PISO_PASSWORD: "9999",   // Login 2 (somente cálculo piso)
};

// ======== KEYS ========
const KEY_HOME  = "nf_auth_home";
const KEY_PISO  = "nf_auth_piso";
const KEY_STATE = "nf_auth_state"; // ✅ estado selecionado

// ✅ Lista de estados (pode ajustar nomes/UF como quiser)
const STATES = [
  { uf: "GO", name: "Goiás",        slug: "GOIAS" },
  { uf: "MT", name: "Mato Grosso",  slug: "MATO_GROSSO" },
  { uf: "MG", name: "Minas Gerais", slug: "MINAS_GERAIS" },
  { uf: "SP", name: "São Paulo",    slug: "SAO_PAULO" },
  { uf: "PR", name: "Paraná",       slug: "PARANA" },
  { uf: "SC", name: "Santa Catarina", slug: "SANTA_CATARINA" },
  { uf: "TO", name: "Tocantins",    slug: "TOCANTINS" },
  { uf: "MA", name: "Maranhão",     slug: "MARANHAO" },
  { uf: "BA", name: "Bahia",        slug: "BAHIA" },
];

// ======== HELPERS ========
function setAuth(key, value = true) {
  localStorage.setItem(key, value ? "1" : "0");
}
function isAuthed(key) {
  return localStorage.getItem(key) === "1";
}
function logoutAll() {
  localStorage.removeItem(KEY_HOME);
  localStorage.removeItem(KEY_PISO);
  localStorage.removeItem(KEY_STATE);
}

function setSelectedState(uf) {
  localStorage.setItem(KEY_STATE, String(uf || "").toUpperCase());
}
function getSelectedState() {
  return (localStorage.getItem(KEY_STATE) || "").toUpperCase();
}

// ======== GUARDS ========
function requireHomeAuth() {
  if (!isAuthed(KEY_HOME)) {
    window.location.href = "../pages/login.html";
  }
}
function requirePisoAuth() {
  // precisa estar logado no sistema E no piso
  if (!isAuthed(KEY_HOME)) {
    window.location.href = "../pages/login.html";
    return;
  }
  if (!isAuthed(KEY_PISO)) {
    const ok = prompt("Acesso restrito: digite a senha do Cálculo de Piso:");
    if (ok === null) { window.location.href = "../pages/home.html"; return; }
    if (ok === AUTH.PISO_PASSWORD) {
      setAuth(KEY_PISO, true);
      return;
    }
    alert("Senha do Piso inválida.");
    window.location.href = "../pages/home.html";
  }
}

// botão sair (se existir)
function bindLogoutButton() {
  const btn = document.querySelector("[data-logout]");
  if (btn) {
    btn.addEventListener("click", () => {
      logoutAll();
      window.location.href = "../pages/login.html";
    });
  }
}

/* =========================================================
   ✅ SELETOR DE ESTADO (MODAL)
   Requisitos no HTML:
   - Um overlay com id="stateModal"
   - Um container com id="stateGrid"
   - Um botão OK com id="stateOk"
   - Um texto status com id="stateChosen"
========================================================= */
function bindStateSelector(options = {}) {
  const {
    mustChoose = true,        // bloqueia login até selecionar
    autoOpen = true,          // abre automaticamente ao carregar
  } = options;

  const modal = document.getElementById("stateModal");
  const grid  = document.getElementById("stateGrid");
  const btnOk = document.getElementById("stateOk");
  const chosenEl = document.getElementById("stateChosen");

  if (!modal || !grid || !btnOk) return;

  let selected = getSelectedState();

  function paintChosen() {
    if (chosenEl) {
      if (selected) chosenEl.textContent = `Selecionado: ${selected}`;
      else chosenEl.textContent = "Selecione um estado para continuar.";
    }
  }

  function open() {
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    paintChosen();
  }
  function close() {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }

  // monta botões
  grid.innerHTML = "";
  STATES.forEach((s, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "stateBtn stateTheme-" + (idx % 9);
    btn.dataset.uf = s.uf;

    btn.innerHTML = `
      <div class="stateMain">${s.name}</div>
      <div class="stateUf">${s.uf}</div>
    `;

    if (selected === s.uf) btn.classList.add("active");

    btn.addEventListener("click", () => {
      selected = s.uf;

      // remove active dos outros
      grid.querySelectorAll(".stateBtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      paintChosen();
    });

    grid.appendChild(btn);
  });

  btnOk.addEventListener("click", () => {
    if (mustChoose && !selected) {
      alert("Selecione um estado para continuar.");
      return;
    }
    if (selected) setSelectedState(selected);
    close();
  });

  // abre se não tem estado
  if (autoOpen) {
    if (!getSelectedState()) open();
    else paintChosen();
  }

  // expõe para usar em botão “Trocar Estado” no futuro
  window.openStateSelector = open;
}
