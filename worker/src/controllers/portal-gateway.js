import { callAppsScript } from "../services/appscript.js";
import { getSession, readSessionId } from "../services/session.js";
import { canRunGatewayAction, MODULE_ACTIONS } from "../services/permissions.js";
import { readJson } from "../utils/validation.js";
import { errorResponse, success } from "../utils/response.js";

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function safeParams(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function gatewayErrorMessage(error) {
  const message = String(error?.message || error || "").trim();

  if (!message) {
    return "Falha na comunicação segura com o Apps Script.";
  }

  const lower = message.toLowerCase();
  const safePrefixes = [
    "tempo limite excedido",
    "resposta inválida do apps script",
    "apps script respondeu",
    "falha ao enviar",
    "arquivo"
  ];

  if (safePrefixes.some((prefix) => lower.startsWith(prefix))) {
    return message;
  }

  return "Falha na comunicação segura com o Apps Script.";
}

export async function portalGatewayController(request, env) {
  const sessionId = readSessionId(request);
  const session = await getSession(env, sessionId);

  if (!session) {
    return errorResponse("Sessão inválida ou expirada.", 401);
  }

  if (!session.estado) {
    return errorResponse("Selecione um estado antes de acessar os módulos.", 409);
  }

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return errorResponse(error.message, 400);
  }

  const moduleName = normalizeKey(body.module);
  const actionName = normalizeKey(body.action);
  const params = safeParams(body.params);

  if (!moduleName || !actionName) {
    return errorResponse("Informe módulo e ação.", 400);
  }

  if (!MODULE_ACTIONS[moduleName]) {
    console.warn("[GATEWAY] Módulo recusado", {
      usuario: session.usuario,
      perfil: session.perfil,
      estado: session.estado,
      moduleName,
      actionName
    });
    return errorResponse("Módulo não autorizado.", 403);
  }

  if (!canRunGatewayAction(session, moduleName, actionName, params)) {
    console.warn("[GATEWAY] Ação recusada", {
      usuario: session.usuario,
      perfil: session.perfil,
      estado: session.estado,
      moduleName,
      actionName
    });
    return errorResponse("Ação não autorizada para este perfil.", 403);
  }

  try {
    const result = await callAppsScript(env, {
      action: "portal_gateway",
      method: "POST",
      params: {
        module: moduleName,
        action: actionName,
        payload: params,
        auth: {
          usuario: session.usuario,
          nome: session.nome,
          perfil: session.perfil,
          estado: session.estado,
          estados: session.estados
        }
      }
    });

    if (!result?.ok) {
      return errorResponse(
        result?.error || "O Apps Script recusou a operação.",
        Number(result?.status) || 502,
        result?.details
      );
    }

    return success({
      module: moduleName,
      action: actionName,
      data: result.data ?? result
    });
  } catch (error) {
    const message = gatewayErrorMessage(error);
    const isTimeout = message.toLowerCase().includes("tempo limite excedido");

    console.error("[GATEWAY] Falha ao chamar Apps Script", {
      moduleName,
      actionName,
      resource: normalizeKey(params.resource),
      message: String(error?.message || error)
    });

    return errorResponse(
      message,
      isTimeout ? 504 : 502
    );
  }
}
