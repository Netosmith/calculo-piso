import { errorResponse } from "../utils/response.js";

/**
 * Encaminha /v1/pingo/* para o Durable Object da loja Pingo Chic.
 * Um único objeto ("main") garante consistência de estoque e numeração de pedidos.
 */
export async function pingoController(request, env) {
  if (!env.PINGO_STORE) {
    return errorResponse("Loja Pingo Chic não configurada no Worker (binding PINGO_STORE).", 500);
  }
  const stub = env.PINGO_STORE.get(env.PINGO_STORE.idFromName("main"));
  return stub.fetch(request);
}
