// ======== CONFIG (troque as senhas aqui) ========
const AUTH = {
  HOME_PASSWORD: "1234",   // Login 1 (entrada geral)
  PISO_PASSWORD: "9999",   // Login 2 (somente cálculo piso)
};

// ======== KEYS ========
const KEY_HOME = "nf_auth_home";
const KEY_PISO = "nf_auth_piso";
const KEY_ESTADO = "nf_estado_ativo"; // ✅ novo

// ======== ESTADOS (opções) ========
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
function setAuth(key, value = true) {
  localStorage.setItem(key, value ? "1" : "0");
}
function isAuthed(key) {
  return localStorage.getItem(key) === "1";
}
function logoutAll() {
  localStorage.removeItem(KEY_HOME);
  localStorage.removeItem(KEY_PISO);
  localStorage.removeItem(KEY_ESTADO); // ✅ novo
}

// ======== ESTADO ========
function getEstadoAtivo() {
  return (localStorage.getItem(KEY_ESTADO) || "").trim().toUpperCase();
}
function setEstadoAtivo(uf) {
  localStorage.setItem(KEY_ESTADO, String(uf || "").trim().toUpperCase());
}

/**
 * ✅ Seletor minimalista:
 * - Por enquanto via prompt (rápido e sem mexer no layout).
 * - Depois a gente troca por modal bonito no mesmo padrão do sistema.
 */
function ensureEstadoSelecionado() {
  const atual = getEstadoAtivo();
  if (atual) return atual;

  // monta lista "1) GOIÁS (GO)" etc
  const lista = ESTADOS.map((e, i) => `${i + 1}) ${e.nome} (${e.uf})`).join("\n");

  const resp = prompt(
    "Selecione o ESTADO para acessar:\n\n" +
    lista +
    "\n\nDigite o número (ex: 1) ou a UF (ex: GO):"
  );

  if (resp === null) return ""; // cancelou

  const raw = String(resp).trim().toUpperCase();

  // Aceita número
  const idx = parseInt(raw, 10);
  if (!isNaN(idx) && idx >= 1 && idx <= ESTADOS.length) {
    const uf = ESTADOS[idx - 1].uf;
    setEstadoAtivo(uf);
    return uf;
  }

  // Aceita UF
  const found = ESTADOS.find((e) => e.uf === raw);
  if (found) {
    setEstadoAtivo(found.uf);
    return found.uf;
  }

  alert("Estado inválido. Tente novamente.");
  return ensureEstadoSelecionado();
}

// ======== GUARDS ========
function requireHomeAuth() {
  if (!isAuthed(KEY_HOME)) {
    window.location.href = "../pages/login.html";
    return;
  }

  // ✅ garante que sempre terá estado definido ao entrar nas páginas do sistema
  const uf = ensureEstadoSelecionado();
  if (!uf) {
    // se cancelou o seletor, volta pro login
    logoutAll();
    window.location.href = "../pages/login.html";
  }
}

function requirePisoAuth() {
  // precisa estar logado no sistema E no piso
  if (!isAuthed(KEY_HOME)) {
    window.location.href = "../pages/login.html";
    return;
  }

  // ✅ garante estado também (caso alguém abra direto)
  const uf = ensureEstadoSelecionado();
  if (!uf) {
    logoutAll();
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

/**
 * ✅ Função de login (para você usar no login.html)
 * Chame isso quando a senha HOME estiver correta.
 */
function doHomeLogin() {
  setAuth(KEY_HOME, true);
  const uf = ensureEstadoSelecionado();
  if (!uf) {
    logoutAll();
    return;
  }
  window.location.href = "../pages/home.html";
}
