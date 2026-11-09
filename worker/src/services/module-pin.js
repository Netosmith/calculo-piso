// PIN adicional para três módulos da Nova Frota.
// Não substitui o login nem as permissões existentes do Portal Frete.
// A senha é validada somente no Worker, nunca no JavaScript público.
import { readSessionId } from "./session.js";
import { LEGACY_NOVA_FROTA, tenantIdForLegacySession } from "../config/transportadoras.js";

const VERSION="v1";
const TTL_SECONDS=30*60;
const PIN_DIGEST="34ff3bb3732ca5436824c18fc789ff0507ae31807ca3f782b7d7740235d5d719";
const MODULE_ROLES={
  funcionarios:new Set(["ADMINISTRADOR"]),
  "custo-filial":new Set(["ADMINISTRADOR"]),
  "custo-frota":new Set(["ADMINISTRADOR","COMERCIAL"])
};
const encoder=new TextEncoder();
const toHex=bytes=>[...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
const encode64=bytes=>{
  let binary="";for(const b of bytes)binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
};
const decode64=value=>{
  const s=String(value||"").replace(/-/g,"+").replace(/_/g,"/");
  const binary=atob(s+"=".repeat((4-s.length%4)%4));
  return Uint8Array.from(binary,x=>x.charCodeAt(0));
};
async function digest(text){
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(String(text||"")))));
}
async function sign(secret,value){
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(value)));
}
function cookies(request){
  const found=new Map();
  for(const part of String(request.headers.get("Cookie")||"").split(";")){
    const idx=part.indexOf("=");if(idx<1)continue;
    found.set(part.slice(0,idx).trim(),part.slice(idx+1).trim());
  }
  return found;
}
export function isPinModule(module){return Object.hasOwn(MODULE_ROLES,module);}
export function canUsePinModule(session,module){
  return isPinModule(module)&&session?.tenantMode!==true&&
    tenantIdForLegacySession(session)===LEGACY_NOVA_FROTA.id&&
    MODULE_ROLES[module].has(String(session?.perfil||"").trim().toUpperCase());
}
export const pinCookieName=module=>"__Host-pf-pin-"+module;
export async function verifyModulePinValue(value){
  if(typeof value!=="string"||!/^[0-9]{4}$/.test(value))return false;
  const actual=await digest(value);
  // Tempos fixos por byte na comparação do digest; senha nunca é exposta no frontend.
  let diff=0;
  for(let i=0;i<PIN_DIGEST.length;i++)diff|=actual.charCodeAt(i)^PIN_DIGEST.charCodeAt(i);
  return diff===0;
}
export async function issueModulePin(request,env,module){
  if(!isPinModule(module)||!env?.PORTAL_KEY||!readSessionId(request))return null;
  const sessionHash=await digest(readSessionId(request));
  const payload=encode64(encoder.encode(JSON.stringify({
    version:VERSION,module,sessionHash,
    expiresAt:Date.now()+TTL_SECONDS*1000
  })));
  const body=VERSION+"."+payload;
  const mac=encode64(await sign(env.PORTAL_KEY,body));
  return pinCookieName(module)+"="+body+"."+mac+
    "; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age="+TTL_SECONDS;
}
export async function hasModulePin(request,env,module){
  if(!isPinModule(module)||!env?.PORTAL_KEY)return false;
  const session=readSessionId(request);
  if(!session)return false;
  const value=cookies(request).get(pinCookieName(module));
  if(!value||value.length>1300)return false;
  const parts=value.split(".");
  if(parts.length!==3||parts[0]!==VERSION)return false;
  let body;
  try{
    body=JSON.parse(new TextDecoder().decode(decode64(parts[1])));
    if(body.version!==VERSION||body.module!==module||
      !Number.isFinite(body.expiresAt)||body.expiresAt<=Date.now()||
      body.expiresAt>Date.now()+TTL_SECONDS*1000+20000||
      body.sessionHash!==await digest(session))return false;
    const expected=await sign(env.PORTAL_KEY,parts[0]+"."+parts[1]);
    const given=decode64(parts[2]);
    if(expected.length!==given.length)return false;
    let diff=0;for(let i=0;i<expected.length;i++)diff|=expected[i]^given[i];
    return diff===0;
  }catch{return false;}
}
export async function failedPinKey(request,module){
  return "portal-module-pin-fails:"+module+":"+await digest(readSessionId(request));
}
