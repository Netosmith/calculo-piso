import { getSession, readSessionId } from "../services/session.js";
import { errorResponse, success } from "../utils/response.js";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp"
]);

function normalizeClientName(value) {
  const name = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
    .normalize("NFC");

  if (!name) throw new Error("Informe o cliente.");
  if (name.length > 140) throw new Error("Nome do cliente muito longo.");
  return name;
}

function clientLogoKey(clientName) {
  return `clientes/${encodeURIComponent(clientName)}`;
}

function isAdministrator(session) {
  return String(session?.perfil || "").trim().toUpperCase() === "ADMINISTRADOR";
}

async function requireAdministrator(request, env) {
  const session = await getSession(env, readSessionId(request));
  if (!session) return { error: errorResponse("Sessão inválida ou expirada.", 401) };
  if (!isAdministrator(session)) {
    return { error: errorResponse("Ação permitida somente ao administrador.", 403) };
  }
  return { session };
}

function validImageSignature(contentType, bytes) {
  const u8 = new Uint8Array(bytes);

  if (contentType === "image/png") {
    return (
      u8.length >= 8 &&
      u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47 &&
      u8[4] === 0x0d && u8[5] === 0x0a && u8[6] === 0x1a && u8[7] === 0x0a
    );
  }

  if (contentType === "image/jpeg") {
    return u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff;
  }

  if (contentType === "image/webp") {
    return (
      u8.length >= 12 &&
      u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 &&
      u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50
    );
  }

  return false;
}

function decodeClientName(encodedClientName) {
  try {
    return normalizeClientName(decodeURIComponent(encodedClientName || ""));
  } catch {
    throw new Error("Cliente inválido.");
  }
}

function objectHeaders(object) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.get("Content-Type")) headers.set("Content-Type", "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=300, must-revalidate");
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Disposition", "inline");
  return headers;
}

export async function clientLogoController(request, env, encodedClientName) {
  if (!env.CLIENT_LOGOS) {
    return errorResponse("Armazenamento de logos não configurado.", 503);
  }

  let clientName;
  try {
    clientName = decodeClientName(encodedClientName);
  } catch (error) {
    return errorResponse(error.message, 400);
  }

  const key = clientLogoKey(clientName);

  if (request.method === "GET") {
    const object = await env.CLIENT_LOGOS.get(key);
    if (!object || !object.body) return errorResponse("Logo não encontrada.", 404);

    return new Response(object.body, {
      status: 200,
      headers: objectHeaders(object)
    });
  }

  if (request.method === "HEAD") {
    const object = await env.CLIENT_LOGOS.head(key);
    if (!object) return new Response(null, { status: 404 });

    return new Response(null, {
      status: 200,
      headers: objectHeaders(object)
    });
  }

  if (request.method === "PUT") {
    const auth = await requireAdministrator(request, env);
    if (auth.error) return auth.error;

    const contentType = String(request.headers.get("Content-Type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return errorResponse("Formato inválido. Use PNG, JPG/JPEG ou WEBP.", 415);
    }

    const declaredSize = Number(request.headers.get("Content-Length") || 0);
    if (declaredSize > MAX_LOGO_BYTES) {
      return errorResponse("A imagem deve ter no máximo 2 MB.", 413);
    }

    const bytes = await request.arrayBuffer();

    if (!bytes.byteLength) return errorResponse("Arquivo de imagem vazio.", 400);
    if (bytes.byteLength > MAX_LOGO_BYTES) {
      return errorResponse("A imagem deve ter no máximo 2 MB.", 413);
    }

    if (!validImageSignature(contentType, bytes)) {
      return errorResponse("O conteúdo do arquivo não corresponde a uma imagem válida.", 415);
    }

    const stored = await env.CLIENT_LOGOS.put(key, bytes, {
      httpMetadata: {
        contentType,
        cacheControl: "public, max-age=300, must-revalidate"
      },
      customMetadata: {
        cliente: clientName,
        atualizadoPor: String(auth.session.usuario || "").slice(0, 100),
        atualizadoEm: new Date().toISOString()
      }
    });

    return success({
      cliente: clientName,
      size: bytes.byteLength,
      contentType,
      etag: stored?.etag || ""
    });
  }

  if (request.method === "DELETE") {
    const auth = await requireAdministrator(request, env);
    if (auth.error) return auth.error;

    await env.CLIENT_LOGOS.delete(key);

    return success({
      cliente: clientName,
      deleted: true
    });
  }

  return errorResponse("Método HTTP não permitido.", 405);
}
