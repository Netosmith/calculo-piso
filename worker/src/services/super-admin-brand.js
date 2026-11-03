import {errorResponse,success} from "../utils/response.js";

const MAX_LOGO_BYTES=2*1024*1024;
const MIMES=Object.freeze({"image/png":"png","image/jpeg":"jpg","image/webp":"webp"});
const mimeForKey=key=>key?.endsWith(".png")?"image/png":key?.endsWith(".jpg")?"image/jpeg":key?.endsWith(".webp")?"image/webp":null;
const validTenant=id=>typeof id==="string" && id!=="nova-frota" && id.length<=48 &&
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id);

function matchesFile(mime,bytes){
 if(mime==="image/png")return bytes.length>=8 && [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
 if(mime==="image/jpeg")return bytes.length>=3 && bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(mime==="image/webp")return bytes.length>=12 &&
  String.fromCharCode(...bytes.slice(0,4))==="RIFF" &&
  String.fromCharCode(...bytes.slice(8,12))==="WEBP";
 return false;
}
async function lookup(db,id){
 return db.prepare("SELECT id,logo_key FROM portal_tenants WHERE id=?").bind(id).first();
}
function unavailable(error){
 console.error("[SUPER ADMIN] Tenant branding unavailable",{type:error?.name||"Error"});
 return errorResponse("Identidade visual indisponivel neste ambiente.",503);
}

// GET is accessible only after the Super Admin controller verifies the owner session.
export async function readTenantLogo(env,tenantId){
 if(!validTenant(tenantId))return errorResponse("Transportadora invalida.",400);
 if(!env.TENANTS_DB || !env.TENANT_BRANDS)return errorResponse("Biblioteca de logos nao configurada.",503);
 try {
  const row=await lookup(env.TENANTS_DB,tenantId);
  if(!row)return errorResponse("Transportadora nao encontrada.",404);
  if(!row.logo_key)return errorResponse("Transportadora sem logo cadastrada.",404);
  const mime=mimeForKey(row.logo_key);
  if(!mime)return errorResponse("Logo indisponivel.",404);
  const object=await env.TENANT_BRANDS.get(row.logo_key);
  if(!object)return errorResponse("Arquivo de logo nao encontrado.",404);
  return new Response(object.body,{
   status:200,
   headers:{"Content-Type":mime,"Cache-Control":"private, no-store",
    "Content-Disposition":"inline","X-Content-Type-Options":"nosniff"}
  });
 }catch(error){return unavailable(error);}
}

// R2 writes never touch CLIENT_LOGOS (Nova Frota). Images have private random keys.
export async function writeTenantLogo(request,env,actor,tenantId){
 if(!validTenant(tenantId))return errorResponse("Transportadora invalida.",400);
 if(env.SUPER_ADMIN_BRAND_WRITES!=="enabled")
  return errorResponse("Envio de logos nao habilitado neste ambiente.",405);
 if(!env.TENANTS_DB||!env.TENANT_BRANDS)
  return errorResponse("Banco ou biblioteca de logos nao provisionado.",503);
 const mime=(request.headers.get("Content-Type")||"").trim().toLowerCase();
 if(!Object.hasOwn(MIMES,mime))return errorResponse("Envie imagem PNG, JPG ou WebP.",415);
 const advertisedLength=Number(request.headers.get("Content-Length"));
 if(Number.isFinite(advertisedLength)&&advertisedLength>MAX_LOGO_BYTES)
  return errorResponse("Imagem excede 2 MB.",413);
 let bytes;
 try{bytes=new Uint8Array(await request.arrayBuffer());}
 catch{return errorResponse("Imagem invalida.",400);}
 if(!bytes.length || bytes.length>MAX_LOGO_BYTES)return errorResponse("Imagem vazia ou maior que 2 MB.",413);
 if(!matchesFile(mime,bytes))return errorResponse("Conteudo da imagem nao corresponde ao formato.",415);
 let key=null,stored=false;
 try{
  const existing=await lookup(env.TENANTS_DB,tenantId);
  if(!existing)return errorResponse("Transportadora nao encontrada.",404);
  key="tenant/"+tenantId+"/logo/"+crypto.randomUUID()+"."+MIMES[mime];
  await env.TENANT_BRANDS.put(key,bytes,{httpMetadata:{contentType:mime}});
  stored=true;
  await env.TENANTS_DB.batch([
   env.TENANTS_DB.prepare("UPDATE portal_tenants SET logo_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(key,tenantId),
   env.TENANTS_DB.prepare("INSERT INTO portal_tenant_audit (id,actor_id,tenant_id,action,detail_json) VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(),actor,tenantId,"brand.logo.update",JSON.stringify({tipo:mime}))
  ]);
  // Old assets are deleted only after the database and audit commit succeeds.
  if(existing.logo_key && existing.logo_key!==key) {
   try{await env.TENANT_BRANDS.delete(existing.logo_key);}
   catch{console.warn("[SUPER ADMIN] Previous branding object cleanup pending");}
  }
  return success({tenantId,logo:true,aviso:"Logo salva em biblioteca privada da transportadora."});
 }catch(error){
  if(stored&&key)try{await env.TENANT_BRANDS.delete(key);}catch{}
  return unavailable(error);
 }
}
