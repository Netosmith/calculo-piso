// Projection for a future server-side Apps Script integration.
// Never return source objects: legacy records may include private fields.
const ALLOWED_ROLES = new Set(["ADMINISTRADOR","OPERACIONAL","COMERCIAL","PISO","GOADM","MT","PR"]);
const MAX_USERS = 500;

function clean(value, limit = 160) {
  return String(value ?? "").trim().slice(0, limit);
}

export function projectLegacyUsers(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Resposta de usuarios invalida.");
  if (rows.length > MAX_USERS) throw new RangeError("Quantidade de usuarios excede o limite.");
  return rows.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new TypeError("Registro de usuario invalido.");
    }
    const usuario = clean(row.Usuario, 80).toUpperCase();
    const perfil = clean(row.Perfil, 40).toUpperCase();
    const ativo = clean(row.Ativo, 12).toUpperCase();
    if (!usuario || !ALLOWED_ROLES.has(perfil) || !["SIM","NÃO","NAO"].includes(ativo)) {
      throw new TypeError("Registro de usuario incompleto ou desconhecido.");
    }
    return {
      usuario,
      nome: clean(row.Nome),
      perfil,
      estados: clean(row.Estados, 200),
      ativo: ativo === "SIM"
    };
  });
}
