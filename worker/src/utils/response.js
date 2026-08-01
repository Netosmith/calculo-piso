const BASE_HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer"
};

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...BASE_HEADERS, ...extraHeaders }
  });
}

export function success(data = {}, status = 200, extraHeaders = {}) {
  return jsonResponse({ ok: true, ...data }, status, extraHeaders);
}

export function errorResponse(message = "Erro interno.", status = 500, details) {
  const body = { ok: false, error: message };
  if (details !== undefined) body.details = details;
  return jsonResponse(body, status);
}

export function notFound() {
  return errorResponse("Rota não encontrada.", 404);
}

export function methodNotAllowed(allowed = []) {
  return jsonResponse(
    { ok: false, error: "Método HTTP não permitido." },
    405,
    allowed.length ? { Allow: allowed.join(", ") } : {}
  );
}
