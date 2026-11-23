import test from "node:test";
import assert from "node:assert/strict";
import { corsHeaders, handlePreflight } from "../src/middleware/cors.js";

const endpoint = "https://api.portalfrete.net.br/v1/driver-freights";
const origin = "https://netosmith.github.io";
const req = (method, path, from = origin, headers = {}) =>
  new Request(path, { method, headers: { Origin: from, ...headers } });

test("site Nova Frota consulta somente fretes públicos sem credenciais", () => {
  const headers = corsHeaders(req("GET", endpoint));
  assert.equal(headers["Access-Control-Allow-Origin"], origin);
  assert.equal(headers["Access-Control-Allow-Credentials"], undefined);
  assert.match(headers["Access-Control-Allow-Methods"], /GET/);
});
test("preflight de GET público é permitido", async () => {
  const response = handlePreflight(req("OPTIONS", endpoint, origin, {
    "Access-Control-Request-Method": "GET"
  }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
});
test("site externo não ganha CORS para escrita nem autenticação", () => {
  assert.equal(corsHeaders(req("POST", endpoint)), null);
  assert.equal(corsHeaders(req("GET", endpoint + "/manage")), null);
  assert.equal(corsHeaders(req("GET", "https://api.portalfrete.net.br/v1/session")), null);
  assert.equal(corsHeaders(req("OPTIONS", endpoint, origin, {
    "Access-Control-Request-Method": "POST"
  })), null);
  assert.equal(corsHeaders(req("GET", endpoint, "https://example.com")), null);
});
test("Portal Frete conserva CORS autenticado existente", () => {
  const headers = corsHeaders(req("POST", endpoint + "/publish", "https://portalfrete.net.br"));
  assert.equal(headers["Access-Control-Allow-Credentials"], "true");
});
