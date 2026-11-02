import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeAdminToken } from '../src/services/admin-replay-guard.js';
test('replay guard rejects missing database and invalid identifiers',async()=>{
 assert.equal(await consumeAdminToken(null,'owner','a'.repeat(16),Math.floor(Date.now()/1000)+60),false);
 assert.equal(await consumeAdminToken({prepare(){}},'owner','bad',Math.floor(Date.now()/1000)+60),false);
});
test('replay guard accepts first use and rejects replay',async()=>{
 const used=new Set();
 const db={prepare(){return {bind(subject,jti){return {async run(){const key=subject+':'+jti;if(used.has(key))return {meta:{changes:0}};used.add(key);return {meta:{changes:1}};}}}}}};
 const expiry=Math.floor(Date.now()/1000)+60;
 assert.equal(await consumeAdminToken(db,'owner','a'.repeat(16),expiry),true);
 assert.equal(await consumeAdminToken(db,'owner','a'.repeat(16),expiry),false);
});
test('replay guard fails closed on database errors',async()=>{
 const db={prepare(){throw Error('offline')}};
 assert.equal(await consumeAdminToken(db,'owner','a'.repeat(16),Math.floor(Date.now()/1000)+60),false);
});
