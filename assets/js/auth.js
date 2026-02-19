// =====================================================
// auth.js | NOVA FROTA
// Login por usuário + seleção de estado + permissões
// =====================================================

// ======== USUÁRIOS ========
const USERS = {
  LUZIANO: { password: "5707", states: ["GO","SP","MT","MG","MA","BA","PR"] },
  ELIEL:   { password: "1234", states: ["GO"] },
  LUIS:    { password: "1234", states: ["GO"] },
  VALDEMI: { password: "1234", states: ["GO"] },
  ARIEL:   { password: "1234", states: ["GO"] },
  GOIAS:   { password: "1234", states: ["GO"] },
  MATOGROSSO: { password: "1234", states: ["MT"] },
  MINASGERAIS:{ password: "1234", states: ["MG"] },
  TOCANTINS:{ password: "1234", states: ["TO"] },
  BAHIA:{ password: "1234", states: ["BA"] },
  MARANHAO:{ password: "1234", states: ["MA"] },
  PARA:{ password: "1234", states: ["PR"] },
  PARANA:  { password: "1234", states: ["PR"] }
};

// ======== SENHA EXTRA DO PISO ========
const AUTH = {
  PISO_PASSWORD: "1010"
};

// ======== PERMISSÕES POR ESTADO ========
const STATE_FEATURES = {
  GO: ["piso","fretes","share","divulgacao"],
  SP: ["piso","divulgacao"],
  MG: ["piso","divulgacao"],
  MT: ["piso","divulgacao"],
  BA: ["piso","divulgacao"],
  SC: ["piso","divulgacao"],
  TO: ["piso","divulgacao"],
  PR: ["piso","divulgacao"],
  MA: ["piso","divulgacao"]
};

// ======== KEYS ========
const KEY_HOME  = "nf_auth_home";
const KEY_USER  = "nf_auth_user";
const KEY_STATE = "nf_auth_state";
const KEY_PISO  = "nf_auth_piso";

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
  localStorage.clear();
}

// ✅ NOVO → usado pela CALCULADORA
function getPortalUserName(){
  return getUser();
}

// ======== LOGIN ========
function validateLogin(username, password){

  const u = normalizeUpper(username);
  const p = String(password || "").trim();

  const data = USERS[u];

  if(!data) return { ok:false };
  if(data.password !== p) return { ok:false };

  setAuthHome(true);
  setUser(u);

  return { ok:true, states:data.states };
}

// ======== ESTADOS DO USUÁRIO ========
function userAllowedStates(){
  return USERS[getUser()]?.states || [];
}

function isStateAllowedForUser(uf){
  return userAllowedStates().includes(normalizeUpper(uf));
}

// ======== FEATURES ========
function featuresForState(uf){
  return STATE_FEATURES[normalizeUpper(uf)] || [];
}

function canAccessFeature(featureKey){
  return featuresForState(getSelectedState()).includes(featureKey);
}

// ======== GUARDS ========
function requireHomeAuth(){

  if(!isAuthedHome()){
    window.location.href = "../pages/login.html";
    return;
  }

  if(!getSelectedState()){
    window.location.href = "../pages/login.html";
    return;
  }

  if(!isStateAllowedForUser(getSelectedState())){
    alert("Sem acesso a este estado");
    logoutAll();
    window.location.href = "../pages/login.html";
  }
}

// ======== GUARD DO PISO ========
function requirePisoAuth(){

  requireHomeAuth();

  if(!canAccessFeature("piso")){
    alert("Cálculo de Piso não liberado para este estado.");
    window.location.href = "../pages/home.html";
    return;
  }

  if(isAuthed(KEY_PISO)) return;

  const ok = prompt("Senha do Piso:");

  if(ok === AUTH.PISO_PASSWORD){
    setAuth(KEY_PISO,true);
    return;
  }

  alert("Senha inválida");
  window.location.href = "../pages/home.html";
}

// ======== LOGOUT ========
function bindLogoutButton(){
  const btn = document.querySelector("[data-logout]");
  if(btn){
    btn.onclick = () => {
      logoutAll();
      window.location.href = "../pages/login.html";
    };
  }
}
