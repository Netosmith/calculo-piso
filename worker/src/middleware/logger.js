export function logRequest(request, extra = {}) {
  const url = new URL(request.url);
  console.log(JSON.stringify({
    type: "request",
    method: request.method,
    path: url.pathname,
    cfRay: request.headers.get("cf-ray") || "",
    country: request.cf?.country || "",
    timestamp: new Date().toISOString(),
    ...extra
  }));
}

export function logError(error, extra = {}) {
  console.error(JSON.stringify({
    type: "error",
    message: String(error?.message || error),
    timestamp: new Date().toISOString(),
    ...extra
  }));
}
