import { getSession, readSessionId } from "../services/session.js";
import {
  getMaintenanceState,
  isAdministrator,
  setMaintenanceState
} from "../services/maintenance.js";
import { readJson } from "../utils/validation.js";
import { errorResponse, success } from "../utils/response.js";

export async function maintenanceController(request, env) {
  if (request.method === "GET") {
    const maintenance = await getMaintenanceState(env);
    return success({ maintenance });
  }

  if (request.method === "POST") {
    const session = await getSession(env, readSessionId(request));

    if (!session) {
      return errorResponse("Sessão inválida ou expirada.", 401);
    }

    if (!isAdministrator(session)) {
      return errorResponse("Somente ADMINISTRADOR pode alterar o modo de manutenção.", 403);
    }

    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      return errorResponse(error.message, 400);
    }

    if (typeof body.enabled !== "boolean") {
      return errorResponse("Informe enabled como true ou false.", 400);
    }

    const maintenance = await setMaintenanceState(env, {
      enabled: body.enabled,
      message: body.message,
      updatedBy: session.usuario
    });

    return success({ maintenance });
  }

  return errorResponse("Método HTTP não permitido.", 405);
}
