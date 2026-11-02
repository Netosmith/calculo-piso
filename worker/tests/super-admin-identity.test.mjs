import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageTenants } from '../src/config/super-admin-identity.js';
const env={SUPER_ADMIN_USER:'LUZIANO',SUPER_ADMIN_SUBJECT:'identity-123'};
const valid={usuario:'LUZIANO',transportadoraId:'nova-frota',authSubject:'identity-123',authAssurance:'mfa',authProviderVerified:true};
test('global write gate requires verified identity and MFA',()=>{
 assert.equal(canManageTenants(valid,env),true);
});
test('global write gate fails closed without subject configuration',()=>{
 assert.equal(canManageTenants(valid,{SUPER_ADMIN_USER:'LUZIANO'}),false);
});
test('global write gate denies mismatched immutable identity',()=>{
 assert.equal(canManageTenants({...valid,authSubject:'identity-other'},env),false);
});
test('global write gate denies missing MFA or provider verification',()=>{
 assert.equal(canManageTenants({...valid,authAssurance:'password'},env),false);
 assert.equal(canManageTenants({...valid,authProviderVerified:false},env),false);
});
test('global write gate denies other tenant even with matching identity',()=>{
 assert.equal(canManageTenants({...valid,transportadoraId:'other'},env),false);
});
