import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { verifyOidcJwt } from '../src/services/oidc-verifier.js';
globalThis.crypto ??= webcrypto;
const b64=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
async function fixture(){
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-key',alg:'RS256',use:'sig'};
 const options={issuer:'https://id.example',audience:'portal',subject:'owner',jwk};
 const claims={iss:options.issuer,aud:options.audience,sub:options.subject,exp:Math.floor(Date.now()/1000)+300};
 async function sign(payload=claims){
   const data=b64({alg:'RS256',typ:'JWT',kid:'test-key'})+'.'+b64(payload);
   const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(data));
   return data+'.'+Buffer.from(signature).toString('base64url');
 }
 return {options,claims,sign};
}
test('OIDC verifier accepts valid RS256 signature and claims',async()=>{
 const f=await fixture();
 assert.equal((await verifyOidcJwt(await f.sign(),f.options)).ok,true);
});
test('OIDC verifier rejects tampered payload',async()=>{
 const f=await fixture(),token=await f.sign();
 const parts=token.split('.');
 parts[1]=b64({...f.claims,sub:'attacker'});
 assert.equal((await verifyOidcJwt(parts.join('.'),f.options)).ok,false);
});
test('OIDC verifier rejects wrong audience even with valid signature',async()=>{
 const f=await fixture();
 assert.equal((await verifyOidcJwt(await f.sign({...f.claims,aud:'other'}),f.options)).ok,false);
});
test('OIDC verifier rejects missing trusted key and malformed tokens',async()=>{
 const f=await fixture(),token=await f.sign();
 assert.equal((await verifyOidcJwt(token,{...f.options,jwk:null})).ok,false);
 assert.equal((await verifyOidcJwt('invalid',f.options)).ok,false);
});
