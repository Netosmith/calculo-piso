import {errorResponse,success} from "../utils/response.js";
import {makePasswordRecord,normalizeTenantUser,validTenantPassword} from "./tenant-auth.js";
import {credentialSchemaStatus} from "./super-admin-tenant-credentials.js";

const ROLES=new Set(["ADMINISTRADOR","COMERCIAL","OPERACIONAL","PISO","GOADM"]);
const MAX_USERS=500;
const error=(message,status=400)=>errorResponse(message,status);
const tenantUser=(value)=>normalizeTenantUser(value);
async function audit(db,tenant,actor,action,detail){
 return db.prepare("INSERT INTO portal_tenant_audit(id,actor_id,tenant_id,action,detail_json) VALUES (?,?,?,?,?)")
  .bind(crypto.randomUUID(),actor,tenant,action,JSON.stringify(detail));
}
async function readJson(request){
 const text=await request.text();
 if(text.length>4096)throw Error("invalid");
 let data;try{data=JSON.parse(text);}catch{throw Error("invalid");}
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("invalid");
 return data;
}
function exactKeys(data,allowed){
 return Object.keys(data).every(key=>allowed.includes(key));
}
function visible(row){
 return {Usuario:row.user_id,Nome:row.user_id,Perfil:row.role,
  Ativo:row.active===1?"SIM":"NÃO",
  Acesso:row.password_set===1?(row.active===1?"PRONTO":"INATIVO"):"SEM SENHA"};
}

/**
 * Tenant account management intentionally never calls the legacy Nova Frota
 * Apps Script. It uses only the signed tenant_id in the D1 session, and
 * only an ADMINISTRADOR can create or update tenant login credentials.
 */
export async function tenantUsersController(request,env,principal,modules,path){
 if(principal?.role!=="ADMINISTRADOR" || !modules.includes("cadastros"))
  return error("Somente ADMINISTRADOR com Cadastros liberado pode gerenciar usuarios.",403);
 const db=env.TENANTS_DB,tenant=principal.tenant_id,actor=principal.user_id;
 if(!db)return error("Banco de usuarios indisponivel.",503);
 const base="/v1/tenant/usuarios";
 const suffix=path.slice(base.length);
 if(!suffix && request.method==="GET"){
  try{
   const out=await db.prepare(`SELECT u.user_id,u.role,u.active,u.created_at,
     EXISTS(SELECT 1 FROM portal_tenant_credentials c
      WHERE c.tenant_id=u.tenant_id AND c.user_id=u.user_id) AS password_set
     FROM portal_tenant_users u WHERE u.tenant_id=? ORDER BY u.user_id LIMIT 500`)
     .bind(tenant).all();
   return success({usuarios:(out.results||[]).map(visible)});
  }catch{return error("Consulta de usuarios indisponivel. Confirme a migracao D1.",503);}
 }
 if(!["POST","PATCH"].includes(request.method))
  return error("Metodo nao permitido.",405);
 let data;
 try{data=await readJson(request);}catch{return error("Dados invalidos.",400);}
 const schema=await credentialSchemaStatus(db);
 if(!schema.ok)return error("Estrutura D1 de credenciais incompleta ("+schema.missing.join(", ")+").",503);
 if(!suffix && request.method==="POST"){
  if(!exactKeys(data,["usuario","perfil","senha","ativo"]) ||
     !Object.hasOwn(data,"usuario")||!Object.hasOwn(data,"perfil")||
     !Object.hasOwn(data,"senha") || !Object.hasOwn(data,"ativo"))
   return error("Informe usuario, perfil, senha e situacao.",400);
  const id=tenantUser(data.usuario),role=data.perfil;
  if(!id||!ROLES.has(role)||!validTenantPassword(data.senha)||
    typeof data.ativo!=="boolean")return error("Usuario, perfil, senha ou situacao invalidos. Senha minima: 12 caracteres.",400);
  try{
   const qty=await db.prepare("SELECT COUNT(*) AS n FROM portal_tenant_users WHERE tenant_id=?").bind(tenant).first();
   if(Number(qty?.n)>=MAX_USERS)return error("Limite de usuarios atingido.",409);
   const found=await db.prepare("SELECT user_id FROM portal_tenant_users WHERE tenant_id=? AND user_id=?")
     .bind(tenant,id).first();
   if(found)return error("Usuario ja cadastrado. Utilize Editar para redefinir a senha.",409);
   const password=await makePasswordRecord(data.senha);
   await db.batch([
    db.prepare("INSERT INTO portal_tenant_users(tenant_id,user_id,role,active) VALUES (?,?,?,?)")
     .bind(tenant,id,role,data.ativo?1:0),
    db.prepare(`INSERT INTO portal_tenant_credentials
     (tenant_id,user_id,password_salt,password_hash,iterations,version) VALUES (?,?,?,?,?,?)`)
     .bind(tenant,id,password.password_salt,password.password_hash,password.iterations,password.version),
    await audit(db,tenant,actor,"user.onboard",{usuario:id,perfil:role,ativo:data.ativo,senhaConfigurada:true})
   ]);
   return success({usuario:{Usuario:id,Nome:id,Perfil:role,Ativo:data.ativo?"SIM":"NÃO",Acesso:data.ativo?"PRONTO":"INATIVO"}},201);
  }catch(ex){
   console.error("[TENANT USERS] create failed",{type:ex?.name||"Error"});
   return error("Nao foi possivel concluir o cadastro de acesso.",503);
  }
 }
 const match=suffix.match(/^\/([A-Z0-9][A-Z0-9._-]{1,79})$/);
 if(!match || request.method!=="PATCH")return error("Rota de usuario invalida.",404);
 const id=match[1];
 if(!exactKeys(data,["perfil","ativo","senha"])||Object.keys(data).length===0)
  return error("Campos de edicao invalidos.",400);
 if(Object.hasOwn(data,"perfil")&&!ROLES.has(data.perfil))return error("Perfil invalido.",400);
 if(Object.hasOwn(data,"ativo")&&typeof data.ativo!=="boolean")return error("Situacao invalida.",400);
 if(Object.hasOwn(data,"senha")&&data.senha!==""&&!validTenantPassword(data.senha))
  return error("A senha exige de 12 a 128 caracteres.",400);
 try{
  const old=await db.prepare("SELECT role,active FROM portal_tenant_users WHERE tenant_id=? AND user_id=?")
    .bind(tenant,id).first();
  if(!old)return error("Usuario nao encontrado nesta transportadora.",404);
  const role=data.perfil??old.role,active=data.ativo??Boolean(old.active);
  if(id===actor && (role!=="ADMINISTRADOR" || !active))
   return error("O administrador nao pode desativar seu proprio acesso.",403);
  if(old.role==="ADMINISTRADOR" && (role!=="ADMINISTRADOR" || !active)){
   const count=await db.prepare("SELECT COUNT(*) AS n FROM portal_tenant_users WHERE tenant_id=? AND role='ADMINISTRADOR' AND active=1").bind(tenant).first();
   if(Number(count?.n)<=1)return error("Mantenha pelo menos um administrador ativo.",409);
  }
  const reset=typeof data.senha==="string"&&data.senha.length>0;
  if(active&&!reset){
   const hasPassword=await db.prepare("SELECT user_id FROM portal_tenant_credentials WHERE tenant_id=? AND user_id=?")
    .bind(tenant,id).first();
   if(!hasPassword)return error("Defina uma senha antes de ativar o usuario.",409);
  }
  const password=reset?await makePasswordRecord(data.senha):null;
  const statements=[
   db.prepare("UPDATE portal_tenant_users SET role=?,active=? WHERE tenant_id=? AND user_id=?")
    .bind(role,active?1:0,tenant,id)
  ];
  if(reset){
   statements.push(db.prepare(`INSERT INTO portal_tenant_credentials
    (tenant_id,user_id,password_salt,password_hash,iterations,version) VALUES (?,?,?,?,?,?)
    ON CONFLICT(tenant_id,user_id) DO UPDATE SET
    password_salt=excluded.password_salt,password_hash=excluded.password_hash,
    iterations=excluded.iterations,version=excluded.version,updated_at=CURRENT_TIMESTAMP`)
    .bind(tenant,id,password.password_salt,password.password_hash,password.iterations,password.version));
  }
  if(reset||!active)
   statements.push(db.prepare("DELETE FROM portal_tenant_sessions WHERE tenant_id=? AND user_id=?").bind(tenant,id));
  statements.push(await audit(db,tenant,actor,"user.update",
    {usuario:id,perfil:role,ativo:active,senhaRedefinida:reset}));
  await db.batch(statements);
  return success({usuario:{Usuario:id,Nome:id,Perfil:role,Ativo:active?"SIM":"NÃO"}});
 }catch(ex){
  console.error("[TENANT USERS] update failed",{type:ex?.name||"Error"});
  return error("Nao foi possivel atualizar este usuario.",503);
 }
}
