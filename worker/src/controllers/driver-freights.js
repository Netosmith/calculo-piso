import {LEGACY_NOVA_FROTA,tenantIdForLegacySession} from "../config/transportadoras.js";
import {getSession,readSessionId} from "../services/session.js";
import {canRunGatewayAction} from "../services/permissions.js";
import {errorResponse,success} from "../utils/response.js";

// Somente ofertas explicitamente publicadas são visíveis sem autenticação.
// Nunca ler as planilhas operacionais no endpoint público.
const SOURCES=new Set(["fretes","fretes2"]);
const LIMIT=120;
const MAX_AGE=72*60*60*1000;
const clean=(value,limit)=>{
  const s=String(value??"").trim();
  return s.length<=limit&&!/[\x00-\x1f\x7f<>]/.test(s)?s:null;
};
const sourceId=value=>clean(value,150);
const safeSource=value=>typeof value==="string"&&SOURCES.has(value);
const validWhatsapp=value=>{
  const raw=String(value??"").trim();
  if(!/^[+\d()\s-]+$/.test(raw))return null;
  const digits=raw.replace(/\D/g,"");
  return /^55\d{10,11}$/.test(digits)?digits:null;
};
const validPublicRow=(body)=>{
  if(!body||typeof body!=="object"||Array.isArray(body))return null;
  if(!safeSource(body.source))return null;
  const id=sourceId(body.sourceId),origem=clean(body.origem,130),
    destino=clean(body.destino,130),produto=clean(body.produto,100),
    volume=clean(body.volume??"",55),valor=clean(body.valorMotorista??"",55),
    whatsappEmbarcador=validWhatsapp(body.whatsappEmbarcador);
  if(!id||!origem||!destino||!produto||volume===null||valor===null||!whatsappEmbarcador)return null;
  if(String(body.status||"").toUpperCase()!=="LIBERADO")return null;
  // Conserva apenas os campos autorizados, nunca JSON original da planilha.
  return {source:body.source,sourceId:id,origem,destino,produto,volume,
    valorMotorista:valor,whatsappEmbarcador};
};
async function operator(request,env,source){
  const session=await getSession(env,readSessionId(request));
  if(!session)return {error:errorResponse("Entre no Portal Frete.",401)};
  if(session.tenantMode===true||tenantIdForLegacySession(session)!==LEGACY_NOVA_FROTA.id)
    return {error:errorResponse("Divulgação exclusiva Nova Frota.",403)};
  const role=String(session.perfil||"").trim().toUpperCase();
  if(!["ADMINISTRADOR","COMERCIAL","OPERACIONAL","GO","MT"].includes(role)||
     !canRunGatewayAction(session,source,"update"))
    return {error:errorResponse("Sem permissão para divulgar este frete.",403)};
  return {session};
}
export async function driverFreightsController(request,env){
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,""),method=request.method;
  if(!env.FLEET_DB)return errorResponse("Catálogo de fretes indisponível.",503);
  const db=env.FLEET_DB;
  if(path==="/v1/driver-freights"&&method==="GET"){
    try{
      const result=await db.prepare(
        "SELECT source,source_id AS sourceId,origem,destino,produto,volume,"+
        "valor_motorista AS valorMotorista,whatsapp_embarcador AS whatsappEmbarcador,"+
        "published_at AS publishedAt,expires_at AS expiresAt "+
        "FROM driver_public_freights WHERE expires_at>? "+
        "ORDER BY published_at DESC LIMIT ?"
      ).bind(new Date().toISOString(),LIMIT).all();
      return success({fretes:result.results||[],source:"divulgacao-nova-frota",expiresWithinHours:72});
    }catch(e){
      console.error("[DRIVER FREIGHTS] read",String(e?.message||e));
      return errorResponse("Não foi possível consultar as ofertas.",503);
    }
  }
  if(path==="/v1/driver-freights/manage"&&method==="GET"){
    const source=url.searchParams.get("source");
    if(!safeSource(source))return errorResponse("Base inválida.",400);
    const auth=await operator(request,env,source);
    if(auth.error)return auth.error;
    try{
      const result=await db.prepare(
        "SELECT source_id AS sourceId,published_at AS publishedAt,expires_at AS expiresAt "+
        "FROM driver_public_freights WHERE source=? AND expires_at>? LIMIT 1000"
      ).bind(source,new Date().toISOString()).all();
      return success({published:result.results||[]});
    }catch(e){return errorResponse("Falha ao consultar divulgação.",503);}
  }
  if(path!=="/v1/driver-freights/publish"||!["POST","DELETE"].includes(method))
    return errorResponse("Rota inexistente.",404);
  if(request.headers.get("Origin")!=="https://portalfrete.net.br")
    return errorResponse("Origem inválida.",403);
  if(!String(request.headers.get("Content-Type")||"").startsWith("application/json"))
    return errorResponse("Formato inválido.",415);
  let data;
  try{
    const raw=await request.text();
    if(raw.length>3500)return errorResponse("Dados muito extensos.",400);
    data=JSON.parse(raw);
  }catch{return errorResponse("Dados inválidos.",400);}
  const source=data?.source;
  if(!safeSource(source))return errorResponse("Base inválida.",400);
  const auth=await operator(request,env,source);
  if(auth.error)return auth.error;
  if(method==="DELETE"){
    const id=sourceId(data?.sourceId);
    if(!id)return errorResponse("Frete inválido.",400);
    try{
      await db.prepare("DELETE FROM driver_public_freights WHERE source=? AND source_id=?")
        .bind(source,id).run();
      return success({unpublished:true});
    }catch(e){return errorResponse("Não foi possível retirar o anúncio.",503);}
  }
  const row=validPublicRow(data);
  if(!row)return errorResponse("Somente fretes LIBERADOS completos podem ser publicados.",400);
  const publishedAt=new Date().toISOString();
  const expiresAt=new Date(Date.now()+MAX_AGE).toISOString();
  try{
    await db.prepare(
      "INSERT INTO driver_public_freights "+
      "(source,source_id,origem,destino,produto,volume,valor_motorista,whatsapp_embarcador,published_by,published_at,expires_at) "+
      "VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source,source_id) DO UPDATE SET "+
      "origem=excluded.origem,destino=excluded.destino,produto=excluded.produto,"+
      "volume=excluded.volume,valor_motorista=excluded.valor_motorista,"+
      "whatsapp_embarcador=excluded.whatsapp_embarcador,"+
      "published_by=excluded.published_by,published_at=excluded.published_at,expires_at=excluded.expires_at"
    ).bind(row.source,row.sourceId,row.origem,row.destino,row.produto,row.volume,
      row.valorMotorista,row.whatsappEmbarcador,
      String(auth.session.usuario||"").slice(0,100),publishedAt,expiresAt).run();
    return success({published:true,expiresAt});
  }catch(e){
    console.error("[DRIVER FREIGHTS] publish",String(e?.message||e));
    return errorResponse("Não foi possível divulgar este frete.",503);
  }
}
