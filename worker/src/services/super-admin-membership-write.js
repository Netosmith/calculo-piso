import {errorResponse,success} from "../utils/response.js";

const ROLES=new Set(["ADMINISTRADOR","COMERCIAL","OPERACIONAL","PISO","GOADM","MT","PR"]);
const USER_ID=/^[A-Z0-9][A-Z0-9._-]{1,79}$/;
const allowed=(object,keys)=>object && typeof object==="object" &&
  !Array.isArray(object) && Object.keys(object).every(key=>keys.includes(key));

function normalizeUser(value) {
  if(typeof value!=="string")return null;
  const id=value.trim().toUpperCase();
  return USER_ID.test(id)?id:null;
}
async function readBody(request,keys) {
  const text=await request.text();
  if(text.length>2048)throw new TypeError("invalid-body");
  let data;
  try{data=JSON.parse(text);}catch{throw new TypeError("invalid-body");}
  if(!allowed(data,keys))throw new TypeError("invalid-body");
  return data;
}
async function audit(db,actor,tenant,action,detail) {
  return db.prepare("INSERT INTO portal_tenant_audit (id,actor_id,tenant_id,action,detail_json) VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(),actor,tenant,action,JSON.stringify(detail));
}

// Memberships are catalogue records ONLY. They are not credentials or login
// grants: another tenant cannot access any Nova Frota Apps Script resources.
export async function writeTenantMembership(request,env,actor,tenantId,userId=null) {
  if(env.SUPER_ADMIN_MEMBERSHIP_WRITES!=="enabled")
    return errorResponse("Cadastro de vinculos nao habilitado neste ambiente.",405);
  const db=env.TENANTS_DB;
  if(!db || tenantId==="nova-frota")return errorResponse("Transportadora indisponivel para vinculos.",403);
  try {
    const tenant=await db.prepare("SELECT id FROM portal_tenants WHERE id=?").bind(tenantId).first();
    if(!tenant)return errorResponse("Transportadora nao encontrada.",404);

    if(request.method==="POST" && userId===null) {
      const body=await readBody(request,["usuario","perfil"]);
      const id=normalizeUser(body.usuario);
      if(!id || !ROLES.has(body.perfil))return errorResponse("Usuario ou perfil invalido.",400);
      const qty=await db.prepare("SELECT COUNT(*) AS n FROM portal_tenant_users WHERE tenant_id=?").bind(tenantId).first();
      if(Number(qty?.n)>=500)return errorResponse("Limite de vinculos atingido.",409);
      const found=await db.prepare("SELECT user_id FROM portal_tenant_users WHERE tenant_id=? AND user_id=?")
        .bind(tenantId,id).first();
      if(found)return errorResponse("Vinculo ja cadastrado.",409);
      await db.batch([
        db.prepare("INSERT INTO portal_tenant_users(tenant_id,user_id,role,active) VALUES (?,?,?,0)")
          .bind(tenantId,id,body.perfil),
        await audit(db,actor,tenantId,"membership.create",{usuario:id,perfil:body.perfil,ativo:false})
      ]);
      return success({tenantId,usuario:{id,perfil:body.perfil,ativo:false},aviso:"Vinculo cadastrado, sem criar credenciais ou liberar login."},201);
    }

    if(request.method==="PATCH" && userId!==null) {
      const id=normalizeUser(userId);
      if(!id || id!==userId)return errorResponse("Identificador de usuario invalido.",400);
      const body=await readBody(request,["perfil","ativo"]);
      if(!Object.hasOwn(body,"perfil") && !Object.hasOwn(body,"ativo"))
        return errorResponse("Nenhuma alteracao informada.",400);
      if(Object.hasOwn(body,"perfil") && !ROLES.has(body.perfil))
        return errorResponse("Perfil invalido.",400);
      if(Object.hasOwn(body,"ativo") && typeof body.ativo!=="boolean")
        return errorResponse("Status de vinculo invalido.",400);
      const current=await db.prepare("SELECT role,active FROM portal_tenant_users WHERE tenant_id=? AND user_id=?")
        .bind(tenantId,id).first();
      if(!current)return errorResponse("Vinculo nao encontrado.",404);
      const role=body.perfil??current.role;
      const active=body.ativo??Boolean(current.active);
      await db.batch([
        db.prepare("UPDATE portal_tenant_users SET role=?,active=? WHERE tenant_id=? AND user_id=?")
          .bind(role,active?1:0,tenantId,id),
        await audit(db,actor,tenantId,"membership.update",{usuario:id,perfil:role,ativo:active})
      ]);
      return success({tenantId,usuario:{id,perfil:role,ativo:active},aviso:"Alteracao restrita ao catalogo, sem atualizar credenciais."});
    }
    return errorResponse("Metodo de vinculo nao permitido.",405);
  }catch(error){
    if(error instanceof TypeError && error.message==="invalid-body")
      return errorResponse("Corpo da solicitacao invalido.",400);
    console.error("[SUPER ADMIN] Membership write failed",{type:error?.name||"Error"});
    return errorResponse("Nao foi possivel gravar o vinculo.",503);
  }
}
