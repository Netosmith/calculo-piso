import { getSession, readSessionId } from "../services/session.js";
import { errorResponse, success } from "../utils/response.js";

const PREFIX = "nf:monitor:";
const TTL = 7 * 24 * 60 * 60;
const LINK_TTL = 24 * 60 * 60;
const PROFILES = new Set(["ADMINISTRADOR", "COMERCIAL", "OPERACIONAL"]);
const clean = (v,n=100) => String(v ?? "").trim().slice(0,n);
const plate = v => clean(v,12).toUpperCase().replace(/[^A-Z0-9]/g,"");
const id = () => crypto.randomUUID();
const token = () => [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,"0")).join("");
const validId = v => /^[a-f0-9-]{36}$/.test(String(v||""));
const validToken = v => /^[a-f0-9]{64}$/.test(String(v||""));
const readBody = async request => {
  try {
    const body = await request.json();
    return body && typeof body==="object" && !Array.isArray(body) ? body : null;
  } catch { return null; }
};
const tripKey = value => PREFIX+"trip:"+value;
const linkKey = value => PREFIX+"link:"+value;
async function manager(request,env){
  const session = await getSession(env,readSessionId(request));
  if(!session)return {error:errorResponse("Sessão inválida.",401)};
  if(!PROFILES.has(clean(session.perfil).toUpperCase()))return {error:errorResponse("Sem permissão para Monitoramento.",403)};
  return {session};
}
async function getTrip(env,value){
  if(!validId(value))return null;
  return env.SESSIONS.get(tripKey(value),"json");
}
async function getByToken(env,value){
  if(!validToken(value))return null;
  const linked=await env.SESSIONS.get(linkKey(value));
  return linked ? getTrip(env,linked) : null;
}
async function saveTrip(env,trip){
  await env.SESSIONS.put(tripKey(trip.id),JSON.stringify(trip),{expirationTtl:TTL});
}
function publicTrip(t){
  return {id:t.id,plate:t.plate,driver:t.driver,origin:t.origin,destination:t.destination,
    active:t.active,createdAt:t.createdAt,updatedAt:t.updatedAt,lastPosition:t.lastPosition||null};
}
export async function monitorController(request,env){
  if(!env.SESSIONS)return errorResponse("Armazenamento indisponível.",503);
  const url=new URL(request.url);
  const path=url.pathname.endsWith("/") ? url.pathname.slice(0,-1) : url.pathname;
  const method=request.method;

  // Diagnóstico de disponibilidade sem exposição de dados de viagens.
  if(path==="/v1/monitor/health" && method==="GET"){
    try {
      await env.SESSIONS.get(PREFIX+"health-probe");
      return success({storage:"available"});
    } catch(error) {
      console.error("[MONITOR] KV indisponível",String(error?.message||error));
      return errorResponse("Armazenamento temporariamente indisponível.",503,{stage:"kv-read"});
    }
  }

  // Link do motorista autoriza somente leitura da própria viagem e envio de posição.
  if(path==="/v1/monitor/driver"){
    if(method!=="POST")return errorResponse("Método não permitido.",405);
    const body=await readBody(request);
    const t=await getByToken(env,body?.token);
    if(!t)return errorResponse("Link inválido ou expirado.",404);
    return success({trip:publicTrip(t)});
  }
  if(path==="/v1/monitor/position"){
    if(method!=="POST")return errorResponse("Método não permitido.",405);
    const body=await readBody(request);
    const t=await getByToken(env,body?.token);
    if(!t)return errorResponse("Link inválido ou expirado.",404);
    if(!t.active)return errorResponse("Viagem já encerrada.",409);
    const lat=Number(body.latitude),lng=Number(body.longitude),accuracy=Number(body.accuracy);
    if(!Number.isFinite(lat)||lat < -90||lat > 90||!Number.isFinite(lng)||lng < -180||lng > 180)
      return errorResponse("Coordenadas inválidas.",400);
    if(!Number.isFinite(accuracy)||accuracy<0||accuracy>100000)
      return errorResponse("Precisão inválida.",400);
    t.lastPosition={lat,lng,accuracy,at:new Date().toISOString()};
    t.updatedAt=t.lastPosition.at;
    await saveTrip(env,t);
    return success({receivedAt:t.updatedAt});
  }

  const auth=await manager(request,env);
  if(auth.error)return auth.error;

  if(path==="/v1/monitor/trips" && method==="GET"){
    // Índice pequeno para o piloto: evita a operação KV.list em toda consulta.
    const ids=(await env.SESSIONS.get(PREFIX+"index","json")) || [];
    const trips=(await Promise.all(ids.slice(0,200).map(x=>getTrip(env,x))))
      .filter(Boolean).map(publicTrip).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    return success({trips,complete:true});
  }
  if(path==="/v1/monitor/trips" && method==="POST"){
    const body=await readBody(request);
    const p=plate(body?.plate),driver=clean(body?.driver,100);
    if(p.length!==7||driver.length<2)return errorResponse("Informe placa e motorista válidos.",400);
    const now=new Date().toISOString(), tripId=id(), access=token();
    const trip={id:tripId,plate:p,driver,origin:clean(body?.origin,100),
      destination:clean(body?.destination,100),active:true,createdAt:now,updatedAt:now,
      createdBy:clean(auth.session.usuario,100),lastPosition:null};
    await saveTrip(env,trip);
    const currentIndex=(await env.SESSIONS.get(PREFIX+"index","json")) || [];
    const nextIndex=[tripId,...currentIndex.filter(x=>validId(x)&&x!==tripId)].slice(0,200);
    await env.SESSIONS.put(PREFIX+"index",JSON.stringify(nextIndex),{expirationTtl:TTL});
    await env.SESSIONS.put(linkKey(access),tripId,{expirationTtl:LINK_TTL});
    return success({trip:publicTrip(trip),token:access,linkExpiresHours:24},201);
  }
  const stopParts=path.split("/").filter(Boolean);
  if(stopParts.length===5 && stopParts[0]==="v1" && stopParts[1]==="monitor" && stopParts[2]==="trips" && stopParts[4]==="stop" && method==="POST"){
    const trip=await getTrip(env,stopParts[3]);
    if(!trip)return errorResponse("Viagem não encontrada.",404);
    trip.active=false;trip.updatedAt=new Date().toISOString();
    await saveTrip(env,trip);
    return success({trip:publicTrip(trip)});
  }
  return errorResponse("Rota de monitoramento não encontrada.",404);
}
