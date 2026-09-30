// =====================================================
// auth.js | PORTAL FRETE
// Sessão real via Cloudflare Worker + KV
// localStorage permanece apenas como cache visual temporário
// =====================================================

// =====================================================
// PERMISSÕES POR PERFIL
// =====================================================
const STATE_FEATURES = {
  GO: ["fretes", "divulgacao", "estadias", "chamados"],
  GOADM: ["administrativo", "patrimonio", "estadias", "chamados"],

  OPERACIONAL: [
    "piso", "piso2", "fretes", "share", "divulgacao",
    "fretes-mercado", "bi", "controle", "estadias", "embarques", "chamados"],

  COMERCIAL: [
    "piso", "piso2", "fretes", "share", "divulgacao",
    "bi", "custo-frota", "fretes-mercado", "controle", "fretes2", "estadias", "relatorio", "embarques", "chamados"],

  ADMINISTRADOR: [
    "piso", "piso2", "fretes", "share", "divulgacao", "bi",
    "custo-filial", "custo-frota", "fretes-mercado", "administrativo",
    "patrimonio", "cadastros", "fretes2", "controle", "estadias", "relatorio", "embarques", "chamados"],

  ESTADIAS_ADMIN: ["estadias"],
  ESTADIAS_EDITOR: ["estadias"],
  ESTADIAS_CONSULTA: ["estadias"],
  PISO: ["piso2"],

  SP: ["piso", "divulgacao", "estadias"],
  MG: ["piso", "divulgacao", "estadias"],
  MT: ["piso", "divulgacao", "fretes2", "controle", "share", "embarques", "relatorio", "chamados"],
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
    script.src = "../assets/js/api.js?v=5";
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
  let feature = String(featureKey || "").trim().toLowerCase();
  const profile = getProfile();

  // Compatibilidade da tela Fretes MT:
  // o fretes2.js ainda valida "fretes" na inicialização, mas nesta página
  // a permissão correta é "fretes2". A conversão é limitada à rota Fretes2,
  // sem liberar o módulo Fretes GO para o perfil MT.
  const currentPath = String(window.location.pathname || "").toLowerCase();
  if(feature === "fretes" && currentPath.endsWith("/fretes2.html")){
    feature = "fretes2";
  }

  // ADMINISTRADOR sempre possui acesso a todas as funcionalidades do frontend.
  // Assim, novos módulos não precisam ser adicionados manualmente ao array ADMINISTRADOR.
  if(profile === "ADMINISTRADOR"){
    return isAuthedHome();
  }

  // Central de Suporte é liberada para qualquer usuário autenticado.
  if(feature === "chamados"){
    return isAuthedHome();
  }

  const features = featuresForProfile(profile)
    .map(item => String(item || "").trim().toLowerCase());

  return features.includes(feature);
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

function requireChamadosAuth(){
  return requireFeatureAuth(
    "chamados",
    "Central de Suporte não liberada para este perfil."
  );
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

// =====================================================
// PORTAL GLOBAL NAV
// Menu superior compartilhado entre os módulos do Portal.
// Os itens são filtrados pelas mesmas permissões usadas na Home.
// =====================================================
const PORTAL_NAV_ITEMS = [
  {
    key:"home",
    label:"Home",
    href:"./home.html",
    always:true,
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>'
  },
  {
    key:"piso",
    label:"Cálculo Piso",
    feature:["piso2","piso"],
    href:() => canAccessFeature("piso2") ? "./calculo-antt.html" : "./calculo-piso.html",
    paths:["calculo-piso.html","calculo-antt.html","calculo-antt2.html"],
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 6-7"/></svg>'
  },
  {
    key:"fretes",
    label:"Fretes",
    feature:["fretes","fretes2"],
    href:() => {
      const uf = typeof getSelectedState === "function" ? getSelectedState() : "";
      if(uf === "MT" && canAccessFeature("fretes2")) return "./fretes2.html";
      if(canAccessFeature("fretes")) return "./fretes.html";
      return "./fretes2.html";
    },
    paths:["fretes.html","fretes2.html"],
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>'
  },
  {
    key:"controle",
    label:"Controle Embarque",
    feature:"controle",
    href:"./controle.html",
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7"/><path d="M3 20h18"/></svg>'
  },
  {
    key:"share",
    label:"Share Clientes",
    feature:"share",
    href:"./share-clientes.html",
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 2-7 5-7s5 3 5 7M14 14c4-.8 7 1.7 7 6"/></svg>'
  },
  {
    key:"divulgacao",
    label:"Divulgação",
    feature:"divulgacao",
    href:"./divulgacao.html",
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13V9l12-5v14L4 13Z"/><path d="M16 8h3a2 2 0 0 1 0 4h-3M6 13l1 6h4l-2-5"/></svg>'
  },
  {
    key:"bi",
    label:"BI Operacional",
    feature:"bi",
    href:"./bi.html",
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10h3v10M11 20V4h3v16M17 20v-7h3v7M3 20h19"/></svg>'
  },
  {
    key:"administrativo",
    label:"Administrativo",
    feature:"administrativo",
    href:"./administrativo.html",
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2-1.7.7-1.9-.9L1.1 5.9l.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7 2-.7Z" transform="translate(1.5 0) scale(.85)"/></svg>'
  },
  {
    key:"cadastros",
    label:"Cadastro",
    feature:"cadastros",
    href:"./cadastros.html",
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>'
  },
  {
    key:"relatorio",
    label:"Relatório",
    feature:"relatorio",
    href:"./relatorio.html",
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/></svg>'
  },
  {
    key:"estadias",
    label:"Estadia",
    feature:"estadias",
    href:"./estadias.html",
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>'
  },
  {
    key:"fretes-mercado",
    label:"Fretes Mercado",
    feature:"fretes-mercado",
    href:"./fretes-mercado.html",
    secondary:true,
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10h4v10M10 20V6h4v14M16 20V3h4v17"/><path d="M3 20h18"/></svg>'
  },
  {
    key:"custo-frota",
    label:"Cálculo Frota",
    feature:"custo-frota",
    href:"./custo-frota-pesada.html",
    secondary:true,
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17h16M6 17l2-7h8l2 7"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/></svg>'
  },
  {
    key:"custo-filial",
    label:"Resultado Filial",
    feature:"custo-filial",
    href:"./custo-filial.html",
    secondary:true,
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11"/><path d="M8 20v-6h8v6M8 10h.01M12 10h.01M16 10h.01"/></svg>'
  },
  {
    key:"patrimonio",
    label:"Patrimônio",
    feature:"patrimonio",
    href:"./patrimonio-br.html",
    secondary:true,
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V8l7-4 7 4v13"/><path d="M9 12h6M9 16h6"/></svg>'
  },
  {
    key:"embarques",
    label:"Embarques",
    feature:"embarques",
    href:"./embarques.html",
    secondary:true,
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M4 9h16M8 5v14M15 12h3"/></svg>'
  },
  {
    key:"chamados",
    label:"Suporte",
    feature:"chamados",
    href:"./chamados.html",
    secondary:true,
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><path d="M4 13a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2ZM20 13a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2Z"/></svg>'
  }
];

function injectPortalNavStyles(){
  if(document.getElementById("nfGlobalNavStyle")) return;

  const style = document.createElement("style");
  style.id = "nfGlobalNavStyle";
  style.textContent = `
    .nf-global-nav{
      flex:1 1 auto;
      min-width:0;
      height:62px;
      display:flex;
      align-items:stretch;
      justify-content:center;
      gap:0;
      overflow-x:hidden;
      overflow-y:hidden;
      scrollbar-width:none;
      -ms-overflow-style:none;
      position:relative;
      z-index:80;
      margin:0 12px;
      background:linear-gradient(90deg,rgba(4,22,47,.94),rgba(7,31,62,.94) 55%,rgba(4,22,47,.94));
      border:1px solid rgba(67,139,210,.12);
      border-radius:12px;
      box-shadow:inset 0 -1px 0 rgba(255,255,255,.025);
    }
    .nf-global-nav::-webkit-scrollbar{display:none}
    .nf-global-nav-item{
      position:relative;
      flex:0 0 auto;
      min-width:78px;
      height:62px;
      padding:7px 11px 6px;
      box-sizing:border-box;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:4px;
      color:#d6e7fb!important;
      text-decoration:none!important;
      border-left:1px solid rgba(255,255,255,.035);
      border-right:1px solid rgba(255,255,255,.02);
      background:transparent;
      font-family:Inter,Arial,sans-serif;
      transition:background .2s ease,color .2s ease,transform .2s ease;
      white-space:nowrap;
    }
    .nf-global-nav-item svg{
      width:20px;
      height:20px;
      fill:none;
      stroke:currentColor;
      stroke-width:1.8;
      stroke-linecap:round;
      stroke-linejoin:round;
      opacity:.95;
      transition:filter .2s ease,transform .2s ease;
    }
    .nf-global-nav-item span{
      font-size:10px;
      line-height:1;
      font-weight:800;
      letter-spacing:-.01em;
    }
    .nf-global-nav-item::after{
      content:"";
      position:absolute;
      left:11px;
      right:11px;
      bottom:2px;
      height:2px;
      border-radius:999px;
      background:#42b9ff;
      box-shadow:
        0 0 4px #42b9ff,
        0 0 10px #168fff,
        0 0 20px rgba(0,153,255,.92),
        0 -3px 18px rgba(61,177,255,.38);
      transform:scaleX(0);
      transform-origin:center;
      opacity:0;
      transition:transform .18s ease,opacity .18s ease;
    }
    .nf-global-nav-item:hover,
    .nf-global-nav-item:focus-visible{
      color:#fff!important;
      background:linear-gradient(180deg,rgba(14,83,154,.14),rgba(14,115,215,.09));
      outline:none;
    }
    .nf-global-nav-item:hover::after,
    .nf-global-nav-item:focus-visible::after,
    .nf-global-nav-item.active::after{
      transform:scaleX(1);
      opacity:1;
    }
    .nf-global-nav-item:hover svg,
    .nf-global-nav-item:focus-visible svg,
    .nf-global-nav-item.active svg{
      filter:drop-shadow(0 0 5px rgba(56,189,248,.95));
      transform:translateY(-1px);
    }
    .nf-global-nav-item.active{
      color:#fff!important;
      background:linear-gradient(180deg,rgba(18,85,157,.2),rgba(8,73,143,.12));
    }

    /* O menu entra dentro do cabeçalho que a página já possui. */
    .topbar-inner.nf-global-nav-host,
    .nf-topbar-inner.nf-global-nav-host,
    .fleet-topbar-inner.nf-global-nav-host{
      display:flex!important;
      align-items:center!important;
      min-width:0;
    }
    header.topbar.nf-global-nav-host,
    header.portal-header.nf-global-nav-host{
      display:flex!important;
      align-items:center!important;
      min-width:0;
    }
    .nf-global-nav-host > .nf-global-nav{min-width:240px}

    .nf-global-nav-more-button{
      position:relative;
      flex:0 0 48px;
      width:48px;
      height:48px;
      margin-left:2px;
      align-self:center;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      border:1px solid rgba(90,146,205,.2);
      border-radius:12px;
      background:linear-gradient(180deg,rgba(8,34,68,.96),rgba(4,22,47,.96));
      color:#d9ecff;
      cursor:pointer;
      box-shadow:inset 0 -1px 0 rgba(255,255,255,.03);
      transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease;
      z-index:85;
    }
    .nf-global-nav-more-button[hidden]{display:none!important}
    .nf-global-nav-more-button:hover,
    .nf-global-nav-more-button:focus-visible{
      color:#fff;
      border-color:rgba(66,185,255,.72);
      box-shadow:0 0 8px rgba(66,185,255,.3),0 0 22px rgba(22,143,255,.18);
      transform:translateY(-1px);
      outline:none;
    }
    .nf-global-nav-more-button::after{
      content:"";
      position:absolute;
      left:9px;
      right:9px;
      bottom:2px;
      height:2px;
      border-radius:999px;
      background:#42b9ff;
      box-shadow:0 0 4px #42b9ff,0 0 10px #168fff,0 0 20px rgba(0,153,255,.92);
      opacity:.9;
    }
    .nf-global-nav-more-button svg{
      width:23px;
      height:23px;
      fill:none;
      stroke:currentColor;
      stroke-width:2;
      stroke-linecap:round;
    }
    .nf-global-nav-more-count{
      position:absolute;
      top:-5px;
      right:-5px;
      min-width:18px;
      height:18px;
      padding:0 4px;
      box-sizing:border-box;
      display:flex;
      align-items:center;
      justify-content:center;
      border-radius:999px;
      background:#168fff;
      color:#fff;
      font:800 10px/1 Inter,Arial,sans-serif;
      box-shadow:0 0 0 2px #071a35,0 0 9px rgba(22,143,255,.7);
    }

    .nf-global-nav-backdrop{
      position:fixed;
      inset:0;
      z-index:10020;
      background:rgba(1,9,21,.48);
      backdrop-filter:blur(2px);
      opacity:0;
      visibility:hidden;
      transition:opacity .2s ease,visibility .2s ease;
    }
    .nf-global-nav-backdrop.open{
      opacity:1;
      visibility:visible;
    }
    .nf-global-nav-drawer{
      position:fixed;
      top:0;
      right:0;
      z-index:10030;
      width:min(360px,88vw);
      height:100dvh;
      box-sizing:border-box;
      display:flex;
      flex-direction:column;
      background:linear-gradient(180deg,#071a35 0%,#06152b 48%,#041126 100%);
      border-left:1px solid rgba(77,157,231,.28);
      box-shadow:-20px 0 55px rgba(0,0,0,.4);
      transform:translateX(104%);
      transition:transform .24s cubic-bezier(.2,.8,.2,1);
      color:#eef7ff;
      font-family:Inter,Arial,sans-serif;
    }
    .nf-global-nav-drawer.open{transform:translateX(0)}
    .nf-global-nav-drawer-head{
      min-height:76px;
      padding:16px 16px 13px 20px;
      box-sizing:border-box;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      border-bottom:1px solid rgba(90,146,205,.18);
    }
    .nf-global-nav-drawer-title strong{
      display:block;
      font-size:18px;
      line-height:1.1;
      font-weight:900;
    }
    .nf-global-nav-drawer-title span{
      display:block;
      margin-top:4px;
      color:#8eabc7;
      font-size:11px;
      line-height:1.2;
    }
    .nf-global-nav-drawer-close{
      width:38px;
      height:38px;
      flex:0 0 38px;
      display:grid;
      place-items:center;
      border:1px solid rgba(102,157,210,.24);
      border-radius:10px;
      background:rgba(255,255,255,.035);
      color:#fff;
      font-size:23px;
      line-height:1;
      cursor:pointer;
    }
    .nf-global-nav-drawer-list{
      flex:1;
      min-height:0;
      overflow:auto;
      padding:12px;
      scrollbar-width:thin;
      scrollbar-color:#1f6fb8 transparent;
    }
    .nf-global-nav-drawer-item{
      position:relative;
      width:100%;
      min-height:58px;
      box-sizing:border-box;
      display:flex;
      align-items:center;
      gap:13px;
      padding:10px 14px;
      margin-bottom:6px;
      border:1px solid rgba(80,137,193,.14);
      border-radius:12px;
      background:rgba(255,255,255,.025);
      color:#dcecff!important;
      text-decoration:none!important;
      overflow:hidden;
      transition:background .18s ease,border-color .18s ease,transform .18s ease;
    }
    .nf-global-nav-drawer-item::after{
      content:"";
      position:absolute;
      left:14px;
      right:14px;
      bottom:0;
      height:2px;
      border-radius:999px;
      background:#42b9ff;
      box-shadow:0 0 5px #42b9ff,0 0 14px #168fff;
      transform:scaleX(0);
      opacity:0;
      transition:transform .18s ease,opacity .18s ease;
    }
    .nf-global-nav-drawer-item:hover,
    .nf-global-nav-drawer-item:focus-visible{
      background:rgba(20,100,181,.15);
      border-color:rgba(66,185,255,.36);
      transform:translateX(-2px);
      outline:none;
    }
    .nf-global-nav-drawer-item:hover::after,
    .nf-global-nav-drawer-item:focus-visible::after,
    .nf-global-nav-drawer-item.active::after{
      transform:scaleX(1);
      opacity:1;
    }
    .nf-global-nav-drawer-item svg{
      width:24px;
      height:24px;
      flex:0 0 24px;
      fill:none;
      stroke:#8fd1ff;
      stroke-width:1.8;
      stroke-linecap:round;
      stroke-linejoin:round;
    }
    .nf-global-nav-drawer-item-text{
      min-width:0;
      display:flex;
      flex-direction:column;
      gap:3px;
    }
    .nf-global-nav-drawer-item-text strong{
      color:#fff;
      font-size:13px;
      line-height:1.15;
      font-weight:850;
    }
    .nf-global-nav-drawer-item-text span{
      color:#7898b8;
      font-size:10px;
      line-height:1.1;
    }
    .nf-global-nav-item.nf-nav-overflow-hidden{display:none!important}

    /* Barra autônoma para páginas antigas que não tinham cabeçalho padrão. */
    .nf-global-nav-standalone{
      position:sticky;
      top:0;
      z-index:9999;
      width:100%;
      height:66px;
      box-sizing:border-box;
      display:flex;
      align-items:center;
      gap:12px;
      padding:0 14px;
      background:linear-gradient(90deg,#06152b,#071a35 62%,#06152b);
      border-bottom:1px solid rgba(90,146,205,.22);
      box-shadow:0 8px 24px rgba(2,12,27,.16);
    }
    .nf-global-nav-standalone-brand{
      flex:0 0 150px;
      min-width:150px;
      height:54px;
      display:flex;
      align-items:center;
      justify-content:center;
      text-decoration:none;
    }
    .nf-global-nav-standalone-brand img{
      display:block;
      width:142px;
      max-height:42px;
      object-fit:contain;
    }
    .nf-global-nav-logout{
      position:relative;
      flex:0 0 46px;
      width:46px;
      height:46px;
      display:grid;
      place-items:center;
      border:1px solid rgba(90,146,205,.22);
      border-radius:12px;
      background:linear-gradient(180deg,rgba(8,34,68,.96),rgba(4,22,47,.96));
      color:#d9ecff;
      font-size:18px;
      cursor:pointer;
      transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease;
    }
    .nf-global-nav-logout:hover,
    .nf-global-nav-logout:focus-visible{
      color:#fff;
      border-color:rgba(66,185,255,.72);
      box-shadow:0 0 8px rgba(66,185,255,.3),0 0 22px rgba(22,143,255,.18);
      transform:translateY(-1px);
      outline:none;
    }

    /* A barra global é única. Cabeçalhos antigos viram apenas ferramentas do módulo. */
    .nf-global-legacy-hidden{display:none!important}
    .nf-global-module-tools{
      min-height:0!important;
      height:auto!important;
      margin:10px auto 0!important;
      padding:8px 14px!important;
      box-sizing:border-box!important;
      background:#fff!important;
      border:1px solid #dbe5f0!important;
      border-radius:14px!important;
      box-shadow:0 6px 18px rgba(15,42,72,.06)!important;
    }
    .nf-global-module-tools .brandText,
    .nf-global-module-tools .userMini,
    .nf-global-module-tools [data-logout],
    .nf-global-module-tools #btnLogout,
    .nf-global-module-tools #btnHome,
    .nf-global-module-tools .home,
    .nf-global-module-tools a[href$="home.html"],
    .nf-global-module-tools a[href="./home.html"],
    .nf-global-module-tools .brand > img,
    .nf-global-module-tools .brandArea > img,
    .nf-global-module-tools .fleet-brand > img{
      display:none!important;
    }
    .nf-global-module-tools .brand,
    .nf-global-module-tools .brandArea,
    .nf-global-module-tools .fleet-brand{
      display:flex!important;
      align-items:center!important;
      min-width:0!important;
      gap:10px!important;
    }
    .nf-global-module-tools,
    .nf-global-module-tools .topbar-inner,
    .nf-global-module-tools .nf-topbar-inner,
    .nf-global-module-tools .fleet-topbar-inner{
      justify-content:flex-end!important;
      gap:8px!important;
    }
    body.nf-standard-shell .app,
    body.nf-standard-shell .page,
    body.nf-standard-shell .container,
    body.nf-standard-shell .pageBI{
      position:relative;
    }

    @media(max-width:1450px){
      .nf-global-nav-item{min-width:62px;padding-left:8px;padding-right:8px}
      .nf-global-nav-item span{font-size:9px}
    }
    @media(max-width:1180px){
      .nf-global-nav{justify-content:flex-start}
      .nf-global-nav-item{min-width:48px}
      .nf-global-nav-item span{display:none}
      .nf-global-nav-item svg{width:21px;height:21px}
    }
    @media(max-width:760px){
      .nf-global-nav{height:54px;margin:0 5px}
      .nf-global-nav-item{height:54px;min-width:44px}
      .nf-global-nav-standalone{height:58px;padding:0 8px;gap:6px}
      .nf-global-nav-standalone-brand{flex-basis:108px;min-width:108px;height:48px}
      .nf-global-nav-standalone-brand img{width:105px}
      .nf-global-nav-logout{width:42px;height:42px;flex-basis:42px}
    }
  `;

  document.head.appendChild(style);
}

function portalNavCurrentFile(){
  return String(window.location.pathname || "")
    .split("/")
    .pop()
    .toLowerCase();
}

function portalNavAllowed(item){
  if(item.always) return isAuthedHome();
  const features = Array.isArray(item.feature) ? item.feature : [item.feature];
  return features.filter(Boolean).some(feature => canAccessFeature(feature));
}

function portalNavHref(item){
  return typeof item.href === "function" ? item.href() : item.href;
}

function portalNavIsActive(item){
  const file = portalNavCurrentFile();
  const paths = item.paths || [String(portalNavHref(item) || "").split("/").pop().toLowerCase()];
  return paths.map(path => String(path || "").toLowerCase()).includes(file);
}

function createPortalGlobalNav(){
  const nav = document.createElement("nav");
  nav.className = "nf-global-nav";
  nav.id = "nfGlobalNav";
  nav.setAttribute("aria-label","Navegação principal do Portal");

  PORTAL_NAV_ITEMS
    .filter(portalNavAllowed)
    .forEach(item => {
      const link = document.createElement("a");
      link.className = "nf-global-nav-item";
      link.dataset.navKey = item.key;
      link.dataset.secondary = item.secondary ? "1" : "0";
      if(portalNavIsActive(item)) link.classList.add("active");
      link.href = portalNavHref(item);
      link.title = item.label;
      link.setAttribute("aria-label", item.label);
      link.innerHTML = `${item.icon}<span>${item.label}</span>`;
      nav.appendChild(link);
    });

  return nav;
}

function createPortalNavMoreButton(){
  const button = document.createElement("button");
  button.type = "button";
  button.id = "nfGlobalNavMore";
  button.className = "nf-global-nav-more-button";
  button.hidden = true;
  button.title = "Mais módulos";
  button.setAttribute("aria-label","Abrir mais módulos");
  button.setAttribute("aria-expanded","false");
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h14"></path>
    </svg>
    <span class="nf-global-nav-more-count" id="nfGlobalNavMoreCount">0</span>
  `;
  return button;
}

function closePortalNavDrawer(){
  document.getElementById("nfGlobalNavDrawer")?.classList.remove("open");
  document.getElementById("nfGlobalNavBackdrop")?.classList.remove("open");
  const button = document.getElementById("nfGlobalNavMore");
  button?.setAttribute("aria-expanded","false");
  document.body?.classList.remove("nf-nav-drawer-open");
}

function openPortalNavDrawer(){
  const drawer = document.getElementById("nfGlobalNavDrawer");
  const backdrop = document.getElementById("nfGlobalNavBackdrop");
  const button = document.getElementById("nfGlobalNavMore");
  if(!drawer || !backdrop || !button || button.hidden) return;

  drawer.classList.add("open");
  backdrop.classList.add("open");
  button.setAttribute("aria-expanded","true");
  document.body?.classList.add("nf-nav-drawer-open");
}

function ensurePortalNavDrawer(){
  document.getElementById("nfGlobalNavDrawer")?.remove();
  document.getElementById("nfGlobalNavBackdrop")?.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "nfGlobalNavBackdrop";
  backdrop.className = "nf-global-nav-backdrop";
  backdrop.addEventListener("click", closePortalNavDrawer);

  const drawer = document.createElement("aside");
  drawer.id = "nfGlobalNavDrawer";
  drawer.className = "nf-global-nav-drawer";
  drawer.setAttribute("aria-label","Mais módulos do Portal");
  drawer.innerHTML = `
    <div class="nf-global-nav-drawer-head">
      <div class="nf-global-nav-drawer-title">
        <strong>Mais módulos</strong>
        <span>Acessos liberados para o seu perfil</span>
      </div>
      <button class="nf-global-nav-drawer-close" type="button" aria-label="Fechar menu">×</button>
    </div>
    <nav class="nf-global-nav-drawer-list" id="nfGlobalNavDrawerList"></nav>
  `;

  drawer.querySelector(".nf-global-nav-drawer-close")?.addEventListener("click", closePortalNavDrawer);

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  return drawer;
}

function populatePortalNavDrawer(hiddenItems){
  const list = document.getElementById("nfGlobalNavDrawerList");
  if(!list) return;
  list.innerHTML = "";

  hiddenItems.forEach(link => {
    const item = document.createElement("a");
    item.className = "nf-global-nav-drawer-item";
    if(link.classList.contains("active")) item.classList.add("active");
    item.href = link.href;
    item.title = link.title || "";
    item.innerHTML = `
      ${link.querySelector("svg")?.outerHTML || ""}
      <span class="nf-global-nav-drawer-item-text">
        <strong>${link.querySelector("span")?.textContent || link.title || "Módulo"}</strong>
        <span>Abrir módulo</span>
      </span>
    `;
    item.addEventListener("click", closePortalNavDrawer);
    list.appendChild(item);
  });
}

function syncPortalNavOverflow(){
  const nav = document.getElementById("nfGlobalNav");
  const more = document.getElementById("nfGlobalNavMore");
  if(!nav || !more) return;

  const items = Array.from(nav.querySelectorAll(".nf-global-nav-item"));
  items.forEach(item => item.classList.remove("nf-nav-overflow-hidden"));
  more.hidden = true;
  closePortalNavDrawer();

  // Primeira medição: se couber tudo, não há menu lateral.
  const totalWidth = items.reduce((sum,item) => sum + item.getBoundingClientRect().width, 0);
  if(totalWidth <= nav.clientWidth + 2){
    populatePortalNavDrawer([]);
    return;
  }

  // Reserva o espaço do botão "Mais" e recalcula o espaço útil.
  more.hidden = false;
  const available = nav.clientWidth;
  let used = items.reduce((sum,item) => sum + item.getBoundingClientRect().width, 0);

  // Esconde primeiro os módulos secundários; depois, do fim para o começo.
  const secondary = items
    .filter(item => item.dataset.secondary === "1" && !item.classList.contains("active"))
    .reverse();

  const regular = items
    .filter(item =>
      item.dataset.secondary !== "1" &&
      item.dataset.navKey !== "home" &&
      !item.classList.contains("active")
    )
    .reverse();

  const finalFallback = items
    .filter(item =>
      item.dataset.navKey === "home" &&
      !item.classList.contains("active")
    );

  [...secondary,...regular,...finalFallback].some(item => {
    if(used <= available + 2) return true;
    const width = item.getBoundingClientRect().width;
    item.classList.add("nf-nav-overflow-hidden");
    used -= width;
    return false;
  });

  const hiddenItems = items.filter(item => item.classList.contains("nf-nav-overflow-hidden"));
  populatePortalNavDrawer(hiddenItems);

  const count = document.getElementById("nfGlobalNavMoreCount");
  if(count) count.textContent = String(hiddenItems.length);

  if(!hiddenItems.length){
    more.hidden = true;
  }
}

let portalNavResizeFrame = 0;
function schedulePortalNavOverflow(){
  cancelAnimationFrame(portalNavResizeFrame);
  portalNavResizeFrame = requestAnimationFrame(() => {
    requestAnimationFrame(syncPortalNavOverflow);
  });
}

function findPortalNavHost(){
  const selectors = [
    ".nf-topbar-inner",
    ".topbar-inner",
    ".fleet-topbar-inner",
    "header.portal-header",
    "header.topbar"
  ];

  for(const selector of selectors){
    const host = document.querySelector(selector);
    if(host) return host;
  }

  return null;
}

function insertPortalNavIntoHost(host, nav, more){
  host.classList.add("nf-global-nav-host");

  const preferredRight = host.querySelector(
    ".actions,.topRight,.topActions,.userbox,.account,.fleet-logout,.nf-solic-wrap,.nf-actions"
  );

  if(preferredRight){
    host.insertBefore(nav, preferredRight);
    host.insertBefore(more, preferredRight);
    return;
  }

  if(host.children.length > 1){
    host.insertBefore(nav, host.lastElementChild);
    host.insertBefore(more, host.lastElementChild);
    return;
  }

  host.appendChild(nav);
  host.appendChild(more);
}

function normalizeLegacyPortalChrome(){
  document.body?.classList.add("nf-standard-shell");

  const candidates = Array.from(document.querySelectorAll(
    "body > .topbar, body > header.topbar, body > .portal-header, body > .fleet-topbar, main.app > header.topbar, .app > header.topbar"
  ));

  candidates.forEach((bar) => {
    if(bar.closest(".nf-global-nav-standalone")) return;

    const usefulControls = Array.from(
      bar.querySelectorAll("button,select,input,a")
    ).filter((el) => {
      if(el.matches("[data-logout],#btnLogout,#btnHome,.home")) return false;
      if(el.matches('a[href="./home.html"],a[href$="/home.html"],a[href$="home.html"]')) return false;
      if(el.closest(".brand,.brandArea,.brandText,.userMini")) return false;
      return true;
    });

    if(!usefulControls.length){
      bar.classList.add("nf-global-legacy-hidden");
      return;
    }

    bar.classList.add("nf-global-module-tools");
  });
}

function createPortalGlobalShell(nav, more){
  const shell = document.createElement("header");
  shell.className = "nf-global-nav-standalone";
  shell.id = "nfGlobalShell";

  const brand = document.createElement("a");
  brand.className = "nf-global-nav-standalone-brand";
  brand.href = "./home.html";
  brand.title = "Home";
  brand.innerHTML = '<img src="../assets/img/logo-novafrota.png" alt="NOVA FROTA">';

  const logout = document.createElement("button");
  logout.type = "button";
  logout.className = "nf-global-nav-logout";
  logout.title = "Sair";
  logout.setAttribute("aria-label","Sair do Portal");
  logout.textContent = "↪";
  logout.addEventListener("click", async () => {
    logout.disabled = true;
    try{ await logoutPortal(); }catch{}
    redirectToLogin();
  });

  shell.appendChild(brand);
  shell.appendChild(nav);
  shell.appendChild(more);
  shell.appendChild(logout);
  return shell;
}

function renderPortalGlobalNav(){
  if(!document.body || !isAuthedHome()) return;

  injectPortalNavStyles();

  document.getElementById("nfGlobalNav")?.remove();
  document.getElementById("nfGlobalNavMore")?.remove();
  document.getElementById("nfGlobalShell")?.remove();
  document.querySelector(".nf-global-nav-standalone")?.remove();
  closePortalNavDrawer();

  const nav = createPortalGlobalNav();
  if(!nav.children.length) return;

  const more = createPortalNavMoreButton();
  more.addEventListener("click", () => {
    const drawer = document.getElementById("nfGlobalNavDrawer");
    if(drawer?.classList.contains("open")) closePortalNavDrawer();
    else openPortalNavDrawer();
  });

  ensurePortalNavDrawer();

  const shell = createPortalGlobalShell(nav, more);
  document.body.insertBefore(shell, document.body.firstChild);

  normalizeLegacyPortalChrome();
  schedulePortalNavOverflow();
}

async function initPortalGlobalNav(){
  const file = portalNavCurrentFile();
  if(["login.html","index.html","home.html","ordem.html"].includes(file)) return;

  try{
    if(window.portalAuthReady) await window.portalAuthReady;
  }catch{}

  if(!isAuthedHome()) return;
  renderPortalGlobalNav();
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", initPortalGlobalNav, { once:true });
}else{
  initPortalGlobalNav();
}

window.addEventListener("portal:session", () => {
  if(portalNavCurrentFile() === "home.html") return;
  renderPortalGlobalNav();
});

window.addEventListener("resize", schedulePortalNavOverflow, { passive:true });

document.addEventListener("keydown", (event) => {
  if(event.key === "Escape") closePortalNavDrawer();
});

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
