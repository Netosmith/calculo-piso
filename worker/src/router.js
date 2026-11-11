import { superAdminController } from "./controllers/super-admin.js";
import { modulePinController } from "./controllers/module-pin.js";
import { fleetController } from "./controllers/fleet.js";
import { monitorController } from "./controllers/monitor.js";
import {driverFreightsController} from "./controllers/driver-freights.js";
import { employeesController } from "./controllers/employees.js";
import {gamesController} from "../../games/server/api.js";
import { healthController } from "./controllers/health.js";
import { gatewayTestController } from "./controllers/gateway.js";
import { portalGatewayController } from "./controllers/portal-gateway.js";
import { clientLogoController } from "./controllers/client-logos.js";
import { maintenanceController } from "./controllers/maintenance.js";
import {
  loginController,
  logoutController,
  selectStateController,
  sessionController
} from "./controllers/session.js";
import { notFound, methodNotAllowed } from "./utils/response.js";
import { pingoController } from "./controllers/pingochic.js";
import {publicTenantsController,tenantApiController,tenantContextController} from "./controllers/tenant-unified.js";
import {hasTenantSessionCookie} from "./services/tenant-auth.js";
import {errorResponse} from "./utils/response.js";
import {cadastroController} from "./controllers/cadastro-solicitacoes.js";
import {trocaNotasController} from "./controllers/troca-notas.js";
import {aberturaPedidosController} from "./controllers/abertura-pedidos.js";

export async function routeRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if(path==="/v1/transportadoras/public")return publicTenantsController(request,env);
  if(path==="/v1/tenant/context")return tenantContextController(request,env);
  if(path.startsWith("/v1/tenant/"))return tenantApiController(request,env);
  if(path==="/v1/cadastro-solicitacoes"||path.startsWith("/v1/cadastro-solicitacoes/"))return cadastroController(request,env);
  if(path==="/v1/troca-notas"||path.startsWith("/v1/troca-notas/"))return trocaNotasController(request,env);
  if(path==="/v1/abertura-pedidos"||path.startsWith("/v1/abertura-pedidos/"))return aberturaPedidosController(request,env);

  // A consulta lê somente ofertas publicadas deliberadamente. Nenhum dado interno de tenant.
  if(path==="/v1/driver-freights"&&request.method==="GET")return driverFreightsController(request,env);

  // Never route a tenant browser context into Nova Frota legacy APIs,
  // even if another signed cookie remains present.
  // Client brand images are intentionally common to all transportadoras.
  // Tenant cookies may GET/HEAD a public client logo, but NEVER write it or
  // access any other legacy Nova Frota API endpoint.
  const sharedLogoRead=path.startsWith("/v1/client-logos/") &&
    ["GET","HEAD"].includes(request.method);
  if(hasTenantSessionCookie(request) &&
     !sharedLogoRead &&
     !["/v1/login","/v1/session","/v1/logout","/health"].includes(path))
    return errorResponse("Recurso exclusivo da operacao legada.",403);

  if (path.startsWith("/v1/module-pin/")) return modulePinController(request, env);
  if (path.startsWith("/v1/super-admin/")) return superAdminController(request, env);

  if (path.startsWith("/v1/fleet/")) return fleetController(request, env);
  if (path.startsWith("/v1/monitor/")) return monitorController(request, env);
  if (path.startsWith("/v1/driver-freights/")) return driverFreightsController(request,env);
  if (path === "/v1/funcionarios" || path.startsWith("/v1/funcionarios/")) return employeesController(request, env);

  if (path === "/v1/pingo" || path.startsWith("/v1/pingo/")) return pingoController(request, env);

  // Inclui /v1/games/lotofacil/combination: acesso, PIN e perfil permanecem sob gamesController.
  if (path === "/v1/games" || path.startsWith("/v1/games/")) return gamesController(request, env);

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

  if (path === "/v1/maintenance") {
    if (!["GET", "POST"].includes(request.method)) return methodNotAllowed(["GET", "POST"]);
    return maintenanceController(request, env);
  }

  if (path === "/v1/gateway") {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    return portalGatewayController(request, env, ctx);
  }

  if (path.startsWith("/v1/client-logos/")) {
    if (!["GET", "HEAD", "PUT", "DELETE"].includes(request.method)) {
      return methodNotAllowed(["GET", "HEAD", "PUT", "DELETE"]);
    }
    const encodedClientName = path.slice("/v1/client-logos/".length);
    return clientLogoController(request, env, encodedClientName);
  }

  return notFound();
}
