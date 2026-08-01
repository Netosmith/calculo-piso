import { healthController } from "./controllers/health.js";
import { gatewayTestController } from "./controllers/gateway.js";
import { notFound, methodNotAllowed } from "./utils/response.js";

export async function routeRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/health") {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return healthController();
  }

  if (path === "/v1/gateway-test") {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return gatewayTestController(env);
  }

  return notFound();
}
