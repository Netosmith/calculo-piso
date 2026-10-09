import { callAppsScript } from "../services/appscript.js";
import {
  clearSessionCookie,
  createSessionToken,
  deleteSession,
  getSession,
  readSessionId,
  sessionCookie,
  sessionTtlSeconds
} from "../services/session.js";
import { readJson } from "../utils/validation.js";
import { errorResponse, success } from "../utils/response.js";

function normalizeUpper(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function publicSession(session) {
  return {
    usuario: session.usuario,
    nome: session.nome,
    perfil: session.perfil,
    estados: session.estados,
    estado: session.estado || "",
    expiresAt: session.expiresAt
  };
}

export async function loginController(request, env) {
  let body;

  try {
    body = await readJson(request);
  } catch (error) {
    return errorResponse(error.message, 400);
  }

  const usuario = normalizeUpper(body.usuario);
  const senha = String(body.senha || "").trim();

  if (!usuario || !senha) {
    return errorResponse("Informe usuário e senha.", 400);
  }

  let result;

  try {
    result = await callAppsScript(env, {
      action: "login",
      method: "POST",
      params: { usuario, senha }
    });
  } catch (error) {
    console.error("[LOGIN] Falha ao consultar Apps Script", {
      message: String(error?.message || error)
    });
    return errorResponse("Falha ao consultar o cadastro de usuários.", 502, {
      stage: "apps_script"
    });
  }

  if (!result?.ok) {
    return errorResponse(result?.error || "Usuário ou senha inválidos.", 401);
  }

  let estados;
  try {
    estados = Array.isArray(result.states)
      ? result.states.map(normalizeUpper).filter(Boolean)
      : [];
  } catch (error) {
    console.error("[LOGIN] Falha ao normalizar estados", {
      message: String(error?.message || error)
    });
    return errorResponse("Falha ao processar as permissões do usuário.", 500, {
      stage: "states"
    });
  }

  if (!estados.length) {
    return errorResponse("Usuário sem estado liberado.", 403);
  }

  const now = Date.now();
  const session = {
    usuario: normalizeUpper(result.usuario || usuario),
    nome: String(result.nome || result.usuario || usuario).trim(),
    perfil: normalizeUpper(result.perfil || "OPERACIONAL"),
    estados,
    estado: "",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + sessionTtlSeconds() * 1000).toISOString()
  };

  let sessionToken;
  try {
    sessionToken = await createSessionToken(env, session);
  } catch (error) {
    console.error("[LOGIN] Falha ao assinar sessão", {
      message: String(error?.message || error)
    });
    return errorResponse("Falha ao criar a sessão do Portal.", 500, {
      stage: "session_token"
    });
  }

  try {
    return success(
      {
        session: publicSession(session),
        requiresStateSelection: estados.length > 1
      },
      200,
      { "Set-Cookie": sessionCookie(sessionToken) }
    );
  } catch (error) {
    console.error("[LOGIN] Falha ao montar resposta", {
      message: String(error?.message || error)
    });
    return errorResponse("Falha ao concluir o login.", 500, {
      stage: "response"
    });
  }
}

export async function sessionController(request, env) {
  const sessionId = readSessionId(request);
  const session = await getSession(env, sessionId);

  if (!session) {
    return errorResponse("Sessão inválida ou expirada.", 401);
  }

  return success({ session: publicSession(session) });
}

export async function selectStateController(request, env) {
  const sessionId = readSessionId(request);
  const session = await getSession(env, sessionId);

  if (!session) {
    return errorResponse("Sessão inválida ou expirada.", 401);
  }

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return errorResponse(error.message, 400);
  }

  const estado = normalizeUpper(body.estado);

  if (!estado || !session.estados.includes(estado)) {
    return errorResponse("Estado não autorizado para este usuário.", 403);
  }

  session.estado = estado;

  let sessionToken;
  try {
    sessionToken = await createSessionToken(env, session);
  } catch (error) {
    console.error("[SESSION] Falha ao atualizar cookie assinado", {
      message: String(error?.message || error)
    });
    return errorResponse("Não foi possível atualizar a sessão.", 500);
  }

  return success(
    { session: publicSession(session) },
    200,
    { "Set-Cookie": sessionCookie(sessionToken) }
  );
}

export async function logoutController(request, env) {
  const sessionId = readSessionId(request);
  await deleteSession(env, sessionId);

  return success(
    { loggedOut: true },
    200,
    { "Set-Cookie": clearSessionCookie() }
  );
}
