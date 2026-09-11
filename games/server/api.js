import {getSession,readSessionId} from '../../worker/src/services/session.js';
import {validSession} from './rooms.js';
import {cineController} from './cine.js';

const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const encoder=new TextEncoder();
const grantKey=sessionId=>`games-unlock:${sessionId}`;
const failureKey=sessionId=>`games-unlock-failures:${sessionId}`;
function safeEqual(left,right){
 const a=encoder.encode(String(left)),b=encoder.encode(String(right));let difference=a.length^b.length;
 for(let i=0;i<Math.max(a.length,b.length);i++)difference|=(a[i]||0)^(b[i]||0);
 return difference===0;
}
async function unlocked(env,sessionId){return Boolean(await env.SESSIONS.get(grantKey(sessionId)))}
export async function gamesController(request,env){
 const sessionId=readSessionId(request),session=await getSession(env,sessionId);
 if(!session||Date.parse(session.expiresAt)<=Date.now())return reply({ok:false,error:'Sessão inválida ou expirada.'},401);
 if(!validSession(session))return reply({ok:false,error:'Nova Frota Games é exclusivo para ADMINISTRADOR com estado selecionado.'},403);
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(!env.GAMES_ACCESS_PASSWORD)return reply({ok:false,error:'A senha do Nova Frota Games ainda não foi configurada no servidor.'},503);
 if(path==='/v1/games/access'&&request.method==='GET')return reply({ok:true,unlocked:await unlocked(env,sessionId),user:session.usuario,name:session.nome});
 if(path==='/v1/games/unlock'&&request.method==='POST'){
  const failures=Number(await env.SESSIONS.get(failureKey(sessionId))||0);
  if(failures>=5)return reply({ok:false,error:'Muitas tentativas incorretas. Aguarde 10 minutos e tente novamente.'},429);
  const text=await request.text();if(text.length>128)return reply({ok:false,error:'Senha inválida.'},400);
  let data;try{data=JSON.parse(text)}catch{return reply({ok:false,error:'Senha inválida.'},400)}
  const password=typeof data?.password==='string'?data.password:'';
  if(!safeEqual(password,env.GAMES_ACCESS_PASSWORD)){
   const attempts=failures+1;await env.SESSIONS.put(failureKey(sessionId),String(attempts),{expirationTtl:600});
   return reply({ok:false,error:attempts>=5?'Muitas tentativas incorretas. Aguarde 10 minutos e tente novamente.':`Senha incorreta. ${5-attempts} tentativa(s) restante(s).`},attempts>=5?429:403);
  }
  const remaining=Math.ceil((Date.parse(session.expiresAt)-Date.now())/1000);
  await env.SESSIONS.put(grantKey(sessionId),'1',{expirationTtl:Math.max(60,Math.min(43200,remaining))});
  await env.SESSIONS.delete(failureKey(sessionId));
  return reply({ok:true,unlocked:true,user:session.usuario,name:session.nome});
 }
 if(!await unlocked(env,sessionId))return reply({ok:false,error:'Digite a senha do Nova Frota Games para continuar.'},423);
 if(path.startsWith('/v1/games/cine/'))return cineController(request,env,sessionId,session);
 if(!env.GAMES_ROOMS)return reply({ok:false,error:'Multiplayer aguardando configuração na Cloudflare.'},503);
 if(path==='/v1/games/rooms'&&request.method==='POST'){
  const text=await request.text();if(text.length>512)return reply({ok:false,error:'Pedido inválido.'},400);
  let data;try{data=JSON.parse(text)}catch{return reply({ok:false,error:'Pedido inválido.'},400)}
  if(!data||![1,2,3].includes(data.size))return reply({ok:false,error:'Escolha 1x1, 2x2 ou 3x3.'},400);
  const key=`games-create:${session.usuario}`,last=Number(await env.SESSIONS.get(key)||0);
  if(Date.now()-last<10000)return reply({ok:false,error:'Aguarde 10 segundos para criar outra sala.'},429);
  await env.SESSIONS.put(key,String(Date.now()),{expirationTtl:60});
  const code=crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase();
  const stub=env.GAMES_ROOMS.get(env.GAMES_ROOMS.idFromName(code));
  return stub.fetch(new Request('https://room/create',{method:'POST',body:JSON.stringify({size:data.size,user:session.usuario,code})}));
 }
 const room=path.match(/^\/v1\/games\/rooms\/([A-F0-9]{10})\/connect$/);
 if(room&&request.method==='GET'){
  const origin=request.headers.get('Origin');
  if(!['https://portalfrete.net.br','https://www.portalfrete.net.br','https://portalfrete.pages.dev'].includes(origin))return reply({ok:false,error:'Origem não autorizada.'},403);
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return reply({ok:false,error:'Conexão WebSocket necessária.'},426);
  const headers=new Headers(request.headers);headers.set('X-Games-User',session.usuario);headers.set('X-Games-Name',encodeURIComponent(session.nome||session.usuario));headers.set('X-Games-Session',sessionId);
  return env.GAMES_ROOMS.get(env.GAMES_ROOMS.idFromName(room[1])).fetch(new Request('https://room/connect',{method:'GET',headers}));
 }
 return reply({ok:false,error:'Rota não encontrada.'},404);
}
