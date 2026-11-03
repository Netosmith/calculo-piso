import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createSessionToken } from '../src/services/session.js';
import { fleetController } from '../src/controllers/fleet.js';
import { monitorController } from '../src/controllers/monitor.js';

globalThis.crypto ??= webcrypto;
const env = { PORTAL_KEY: 'test-secret', FLEET_DB: {prepare(){throw new Error('Unauthorized DB access');}} };
async function req(path, session) {
  const headers = {};
  if(session) {
    const token = await createSessionToken(env, {...session, expiresAt:new Date(Date.now()+60000).toISOString()});
    headers.Cookie = '__Host-portal_session=' + token;
  }
  return new Request('https://example.test' + path, {headers});
}
test('fleet rejects other tenants before database access', async () => {
  const response = await fleetController(await req('/v1/fleet/records',{usuario:'USER',perfil:'ADMINISTRADOR',transportadoraId:'outra'}),env);
  assert.equal(response.status,403);
});
test('fleet rejects missing sessions', async () => {
  const response = await fleetController(await req('/v1/fleet/records'),env);
  assert.equal(response.status,401);
});
test('monitor manager rejects other tenants before database access', async () => {
  const response = await monitorController(await req('/v1/monitor/trips',{usuario:'USER',perfil:'ADMINISTRADOR',transportadoraId:'outra'}),env);
  assert.equal(response.status,403);
});
test('monitor manager rejects missing sessions', async () => {
  const response = await monitorController(await req('/v1/monitor/trips'),env);
  assert.equal(response.status,401);
});
