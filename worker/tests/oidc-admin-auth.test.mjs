import test from 'node:test';
import assert from 'node:assert/strict';
import { hasVerifiedMfa, verifySuperAdminIdentity } from '../src/services/oidc-admin-auth.js';
test('MFA policy fails closed without provider-specific configuration',()=>{
 assert.equal(hasVerifiedMfa({amr:['mfa']}),false);
});
test('MFA rejects password-only sessions',()=>{
 assert.equal(hasVerifiedMfa({amr:['pwd']},{acceptedAmr:['mfa']}),false);
});
test('MFA accepts configured amr method',()=>{
 assert.equal(hasVerifiedMfa({amr:['pwd','mfa']},{acceptedAmr:['mfa']}),true);
});
test('MFA accepts configured acr level',()=>{
 assert.equal(hasVerifiedMfa({acr:'urn:example:assurance:mfa'},{acceptedAcr:['urn:example:assurance:mfa']}),true);
});
test('Super Admin identity fails closed on invalid JWT before MFA',async()=>{
 const result=await verifySuperAdminIdentity('invalid',{issuer:'https://identity.example',jwksUrl:'https://identity.example/keys',audience:'portal',subject:'owner',mfaPolicy:{acceptedAmr:['mfa']}},()=>{throw Error('must not fetch')});
 assert.equal(result.ok,false);
});
