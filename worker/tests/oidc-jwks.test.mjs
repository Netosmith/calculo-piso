import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyWithTrustedJwks } from '../src/services/oidc-jwks.js';
const config={issuer:'https://identity.example',jwksUrl:'https://identity.example/keys',audience:'portal',subject:'owner'};
test('JWKS rejects cross-origin key URLs without fetching',async()=>{
 let calls=0;
 const result=await verifyWithTrustedJwks('x.y.z',{...config,jwksUrl:'https://attacker.example/keys'},()=>{calls++;throw Error('unexpected')});
 assert.equal(result.ok,false);
 assert.equal(calls,0);
});
test('JWKS rejects malformed JWT headers before fetching',async()=>{
 let calls=0;
 const result=await verifyWithTrustedJwks('invalid',config,()=>{calls++;throw Error('unexpected')});
 assert.equal(result.ok,false);
 assert.equal(calls,0);
});
test('JWKS rejects missing and duplicate signing keys',async()=>{
 const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'key-1'})).toString('base64url');
 const token=header+'.e30.signature';
 for(const keys of [[],[{kid:'key-1',kty:'RSA'},{kid:'key-1',kty:'RSA'}]]){
  const result=await verifyWithTrustedJwks(token,config,async()=>({ok:true,text:async()=>JSON.stringify({keys})}));
  assert.equal(result.ok,false);
 }
});
test('JWKS rejects unavailable and oversized responses',async()=>{
 const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'key-1'})).toString('base64url');
 const token=header+'.e30.signature';
 assert.equal((await verifyWithTrustedJwks(token,config,async()=>({ok:false}))).ok,false);
 assert.equal((await verifyWithTrustedJwks(token,config,async()=>({ok:true,text:async()=> 'x'.repeat(65537)}))).ok,false);
});
