const SESSION_TTL_SECONDS = 12 * 60 * 60;
const COOKIE_NAME = "__Host-portal_session";

function bytesToHex(bytes) {
  return [...bytes]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createSessionId() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function sessionCookie(sessionId) {
  return [
    `${COOKIE_NAME}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${SESSION_TTL_SECONDS}`
  ].join("; ");
}

export function clearSessionCookie() {
  return [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Max-Age=0"
  ].join("; ");
}

export function readSessionId(request) {
  const cookieHeader = request.headers.get("Cookie") || "";

  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === COOKIE_NAME) {
      return valueParts.join("=").trim();
    }
  }

  return "";
}

export async function saveSession(env, sessionId, session) {
  await env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: SESSION_TTL_SECONDS }
  );
}

export async function getSession(env, sessionId) {
  if (!sessionId) return null;

  return env.SESSIONS.get(`session:${sessionId}`, {
    type: "json"
  });
}

export async function deleteSession(env, sessionId) {
  if (!sessionId) return;
  await env.SESSIONS.delete(`session:${sessionId}`);
}

export function sessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}
