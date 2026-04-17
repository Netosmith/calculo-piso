// =====================================================
// auth.js | NOVA FROTA
// Login por usuário + seleção de estado + permissões
// =====================================================

// ======== USUÁRIOS ========
const USERS = {
  LUZIANO: { password: "5707", states: ["GO","GOADM","COMERCIAL", "PATRIMONIO-BR"] },
  JONATHAN: { password: "2424", states: ["PISO"] },
  "GABRIEL PAIVA": { password: "3030", states: ["PISO"] },
  NANEEL: { password: "1212", states: ["PISO"] },
  FABIO: { password: "5707", states: ["OPERACIONAL"] },
  BARIONI: { password: "5707", states: ["COMERCIAL"] },
  ELIEL:   { password: "1234", states: ["COMERCIAL"] },
  ELVIS: { password: "5707", states: ["COMERCIAL"] },
  EVERALDO:   { password: "5000", states: ["OPERACIONAL"] },
  MARCELO:   { password: "8888", states: ["OPERACIONAL"] },
  WILHANS:   { password: "5858", states: ["OPERACIONAL"] },
  RONE:   { password: "5554", states: ["OPERACIONAL"] },
  EVERALDOJR:   { password: "2000", states: ["OPERACIONAL"] },
  KIEWERSON:   { password: "5554", states: ["OPERACIONAL"] },
  FABIOLA:   { password: "6464", states: ["OPERACIONAL"] },
  RAFAEL:   { password: "5554", states: ["OPERACIONAL"] },
  MATEUS:   { password: "5554", states: ["OPERACIONAL"] },
  JHONATAN:   { password: "5554", states: ["OPERACIONAL"] },
  "GUILHERME RAFAEL":   { password: "1212", states: ["OPERACIONAL"] },
  FHELLIPE:   { password: "5554", states: ["OPERACIONAL"] },
  FERNANDO:   { password: "2020", states: ["OPERACIONAL"] },
  ROBSON:   { password: "5554", states: ["OPERACIONAL"] },
  RICARDO:   { password: "5554", states: ["OPERACIONAL"] },
    LUIS:    { password: "1234", states: ["COMERCIAL"] },
  VALDEMI: { password: "1234", states: ["COMERCIAL"] },
  ARIEL:   { password: "1987", states: ["COMERCIAL"] },
  "RIO VERDE":   { password: "1234", states: ["GO"] },
  EDSON:   { password: "5050", states: ["GO"] },
  JATAI:   { password: "5050", states: ["GO"] },
  MONTIVIDIU:   { password: "5554", states: ["GO"] },
  ANAPOLIS:   { password: "4445", states: ["GO"] },
  VIANOPOLIS:   { password: "1234", states: ["GO"] },
  GUILHERME:   { password: "5554", states: ["OPERACIONAL"] },
  INDIARA:   { password: "1234", states: ["GO"] },
  DANILO:   { password: "2424", states: ["GO"] },
  MINEIROS:   { password: "1234", states: ["GO"] },
  CHAPCEU:   { password: "1234", states: ["GO"] },
  ITUMBIARA:   { password: "1234", states: ["GO"] },
  CATALAO:   { password: "1234", states: ["GO"] },
  CRISTALINA:   { password: "1234", states: ["GO"] },
  FORMOSA:   { password: "1234", states: ["GO"] },
  "BOM JESUS":   { password: "8888", states: ["GO"] },
  YASMIN:   { password: "5707", states: ["GOADM"] },
  JAKELINE:   { password: "5707", states: ["GOADM"] },
  OUROSAFRA: { password: "1234", states: ["SP"] },
  GOIAS:   { password: "1234", states: ["GO"] },
  MATOGROSSO: { password: "5554", states: ["MT"] },
  "MINAS GERAIS":{ password: "5554", states: ["MG"] },
  TOCANTINS:{ password: "5554", states: ["TO"] },
  BAHIA:{ password: "5554", states: ["BA"] },
  MARANHAO:{ password: "5554", states: ["MA"] },
  PARA:{ password: "5554", states: ["PA"] },
  PARANA:  { password: "5554", states: ["PR"] }
};

// ======== SENHA EXTRA DO PISO ========
const AUTH = {
  PISO_PASSWORD: "1010"
};

// ======== PERMISSÕES POR ESTADO ========
const STATE_FEATURES = {
  GO: ["fretes","divulgacao"],
  GOADM: ["administrativo", "patrimonio"],
  OPERACIONAL: ["piso","fretes","share","divulgacao","fretes-mercado"],
  COMERCIAL: ["piso","fretes","share","divulgacao","bi","custo-filial","fretes-mercado"],
  PISO: ["piso"],
  SP: ["piso","divulgacao"],
  MG: ["piso","divulgacao"],
  MT: ["piso","divulgacao"],
  BA: ["piso","divulgacao"],
  SC: ["piso","divulgacao"],
  TO: ["piso","divulgacao"],
  PR: ["piso","divulgacao"],
  PA: ["piso","divulgacao"],
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
