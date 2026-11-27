import { LEGACY_NOVA_FROTA, tenantIdForLegacySession } from "../config/transportadoras.js";
import { getSession, readSessionId } from "../services/session.js";
import { errorResponse, success } from "../utils/response.js";

// Ponto de descarga: link de uso único, sem selfie, viagem ou GPS contínuo.
// O consentimento é explícito na página de destino. Não registrar IP como GPS.
const PROFILES=new Set(["ADMINISTRADOR","COMERCIAL","OPERACIONAL"]);
const VALID_TOKEN=/^[a-f0-9]{64}$/;
const VALID_ID=/^[a-f0-9-]{36}$/;
const EXPIRE_HOURS=48;
const MAX_ROWS=300;
const clean=(v,n=120)=>String(v??"").replace(/[\x00-\x1f\x7f]/g," ").trim().slice(0,n);
const iso=()=>new Date().toISOString();
const validPosition=(lat,lng,accuracy)=>
 typeof lat==="number"&&Number.isFinite(lat)&&lat>=-90&&lat<=90&&
 typeof lng==="number"&&Number.isFinite(lng)&&lng>=-180&&lng<=180&&
 typeof accuracy==="number"&&Number.isFinite(accuracy)&&accuracy>=0&&accuracy<=100000;
async function parseJson(req){
 try{
  const length=Number(req.headers.get("content-length")||0);
  if(length>4096)return null;
  const body=await req.json();
  return body&&typeof body==="object"&&!Array.isArray(body)?body:null;
 }catch{return null}
}
function token(){
 return Array.from(crypto.getRandomValues(new Uint8Array(32)),
   x=>x.toString(16).padStart(2,"0")).join("");
}
async function sha(text){
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
 return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,"0")).join("");
}
function summary(row){
 const lat=typeof row.lat==="number"&&Number.isFinite(row.lat)?row.lat:null;
 const lng=typeof row.lng==="number"&&Number.isFinite(row.lng)?row.lng:null;
 return {
  id:row.id,referencia:row.referencia,placa:row.placa,motorista:row.motorista,
  cliente:row.cliente,descarga:row.descarga,nf:row.nf,cte:row.cte,
  observacoes:row.observacoes,createdAt:row.created_at,expiresAt:row.expires_at,
  capturedAt:row.captured_at||null,accuracy:row.accuracy,
  lat,lng,
  status:row.revoked_at?"CANCELADO":row.captured_at?"RECEBIDO":
   Date.parse(row.expires_at)<=Date.now()?"EXPIRADO":"AGUARDANDO",
  googleMaps:lat!==null&&lng!==null?
   "https://www.google.com/maps?q="+lat+","+lng:null
 };
}
async function authManager(req,env){
 const session=await getSession(env,readSessionId(req));
 if(!session)return {error:errorResponse("Sessão inválida.",401)};
 if(tenantIdForLegacySession(session)!==LEGACY_NOVA_FROTA.id)
  return {error:errorResponse("Recurso exclusivo do monitoramento Nova Frota.",403)};
 if(!PROFILES.has(clean(session.perfil,50).toUpperCase()))
  return {error:errorResponse("Perfil sem acesso ao monitoramento.",403)};
 return {session};
}
function dbError(err,stage){
 console.error("[MONITOR SPOT] "+stage,String(err?.message||err));
 return errorResponse("Não foi possível consultar os pontos de descarga.",503,{stage});
}
async function publicLookup(db,tkn){
 if(!VALID_TOKEN.test(tkn||""))return null;
 return db.prepare("SELECT id,captured_at,expires_at,revoked_at FROM monitor_spot_requests WHERE token_hash=?")
  .bind(await sha(tkn)).first();
}
export async function monitorSpotController(req,env){
 const path=new URL(req.url).pathname.replace(/\/+$/,""),method=req.method;
 const db=env.FLEET_DB;
 if(!db)return errorResponse("Armazenamento indisponível.",503);
 // O link público só verifica validade e recebe UM ponto, nunca expõe os
 // dados do cliente, placa, referência ou outras solicitações.
 if(path==="/v1/monitor/spot/preview"&&method==="POST"){
  const body=await parseJson(req);
  if(!body||!VALID_TOKEN.test(body.token||""))
   return errorResponse("Link de localização inválido.",400);
  try{
   const row=await publicLookup(db,body.token);
   if(!row)return errorResponse("Link de localização inválido.",404);
   if(row.revoked_at)return errorResponse("Link cancelado.",410);
   if(row.captured_at)return success({status:"RECEBIDO",used:true});
   if(Date.parse(row.expires_at)<=Date.now())
    return errorResponse("Link expirado. Solicite um novo.",410);
   return success({status:"AGUARDANDO",used:false,expiresAt:row.expires_at});
  }catch(err){return dbError(err,"preview")}
 }
 if(path==="/v1/monitor/spot/submit"&&method==="POST"){
  const body=await parseJson(req);
  if(!body||!VALID_TOKEN.test(body.token||"")||body.consent!==true||
     body.purpose!=="ponto-descarga-v1")
   return errorResponse("Autorização de localização ausente ou link inválido.",400);
  const {latitude:lat,longitude:lng,accuracy}=body;
  if(!validPosition(lat,lng,accuracy))
   return errorResponse("Posição inválida. Tente novamente com o GPS ativo.",400);
  try{
   const tokenHash=await sha(body.token),time=iso();
   // UPDATE atômico: o token expira após o primeiro ponto; previews de redes
   // sociais nunca consomem o link.
   const updated=await db.prepare(
    "UPDATE monitor_spot_requests SET lat=?,lng=?,accuracy=?,captured_at=? "+
    "WHERE token_hash=? AND captured_at IS NULL AND revoked_at IS NULL AND expires_at>?"
   ).bind(lat,lng,accuracy,time,tokenHash,time).run();
   if(updated.meta?.changes===1)
    return success({received:true,at:time,
     googleMaps:"https://www.google.com/maps?q="+lat+","+lng});
   const row=await publicLookup(db,body.token);
   if(!row)return errorResponse("Link inválido.",404);
   if(row.captured_at)return errorResponse("Esta localização já foi enviada.",409);
   return errorResponse("Link expirado ou cancelado.",410);
  }catch(err){return dbError(err,"submit")}
 }
 // Todas as outras operações exigem sessão, perfil e módulo autorizado.
 const auth=await authManager(req,env);
 if(auth.error)return auth.error;
 if(path==="/v1/monitor/spot/requests"&&method==="GET"){
  try{
   const list=await db.prepare(
    "SELECT id,referencia,placa,motorista,cliente,descarga,nf,cte,observacoes,"+
    "created_at,expires_at,captured_at,revoked_at,lat,lng,accuracy "+
    "FROM monitor_spot_requests ORDER BY created_at DESC LIMIT ?"
   ).bind(MAX_ROWS).all();
   return success({requests:(list.results||[]).map(summary)});
  }catch(err){return dbError(err,"list")}
 }
 if(path==="/v1/monitor/spot/requests"&&method==="POST"){
  const body=await parseJson(req);
  const referencia=clean(body?.referencia,100);
  if(referencia.length<2)return errorResponse("Identifique a descarga (mínimo 2 caracteres).",400);
  const item={
   id:crypto.randomUUID(),referencia,
   placa:clean(body.placa,16).toUpperCase().replace(/[^A-Z0-9-]/g,""),
   motorista:clean(body.motorista,100),cliente:clean(body.cliente,100),
   descarga:clean(body.descarga,160),nf:clean(body.nf,80),
   cte:clean(body.cte,80),observacoes:clean(body.observacoes,400)
  };
  const tkn=token(),time=iso(),expires=new Date(Date.now()+EXPIRE_HOURS*3600000).toISOString();
  try{
   await db.prepare(
    "INSERT INTO monitor_spot_requests "+
    "(id,token_hash,referencia,placa,motorista,cliente,descarga,nf,cte,observacoes,created_by,created_at,expires_at) "+
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
   ).bind(item.id,await sha(tkn),item.referencia,item.placa,item.motorista,item.cliente,
     item.descarga,item.nf,item.cte,item.observacoes,clean(auth.session.usuario,100),time,expires).run();
   return success({request:{...item,createdAt:time,expiresAt:expires,status:"AGUARDANDO"},
    token:tkn,validHours:EXPIRE_HOURS},201);
  }catch(err){return dbError(err,"create")}
 }
 const match=path.match(/^\/v1\/monitor\/spot\/requests\/([a-f0-9-]{36})$/);
 if(match&&method==="DELETE"){
  try{
   // Exclusão permanente também descarta coordenadas e invalida o token.
   const result=await db.prepare("DELETE FROM monitor_spot_requests WHERE id=?")
    .bind(match[1]).run();
   if(result.meta?.changes!==1)return errorResponse("Ponto não encontrado.",404);
   return success({deleted:true});
  }catch(err){return dbError(err,"delete")}
 }
 return errorResponse("Rota de ponto de descarga não encontrada.",404);
}
