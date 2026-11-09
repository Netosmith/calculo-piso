// Rotas públicas do Portal. Não contêm usuários, credenciais nem dados de empresas.
// Um único app pode ser ativado pelo link específico de uma transportadora.
export const PORTAL_ORIGIN="https://portalfrete.net.br";
const ALLOWED_MODULES=new Set([
  "login","home","fretes","fretes2","monitoramento","bi",
  "calculo-piso2","calculo-antt","funcionarios","custo-frota-pesada",
  "chamados","divulgacao","super-admin"
]);
export function normalizeTenantSlug(value){
  const slug=String(value??"").trim().toLowerCase();
  if(slug===""||slug==="nova-frota")return "";
  if(["api","admin","super-admin","pages"].includes(slug))return null;
  if(!/^[a-z0-9][a-z0-9-]{1,39}$/.test(slug)||slug.includes("--"))return null;
  return slug;
}
export function portalPage(module,tenant=""){
  if(!ALLOWED_MODULES.has(module))throw new Error("Módulo indisponível.");
  const slug=normalizeTenantSlug(tenant);
  if(slug===null)throw new Error("Código de transportadora inválido.");
  if(slug && ["monitoramento","funcionarios","fretes2","super-admin"].includes(module))
    throw new Error("Este acesso é exclusivo do Portal Nova Frota.");
  return PORTAL_ORIGIN+"/pages/"+(slug?slug+"/":"")+module+".html";
}
export function trustedNavigation(url){
  if(url==="about:blank")return true;
  try{
    const value=new URL(url);
    return value.protocol==="https:"&&value.hostname==="portalfrete.net.br"&&
      (value.port===""||value.port==="443")&&!!value.pathname.startsWith("/");
  }catch{return false;}
}
export function slugFromInvite(url){
  if(typeof url!=="string"||/\.\.|%2e/i.test(url))return null;
  try{
    const parsed=new URL(url);
    if(parsed.protocol==="portalfrete:" && parsed.hostname==="acesso"){
      return normalizeTenantSlug(parsed.pathname.replace(/^\//,""));
    }
    if(trustedNavigation(url)){
      const match=parsed.pathname.match(/^\/pages\/([a-z0-9-]+)\/login\.html$/);
      if(match)return normalizeTenantSlug(match[1]);
      if(parsed.pathname==="/pages/login.html")return "";
    }
  }catch{}
  return null;
}
