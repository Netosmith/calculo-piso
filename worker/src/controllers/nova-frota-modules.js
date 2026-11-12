import {LEGACY_NOVA_FROTA,tenantIdForLegacySession} from "../config/transportadoras.js";
import {getSession,readSessionId} from "../services/session.js";
import {readNovaFrotaModules} from "../services/nova-frota-modules.js";
import {modulesForProfile} from "../services/profile-access.js";
import {success,errorResponse} from "../utils/response.js";
export async function novaFrotaModulesController(request,env){
 if(request.method!=="GET")return errorResponse("Método não permitido.",405);
 const session=await getSession(env,readSessionId(request));
 if(!session||tenantIdForLegacySession(session)!==LEGACY_NOVA_FROTA.id)
  return errorResponse("Acesso restrito à Nova Frota.",403);
 try{
  const state=await readNovaFrotaModules(env);
  const isOwner=String(env.SUPER_ADMIN_USER||"").trim().toUpperCase()===
    String(session.usuario||"").trim().toUpperCase() && Boolean(env.SUPER_ADMIN_USER);
  const modules=await modulesForProfile(env,LEGACY_NOVA_FROTA.id,session.perfil,state.modules,isOwner);
  return success({empresa:LEGACY_NOVA_FROTA.id,modules,configured:state.configured});
 }catch{
  return errorResponse("Não foi possível carregar permissões dos módulos.",503);
 }
}
