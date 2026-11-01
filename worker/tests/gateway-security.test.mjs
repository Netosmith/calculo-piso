import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createSessionToken } from '../src/services/session.js';
import { portalGatewayController } from '../src/controllers/portal-gateway.js';

globalThis.crypto ??= webcrypto;
const env = { PORTAL_KEY:'test-secret' };
async function request(session) {
  const headers = {};
  if (session) {
    const token = await createSessionToken(env, {...session,expiresAt:new Date(Date.now()+60000).toISOString()});
    headers.Cookie = '__Host-portal_session=' + token;
  }
  return new Request('https://example.test/v1/portal-gateway', {method:'POST',headers});
}
test('gateway rejects unauthenticated access before Apps Script',async()=>{
  const response = await portalGatewayController(await request(),env);
  assert.equal(response.status,401);
});
test('gateway rejects foreign tenant before Apps Script',async()=>{
  const response = await portalGatewayController(await request({usuario:'USER',perfil:'ADMINISTRADOR',transportadoraId:'outra'}),env);
  assert.equal(response.status,403);
});
test('gateway rejects explicitly empty tenant ID',async()=>{
  const response = await portalGatewayController(await request({usuario:'USER',perfil:'ADMINISTRADOR',transportadoraId:''}),env);
  assert.equal(response.status,403);
});
