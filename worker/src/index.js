// redeploy 2026-10-05: restaurar disponibilidade da API Pingo Chic
export {PingoStore} from "./pingochic/store-do-portal.js";
export {SinucaRoom} from "../../games/server/sinuca.js";
export {CineAccess} from "../../games/server/cine-access.js";
export {GamesRoom} from "../../games/server/rooms.js";
import { routeRequest } from "./router.js";
import { handlePreflight, corsHeaders } from "./middleware/cors.js";
import {
  validateRuntimeSecrets,
  rejectUnknownOrigin
} from "./middleware/security.js";
import { logRequest, logError } from "./middleware/logger.js";
import { errorResponse } from "./utils/response.js";

function withCors(response, cors) {
  if (!cors || response.webSocket) return response;

  const headers = new Headers(response.headers);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env, ctx) {
    logRequest(request);

    if (request.method === "OPTIONS") {
      return handlePreflight(request);
    }

    const cors = corsHeaders(request);
    const originError = rejectUnknownOrigin(request, cors);
    if (originError) return originError;

    const missingSecrets = validateRuntimeSecrets(env);
    if (missingSecrets.length) {
      return withCors(
        errorResponse(
          "Configuração incompleta do Worker.",
          500,
          `Secrets ausentes: ${missingSecrets.join(", ")}`
        ),
        cors
      );
    }

    try {
      const response = await routeRequest(request, env, ctx);
      return withCors(response, cors);
    } catch (error) {
      logError(error);
      return withCors(errorResponse("Erro interno da API.", 500), cors);
    }
  }
};
