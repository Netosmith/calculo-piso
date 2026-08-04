import { APP_SCRIPT_TIMEOUT_MS } from "../config.js";

const RETRYABLE_MODULES = new Set([
  "home",
  "fretes",
  "fretes2",
  "fretes-mercado",
  "bi",
  "share",
  "controle",
  "cadastros",
  "administrativo",
  "estadias",
  "patrimonio",
  "custo-filial"
]);

function requestContext(payload) {
  const outerAction = String(payload?.action || "").toLowerCase();
  const gatewayParams = payload?.params;
  const isGatewayRequest =
    outerAction === "portal_gateway" &&
    gatewayParams &&
    typeof gatewayParams === "object" &&
    !Array.isArray(gatewayParams);

  return {
    outerAction,
    module: String(
      isGatewayRequest ? gatewayParams.module : payload?.module || ""
    ).toLowerCase(),
    action: String(
      isGatewayRequest ? gatewayParams.action : payload?.action || ""
    ).toLowerCase(),
    params: isGatewayRequest
      ? gatewayParams.payload
      : payload?.params
  };
}

function isTransientError(error) {
  const message = String(error?.message || error || "").toLowerCase();

  return (
    error?.name === "AbortError" ||
    message.includes("aborted") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("temporarily") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504")
  );
}

function shouldRetry(payload, attempt, error) {
  if (attempt >= 2 || !isTransientError(error)) return false;

  const context = requestContext(payload);
  const isRetryableRead =
    context.action === "read" &&
    RETRYABLE_MODULES.has(context.module);
  const isRetryableLogin = context.outerAction === "login";
  const isIdempotentFretesWrite =
    context.module === "fretes" &&
    (context.action === "create" || context.action === "update") &&
    Boolean(String(context.params?.id || "").trim());

  return isRetryableRead || isRetryableLogin || isIdempotentFretesWrite;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeAppsScriptRequest(env, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APP_SCRIPT_TIMEOUT_MS);

  try {
    const response = await fetch(env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        gatewayRequest: true,
        gatewayKey: env.PORTAL_KEY,
        ...payload
      }),
      signal: controller.signal,
      redirect: "follow"
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Resposta inválida do Apps Script (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(data?.error || `Apps Script respondeu HTTP ${response.status}.`);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function callAppsScript(env, payload) {
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await executeAppsScriptRequest(env, payload);
    } catch (error) {
      lastError = error;

      if (!shouldRetry(payload, attempt, error)) {
        throw error;
      }

      await wait(700 * attempt);
    }
  }

  throw lastError || new Error("Falha na comunicação segura com o Apps Script.");
}
