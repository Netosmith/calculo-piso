const SESSION_TTL_SECONDS = 12 * 60 * 60;
const COOKIE_NAME = "__Host-portal_session";
const TOKEN_PREFIX = "v1";

function bytesToHex(bytes) {
  return [...bytes]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecodeBytes(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function encodeJson(value) {
  return base64UrlEncodeBytes(
    new TextEncoder().encode(JSON.stringify(value))
  );
}

function decodeJson(value) {
  return JSON.parse(
    new TextDecoder().decode(base64UrlDecodeBytes(value))
  );
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret || "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signPayload(secret, payload) {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

async function verifyPayload(secret, payload, signature) {
  try {
    const key = await hmacKey(secret);
    return crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecodeBytes(signature),
      new TextEncoder().encode(payload)
    );
  } catch {
    return false;
  }
}

export function createSessionId() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function createSessionToken(env, session) {
  const secret = String(env?.PORTAL_KEY || "");
  if (!secret) throw new Error("Chave de assinatura da sessão indisponível.");

  const payload = encodeJson({
    ...session,
    tokenVersion: 1
  });
  const signature = await signPayload(secret, payload);
  return `${TOKEN_PREFIX}.${payload}.${signature}`;
}

export function sessionCookie(sessionToken) {
  return [
    `${COOKIE_NAME}=${sessionToken}`,
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
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
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
  // Compatibilidade com sessões legadas. Novos logins usam cookie assinado
  // e não dependem mais de escrita no KV.
  await env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: SESSION_TTL_SECONDS }
  );
}

async function getSignedSession(env, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;

  const [, payload, signature] = parts;
  const secret = String(env?.PORTAL_KEY || "");
  if (!secret) return null;

  const valid = await verifyPayload(secret, payload, signature);
  if (!valid) return null;

  let session;
  try {
    session = decodeJson(payload);
  } catch {
    return null;
  }

  const expiresAt = Date.parse(String(session?.expiresAt || ""));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  return session;
}

export async function getSession(env, sessionId) {
  if (!sessionId) return null;

  if (String(sessionId).startsWith(`${TOKEN_PREFIX}.`)) {
    return getSignedSession(env, sessionId);
  }

  // Compatibilidade temporária com cookies antigos armazenados no KV.
  try {
    return await env.SESSIONS.get(`session:${sessionId}`, {
      type: "json"
    });
  } catch {
    return null;
  }
}

export async function deleteSession(env, sessionId) {
  if (!sessionId) return;

  // Sessões stateless são encerradas removendo o cookie.
  if (String(sessionId).startsWith(`${TOKEN_PREFIX}.`)) return;

  // Sessão legada: tentamos remover do KV sem impedir o logout caso
  // a cota diária de escrita já tenha sido atingida.
  try {
    await env.SESSIONS.delete(`session:${sessionId}`);
  } catch (error) {
    console.warn("[SESSION] Não foi possível excluir sessão legada do KV", {
      message: String(error?.message || error)
    });
  }
}

export function sessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}
