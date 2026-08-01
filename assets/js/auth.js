// =====================================================
// auth.js | PORTAL FRETE
// Sessão real via Cloudflare Worker + KV
// localStorage permanece apenas como cache visual temporário
// =====================================================

// =====================================================
// PERMISSÕES POR PERFIL
// =====================================================
const STATE_FEATURES = {
  GO: ["fretes", "divulgacao", "estadias"],
  GOADM: ["administrativo", "patrimonio", "estadias"],

  OPERACIONAL: [
    "piso", "piso2", "fretes", "share", "divulgacao",
    "fretes-mercado", "bi", "controle", "estadias"
  ],

  COMERCIAL: [
    "piso", "piso2", "fretes", "share", "divulgacao",
    "bi", "fretes-mercado", "controle", "fretes2", "estadias"
  ],

  ADMINISTRADOR: [
    "piso", "piso2", "fretes", "share", "divulgacao", "bi",
    "custo-filial", "fretes-mercado", "administrativo",
    "patrimonio", "cadastros", "fretes2", "controle", "estadias"
  ],

  ESTADIAS_ADMIN: ["estadias"],
  ESTADIAS_EDITOR: ["estadias"],
  ESTADIAS_CONSULTA: ["estadias"],
  PISO: ["piso2"],

  SP: ["piso", "divulgacao", "estadias"],
  MG: ["piso", "divulgacao", "estadias"],
  MT: ["piso", "divulgacao", "fretes2", "controle", "share", "estadias"],
  BA: ["piso", "divulgacao", "estadias"],
  SC: ["piso", "divulgacao", "estadias"],
  TO: ["piso", "divulgacao", "estadias"],
  PR: ["piso", "divulgacao", "estadias"],
  PA: ["piso", "divulgacao", "estadias"],
  MA: ["piso", "divulgacao", "estadias"]
};

const ESTADIAS_WRITE_PROFILES = [
  "ADMINISTRADOR",
  "GOADM",
  "ESTADIAS_ADMIN",
  "ESTADIAS_EDITOR"
];

const ESTADIAS_DELETE_PROFILES = [
  "ADMINISTRADOR",
  "GOADM",
  "ESTADIAS_ADMIN"
];

// =====================================================
// CACHE LOCAL DE COMPATIBILIDADE
// =====================================================
const KEY_HOME    = "nf_auth_home";
const KEY_USER    = "nf_auth_user";
const KEY_NAME    = "nf_auth_name";
const KEY_PROFILE = "nf_auth_profile";
const KEY_STATES  = "nf_auth_states";
const KEY_STATE   = "nf_auth_state";
const KEY_PISO    = "nf_auth_piso";
const KEY_PISO2   = "nf_auth_piso2";

function normalizeUpper(value){
  return String(value || "")
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
  localStorage.setItem(KEY_PROFILE, normalizeUpper(profile || "OPERACIONAL"));
}

function getProfile(){
  return normalizeUpper(localStorage.getItem(KEY_PROFILE) || "OPERACIONAL");
}

function setUserStates(states){
  const normalized = Array.isArray(states)
    ? states.map(normalizeUpper).filter(Boolean)
    : [];

  localStorage.setItem(KEY_STATES, JSON.stringify(normalized));
}

function getUserStates(){
  try{
    const value = JSON.parse(localStorage.getItem(KEY_STATES) || "[]");
    return Array.isArray(value)
      ? value.map(normalizeUpper).filter(Boolean)
      : [];
  }catch(error){
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

function clearAuthCache(){
  [
    KEY_HOME,
    KEY_USER,
    KEY_NAME,
    KEY_PROFILE,
    KEY_STATES,
    KEY_STATE,
    KEY_PISO,
    KEY_PISO2
  ].forEach(key => localStorage.removeItem(key));
}

function logoutAll(){
  clearAuthCache();
}

function mirrorServerSession(session){
  if(!session){
    clearAuthCache();
    return false;
  }

  setAuthHome(true);
  setUser(session.usuario || "");
  setPortalUserName(session.nome || session.usuario || "");
  setProfile(session.perfil || "OPERACIONAL");
  setUserStates(session.estados || []);

  if(session.estado){
    setSelectedState(session.estado);
  }else{
    localStorage.removeItem(KEY_STATE);
  }

  return true;
}

function getAuthContext(){
  return {
    usuario: getUser(),
    nome: getPortalUserName(),
    perfil: getProfile(),
    estado: getSelectedState(),
    estados: getUserStates()
  };
}

// =====================================================
// API E SESSÃO
// =====================================================
async function ensurePortalApi(){
  if(window.PortalAPI){
    return window.PortalAPI;
  }

  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-portal-api]');

    if(existing){
      existing.addEventListener("load", resolve, { once:true });
      existing.addEventListener("error", reject, { once:true });
      return;
    }

    const script = document.createElement("script");
    script.src = "../assets/js/api.js?v=2";
    script.dataset.portalApi = "1";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Falha ao carregar a API do Portal."));
    document.head.appendChild(script);
  });

  if(!window.PortalAPI){
    throw new Error("API do Portal indisponível.");
  }

  return window.PortalAPI;
}

async function refreshPortalSession(){
  try{
    const api = await ensurePortalApi();
    const result = await api.session();
    mirrorServerSession(result.session);
    return result.session;
  }catch(error){
    if(error?.status === 401){
      clearAuthCache();
    }
    throw error;
  }
}

async function validateLogin(username, password){
  const usuario = normalizeUpper(username);
  const senha = String(password || "").trim();

  if(!usuario || !senha){
    return { ok:false, error:"Informe usuário e senha." };
  }

  try{
    const api = await ensurePortalApi();
    const result = await api.login(usuario, senha);
    const session = result.session;

    mirrorServerSession(session);

    return {
      ok:true,
      usuario:session.usuario,
      nome:session.nome,
      perfil:session.perfil,
      states:session.estados || [],
      estado:session.estado || ""
    };
  }catch(error){
    clearAuthCache();
    return {
      ok:false,
      error:error?.message || "Usuário ou senha inválidos."
    };
  }
}

async function selectPortalState(estado){
  const api = await ensurePortalApi();
  const result = await api.selectState(normalizeUpper(estado));
  mirrorServerSession(result.session);
  return result.session;
}

async function logoutPortal(){
  try{
    const api = await ensurePortalApi();
    await api.logout();
  }catch(error){
    console.warn("[AUTH] Não foi possível encerrar a sessão remota:", error);
  }finally{
    clearAuthCache();
  }
}

async function verifyPortalSession(options = {}){
  try{
    const session = await refreshPortalSession();

    if(options.requireState && !session?.estado){
      window.location.href = "../pages/login.html";
      return null;
    }

    return session;
  }catch(error){
    if(options.redirect !== false){
      window.location.href = "../pages/login.html";
    }
    return null;
  }
}

// =====================================================
// ESTADOS E FEATURES
// =====================================================
function userAllowedStates(){
  return getUserStates();
}

function isStateAllowedForUser(uf){
  return userAllowedStates().includes(normalizeUpper(uf));
}

function featuresForProfile(profile){
  return STATE_FEATURES[normalizeUpper(profile)] || [];
}

function canAccessFeature(featureKey){
  const feature = String(featureKey || "").trim().toLowerCase();
  return featuresForProfile(getProfile()).includes(feature);
}

function canViewEstadias(){
  return canAccessFeature("estadias");
}

function canWriteEstadias(){
  return ESTADIAS_WRITE_PROFILES.includes(getProfile());
}

function canDeleteEstadias(){
  return ESTADIAS_DELETE_PROFILES.includes(getProfile());
}

function getEstadiasAccessMode(){
  if(!canViewEstadias()) return "DENIED";
  if(canWriteEstadias()) return "WRITE";
  return "READ";
}

function applyEstadiasAccessUI(){
  const mode = getEstadiasAccessMode();
  const readOnly = mode === "READ";

  document.body.classList.toggle("estadiasReadOnly", readOnly);
  document.body.dataset.estadiasAccess = mode.toLowerCase();

  document.querySelectorAll("[data-estadias-write]").forEach(element => {
    element.hidden = readOnly;
    element.disabled = readOnly;
  });

  document.querySelectorAll("[data-estadias-delete]").forEach(element => {
    const allowed = canDeleteEstadias();
    element.hidden = !allowed;
    element.disabled = !allowed;
  });

  return mode;
}

// =====================================================
// GUARDAS DE COMPATIBILIDADE
// =====================================================
function redirectToLogin(){
  window.location.href = "../pages/login.html";
}

function requireHomeAuth(){
  if(!isAuthedHome()){
    redirectToLogin();
    return false;
  }

  const state = getSelectedState();
  if(!state || !isStateAllowedForUser(state)){
    clearAuthCache();
    redirectToLogin();
    return false;
  }

  verifyPortalSession({ requireState:true });
  return true;
}

function requireFeatureAuth(featureKey, deniedMessage){
  if(requireHomeAuth() !== true){
    return false;
  }

  if(!canAccessFeature(featureKey)){
    alert(deniedMessage || "Esta funcionalidade não está liberada para este perfil.");
    window.location.href = "../pages/home.html";
    return false;
  }

  return true;
}

function requireEstadiasAuth(){
  if(requireFeatureAuth(
    "estadias",
    "Controle de Estadias não liberado para este perfil."
  ) !== true){
    return false;
  }

  applyEstadiasAccessUI();
  return true;
}

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

function bindLogoutButton(){
  const button = document.querySelector("[data-logout]");
  if(!button) return;

  button.onclick = async () => {
    button.disabled = true;
    await logoutPortal();
    redirectToLogin();
  };
}

window.portalAuthReady = refreshPortalSession()
  .then(session => {
    window.dispatchEvent(new CustomEvent("portal:session", { detail:session }));
    return session;
  })
  .catch(() => null);

// Carrega a implementação da tela Patrimônio BR sem depender de chamada pública.
(function loadPatrimonioBrModule(){
  const path = String(window.location.pathname || "").toLowerCase();
  if(!path.endsWith("/patrimonio-br.html")) return;

  ensurePortalApi()
    .then(() => new Promise((resolve, reject) => {
      if(document.querySelector('script[data-patrimonio-br]')) return resolve();
      const script = document.createElement("script");
      script.src = "../assets/js/patrimonio-br.js?v=1";
      script.dataset.patrimonioBr = "1";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Falha ao carregar o módulo Patrimônio BR."));
      document.head.appendChild(script);
    }))
    .catch(error => {
      console.error("[AUTH] Patrimônio BR:", error);
      const status = document.getElementById("syncStatus");
      if(status) status.textContent = "❌ Módulo indisponível";
    });
})();