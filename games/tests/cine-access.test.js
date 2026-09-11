import test from 'node:test';
import assert from 'node:assert/strict';
import {CineAccess,configuredSlots} from '../server/cine-access.js';
import {fixture} from './cine-fixture.js';
const call=(room,data)=>room.fetch(new Request('https://fixture/',{method:'POST',body:JSON.stringify({slot:'01',user:'user',session:'session',sessionExpires:Date.now()+3600000,...data})}));
test('simultaneous claims grant one lease and persist through restart',async()=>{
 const {room,storage}=fixture();const results=await Promise.all(Array.from({length:20},(_,i)=>call(room,{action:'claim',user:'u'+i})));
 assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===409).length,19);
 assert.equal((await call(new CineAccess({storage}),{action:'claim',user:'new'})).status,409);
});
test('ten distinct users occupy ten seats, one user cannot reserve two',async()=>{
 const {room}=fixture();const first=await call(room,{action:'claim'});assert.equal(first.status,200);
 assert.equal((await call(room,{action:'claim',slot:'02'})).status,409);
 for(let i=2;i<=10;i++)assert.equal((await call(room,{action:'claim',slot:String(i).padStart(2,'0'),user:'u'+i})).status,200);
 assert.equal((await call(room,{action:'claim',slot:'11',user:'u11'})).status,400);
});
test('foreign release, foreign session and expired leases cannot access media',async()=>{
 const {room,values}=fixture();const {lease}=await (await call(room,{action:'claim'})).json();
 assert.equal((await call(room,{action:'release',lease,user:'other'})).status,409);
 assert.equal((await call(room,{action:'heartbeat',lease,session:'other'})).status,409);
 assert.equal((await call(room,{action:'heartbeat',lease})).status,200);
 values.get('leases')['01'].expires=Date.now()-1;
 assert.equal((await call(room,{action:'check',lease})).status,409);
 assert.equal((await call(room,{action:'claim',user:'next'})).status,200);
});
test('release frees seat and selecting a new channel invalidates prior playback',async()=>{
 const {room}=fixture();const {lease}=await (await call(room,{action:'claim'})).json();
 const first=await (await call(room,{action:'play',lease})).json();
 assert.equal((await call(room,{action:'check',lease,playback:first.playback})).status,200);
 await call(room,{action:'play',lease});
 assert.equal((await call(room,{action:'check',lease,playback:first.playback})).status,409);
 await call(room,{action:'release',lease});assert.equal((await call(room,{action:'check',lease})).status,409);
 assert.equal((await call(room,{action:'claim',user:'next'})).status,200);
});
test('ten cards conceal sources and only distinct configured HTTPS lists are offered',()=>{
 const slots=configuredSlots({CINE_TOKEN_KEY:'x'.repeat(32),CINE_PLAYLIST_01:'https://provider.example/a',CINE_PLAYLIST_02:'https://provider.example/a',CINE_PLAYLIST_03:'http://provider.example/b'});
 assert.equal(slots.length,10);assert.equal(slots.filter(s=>s.configured).length,1);assert.ok(!JSON.stringify(slots).includes('provider'));
});
