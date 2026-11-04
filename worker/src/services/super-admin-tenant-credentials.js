import {errorResponse,success} from "../utils/response.js";
import {makePasswordRecord,normalizeTenantUser,validTenantId,validTenantPassword} from "./tenant-auth.js";

// Read-only checks validate the actual D1 schema, not only table existence.
// No passwords, credential rows or authentication material are returned.
export async function credentialSchemaStatus(db){
 if(!db)return {ok:false,missing:["conexao"]};
 const checks=[
  ["credenciais","SELECT tenant_id,user_id,password_salt,password_hash,iterations,version,updated_at FROM portal_tenant_credentials LIMIT 1"],
  ["sessoes","SELECT token_hash,tenant_id,user_id,credential_version,expires_at FROM portal_tenant_sessions LIMIT 1"],
  ["auditoria","SELECT id,actor_id,tenant_id,action,detail_json FROM portal_tenant_audit LIMIT 1"]
 ];
 const missing=[];
 for(const [label,sql] of checks){
  try{await db.prepare(sql).first();}catch{missing.push(label);}
 }
 return {ok:missing.length===0,missing};
}

// Explicit staging opt-in, owner Access gate and isolated D1 only.
// Never writes or reads passwords from the legacy Nova Frota Apps Script.
export async function setTenantCredentials(request,env,actor,tenantId,userId){
 if(env.SUPER_ADMIN_CREDENTIAL_WRITES!=="enabled")
  return errorResponse("Configuracao de senhas ainda nao habilitada.",405);
 if(!validTenantId(tenantId) || !userId || normalizeTenantUser(userId)!==userId)
  return errorResponse("Transportadora ou usuario invalido.",400);
 if(!env.TENANTS_DB)return errorResponse("Banco de credenciais indisponivel.",503);
 let stage="validacao";
 try{
  const raw=await request.text();
  if(raw.length>1024)return errorResponse("Solicitacao excede limite.",413);
  let payload;
  try{payload=JSON.parse(raw);}catch{return errorResponse("JSON invalido.",400);}
  if(!payload || Array.isArray(payload) || typeof payload!=="object" ||
      Object.keys(payload).some(key=>!["senha","ativar"].includes(key)) ||
      !Object.hasOwn(payload,"senha") || (Object.hasOwn(payload,"ativar")&&payload.ativar!==true) ||
      !validTenantPassword(payload.senha))
    return errorResponse("Senha deve ter de 12 a 128 caracteres validos.",400);
  const activate=payload.ativar===true;
  if(activate&&env.SUPER_ADMIN_MEMBERSHIP_WRITES!=="enabled")
    return errorResponse("Ativacao de usuario nao habilitada.",405);
  const db=env.TENANTS_DB;
  const member=await db.prepare(`SELECT u.user_id FROM portal_tenant_users u
    JOIN portal_tenants t ON t.id=u.tenant_id
    WHERE u.tenant_id=? AND u.user_id=? LIMIT 1`).bind(tenantId,userId).first();
  if(!member)return errorResponse("Vinculo nao encontrado.",404);
  stage="verificacao-d1";
  const schema=await credentialSchemaStatus(db);
  if(!schema.ok)return errorResponse(
    "Estrutura D1 de credenciais incompleta ("+schema.missing.join(", ")+"). Verifique a migracao 0002.",503);
  stage="hash";
  const record=await makePasswordRecord(payload.senha);
  stage="gravacao-d1";
  await db.batch([
   ...(activate?[db.prepare("UPDATE portal_tenant_users SET active=1 WHERE tenant_id=? AND user_id=?")
     .bind(tenantId,userId)]:[]),
   db.prepare(`INSERT INTO portal_tenant_credentials
    (tenant_id,user_id,password_salt,password_hash,iterations,version)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(tenant_id,user_id) DO UPDATE SET
    password_salt=excluded.password_salt,password_hash=excluded.password_hash,
    iterations=excluded.iterations,version=excluded.version,updated_at=CURRENT_TIMESTAMP`)
    .bind(tenantId,userId,record.password_salt,record.password_hash,record.iterations,record.version),
   db.prepare("DELETE FROM portal_tenant_sessions WHERE tenant_id=? AND user_id=?").bind(tenantId,userId),
   db.prepare("INSERT INTO portal_tenant_audit(id,actor_id,tenant_id,action,detail_json) VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(),actor,tenantId,"credentials.reset",JSON.stringify({usuario:userId,ativado:activate}))
  ]);
  return success({tenantId,userId,senhaConfigurada:true,ativo:activate?true:undefined,
    aviso:activate?"Usuario ativado com senha configurada.":"Senha atualizada. Sessoes anteriores encerradas."});
 }catch(error){
  // Do not log SQL strings, requests, passwords, salts or hashes.
  const cryptoCode=stage==="hash" && typeof error?.cryptoStage==="string"?
   error.cryptoStage+"/"+(error.cryptoType||"Error"):null;
  console.error("[SUPER ADMIN] Credential setup failed",{
   stage,type:error?.name||"Error",cryptoCode,
   category:/no such table|no such column|foreign key mismatch/i.test(String(error?.message||""))?
    "schema":/FOREIGN KEY constraint failed/i.test(String(error?.message||""))?
    "reference":"other"
  });
  return errorResponse(stage==="hash"?
   "Falha no processamento seguro da senha"+(cryptoCode?" ("+cryptoCode+")":"")+".":
   stage==="gravacao-d1"?
   "Falha ao gravar credenciais no D1. Verifique os logs do Super Admin.":
   "Nao foi possivel configurar a senha.",503);
 }
}
