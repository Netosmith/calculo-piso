import { getSession, readSessionId } from "../services/session.js";
import { errorResponse, success } from "../utils/response.js";

const PROFILES=new Set(["ADMINISTRADOR","COMERCIAL","OPERACIONAL"]);
const clean=(v,n=100)=>String(v??"").trim().slice(0,n);
const plate=v=>clean(v,12).toUpperCase().replace(/[^A-Z0-9]/g,"");
const validToken=v=>/^[a-f0-9]{64}$/.test(String(v||""));
const validId=v=>/^[a-f0-9-]{36}$/.test(String(v||""));
const parse=async req=>{try{const x=await req.json();return x&&typeof x==="object"&&!Array.isArray(x)?x:null}catch{return null}};
const now=()=>new Date().toISOString();
const makeToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
async function hashToken(value){
  const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");
}
async function manager(req,env){
  const session=await getSession(env,readSessionId(req));
  if(!session)return {error:errorResponse("Sessão inválida.",401)};
  if(!PROFILES.has(clean(session.perfil).toUpperCase()))
    return {error:errorResponse("Sem permissão para Monitoramento.",403)};
  return {session};
}
const toTrip=row=>({
  id:row.id,plate:row.plate,driver:row.driver,origin:row.origin,destination:row.destination,
  active:row.active===1,createdAt:row.created_at,updatedAt:row.updated_at,
  lastPosition:row.last_position_at?{lat:row.lat,lng:row.lng,accuracy:row.accuracy,at:row.last_position_at}:null
});
async function tripForToken(db,value){
  if(!validToken(value))return null;
  const hash=await hashToken(value);
  return db.prepare("SELECT * FROM monitor_trips WHERE token_hash=? AND token_expires_at>?")
    .bind(hash,now()).first();
}
function dbError(error,stage){
  console.error("[MONITOR] "+stage,String(error?.message||error));
  return errorResponse("Falha no banco do monitoramento.",503,{stage});
}
export async function monitorController(request,env){
  const url=new URL(request.url),path=url.pathname.endsWith("/")?url.pathname.slice(0,-1):url.pathname,method=request.method;
  if(path==="/v1/monitor/health"&&method==="GET"){
    if(!env.FLEET_DB)return errorResponse("Banco D1 indisponível.",503,{stage:"db-binding"});
    try{const result=await env.FLEET_DB.prepare("SELECT 1 AS ok").first();
      return success({storage:result?.ok===1?"available":"unavailable",database:"D1"});
    }catch(e){return dbError(e,"db-health")}
  }
  if(!env.FLEET_DB)return errorResponse("Banco D1 não configurado.",503,{stage:"db-binding"});
  const db=env.FLEET_DB;
  if(path==="/v1/monitor/driver"&&method==="POST"){
    const body=await parse(request);
    try{const row=await tripForToken(db,body?.token);
      if(!row)return errorResponse("Link inválido ou expirado.",404);
      return success({trip:toTrip(row)});
    }catch(e){return dbError(e,"driver-read")}
  }
  if(path==="/v1/monitor/position"&&method==="POST"){
    const body=await parse(request);
    const lat=Number(body?.latitude),lng=Number(body?.longitude),accuracy=Number(body?.accuracy);
    if(!Number.isFinite(lat)||lat < -90||lat > 90||!Number.isFinite(lng)||lng < -180||lng > 180||
      !Number.isFinite(accuracy)||accuracy<0||accuracy>100000)
      return errorResponse("Coordenadas inválidas.",400);
    try{
      const row=await tripForToken(db,body?.token);
      if(!row)return errorResponse("Link inválido ou expirado.",404);
      if(row.active!==1)return errorResponse("Viagem encerrada.",409);
      const time=now();
      await db.prepare("UPDATE monitor_trips SET lat=?,lng=?,accuracy=?,last_position_at=?,updated_at=? WHERE id=? AND active=1")
        .bind(lat,lng,accuracy,time,time,row.id).run();
      return success({receivedAt:time});
    }catch(e){return dbError(e,"position-write")}
  }
  let auth;
  try{auth=await manager(request,env)}catch(e){return dbError(e,"session")}
  if(auth.error)return auth.error;

  if(path==="/v1/monitor/trips"&&method==="GET"){
    try{
      const result=await db.prepare("SELECT * FROM monitor_trips ORDER BY created_at DESC LIMIT 200").all();
      return success({trips:(result.results||[]).map(toTrip),complete:true});
    }catch(e){return dbError(e,"trips-read")}
  }
  if(path==="/v1/monitor/trips"&&method==="POST"){
    const body=await parse(request),p=plate(body?.plate),driver=clean(body?.driver);
    if(p.length!==7||driver.length<2)return errorResponse("Informe placa e motorista válidos.",400);
    const access=makeToken(),tokenHash=await hashToken(access),time=now(),tripId=crypto.randomUUID();
    const expires=new Date(Date.now()+24*3600*1000).toISOString();
    const origin=clean(body?.origin),destination=clean(body?.destination),actor=clean(auth.session.usuario);
    try{
      await db.prepare("INSERT INTO monitor_trips (id,plate,driver,origin,destination,created_by,created_at,updated_at,active,token_hash,token_expires_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)")
        .bind(tripId,p,driver,origin,destination,actor,time,time,tokenHash,expires).run();
      return success({trip:{id:tripId,plate:p,driver,origin,destination,active:true,createdAt:time,updatedAt:time,lastPosition:null},token:access,linkExpiresHours:24},201);
    }catch(e){return dbError(e,"trip-create")}
  }
  const parts=path.split("/").filter(Boolean);
  if(parts.length===5&&parts[0]==="v1"&&parts[1]==="monitor"&&parts[2]==="trips"&&parts[4]==="stop"&&method==="POST"){
    if(!validId(parts[3]))return errorResponse("Identificador inválido.",400);
    try{
      const time=now();
      const result=await db.prepare("UPDATE monitor_trips SET active=0,updated_at=? WHERE id=?").bind(time,parts[3]).run();
      if(!result.meta?.changes)return errorResponse("Viagem não encontrada.",404);
      const row=await db.prepare("SELECT * FROM monitor_trips WHERE id=?").bind(parts[3]).first();
      return success({trip:toTrip(row)});
    }catch(e){return dbError(e,"trip-stop")}
  }
  return errorResponse("Rota de monitoramento não encontrada.",404);
}
