import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { LEGACY_NOVA_FROTA, tenantIdForLegacySession } from '../src/config/transportadoras.js';
import { createSessionToken } from '../src/services/session.js';
import { superAdminController } from '../src/controllers/super-admin.js';

globalThis.crypto ??= webcrypto;

const secret = 'test-secret-not-for-production';
const env = { PORTAL_KEY: secret, SUPER_ADMIN_USER: 'LUZIANO' };

async function requestFor(session, path = '/v1/super-admin/me') {
  const token = await createSessionToken(env, {
    usuario: session.usuario,
    transportadoraId: session.transportadoraId,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });
  return new Request('https://example.test' + path, {
    headers: { Cookie: '__Host-portal_session=' + token }
  });
}

test('tenant mapping preserves legacy sessions and rejects explicit empty ID', () => {
  assert.equal(tenantIdForLegacySession({ usuario: 'LEGADO' }), LEGACY_NOVA_FROTA.id);
  assert.equal(tenantIdForLegacySession({ usuario: 'NOVO', transportadoraId: '' }), null);
  assert.equal(tenantIdForLegacySession({ usuario: 'NOVO', transportadoraId: 'outra' }), 'outra');
  assert.equal(tenantIdForLegacySession(null), null);
});

test('Super Admin fails closed when owner configuration is absent', async () => {
  const response = await superAdminController(await requestFor({usuario:'LUZIANO',transportadoraId:'nova-frota'}), {PORTAL_KEY:secret});
  assert.equal(response.status, 403);
});

test('Super Admin rejects other users and tenants', async () => {
  for (const session of [
    { usuario:'OUTRO', transportadoraId:'nova-frota' },
    { usuario:'LUZIANO', transportadoraId:'outra' },
    { usuario:'LUZIANO', transportadoraId:'' }
  ]) {
    const response = await superAdminController(await requestFor(session), env);
    assert.equal(response.status, 403);
  }
});

test('Super Admin lists only legacy company in read-only mode', async () => {
  const response = await superAdminController(await requestFor({usuario:'LUZIANO',transportadoraId:'nova-frota'}, '/v1/super-admin/transportadoras'), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.transportadoras.length, 1);
  assert.equal(body.transportadoras[0].id, 'nova-frota');
});

test('Super Admin denies unauthenticated requests', async () => {
  const response = await superAdminController(new Request('https://example.test/v1/super-admin/me'), env);
  assert.equal(response.status, 401);
});

test('Super Admin blocks writes without verified MFA identity', async () => {
 const response=await superAdminController(await requestFor({usuario:'LUZIANO',transportadoraId:'nova-frota'},'/v1/super-admin/transportadoras'),env);
 assert.equal(response.status,200);
 const token=await createSessionToken(env,{usuario:'LUZIANO',transportadoraId:'nova-frota',expiresAt:new Date(Date.now()+60000).toISOString()});
 const write=new Request('https://example.test/v1/super-admin/transportadoras',{method:'POST',headers:{Cookie:'__Host-portal_session='+token}});
 assert.equal((await superAdminController(write,env)).status,403);
});
test('Super Admin keeps writes disabled even with verified MFA claims',async()=>{
 const strongEnv={...env,SUPER_ADMIN_SUBJECT:'trusted-identity'};
 const token=await createSessionToken(strongEnv,{usuario:'LUZIANO',transportadoraId:'nova-frota',authSubject:'trusted-identity',authAssurance:'mfa',authProviderVerified:true,expiresAt:new Date(Date.now()+60000).toISOString()});
 const write=new Request('https://example.test/v1/super-admin/transportadoras',{method:'POST',headers:{Cookie:'__Host-portal_session='+token}});
 assert.equal((await superAdminController(write,strongEnv)).status,403);
});
