import {errorResponse,success} from "../utils/response.js";
import {writeTenantMembership} from "./super-admin-membership-write.js";
import {writeTenantLogo} from "./super-admin-brand.js";
import {writeTenantVisual} from "./tenant-visual-assets.js";
import {writeTenantArtThemes} from "./tenant-art-themes.js";
import {setTenantCredentials} from "./super-admin-tenant-credentials.js";
import {adminWriteTenantIntegration} from "./tenant-integration.js";
import {cadastroAdminSave} from "../controllers/cadastro-solicitacoes.js";
import {TENANT_MODULES} from "../config/tenant-modules.js";
import {saveNovaFrotaModules,NOVA_FROTA_MANAGED_MODULES} from "./nova-frota-modules.js";
import {LEGACY_NOVA_FROTA} from "../config/transportadoras.js";

const BASE="/v1/super-admin/transportadoras";
const SLUG=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const hasOwn=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);

async function jsonBody(request, allowed) {
  const raw=await request.text();
  if(raw.length>8192) throw new Error("too-large");
  let data;
  try {data=JSON.parse(raw);} catch {throw new Error("invalid-json");}
  if(!data || typeof data!=="object" || Array.isArray(data) ||
    Object.keys(data).some(key=>!allowed.includes(key))) throw new Error("invalid-fields");
  return data;
}
function validName(name) {
  return typeof name==="string" && name.trim().length>=2 &&
    name.trim().length<=100 && !/[\u0000-\u001f\u007f]/.test(name);
}
function validId(id) {
  return typeof id==="string" && id.length>=3 && id.length<=48 &&
    SLUG.test(id) && id!==LEGACY_NOVA_FROTA.id;
}
function validStatus(status) {return status==="active" || status==="inactive";}
async function audit(db, actor, tenant, action, detail) {
  return db.prepare("INSERT INTO portal_tenant_audit (id,actor_id,tenant_id,action,detail_json) VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(),actor,tenant,action,JSON.stringify(detail));
}
async function findTenant(db,id) {
  return db.prepare("SELECT id,name,status FROM portal_tenants WHERE id=?").bind(id).first();
}
function failDb(error) {
  // Do not reflect SQL/database details to the browser or logs.
  console.error("[SUPER ADMIN] Database write failed", {type:error?.name||"Error"});
  return errorResponse("Nao foi possivel gravar no catalogo.",503);
}

export async function writeTenantCatalog(request,env,actor) {
  if(env.SUPER_ADMIN_TENANT_WRITES!=="enabled")
    return errorResponse("Gestao de transportadoras nao habilitada neste ambiente.",405);
  const db=env.TENANTS_DB;
  if(!db) return errorResponse("Banco de transportadoras indisponivel.",503);
  const path=new URL(request.url).pathname;
  const action=path.slice(BASE.length);
  try {
    const cadastroDriveRoute=action.match(/^\/([a-z0-9-]+)\/cadastro-drive$/);
    if(cadastroDriveRoute){
      if(request.method!=="PUT")return errorResponse("Metodo nao permitido.",405);
      return cadastroAdminSave(request,env,cadastroDriveRoute[1]);
    }
    if(path===BASE && request.method==="POST") {
      const body=await jsonBody(request,["id","name"]);
      const id=body.id,name=body.name;
      if(!validId(id) || !validName(name)) return errorResponse("Identificador ou nome invalido.",400);
      if(await findTenant(db,id)) return errorResponse("Transportadora ja cadastrada.",409);
      const statements=[
        db.prepare("INSERT INTO portal_tenants (id,name,status) VALUES (?,?,'inactive')").bind(id,name.trim()),
        await audit(db,actor,id,"tenant.create",{name:name.trim(),status:"inactive"})
      ];
      await db.batch(statements);
      return success({transportadora:{id,name:name.trim(),active:false,modules:[]}},201);
    }
    const visual=action.match(/^\/([a-z0-9-]+)\/visual\/(logo-dark|logo-light|hero-art|hero-home)$/);
    if(visual){
      if(request.method!=="PUT")return errorResponse("Metodo nao permitido.",405);
      return writeTenantVisual(request,env,actor,visual[1],visual[2]);
    }
    const arts=action.match(/^\/([a-z0-9-]+)\/artes$/);
  if(arts){
    if(request.method!=="PUT")return errorResponse("Metodo nao permitido.",405);
    return writeTenantArtThemes(request,env,actor,arts[1]);
  }
  const brand=action.match(/^\/([a-z0-9-]+)\/logo$/);
    if(brand) {
      if(!validId(brand[1]))return errorResponse("Transportadora invalida.",400);
      if(request.method!=="PUT")return errorResponse("Metodo nao permitido.",405);
      return writeTenantLogo(request,env,actor,brand[1]);
    }
    const baseIntegration=action.match(/^\/([a-z0-9-]+)\/bases\/(GO|MT|SP|MS|BA|PR|SC|RO|TO|MA|AC|AL|AP|AM|CE|DF|ES|MG|PA|PB|PE|PI|RJ|RN|RS|RR|SE)\/integracao$/);
    if(baseIntegration){
      if(request.method!=="PUT")return errorResponse("Metodo nao permitido.",405);
      return adminWriteTenantIntegration(request,env,actor,baseIntegration[1],baseIntegration[2]);
    }
    const integration=action.match(/^\/([a-z0-9-]+)\/integracao$/);
    if(integration){
      if(request.method!=="PUT")return errorResponse("Metodo nao permitido.",405);
      return adminWriteTenantIntegration(request,env,actor,integration[1]);
    }
    const credentials=action.match(/^\/([a-z0-9-]+)\/usuarios\/([A-Za-z0-9._-]+)\/credenciais$/);
    if(credentials){
      if(request.method!=="PUT")return errorResponse("Metodo nao permitido.",405);
      return setTenantCredentials(request,env,actor,credentials[1],credentials[2]);
    }
    const membership=action.match(/^\/([a-z0-9-]+)\/usuarios(?:\/([A-Za-z0-9._-]+))?$/);
    if(membership) {
      if(!validId(membership[1]))return errorResponse("Transportadora invalida.",400);
      return writeTenantMembership(request,env,actor,membership[1],membership[2]||null);
    }
    const parts=action.match(/^\/([a-z0-9-]+)(\/modules)?$/);
    if(!parts || !(validId(parts[1])||parts[1]===LEGACY_NOVA_FROTA.id))return errorResponse("Rota de alteracao invalida.",404);
    const tenantId=parts[1];
    if(tenantId===LEGACY_NOVA_FROTA.id){
     if(parts[2]!=="/modules"||request.method!=="PUT")
      return errorResponse("Operação indisponível.",405);
     const body=await jsonBody(request,["modules"]);
     if(!Array.isArray(body.modules)||body.modules.length>NOVA_FROTA_MANAGED_MODULES.length||
        body.modules.some(key=>!NOVA_FROTA_MANAGED_MODULES.includes(key)))
      return errorResponse("Módulos inválidos.",400);
     try{
      const enabled=await saveNovaFrotaModules(env,body.modules,actor);
      return success({tenantId,modules:enabled});
     }catch(error){return errorResponse(error?.message==="Lista de módulos inválida."?
        "Lista de módulos inválida.":"Não foi possível salvar permissões da Nova Frota.",400);}
    }
    const existing=await findTenant(db,tenantId);
    if(!existing) return errorResponse("Transportadora nao encontrada.",404);
    if(!parts[2] && request.method==="PATCH") {
      const body=await jsonBody(request,["name","status"]);
      if(!hasOwn(body,"name") && !hasOwn(body,"status"))
        return errorResponse("Nenhuma alteracao informada.",400);
      const name=hasOwn(body,"name")?body.name:existing.name;
      const status=hasOwn(body,"status")?body.status:existing.status;
      if(!validName(name) || !validStatus(status)) return errorResponse("Dados invalidos.",400);
      await db.batch([
        db.prepare("UPDATE portal_tenants SET name=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(name.trim(),status,tenantId),
        await audit(db,actor,tenantId,"tenant.update",{name:name.trim(),status})
      ]);
      return success({transportadora:{id:tenantId,name:name.trim(),active:status==="active"}});
    }
    if(parts[2] && request.method==="PUT") {
      const body=await jsonBody(request,["modules"]);
      const modules=body.modules;
      if(!Array.isArray(modules) || modules.length>TENANT_MODULES.length ||
        new Set(modules).size!==modules.length ||
        modules.some(module=>typeof module!=="string" || !TENANT_MODULES.includes(module)))
        return errorResponse("Lista de modulos invalida.",400);
      const statements=[db.prepare("DELETE FROM portal_tenant_modules WHERE tenant_id=?").bind(tenantId)];
      for(const module of modules) statements.push(
        db.prepare("INSERT INTO portal_tenant_modules (tenant_id,module_key,enabled) VALUES (?,?,1)").bind(tenantId,module)
      );
      statements.push(await audit(db,actor,tenantId,"modules.update",{modules}));
      await db.batch(statements);
      return success({tenantId,modules});
    }
    return errorResponse("Metodo nao permitido.",405);
  } catch(error) {
    if(["too-large","invalid-json","invalid-fields"].includes(error?.message))
      return errorResponse("Corpo da solicitacao invalido.",400);
    return failDb(error);
  }
}
