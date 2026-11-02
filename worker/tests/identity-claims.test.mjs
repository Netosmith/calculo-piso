import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectIdentityClaims } from '../src/config/identity-claims.js';
const config={issuer:'https://issuer.example',audience:'portal-admin',subject:'owner-id'};
const claims=()=>({iss:config.issuer,aud:config.audience,sub:config.subject,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300});
test('claims require complete trusted configuration',()=>{
 assert.equal(inspectIdentityClaims(claims(),{}).ok,false);
});
test('claims reject wrong issuer or subject',()=>{
 assert.equal(inspectIdentityClaims({...claims(),iss:'https://other.example'},config).ok,false);
 assert.equal(inspectIdentityClaims({...claims(),sub:'other'},config).ok,false);
});
test('claims reject wrong audience',()=>{
 assert.equal(inspectIdentityClaims({...claims(),aud:'other'},config).ok,false);
});
test('claims reject expired and future tokens',()=>{
 assert.equal(inspectIdentityClaims({...claims(),exp:1},config).ok,false);
 assert.equal(inspectIdentityClaims({...claims(),nbf:Math.floor(Date.now()/1000)+1000},config).ok,false);
});
test('claims accept structurally valid expected identity',()=>{
 assert.equal(inspectIdentityClaims(claims(),config).ok,true);
});

test('claims reject missing issuance time and excessive token lifetime',()=>{
 const token=claims();delete token.iat;
 assert.equal(inspectIdentityClaims(token,config).ok,false);
 assert.equal(inspectIdentityClaims({...claims(),exp:Math.floor(Date.now()/1000)+3600},config).ok,false);
});
test('claims reject stale issuance and future issuance',()=>{
 const now=Math.floor(Date.now()/1000);
 assert.equal(inspectIdentityClaims({...claims(),iat:now-3600},config).ok,false);
 assert.equal(inspectIdentityClaims({...claims(),iat:now+300},config).ok,false);
});
