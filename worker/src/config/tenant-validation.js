import { validTenantModule } from "./tenant-modules.js";

const ID_PATTERN = /^[a-z][a-z0-9-]{2,49}$/;
const RESERVED = new Set(["nova-frota", "admin", "super-admin", "root", "system"]);

export function validateNewTenant(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {ok:false,error:"Dados inválidos."};
  const id = typeof input.id === "string" ? input.id.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!ID_PATTERN.test(id) || id.endsWith("-") || id.includes("--") || RESERVED.has(id))
    return {ok:false,error:"Identificador de transportadora inválido ou reservado."};
  if (name.length < 3 || name.length > 120 || /[<>\x00-\x1f]/.test(name))
    return {ok:false,error:"Nome da transportadora inválido."};
  return {ok:true,value:{id,name,status:"inactive"}};
}

export function validateTenantStatus(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || typeof input.active !== "boolean")
    return {ok:false,error:"Status inválido."};
  return {ok:true,value:{status:input.active?"active":"inactive"}};
}

export function validateTenantModuleChange(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      !validTenantModule(input.module) || typeof input.enabled !== "boolean")
    return {ok:false,error:"Módulo ou estado inválido."};
  return {ok:true,value:{module:input.module,enabled:input.enabled}};
}
