import {errorResponse,success} from "../utils/response.js";
import {readTenantLogo,writeTenantLogo} from "./super-admin-brand.js";

// The original D1 portal_tenants.logo_key remains the dark-on-light Logo 1.
// New slots use private, per-tenant R2 objects without changing legacy data.
export const TENANT_VISUAL_SLOTS=Object.freeze(["logo-dark","logo-light","hero-art","hero-home"]);
const EXT=Object.freeze({"image/png":"png","image/jpeg":"jpg","image/webp":"webp"});
const maxBytes=slot=>slot.startsWith("hero-")?6*1024*1024:2*1024*1024;
const isTenant=id=>typeof id==="string" && id!=="nova-frota" &&
 /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)&&id.length<=48;
const isSlot=slot=>TENANT_VISUAL_SLOTS.includes(slot);
const keyFor=(id,slot)=>"tenant/"+id+"/visual/"+slot+".bin";
const jsonError=()=>errorResponse("Identidade visual indisponivel.",503);
function validMagic(mime,bytes){
 if(mime==="image/png")return bytes.length>=8&&
  [137,80,78,71,13,10,26,10].every((value,i)=>bytes[i]===value);
 if(mime==="image/jpeg")return bytes.length>=3&&
  bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(mime==="image/webp")return bytes.length>=12&&
  String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&
  String.fromCharCode(...bytes.slice(8,12))==="WEBP";
 return false;
}
async function ensureTenant(db,tenant){
 const record=await db.prepare("SELECT id FROM portal_tenants WHERE id=?").bind(tenant).first();
 return Boolean(record);
}
export async function readTenantVisual(env,tenant,slot){
 if(!isTenant(tenant)||!isSlot(slot))return errorResponse("Arquivo visual invalido.",400);
 if(slot==="logo-dark")return readTenantLogo(env,tenant);
 if(!env.TENANTS_DB||!env.TENANT_BRANDS)return jsonError();
 try{
  if(!await ensureTenant(env.TENANTS_DB,tenant))
   return errorResponse("Transportadora nao encontrada.",404);
  const value=await env.TENANT_BRANDS.get(keyFor(tenant,slot));
  if(!value)return errorResponse("Imagem personalizada nao cadastrada.",404);
  const mime=value.httpMetadata?.contentType;
  if(!Object.hasOwn(EXT,mime))return errorResponse("Arquivo visual invalido.",404);
  return new Response(value.body,{status:200,headers:{
   "Content-Type":mime,"Cache-Control":"private, no-store",
   "Content-Disposition":"inline","X-Content-Type-Options":"nosniff",
   "Cross-Origin-Resource-Policy":"same-site"
  }});
 }catch(error){
  console.error("[TENANT VISUAL] Read failed",{kind:error?.name||"Error",slot});
  return jsonError();
 }
}
export async function writeTenantVisual(request,env,actor,tenant,slot){
 if(!isTenant(tenant)||!isSlot(slot))return errorResponse("Arquivo visual invalido.",400);
 if(slot==="logo-dark")return writeTenantLogo(request,env,actor,tenant);
 if(env.SUPER_ADMIN_BRAND_WRITES!=="enabled")
  return errorResponse("Edicao de identidade visual nao habilitada.",405);
 if(!env.TENANTS_DB||!env.TENANT_BRANDS)return jsonError();
 const mime=String(request.headers.get("Content-Type")||"").trim().toLowerCase();
 if(!Object.hasOwn(EXT,mime))return errorResponse("Use PNG, JPG ou WebP.",415);
 const limit=maxBytes(slot);
 const size=Number(request.headers.get("Content-Length")||0);
 if(size>limit)return errorResponse("Imagem excede o limite do arquivo.",413);
 let bytes;
 try{bytes=new Uint8Array(await request.arrayBuffer());}
 catch{return errorResponse("Imagem invalida.",400);}
 if(!bytes.length||bytes.length>limit)return errorResponse("Imagem vazia ou muito grande.",413);
 if(!validMagic(mime,bytes))return errorResponse("Conteudo da imagem invalido.",415);
 try{
  if(!await ensureTenant(env.TENANTS_DB,tenant))
   return errorResponse("Transportadora nao encontrada.",404);
  await env.TENANT_BRANDS.put(keyFor(tenant,slot),bytes,{
   httpMetadata:{contentType:mime}
  });
  await env.TENANTS_DB.prepare(
   "INSERT INTO portal_tenant_audit(id,actor_id,tenant_id,action,detail_json) VALUES (?,?,?,?,?)"
  ).bind(crypto.randomUUID(),actor,tenant,"brand.visual.update",
   JSON.stringify({slot,tipo:mime,tamanho:bytes.length})).run();
  return success({tenantId:tenant,slot,configured:true,
   aviso:"Arquivo visual individual salvo na transportadora."});
 }catch(error){
  console.error("[TENANT VISUAL] Write failed",{kind:error?.name||"Error",slot});
  return jsonError();
 }
}
