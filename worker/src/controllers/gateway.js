import { success, errorResponse } from "../utils/response.js";
import { callAppsScript } from "../services/appscript.js";

export async function gatewayTestController(env) {
  try {
    const result = await callAppsScript(env, {
      action: "gateway_ping",
      method: "GET",
      params: {}
    });

    if (!result?.ok) {
      return errorResponse(
        result?.error || "O Apps Script recusou o teste do gateway.",
        502
      );
    }

    return success({
      gateway: "online",
      appsScript: result.data || result
    });
  } catch (error) {
    return errorResponse(
      "Falha na comunicação segura com o Apps Script.",
      502,
      String(error?.message || error)
    );
  }
}
