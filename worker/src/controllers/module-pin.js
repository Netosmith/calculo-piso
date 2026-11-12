import { getSession,readSessionId } from "../services/session.js";
import { canUsePinModule,isPinModule,verifyModulePinValue,hasModulePin,issueModulePin,failedPinKey } from "../services/module-pin.js";
import { errorResponse,success } from "../utils/response.js";
import {readNovaFrotaModules} from "../services/nova-frota-modules.js";
import {modulesForProfile} from "../services/profile-access.js";
import {LEGACY_NOVA_FROTA,tenantIdForLegacySession} from "../config/transportadoras.js";

const LIMIT=5,WINDOW=10*60;
async function failedAttempts(env,key){
  const raw=await env.SESSIONS.get(key);
  const v=raw?JSON.parse(raw):null;
  if(!v||!Number.isFinite(v.started)||Date.now()-v.started>WINDOW*1000)
    return {count:0,started:Date.now()};
  return v;
}
export async function modulePinController(request,env){
  const url=new URL(request.url),method=request.method;
  if(!["GET","POST"].includes(method))return errorResponse("Método não permitido.",405);
  const session=await getSession(env,readSessionId(request));
  if(!session)return errorResponse("Entre no Portal Frete para continuar.",401);
  const path=url.pathname;
  if(method==="GET"&&path!=="/v1/module-pin/status"||
     method==="POST"&&path!=="/v1/module-pin/unlock")
    return errorResponse("Rota inexistente.",404);
  let module,code;
  if(method==="GET"){
    module=url.searchParams.get("module")||"";
  }else{
    if(request.headers.get("Origin")!=="https://portalfrete.net.br")
      return errorResponse("Origem da solicitação inválida.",403);
    if(!String(request.headers.get("Content-Type")||"").startsWith("application/json"))
      return errorResponse("Formato não permitido.",415);
    let body;
    try{
      const raw=await request.text();
      if(raw.length>200)return errorResponse("Solicitação inválida.",400);
      body=JSON.parse(raw);
    }catch{return errorResponse("Solicitação inválida.",400);}
    if(!body||typeof body!=="object"||Array.isArray(body)||
      Object.keys(body).some(k=>!["module","pin"].includes(k)))
      return errorResponse("Solicitação inválida.",400);
    module=body.module;code=body.pin;
  }
  if(typeof module!=="string"||!isPinModule(module))
    return errorResponse("Módulo inválido.",400);
  if(!canUsePinModule(session,module)||
    tenantIdForLegacySession(session)!==LEGACY_NOVA_FROTA.id)
    return errorResponse("Módulo não autorizado para este perfil ou transportadora.",403);
  try{
    const state=await readNovaFrotaModules(env);
    const owner=Boolean(env.SUPER_ADMIN_USER)&&
      String(session.usuario||"").trim().toUpperCase()===String(env.SUPER_ADMIN_USER).trim().toUpperCase();
    const effective=await modulesForProfile(env,LEGACY_NOVA_FROTA.id,
      session.perfil,state.modules,owner);
    if(!effective.includes(module))
      return errorResponse("Módulo desativado para este perfil.",403);
  }catch{return errorResponse("Não foi possível verificar a permissão do módulo.",503);}
  if(method==="GET"){
    return success({module,unlocked:await hasModulePin(request,env,module)});
  }
  if(!env.SESSIONS||!env.PORTAL_KEY)return errorResponse("Verificação de senha indisponível.",503);
  try{
    const key=await failedPinKey(request,module);
    const attempts=await failedAttempts(env,key);
    if(attempts.count>=LIMIT)return errorResponse(
      "Muitas tentativas. Tente novamente após 10 minutos.",429);
    if(!await verifyModulePinValue(code)){
      await env.SESSIONS.put(key,JSON.stringify({
        count:attempts.count+1,started:attempts.started
      }),{expirationTtl:WINDOW});
      if(attempts.count+1>=LIMIT)
        return errorResponse("Limite de tentativas atingido. Tente novamente após 10 minutos.",429);
      return errorResponse("Senha incorreta.",403);
    }
    const cookie=await issueModulePin(request,env,module);
    if(!cookie)return errorResponse("Não foi possível autorizar a sessão.",503);
    await env.SESSIONS.delete(key).catch(()=>{});
    return success({module,unlocked:true,expiresInSeconds:1800},200,{"Set-Cookie":cookie});
  }catch(e){
    console.error("[MODULE PIN]",String(e?.message||e));
    return errorResponse("Validação temporariamente indisponível.",503);
  }
}
