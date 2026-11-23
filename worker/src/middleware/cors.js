import { ALLOWED_ORIGINS } from "../config.js";

// O site institucional só pode ler os fretes publicados deliberadamente.
// Não concede CORS para login, dados operacionais ou escrita.
const NOVA_FROTA_SITE_ORIGIN = "https://netosmith.github.io";
const PUBLIC_FREIGHTS_PATH = "/v1/driver-freights";

function isInstitutionalPublicFreightRead(request, origin) {
  if (origin !== NOVA_FROTA_SITE_ORIGIN) return false;
  let pathname;
  try {
    pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return false;
  }
  if (pathname !== PUBLIC_FREIGHTS_PATH) return false;
  if (request.method === "GET" || request.method === "HEAD") return true;
  if (request.method === "OPTIONS") {
    const requested = String(request.headers.get("Access-Control-Request-Method") || "").toUpperCase();
    return requested === "GET" || requested === "HEAD";
  }
  return false;
}

export function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  if (isInstitutionalPublicFreightRead(request, origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      // Esta rota não requer, não recebe nem autoriza cookies.
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type",
      "Access-Control-Max-Age": "3600",
      "Vary": "Origin"
    };
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) return null;

  return {
    "Access-Control-Allow-Origin": origin || "https://portalfrete.net.br",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Portal-Super-Admin-Action, X-Portal-Support-Tenant, X-Monitor-Token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export function handlePreflight(request) {
  const headers = corsHeaders(request);
  return headers
    ? new Response(null, { status: 204, headers })
    : new Response(null, { status: 403 });
}
