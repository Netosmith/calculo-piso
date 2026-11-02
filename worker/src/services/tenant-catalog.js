import { validateNewTenant, validateTenantStatus, validateTenantModuleChange } from "../config/tenant-validation.js";

// Serviço isolado: não é exposto por nenhuma rota HTTP.
// Requer TENANTS_DB dedicado, com migrations aplicadas e auditoria na mesma transação.
function requireDb(env) {
  if (!env?.TENANTS_DB) throw new Error("TENANTS_DB não configurado");
  return env.TENANTS_DB;
}
function actorId(actor) {
  const value = typeof actor === "string" ? actor.trim() : "";
  if (!value || value.length > 120) throw new Error("Ator inválido");
  return value;
}
function audit(db, actor, tenantId, action, details) {
  return db.prepare("INSERT INTO portal_tenant_audit(id,actor_id,tenant_id,action,detail_json) VALUES(?,?,?,?,?)")
    .bind(crypto.randomUUID(),actorId(actor),tenantId,action,JSON.stringify(details));
}
async function transact(db, statements) {
  if (typeof db.batch !== "function") throw new Error("Transações D1 indisponíveis");
  return db.batch(statements);
}
export async function createTenant(env, actor, input) {
  const checked=validateNewTenant(input);
  if (!checked.ok) return checked;
  const db=requireDb(env),{id,name,status}=checked.value;
  await transact(db,[
    db.prepare("INSERT INTO portal_tenants(id,name,status) VALUES(?,?,?)").bind(id,name,status),
    audit(db,actor,id,"tenant.create",{name,status})
  ]);
  return {ok:true,value:{id,name,active:false}};
}
export async function changeTenantStatus(env, actor, tenantId, input) {
  const checked=validateTenantStatus(input);
  if (!checked.ok) return checked;
  if (tenantId==="nova-frota") return {ok:false,error:"A transportadora legada exige processo de desativação específico."};
  const db=requireDb(env),status=checked.value.status;
  await transact(db,[
    db.prepare("UPDATE portal_tenants SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,tenantId),
    audit(db,actor,tenantId,"tenant.status",{status})
  ]);
  return {ok:true,value:{tenantId,status}};
}
export async function changeTenantModule(env, actor, tenantId, input) {
  const checked=validateTenantModuleChange(input);
  if (!checked.ok) return checked;
  if (tenantId==="nova-frota") return {ok:false,error:"Os módulos legados não podem ser alterados nesta fase."};
  const db=requireDb(env),{module,enabled}=checked.value;
  await transact(db,[
    db.prepare("INSERT INTO portal_tenant_modules(tenant_id,module_key,enabled) VALUES(?,?,?) ON CONFLICT(tenant_id,module_key) DO UPDATE SET enabled=excluded.enabled,updated_at=CURRENT_TIMESTAMP")
      .bind(tenantId,module,enabled?1:0),
    audit(db,actor,tenantId,"tenant.module",{module,enabled})
  ]);
  return {ok:true,value:{tenantId,module,enabled}};
}
