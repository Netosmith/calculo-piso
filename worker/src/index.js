import { routeRequest } from "./router.js";
import { handlePreflight, corsHeaders } from "./middleware/cors.js";
import {
  validateRuntimeSecrets,
  rejectUnknownOrigin
} from "./middleware/security.js";
import { logRequest, logError } from "./middleware/logger.js";
import { errorResponse } from "./utils/response.js";

export default {
  async fetch(request, env) {
    logRequest(request);

    if (request.method === "OPTIONS") {
      return handlePreflight(request);
    }

    const cors = corsHeaders(request);
    const originError = rejectUnknownOrigin(request, cors);
    if (originError) return originError;

    const missingSecrets = validateRuntimeSecrets(env);
    if (missingSecrets.length) {
      return errorResponse(
        "Configuração incompleta do Worker.",
        500,
        `Secrets ausentes: ${missingSecrets.join(", ")}`
      );
    }

    try {
      const response = await routeRequest(request, env);
      if (!cors) return response;

      const headers = new Headers(response.headers);
      Object.entries(cors).forEach(([key, value]) => headers.set(key, value));

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      logError(error);
      return errorResponse("Erro interno da API.", 500);
    }
  }
};
