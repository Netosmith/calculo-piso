import test from 'node:test';
import assert from 'node:assert/strict';
import {GamesRoom,sanitizeInput} from '../server/rooms.js';
import {gamesController} from '../server/api.js';
import {Match} from '../js/simulation.js';
const admin={perfil:'ADMINISTRADOR',estado:'GO',usuario:'ADMIN',nome:'Admin',expiresAt:new Date(Date.now()+3600000).toISOString()};
const testPassword='7391';
const req=(path,options={})=>new Request('https://api.portalfrete.net.br/v1/games'+path,{...options,headers:{Cookie:'__Host-portal_session=test',...options.headers}});
const envFor=session=>{
 const values=new Map();if(session)values.set('session:test',session);
 return {GAMES_ACCESS_PASSWORD:testPassword,SESSIONS:{
  get:async(key,options)=>{const value=values.get(key);if(options?.type==='json'&&typeof value==='string')return JSON.parse(value);return value??null},
  put:async(key,value)=>values.set(key,value),delete:async key=>values.delete(key)
 },values};
};
const unlock=env=>gamesController(req('/unlock',{method:'POST',body:JSON.stringify({password:testPassword})}),env);
test('admin-only guard rejects absent, expired and all non-admin profiles',async()=>{
 for(const profile of ['COMERCIAL','OPERACIONAL','PISO','GOADM','ESTADIAS_ADMIN','MT','ADMIN']){
  const r=await gamesController(req('/access'),envFor({...admin,perfil:profile}));assert.equal(r.status,403);
 }
 assert.equal((await gamesController(req('/access'),envFor(null))).status,401);
 assert.equal((await gamesController(req('/access'),envFor({...admin,expiresAt:'2000-01-01'}))).status,401);
 const env=envFor(admin),access=await gamesController(req('/access'),env);assert.equal(access.status,200);assert.equal((await access.json()).unlocked,false);
 assert.equal((await gamesController(req('/rooms'),env)).status,423);
 assert.equal((await unlock(env)).status,200);
 assert.equal((await gamesController(req('/rooms'),env)).status,503);
});
test('password is checked on the server and failed attempts are limited',async()=>{
 const env=envFor(admin);
 const wrong=()=>gamesController(req('/unlock',{method:'POST',body:JSON.stringify({password:'0000'})}),env);
 for(let attempt=1;attempt<5;attempt++)assert.equal((await wrong()).status,403);
 assert.equal((await wrong()).status,429);assert.equal((await unlock(env)).status,429);
 const fresh=envFor(admin);assert.equal((await unlock(fresh)).status,200);
 const access=await gamesController(req('/access'),fresh);assert.equal((await access.json()).unlocked,true);
});
test('websocket forwards server identity, never user-supplied role or identity',async()=>{
 let forwarded;const env=envFor(admin);env.GAMES_ROOMS={idFromName:x=>x,get:()=>({fetch:async r=>{forwarded=r;return new Response('upgrade fixture')}})};
 await unlock(env);
 const r=await gamesController(req('/rooms/ABCDEF1234/connect',{headers:{Origin:'https://portalfrete.net.br',Upgrade:'websocket','X-Games-User':'FAKE','X-Games-Session':'forged'}}),env);
 assert.equal(r.status,200);assert.equal(forwarded.headers.get('X-Games-User'),'ADMIN');assert.equal(forwarded.headers.get('X-Games-Session'),'test');
 assert.equal((await gamesController(req('/rooms/ABCDEF1234/connect',{headers:{Origin:'https://evil.example',Upgrade:'websocket'}}),env)).status,403);
});
test('inputs are sanitized and players move independently',()=>{
 const bad=sanitizeInput({right:'yes',super:true,angle:Infinity,x:999999,hp:999});
 assert.equal(bad.right,false);assert.equal(bad.angle,0);assert.equal(bad.hp,undefined);
 const m=new Match(1);m.players.forEach(p=>p.bot=false);const [a,b]=m.players,x=a.x,y=b.x;
 m.tick(1/30,{players:{0:{right:true},3:{left:true}}});assert.ok(a.x>x);assert.ok(b.x<y);
});
test('two independent clients ready, start, send commands and share authoritative state',async()=>{
 const data=new Map([['meta',{size:1,host:'A',code:'ABCDEF1234',created:Date.now()}]]);let initialized;
 const ctx={storage:{get:async k=>data.get(k),put:async(k,v)=>data.set(k,v),setAlarm:async()=>{},deleteAll:async()=>data.clear()},getWebSockets:()=>[],blockConcurrencyWhile:f=>initialized=f()};
 const room=new GamesRoom(ctx,envFor(admin));await initialized;
 const socket=()=>({messages:[],send(s){this.messages.push(JSON.parse(s))},serializeAttachment(){},close(){}});
 const a=socket(),b=socket();room.members.set(a,{id:0,user:'A',name:'A',ready:false,lastInput:Date.now(),count:0,window:0});room.members.set(b,{id:3,user:'B',name:'B',ready:false,lastInput:Date.now(),count:0,window:0});
 room.webSocketMessage(a,JSON.stringify({type:'start'}));assert.equal(room.match,null);
 room.webSocketMessage(a,JSON.stringify({type:'ready',ready:true}));room.webSocketMessage(b,JSON.stringify({type:'ready',ready:true}));
 room.webSocketMessage(b,JSON.stringify({type:'start'}));assert.equal(room.match,null);
 room.webSocketMessage(a,JSON.stringify({type:'start'}));assert.ok(room.match);room.stop();
 room.webSocketMessage(a,JSON.stringify({type:'input',input:{right:true,super:true}}));room.webSocketMessage(b,JSON.stringify({type:'input',input:{left:true}}));
 const x=room.match.players[0].x;room.step();assert.ok(room.match.players[0].x>x);assert.equal(room.match.fireballs.length,1);
 const sa=a.messages.filter(m=>m.type==='snapshot').at(-1),sb=b.messages.filter(m=>m.type==='snapshot').at(-1);assert.deepEqual(sa,sb);
 room.leave(b);assert.equal(room.match,null);assert.ok(a.messages.some(m=>m.type==='cancelled'));
});
