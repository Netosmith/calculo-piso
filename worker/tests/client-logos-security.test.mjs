import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createSessionToken } from '../src/services/session.js';
import { clientLogoController } from '../src/controllers/client-logos.js';

globalThis.crypto ??= webcrypto;
const key = 'test-only-secret';
const logo = { body: new Uint8Array([137,80,78,71]), httpEtag: '"test"', writeHttpMetadata(headers) { headers.set('Content-Type', 'image/png'); } };
const env = {
  PORTAL_KEY: key,
  CLIENT_LOGOS: {
    async get() { return logo; },
    async head() { return logo; },
    async put() { throw new Error('write should be rejected'); },
    async delete() { throw new Error('delete should be rejected'); }
  }
};
async function request(method, session) {
  const headers = {};
  if (session) {
    const token = await createSessionToken(env, { ...session, expiresAt: new Date(Date.now()+60000).toISOString() });
    headers.Cookie = '__Host-portal_session=' + token;
  }
  return new Request('https://example.test/v1/client-logos/CLIENTE', { method, headers });
}
test('public legacy logo GET remains available', async () => {
  const response = await clientLogoController(await request('GET'), env, 'CLIENTE');
  assert.equal(response.status, 200);
});
test('public legacy logo HEAD remains available', async () => {
  const response = await clientLogoController(await request('HEAD'), env, 'CLIENTE');
  assert.equal(response.status, 200);
});
test('logo writes require authentication', async () => {
  for (const method of ['PUT','DELETE']) {
    const response = await clientLogoController(await request(method), env, 'CLIENTE');
    assert.equal(response.status, 401);
  }
});
test('other tenants cannot modify legacy logos', async () => {
  for (const method of ['PUT','DELETE']) {
    const response = await clientLogoController(await request(method, {usuario:'OUTRO',perfil:'ADMINISTRADOR',transportadoraId:'outra'}), env, 'CLIENTE');
    assert.equal(response.status, 403);
  }
});
