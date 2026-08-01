/**
 * Portal Frete API Gateway
 * Cloudflare Worker
 */

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
  "Cache-Control": "no-store"
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...extraHeaders
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "https://portalfrete.pages.dev",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "Portal Frete API",
        status: "online",
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === "/secret-test" && request.method === "GET") {
      return json({
        ok: true,
        appsScriptConfigured: Boolean(env.APPS_SCRIPT_URL),
        portalKeyConfigured: Boolean(env.PORTAL_KEY)
      });
    }

    return json(
      {
        ok: false,
        error: "Rota não encontrada."
      },
      404
    );
  }
};
