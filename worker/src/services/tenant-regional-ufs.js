import {errorResponse,success} from "../utils/response.js";

const UFS=new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]);
const BASES=new Set(["GERAL","GO","MT","SP","MS","BA","PR","SC","RO","TO","MA","AC","AL","AP","AM","CE","DF","ES","MG","PA","PB","PE","PI","RJ","RN","RS","RR","SE"]);
const storageKey=id=>"tenant/"+id+"/private/regional-ufs-v1.json";
function regionalKey(value){
 const name=String(value||"").trim().replace(/\s+/g," ").normalize("NFC").toUpperCase();
 return name.length>=2&&name.length<=100&&!/[\u0000-\u001f\u007f]/.test(name)?name:"";
}
async function readMap(env,tenantId){
 if(!env.TENANT_BRANDS)throw Error("R2 indisponivel");
 const object=await env.TENANT_BRANDS.get(storageKey(tenantId));
 if(!object)return {};
 const data=await object.json();
 return data?.version===1&&data.regionais&&typeof data.regionais==="object"&&!Array.isArray(data.regionais)
  ? data.regionais:{};
}
export async function regionalUfController(request,env,principal,modules){
 if(!["GET","POST"].includes(request.method))return errorResponse("Metodo nao permitido.",405);
 if(request.method==="GET"){
  if(!modules.some(x=>x==="bi"||x==="cadastros"||x.startsWith("fretes")))
   return errorResponse("Consulta nao liberada.",403);
  try{return success({regionais:await readMap(env,principal.tenant_id)});}
  catch{return errorResponse("Catalogo de UFs temporariamente indisponivel.",503);}
 }
 if(String(principal.role||"").toUpperCase()!=="ADMINISTRADOR"||!modules.includes("cadastros"))
  return errorResponse("Somente o administrador pode cadastrar a UF da regional.",403);
 let body;
 try{
  const raw=await request.text();
  if(raw.length>600)throw Error("size");
  body=JSON.parse(raw);
 }catch{return errorResponse("Cadastro invalido.",400);}
 if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body).some(k=>!["regional","uf","base"].includes(k)))
  return errorResponse("Campos invalidos.",400);
 const regional=regionalKey(body.regional);
 const uf=String(body.uf||"").toUpperCase().trim();
 const base=String(body.base||"GERAL").toUpperCase().trim();
 if(!regional||!UFS.has(uf)||!BASES.has(base))
  return errorResponse("Regional, UF ou base invalida.",400);
 try{
  const map=await readMap(env,principal.tenant_id);
  if(Object.keys(map).length>=500&&!Object.hasOwn(map,regional))
   return errorResponse("Limite de regionais atingido.",409);
  map[regional]={uf,base};
  await env.TENANT_BRANDS.put(storageKey(principal.tenant_id),JSON.stringify({
   version:1,regionais:map
  }),{httpMetadata:{contentType:"application/json"}});
  await env.TENANTS_DB.prepare(
   "INSERT INTO portal_tenant_audit(id,actor_id,tenant_id,action,detail_json) VALUES(?,?,?,?,?)"
  ).bind(crypto.randomUUID(),principal.user_id,principal.tenant_id,
   "regional.uf.update",JSON.stringify({regional,uf,base})).run();
  return success({regional,uf,base});
 }catch(error){
  console.error("[TENANT REGIONAL UF]",{type:error?.name||"Error"});
  return errorResponse("Nao foi possivel gravar UF da regional.",503);
 }
}
