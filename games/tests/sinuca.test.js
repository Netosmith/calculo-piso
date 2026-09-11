import test from 'node:test';
import assert from 'node:assert/strict';
import {newMatch,simulate,shoot,adjudicate,place} from '../sinuca/engine.js';
import {SinucaRoom} from '../server/sinuca.js';
test('rack has 16 separate balls and authoritative simulation is deterministic and stops',()=>{
 const s=newMatch();assert.equal(new Set(s.balls.map(b=>b.id)).size,16);
 for(const a of s.balls)for(const b of s.balls)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=22);
 const a=simulate(s.balls,0,1),b=simulate(s.balls,0,1);assert.deepEqual(a,b);assert.equal(a.first,1);assert.ok(a.frames.length<751);assert.ok(a.balls.every(b=>Number.isFinite(b.x)&&b.vx===0&&b.vy===0));assert.equal(s.balls[0].x,240);
});
test('pockets capture cue and placement cannot overlap or leave table',()=>{
 const s=newMatch();s.balls[0].x=40;s.balls[0].y=40;const r=simulate(s.balls,-Math.PI*3/4,.15);assert.ok(r.potted.includes(0));assert.equal(place(s.balls,0,0),false);assert.equal(place(s.balls,650,240),false);assert.equal(place(s.balls,240,240),true);
});
test('group assignment, fouls, turn retention and legal or early eight ball',()=>{
 const s=newMatch(),result={balls:s.balls,first:1,rail:true,potted:[1]};let next=adjudicate(s,result);assert.deepEqual(next.groups,['lisas','listradas']);assert.equal(next.turn,0);
 next=adjudicate(next,{...result,first:9,potted:[2]});assert.equal(next.turn,1);assert.equal(next.ballInHand,true);
 assert.equal(adjudicate(s,{...result,potted:[8]}).winner,1);
 s.groups=['lisas','listradas'];s.balls.forEach(b=>{if(b.id>0&&b.id<8)b.pocketed=true});assert.equal(adjudicate(s,{...result,first:8,potted:[8]}).winner,0);assert.equal(adjudicate(s,{...result,first:8,potted:[8,0]}).winner,1);
 assert.throws(()=>shoot(s,{angle:NaN,power:1}));assert.throws(()=>shoot({...s,ballInHand:true},{angle:0,power:1,x:0,y:0}));
});
test('durable room enforces membership, two seats, turn and revision; survives restart',async()=>{
 const values=new Map(),ctx={storage:{get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v)),setAlarm:async()=>{},deleteAll:async()=>values.clear()},blockConcurrencyWhile:fn=>fn()};let room=new SinucaRoom(ctx);
 const call=async(user,action,data={})=>{const response=await room.fetch(new Request('https://room',{method:'POST',body:JSON.stringify({user,name:user,action,data,code:'ABC1234567'})}));return response.json()};
 assert.equal((await call('one','create')).ok,true);assert.equal((await call('intruder','state')).ok,false);assert.equal((await call('two','join')).seat,1);assert.equal((await call('three','join')).ok,false);
 assert.equal((await call('two','shot',{revision:0,angle:0,power:.5})).ok,false);
 const shot=await call('one','shot',{revision:0,angle:0,power:.5});assert.equal(shot.ok,true);assert.equal(shot.match.revision,1);assert.ok(shot.shot.frames.length>1);
 assert.equal((await call('one','shot',{revision:0,angle:0,power:.5})).ok,false);room=new SinucaRoom(ctx);assert.deepEqual((await call('two','state')).match,shot.match);
});

test('pool routes require portal role and unlock and take identity only from the session',async()=>{
 const {gamesController}=await import('../server/api.js');
 const values=new Map(),env={GAMES_ACCESS_PASSWORD:'7391',SESSIONS:{get:async k=>values.get(k),put:async(k,v)=>values.set(k,v)}};
 const request=()=>new Request('https://api.portalfrete.net.br/v1/games/sinuca',{method:'POST',headers:{Cookie:'__Host-portal_session=test'},body:JSON.stringify({action:'create',user:'forged'})});
 assert.equal((await gamesController(request(),env)).status,401);
 values.set('session:test',{perfil:'COMERCIAL',estado:'GO',usuario:'real',expiresAt:new Date(Date.now()+3600000).toISOString()});assert.equal((await gamesController(request(),env)).status,403);
 values.get('session:test').perfil='ADMINISTRADOR';assert.equal((await gamesController(request(),env)).status,423);
 values.set('games-unlock:test','1');let received;env.SINUCA_ROOMS={idFromName:x=>x,get:()=>({fetch:async r=>{received=await r.json();return Response.json({ok:true})}})};
 assert.equal((await gamesController(request(),env)).status,200);assert.equal(received.user,'real');assert.equal(received.action,'create');
});
