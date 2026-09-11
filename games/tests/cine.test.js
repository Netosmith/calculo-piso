import {fixture} from './cine-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseM3U,allowedURL,seal,unseal,rewriteManifest,cineController} from '../server/cine.js';
import {gamesController} from '../server/api.js';
const env={CINE_PLAYLIST_URL:'https://provider.example/list?username=test&password=fixture',CINE_TOKEN_KEY:'fixture-key-only-not-a-production-secret'};
test('M3U parser handles quoted commas, CRLF, groups and ignores comments',()=>{
 assert.deepEqual(parseM3U('\uFEFF#EXTM3U\r\n#EXTINF:-1 tvg-name="TV, Test" group-title="Notícias",Canal, local\r\n#comment\r\nhttps://provider.example/1.m3u8'),[{name:'Canal, local',group:'Notícias',url:'https://provider.example/1.m3u8'}]);
 assert.throws(()=>parseM3U('<html>Invalid credentials</html>'));
});
test('upstream allowlist rejects http, unknown hosts, URL credentials and local addresses',()=>{
 for(const url of ['http://provider.example/x','https://evil.example/x','https://user:pass@provider.example/x','https://127.0.0.1/x'])assert.throws(()=>allowedURL(url,env));
 assert.equal(allowedURL('/1.m3u8',env,env.CINE_PLAYLIST_URL).origin,'https://provider.example');
});
test('media tickets conceal credentials, bind session, expire and reject tampering',async()=>{
 const data={url:env.CINE_PLAYLIST_URL,session:'session-A',expires:Date.now()+60000};
 const token=await seal(data,env);assert.ok(!token.includes('provider'));assert.deepEqual(await unseal(token,env,'session-A'),data);
 await assert.rejects(unseal(token,env,'session-B'));
 await assert.rejects(unseal(token+'x',env,'session-A'));
 await assert.rejects(unseal(await seal({...data,expires:0},env),env,'session-A'));
});
test('manifest rewrites playlists, encryption keys and initialization segments without leaking URLs',async()=>{
 const seen=[];const result=await rewriteManifest('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXT-X-MAP:URI="init.mp4"\nsegment.ts\nhttps://provider.example/variant.m3u8','https://provider.example/live/list.m3u8',async url=>{seen.push(url);return '/protected/'+seen.length});
 assert.equal(seen.length,4);assert.ok(result.includes('URI="/protected/1"'));assert.ok(!result.includes('provider.example'));assert.ok(!result.includes('segment.ts'));
});
test('Cine routes require an administrator and password unlock, then report missing configuration',async()=>{
 const session={perfil:'ADMINISTRADOR',estado:'GO',usuario:'A',expiresAt:new Date(Date.now()+60000).toISOString()};
 const request=new Request('https://api.example/v1/games/cine/catalog',{headers:{Cookie:'__Host-portal_session=s'}});
 let unlocked=false;const bindings={GAMES_ACCESS_PASSWORD:'fixture',SESSIONS:{get:async key=>key==='session:s'?session:unlocked?'1':null}};
 assert.equal((await gamesController(request,bindings)).status,423);unlocked=true;
 assert.equal((await gamesController(request,bindings)).status,503);session.perfil='COMERCIAL';
 assert.equal((await gamesController(request,bindings)).status,403);
});
test('media route rejects forged tokens before contacting upstream',async()=>{
 assert.equal((await cineController(new Request('https://api.example/v1/games/cine/media?ticket=forged'),env,'s',{})).status,403);
});
test('catalog and media proxy serve HLS without disclosing provider URLs',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async request=>{
  const u=new URL(request);calls++;
  if(u.pathname==='/list')return new Response('#EXTM3U\n#EXTINF:-1 group-title="TV",Test TV\nhttps://provider.example/live/fixture/secret/1.m3u8');
  if(u.pathname.endsWith('.m3u8'))return new Response('#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\nsegment.ts\n',{headers:{'Content-Type':'application/vnd.apple.mpegurl'}});
  return new Response(new Uint8Array([71,0,0]),{headers:{'Content-Type':'video/mp2t'}});
 };
 try{
  const session={usuario:'test',expiresAt:new Date(Date.now()+60000).toISOString()};
  const {room}=fixture();const bindings={...env,CINE_ACCESS:{idFromName:x=>x,get:()=>room}};
  const claim=await (await cineController(new Request('https://api.example/v1/games/cine/accesses/01/claim',{method:'POST',body:'{}'}),bindings,'s',session)).json();
  const req=path=>new Request('https://api.example/v1/games/cine/'+path+'?slot=01&lease='+claim.lease);
  const list=await (await cineController(req('catalog'),bindings,'s',session)).json();assert.equal(list.channels.length,1);assert.ok(!JSON.stringify(list).includes('secret'));assert.ok(!JSON.stringify(list).includes('provider'));
  const play=await (await cineController(req('play/'+list.channels[0].id),bindings,'s',session)).json();
  const manifest=await (await cineController(new Request('https://api.example'+play.path),bindings,'s',session)).text();assert.ok(!manifest.includes('provider'));assert.ok(manifest.includes('/v1/games/cine/media?ticket='));
  const segment=manifest.split('\n').find(l=>l.startsWith('/v1/'));const media=await cineController(new Request('https://api.example'+segment),bindings,'s',session);assert.equal(media.status,200);assert.equal((await media.arrayBuffer()).byteLength,3);assert.equal(calls,3);
 }finally{globalThis.fetch=original}
});
