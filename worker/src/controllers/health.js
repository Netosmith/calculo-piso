import { success } from "../utils/response.js";

export function healthController() {
  return success({
    service: "Portal Frete API",
    version: "v1",
    status: "online",
    timestamp: new Date().toISOString()
  });
}
