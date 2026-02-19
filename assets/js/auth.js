// =====================================================
// auth.js | NOVA FROTA
// Login por usuário + seleção de estado + permissões
// =====================================================

// ======== USUÁRIOS (LOGIN) ========
// ✅ aqui define: senha e quais ESTADOS cada usuário pode acessar
const USERS = {
  LUZIANO: {
    password: "1234",
    states: ["GO", "SP", "MT"]
  },
  ELIEL: {
    password: "1234",
    states: ["GO"]
  }
};

// ======== PERMISSÕES POR ESTADO (HOME) ========
// ✅ aqui define o que cada ESTADO pode ver na HOME
// chaves: piso, fretes, share, divulgacao
const STATE_FEATURES = {
  GO: ["piso", "fretes", "share", "divulgacao"],
  SP: ["piso", "divulgacao"],
  MG: ["piso"],
  MT: ["piso", "divulgacao"] // (se quiser MT diferente, muda aqui)
  // outros estados: adicione seguindo o padrão
};

// ======== KEYS (localStorage) ========
const KEY_HOME  = "nf_auth_home";
const KEY_USER  = "nf_auth_user";
const KEY_STATE = "nf_auth_state";

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

function logoutAll(){
  localStorage.removeItem(KEY_HOME);
  localStorage.removeItem(KEY_USER);
  localStorage.removeItem(KEY_STATE);
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

// Guard para páginas (opcional usar depois)
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

  // precisa ter estado escolhido também
  const uf = getSelectedState();
  if(!uf){
    window.location.href = "../pages/login.html";
    return;
  }

  // confere se o estado escolhido é permitido para o usuário logado
  if(!isStateAllowedForUser(uf)){
    alert("Seu usuário não tem acesso a este estado.");
    logoutAll();
    window.location.href = "../pages/login.html";
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
