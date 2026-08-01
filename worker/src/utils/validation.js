import { MAX_BODY_BYTES } from "../config.js";

export async function readJson(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength > MAX_BODY_BYTES) {
    throw new Error("Corpo da requisição excede o limite permitido.");
  }

  const text = await request.text();

  if (!text) return {};

  const size = new TextEncoder().encode(text).length;
  if (size > MAX_BODY_BYTES) {
    throw new Error("Corpo da requisição excede o limite permitido.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("JSON inválido.");
  }
}
