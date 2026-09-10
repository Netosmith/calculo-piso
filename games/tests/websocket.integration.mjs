// Usage: node games/tests/websocket.integration.mjs <wrangler dry-run index.js>
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../worker/package.json',import.meta.url));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:process.argv[2],compatibilityDate:'2026-08-01',kvNamespaces:['SESSIONS'],durableObjects:{GAMES_ROOMS:{className:'GamesRoom',useSQLite:true}},bindings:{APPS_SCRIPT_URL:'https://example.invalid',PORTAL_KEY:'local-test-only'}}));
const sockets=[];
try{
 const kv=await mf.getKVNamespace('SESSIONS');
 for(const [id,perfil] of [['A','ADMINISTRADOR'],['B','ADMINISTRADOR'],['C','COMERCIAL']])await kv.put('session:'+id,JSON.stringify({usuario:id,nome:id,perfil,estado:'GO',expiresAt:new Date(Date.now()+60000).toISOString()}));
 const headers=id=>({Origin:'https://portalfrete.net.br',Cookie:'__Host-portal_session='+id});
 const denied=await mf.dispatchFetch('https://api.portalfrete.net.br/v1/games/access',{headers:headers('C')});assert.equal(denied.status,403);
 const created=await mf.dispatchFetch('https://api.portalfrete.net.br/v1/games/rooms',{method:'POST',headers:{...headers('A'),'Content-Type':'application/json'},body:JSON.stringify({size:1})});
 assert.equal(created.status,200);const {code}=await created.json();
 const messages=[[],[]];
 for(const [i,id] of ['A','B'].entries()){
  const r=await mf.dispatchFetch(`https://api.portalfrete.net.br/v1/games/rooms/${code}/connect`,{headers:{...headers(id),Upgrade:'websocket'}});
  assert.equal(r.status,101);const ws=r.webSocket;sockets.push(ws);ws.addEventListener('message',e=>messages[i].push(JSON.parse(e.data)));ws.accept();
 }
 async function until(predicate){const end=Date.now()+8000;while(!predicate()){if(Date.now()>end)throw new Error('WebSocket test timeout');await new Promise(r=>setTimeout(r,20))}}
 await until(()=>messages.every(m=>m.some(x=>x.type==='welcome')));
 for(const ws of sockets)ws.send(JSON.stringify({type:'ready',ready:true}));
 await until(()=>messages[0].some(m=>m.type==='lobby'&&m.members.length===2&&m.members.every(p=>p.ready)));
 sockets[0].send(JSON.stringify({type:'start'}));
 await until(()=>messages.every(m=>m.some(x=>x.type==='snapshot')));
 sockets[0].send(JSON.stringify({type:'input',input:{right:true,super:true,angle:0}}));
 sockets[1].send(JSON.stringify({type:'input',input:{left:true,angle:Math.PI}}));
 await until(()=>messages.every(m=>m.some(x=>x.type==='snapshot'&&x.state.players[0].x>285&&x.state.players[1].x<1875)));
 assert.ok(messages[0].some(m=>m.type==='snapshot'&&m.state.fireballs.length));
 sockets[1].close(1000,'Test disconnect');await until(()=>messages[0].some(m=>m.type==='cancelled'));
 console.log('PASS: real local Worker WebSocket upgrade, two clients, movement, fireball, disconnect and 403 guard.');
}finally{for(const ws of sockets)try{ws.close()}catch{}await mf.dispose()}
