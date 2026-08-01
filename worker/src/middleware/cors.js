import { ALLOWED_ORIGINS } from "../config.js";

export function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) return null;

  return {
    "Access-Control-Allow-Origin": origin || "https://portalfrete.pages.dev",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
