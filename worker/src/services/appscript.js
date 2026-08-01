import { APP_SCRIPT_TIMEOUT_MS } from "../config.js";

export async function callAppsScript(env, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APP_SCRIPT_TIMEOUT_MS);

  try {
    const response = await fetch(env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
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
      throw new Error("Resposta inválida do Apps Script.");
    }

    if (!response.ok) {
      throw new Error(data?.error || `Apps Script respondeu HTTP ${response.status}.`);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}
