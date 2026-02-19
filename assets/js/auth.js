// =====================================================
// auth.js | NOVA FROTA
// Login por usuário + seleção de estado + permissões
// + (compat) senha extra do Piso (requirePisoAuth)
// =====================================================

// ======== USUÁRIOS (LOGIN) ========
// ✅ define: senha e quais ESTADOS cada usuário pode acessar
const USERS = {
  LUZIANO: {
    password: "1234",
    states: ["GO", "SP", "MT", "MG", "MA", "BA","PR"]
  },
  ELIEL: {
    password: "1234",
    states: ["GO"]
  },
  LUIS: {
    password: "1234",
    states: ["GO"]
  },
  VALDEMI: {
    password: "1234",
    states: ["GO"]
  },
  ARIEL: {
    password: "1234",
    states: ["GO"]
  },
  GOIAS: {
    password: "1234",
    states: ["GO"]
  },
  MATOGROSSO: {
    password: "1234",
    states: ["MT"]
  },
  MINASGERAIS: {
    password: "1234",
    states: ["MG"]
  },
  PARANA: {
    password: "1234",
    states: ["PR"]
  }  
};

// ======== (COMPAT) SENHA EXTRA DO PISO ========
// ✅ se você quiser uma senha única pro Piso, deixe aqui:
const AUTH = {
  PISO_PASSWORD: "9999"
};

// ======== PERMISSÕES POR ESTADO (HOME) ========
// chaves: piso, fretes, share, divulgacao
const STATE_FEATURES = {
  GO: ["piso", "fretes", "share", "divulgacao"],
  SP: ["piso", "divulgacao"],
  MG: ["piso", "divulgacao"],
  MT: ["piso", "divulgacao"],
  BA: ["piso", "divulgacao"],
  SC: ["piso", "divulgacao"],
  MA: ["piso", "divulgacao"]
};

// ======== KEYS (localStorage) ========
const KEY_HOME  = "nf_auth_home";
const KEY_USER  = "nf_auth_user";
const KEY_STATE = "nf_auth_state";
const KEY_PISO  = "nf_auth_piso"; // ✅ (compat) trava só do Piso

// ======== HELPERS ========
function normalizeUpper(v){
  return String(v || "").trim().toUpperCase();
}

function setAuthHome(ok=true){
  localStorage.setItem(KEY_HOME, ok ? "1" : "0");
}
function isAuthedHome(){
  return localStorage.getItem(KEY_HOME) === "1";
}

function setUser(user){
  localStorage.setItem(KEY_USER, normalizeUpper(user));
}
function getUser(){
  return normalizeUpper(localStorage.getItem(KEY_USER));
}

function setSelectedState(uf){
  localStorage.setItem(KEY_STATE, normalizeUpper(uf));
}
function getSelectedState(){
  return normalizeUpper(localStorage.getItem(KEY_STATE));
}

function setAuth(key, value=true){
  localStorage.setItem(key, value ? "1" : "0");
}
function isAuthed(key){
  return localStorage.getItem(key) === "1";
}

function logoutAll(){
  localStorage.removeItem(KEY_HOME);
  localStorage.removeItem(KEY_USER);
  localStorage.removeItem(KEY_STATE);
  localStorage.removeItem(KEY_PISO);
}

// ======== LOGIN CHECK ========
function validateLogin(username, password){
  const u = normalizeUpper(username);
  const p = String(password || "").trim();

  const data = USERS[u];
  if(!data) return { ok:false, reason:"user" };
  if(data.password !== p) return { ok:false, reason:"pass" };

  return { ok:true, user:u, states: (data.states || []) };
}

function userAllowedStates(){
  const u = getUser();
  return (USERS[u]?.states || []);
}

function isStateAllowedForUser(uf){
  const allowed = userAllowedStates();
  return allowed.includes(normalizeUpper(uf));
}

// ======== PERMISSÕES (FEATURES) ========
function featuresForState(uf){
  const key = normalizeUpper(uf);
  return STATE_FEATURES[key] || [];
}

function canAccessFeature(featureKey){
  const uf = getSelectedState();
  const list = featuresForState(uf);
  return list.includes(featureKey);
}

// Guard genérico por feature (opcional usar em páginas)
function requireFeature(featureKey){
  requireHomeAuth();
  const uf = getSelectedState();
  if(!uf){
    window.location.href = "../pages/login.html";
    return;
  }
  if(!canAccessFeature(featureKey)){
    alert("Acesso não liberado para este estado.");
    window.location.href = "../pages/home.html";
  }
}

// ======== GUARDS ========
function requireHomeAuth(){
  if(!isAuthedHome()){
    window.location.href = "../pages/login.html";
    return;
  }

  const uf = getSelectedState();
  if(!uf){
    window.location.href = "../pages/login.html";
    return;
  }

  if(!isStateAllowedForUser(uf)){
    alert("Seu usuário não tem acesso a este estado.");
    logoutAll();
    window.location.href = "../pages/login.html";
  }
}

// ✅ (COMPAT) Guard do Piso: precisa estar logado + estado permitir "piso"
// e opcionalmente pede a senha extra do Piso
function requirePisoAuth(){
  // precisa estar logado
  requireHomeAuth();

  // precisa que o estado permita o piso
  if(!canAccessFeature("piso")){
    alert("Cálculo de Piso não liberado para este estado.");
    window.location.href = "../pages/home.html";
    return;
  }

  // se já validou a senha extra nesta sessão, ok
  if(isAuthed(KEY_PISO)) return;

  // pede a senha extra
  const ok = prompt("Acesso restrito: digite a senha do Cálculo de Piso:");
  if(ok === null){
    window.location.href = "../pages/home.html";
    return;
  }
  if(String(ok).trim() === AUTH.PISO_PASSWORD){
    setAuth(KEY_PISO, true);
    return;
  }

  alert("Senha do Piso inválida.");
  window.location.href = "../pages/home.html";
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
