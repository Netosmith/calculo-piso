import { getSession, readSessionId } from "../services/session.js";
import { errorResponse, success } from "../utils/response.js";

// Bootstrap restrito: conta existente autenticada pelo Apps Script.
// O papel global NÃO pode ser atribuído via cadastro comum.
export async function superAdminController(request, env) {
  if (request.method !== "GET") return errorResponse("Método não permitido.",405);
  const session = await getSession(env, readSessionId(request));
  if (!session) return errorResponse("Sessão inválida ou expirada.",401);
  const isOwner = String(session.usuario || "").trim().toUpperCase() === "LUZIANO";
  if (!isOwner) return errorResponse("Acesso exclusivo do Super Admin.",403);
  const path = new URL(request.url).pathname;
  if (path === "/v1/super-admin/me") return success({superAdmin:true,usuario:session.usuario});
  if (path === "/v1/super-admin/transportadoras") {
    // Sem persistência provisionada: não inventar empresas nem conceder acesso cruzado.
    return success({transportadoras:[]});
  }
  return errorResponse("Recurso administrativo não implementado.",404);
}
