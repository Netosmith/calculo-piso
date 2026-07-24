// =====================================================
// auth.js | NOVA FROTA
// Login via Google Apps Script + seleção de estado
// Senhas removidas do navegador
// =====================================================

const AUTH_API_URL =
  "https://script.google.com/macros/s/AKfycbxqYIjETvyUF3DF_ovqQQ5NORRePQw2dxH2dgrERigGsEitSLH1qbLwO3kVrpTYoUfG/exec";

// ======== PERMISSÕES POR PERFIL ========
const STATE_FEATURES = {
  GO: ["fretes","divulgacao"],
  GOADM: ["administrativo","patrimonio"],

  OPERACIONAL: [
    "piso","piso2","fretes","share","divulgacao",
    "fretes-mercado","bi","controle"
  ],

  COMERCIAL: [
    "piso","piso2","fretes","share","divulgacao",
    "bi","fretes-mercado","controle","fretes2"
  ],

  ADMINISTRADOR: [
    "piso","piso2","fretes","share","divulgacao","bi",
    "custo-filial","fretes-mercado","administrativo",
    "patrimonio","cadastros","fretes2","controle"
  ],

  // Perfil exclusivo para o Piso 2.
  PISO: ["piso2"],

  SP: ["piso","divulgacao"],
  MG: ["piso","divulgacao"],
  MT: ["piso","divulgacao","fretes2","controle","share"],
  BA: ["piso","divulgacao"],
  SC: ["piso","divulgacao"],
  TO: ["piso","divulgacao"],
  PR: ["piso","divulgacao"],
  PA: ["piso","divulgacao"],
  MA: ["piso","divulgacao"]
};

// ======== KEYS ========
const KEY_HOME    = "nf_auth_home";
const KEY_USER    = "nf_auth_user";
const KEY_NAME    = "nf_auth_name";
const KEY_PROFILE = "nf_auth_profile";
const KEY_STATES  = "nf_auth_states";
const KEY_STATE   = "nf_auth_state";
const KEY_PISO    = "nf_auth_piso";
const KEY_PISO2   = "nf_auth_piso2";

// ======== HELPERS ========
function normalizeUpper(v){
  return String(v || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function setAuthHome(ok = true){
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

function setPortalUserName(name){
  localStorage.setItem(KEY_NAME, String(name || "").trim());
}

function getPortalUserName(){
  return localStorage.getItem(KEY_NAME) || getUser();
}

function setProfile(profile){
  localStorage.setItem(
    KEY_PROFILE,
    normalizeUpper(profile || "OPERACIONAL")
  );
}

function getProfile(){
  return normalizeUpper(
    localStorage.getItem(KEY_PROFILE) || "OPERACIONAL"
  );
}

function setUserStates(states){
  const arr = Array.isArray(states)
    ? states.map(normalizeUpper).filter(Boolean)
    : [];

  localStorage.setItem(KEY_STATES, JSON.stringify(arr));
}

function getUserStates(){
  try{
    const arr = JSON.parse(localStorage.getItem(KEY_STATES) || "[]");
    return Array.isArray(arr)
      ? arr.map(normalizeUpper).filter(Boolean)
      : [];
  }catch(e){
    console.error("[AUTH] Estados inválidos no localStorage:", e);
    return [];
  }
}

function setSelectedState(uf){
  localStorage.setItem(KEY_STATE, normalizeUpper(uf));
}

function getSelectedState(){
  return normalizeUpper(localStorage.getItem(KEY_STATE));
}

function setAuth(key, value = true){
  localStorage.setItem(key, value ? "1" : "0");
}

function isAuthed(key){
  return localStorage.getItem(key) === "1";
}

function logoutAll(){
  localStorage.clear();
}

// ======== JSONP ========
function authJsonp(paramsObj, timeoutMs = 30000){
  return new Promise((resolve, reject) => {
    const cb = "auth_cb_" + Math.random().toString(36).slice(2);
    const url = new URL(AUTH_API_URL);
    const script = document.createElement("script");

    Object.entries(paramsObj || {}).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });

    url.searchParams.set("callback", cb);
    url.searchParams.set("_", Date.now());

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado ao validar login."));
    }, timeoutMs);

    function cleanup(){
      clearTimeout(timer);
      try{ delete window[cb]; }catch(e){}
      try{ script.remove(); }catch(e){}
    }

    window[cb] = data => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Falha ao conectar ao servidor de login."));
    };

    script.src = url.toString();
    document.head.appendChild(script);
  });
}

// ======== LOGIN ========
async function validateLogin(username, password){
  const u = normalizeUpper(username);
  const p = String(password || "").trim();

  if(!u || !p){
    return {ok:false, error:"Informe usuário e senha."};
  }

  try{
    const res = await authJsonp({
      action:"login",
      usuario:u,
      senha:p
    });

    if(!res || res.ok !== true){
      return {
        ok:false,
        error:res?.error || "Usuário ou senha inválidos."
      };
    }

    const states = Array.isArray(res.states)
      ? res.states.map(normalizeUpper).filter(Boolean)
      : [];

    setAuthHome(true);
    setUser(res.usuario || u);
    setPortalUserName(res.nome || res.usuario || u);
    setProfile(res.perfil || "OPERACIONAL");
    setUserStates(states);

    return {
      ok:true,
      usuario:res.usuario || u,
      nome:res.nome || res.usuario || u,
      perfil:res.perfil || "OPERACIONAL",
      states
    };
  }catch(err){
    return {
      ok:false,
      error:err?.message || "Erro ao validar login."
    };
  }
}

// ======== ESTADOS DO USUÁRIO ========
function userAllowedStates(){
  return getUserStates();
}

function isStateAllowedForUser(uf){
  return userAllowedStates().includes(normalizeUpper(uf));
}

// ======== FEATURES POR PERFIL ========
function featuresForProfile(profile){
  return STATE_FEATURES[normalizeUpper(profile)] || [];
}

function canAccessFeature(featureKey){
  const feature = String(featureKey || "")
    .trim()
    .toLowerCase();

  return featuresForProfile(getProfile()).includes(feature);
}

// ======== GUARD BASE ========
function requireHomeAuth(){
  if(!isAuthedHome()){
    window.location.href = "../pages/login.html";
    return false;
  }

  const state = getSelectedState();

  if(!state){
    window.location.href = "../pages/login.html";
    return false;
  }

  if(!isStateAllowedForUser(state)){
    alert("Sem acesso a este estado.");
    logoutAll();
    window.location.href = "../pages/login.html";
    return false;
  }

  return true;
}

// ======== GUARD GENÉRICO ========
function requireFeatureAuth(featureKey, deniedMessage){
  if(requireHomeAuth() !== true){
    return false;
  }

  if(!canAccessFeature(featureKey)){
    alert(
      deniedMessage ||
      "Esta funcionalidade não está liberada para este perfil."
    );

    window.location.href = "../pages/home.html";
    return false;
  }

  return true;
}

// ======== PISO ANTIGO ========
function requirePisoAuth(){
  if(requireFeatureAuth(
    "piso",
    "Cálculo de Piso não liberado para este perfil."
  ) !== true){
    return false;
  }

  setAuth(KEY_PISO, true);
  return true;
}

// ======== PISO 2 ========
function requirePiso2Auth(){
  if(requireFeatureAuth(
    "piso2",
    "Cálculo de Piso 2 não liberado para este perfil."
  ) !== true){
    return false;
  }

  setAuth(KEY_PISO2, true);
  return true;
}

// ======== LOGOUT ========
function bindLogoutButton(){
  const btn = document.querySelector("[data-logout]");

  if(!btn)return;

  btn.onclick = () => {
    logoutAll();
    window.location.href = "../pages/login.html";
  };
}
