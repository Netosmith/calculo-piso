import { errorResponse } from "../utils/response.js";

export function validateRuntimeSecrets(env) {
  const missing = [];
  if (!env.APPS_SCRIPT_URL) missing.push("APPS_SCRIPT_URL");
  if (!env.PORTAL_KEY) missing.push("PORTAL_KEY");
  return missing;
}

export function rejectUnknownOrigin(request, cors) {
  const origin = request.headers.get("Origin");
  if (origin && !cors) return errorResponse("Origem não autorizada.", 403);
  return null;
}
