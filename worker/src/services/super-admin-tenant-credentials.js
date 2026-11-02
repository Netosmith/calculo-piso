import {errorResponse,success} from "../utils/response.js";
import {makePasswordRecord,normalizeTenantUser,validTenantId,validTenantPassword} from "./tenant-auth.js";

// Explicit staging opt-in, owner Access gate and isolated D1 only.
// Never writes or reads passwords from the legacy Nova Frota Apps Script.
export async function setTenantCredentials(request,env,actor,tenantId,userId){
 if(env.SUPER_ADMIN_CREDENTIAL_WRITES!=="enabled")
  return errorResponse("Configuracao de senhas ainda nao habilitada.",405);
 if(!validTenantId(tenantId) || !userId || normalizeTenantUser(userId)!==userId)
  return errorResponse("Transportadora ou usuario invalido.",400);
 if(!env.TENANTS_DB)return errorResponse("Banco de credenciais indisponivel.",503);
 try{
  const raw=await request.text();
  if(raw.length>1024)return errorResponse("Solicitacao excede limite.",413);
  let payload;
  try{payload=JSON.parse(raw);}catch{return errorResponse("JSON invalido.",400);}
  if(!payload || Array.isArray(payload) || typeof payload!=="object" ||
      Object.keys(payload).length!==1 || !Object.hasOwn(payload,"senha") ||
      !validTenantPassword(payload.senha))
    return errorResponse("Senha deve ter de 12 a 128 caracteres validos.",400);
  const db=env.TENANTS_DB;
  const member=await db.prepare(`SELECT u.user_id FROM portal_tenant_users u
    JOIN portal_tenants t ON t.id=u.tenant_id
    WHERE u.tenant_id=? AND u.user_id=? LIMIT 1`).bind(tenantId,userId).first();
  if(!member)return errorResponse("Vinculo nao encontrado.",404);
  const record=await makePasswordRecord(payload.senha);
  await db.batch([
   db.prepare(`INSERT INTO portal_tenant_credentials
    (tenant_id,user_id,password_salt,password_hash,iterations,version)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(tenant_id,user_id) DO UPDATE SET
    password_salt=excluded.password_salt,password_hash=excluded.password_hash,
    iterations=excluded.iterations,version=excluded.version,updated_at=CURRENT_TIMESTAMP`)
    .bind(tenantId,userId,record.password_salt,record.password_hash,record.iterations,record.version),
   db.prepare("DELETE FROM portal_tenant_sessions WHERE tenant_id=? AND user_id=?").bind(tenantId,userId),
   db.prepare("INSERT INTO portal_tenant_audit(id,actor_id,tenant_id,action,detail_json) VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(),actor,tenantId,"credentials.reset",JSON.stringify({usuario:userId}))
  ]);
  return success({tenantId,userId,senhaConfigurada:true,
    aviso:"Senha atualizada. Sessoes anteriores encerradas; senha nao retornada."});
 }catch(error){
  console.error("[SUPER ADMIN] Credential setup failed",{type:error?.name||"Error"});
  return errorResponse("Nao foi possivel configurar a senha.",503);
 }
}
