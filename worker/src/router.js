import { healthController } from "./controllers/health.js";
import { gatewayTestController } from "./controllers/gateway.js";
import {
  loginController,
  logoutController,
  selectStateController,
  sessionController
} from "./controllers/session.js";
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

  if (path === "/v1/login") {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    return loginController(request, env);
  }

  if (path === "/v1/session") {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return sessionController(request, env);
  }

  if (path === "/v1/session/state") {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    return selectStateController(request, env);
  }

  if (path === "/v1/logout") {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    return logoutController(request, env);
  }

  return notFound();
}
