import {success,errorResponse} from "../utils/response.js";

const MODELS=Object.freeze(["modelo3","modelo4a","modelo4b","modelo4c"]);
const DEFAULT_MODEL=Object.freeze({primary:"#113c70",accent:"#08a968",surface:"#f4f8fb",watermark:8});
const validTenant=id=>typeof id==="string" && id!=="nova-frota" &&
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) && id.length<=48;
const HEX=/^#[0-9a-fA-F]{6}$/;
const storageKey=id=>"tenant/"+id+"/visual/arts-v1.json";
const defaults=()=>Object.fromEntries(MODELS.map(key=>[key,{...DEFAULT_MODEL}]));

function normalizeModel(value,fallback=DEFAULT_MODEL){
 const raw=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
 return {
  primary:HEX.test(raw.primary)?raw.primary.toLowerCase():fallback.primary,
  accent:HEX.test(raw.accent)?raw.accent.toLowerCase():fallback.accent,
  surface:HEX.test(raw.surface)?raw.surface.toLowerCase():fallback.surface,
  watermark:Number.isInteger(raw.watermark)&&raw.watermark>=0&&raw.watermark<=14
    ?raw.watermark:fallback.watermark
 };
}
export function normalizedArtThemes(input){
 const out=defaults();
 const source=input?.models;
 if(source&&typeof source==="object"&&!Array.isArray(source))
  for(const key of MODELS)out[key]=normalizeModel(source[key]);
 return {version:1,models:out};
}
export function validateArtThemeUpdate(body){
 if(!body||typeof body!=="object"||Array.isArray(body)||
    !body.models||typeof body.models!=="object"||Array.isArray(body.models))
  return false;
 if(Object.keys(body).some(x=>!["models"].includes(x)))return false;
 const keys=Object.keys(body.models);
 if(keys.length!==MODELS.length||keys.some(x=>!MODELS.includes(x)))return false;
 return keys.every(key=>{
  const value=body.models[key];
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const props=Object.keys(value);
  if(props.length!==4||props.some(p=>!["primary","accent","surface","watermark"].includes(p)))
   return false;
  return ["primary","accent","surface"].every(p=>HEX.test(value[p]))&&
   Number.isInteger(value.watermark)&&value.watermark>=0&&value.watermark<=14;
 });
}
async function ensureCompany(env,id){
 if(!validTenant(id)||!env.TENANTS_DB||!env.TENANT_BRANDS)return false;
 return Boolean(await env.TENANTS_DB.prepare("SELECT id FROM portal_tenants WHERE id=?")
  .bind(id).first());
}
export async function readTenantArtThemes(env,id){
 if(!validTenant(id))return errorResponse("Transportadora invalida.",400);
 if(!env.TENANTS_DB||!env.TENANT_BRANDS)
  return errorResponse("Biblioteca de artes indisponivel.",503);
 try{
  if(!await ensureCompany(env,id))return errorResponse("Transportadora nao encontrada.",404);
  const asset=await env.TENANT_BRANDS.get(storageKey(id));
  if(!asset)return success({tenantId:id,configured:false,artes:normalizedArtThemes(null)});
  const parsed=JSON.parse(await asset.text());
  return success({tenantId:id,configured:true,artes:normalizedArtThemes(parsed)});
 }catch(error){
  console.error("[ART THEMES] Read failed",{type:error?.name||"Error"});
  return errorResponse("Nao foi possivel carregar as artes.",503);
 }
}
export async function writeTenantArtThemes(request,env,actor,id){
 if(!validTenant(id))return errorResponse("Transportadora invalida.",400);
 if(env.SUPER_ADMIN_BRAND_WRITES!=="enabled")
  return errorResponse("Personalizacao indisponivel.",405);
 if(!env.TENANTS_DB||!env.TENANT_BRANDS)
  return errorResponse("Biblioteca de artes indisponivel.",503);
 let body;
 try{
  const raw=await request.text();
  if(raw.length>5000)return errorResponse("Configuracao muito extensa.",413);
  body=JSON.parse(raw);
 }catch{return errorResponse("Configuracao invalida.",400);}
 if(!validateArtThemeUpdate(body))return errorResponse("Cores ou modelos invalidos.",400);
 try{
  if(!await ensureCompany(env,id))return errorResponse("Transportadora nao encontrada.",404);
  const config=normalizedArtThemes(body);
  // Only visual properties. No spreadsheets, gateway URLs, keys or customer data.
  await env.TENANT_BRANDS.put(storageKey(id),JSON.stringify(config),{
   httpMetadata:{contentType:"application/json"}
  });
  await env.TENANTS_DB.prepare("INSERT INTO portal_tenant_audit (id,actor_id,tenant_id,action,detail_json) VALUES (?,?,?,?,?)")
   .bind(crypto.randomUUID(),actor,id,"brand.arts.update",
    JSON.stringify({modelos:MODELS})).run();
  return success({tenantId:id,configured:true,artes:config});
 }catch(error){
  console.error("[ART THEMES] Write failed",{type:error?.name||"Error"});
  return errorResponse("Nao foi possivel salvar a personalizacao.",503);
 }
}
