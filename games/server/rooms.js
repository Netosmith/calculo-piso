import {Match} from '../js/simulation.js';

export function sanitizeInput(value){
 const out={};for(const k of ['left','right','up','down','fire','coffee','pickup','super'])out[k]=value?.[k]===true;
 out.angle=Number.isFinite(value?.angle)?Math.atan2(Math.sin(value.angle),Math.cos(value.angle)):0;
 return out;
}
export function validSession(s){return s?.perfil==='ADMINISTRADOR'&&!!s.estado&&Date.parse(s.expiresAt)>Date.now();}

export class GamesRoom {
 constructor(ctx,env){
  this.ctx=ctx;this.env=env;this.members=new Map();this.inputs={};this.match=null;this.timer=null;this.meta=null;this.tickCount=0;
  ctx.blockConcurrencyWhile(async()=>{
   this.meta=await ctx.storage.get('meta');
   for(const ws of ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a)this.members.set(ws,a)}
   if(this.members.size){this.broadcast({type:"cancelled",error:"A sala foi reiniciada. Marque pronto para começar outra partida."});for(const m of this.members.values())m.ready=false;this.broadcastLobby()}
  });
 }
 async fetch(request){
  const url=new URL(request.url);
  if(url.pathname==='/create'){
   if(this.meta)return Response.json({error:'Sala já existe.'},{status:409});
   const body=await request.json();this.meta={size:body.size,host:body.user,code:body.code,created:Date.now()};
   await this.ctx.storage.put('meta',this.meta);await this.ctx.storage.setAlarm(Date.now()+30000);
   return Response.json({ok:true,code:body.code});
  }
  if(!this.meta||Date.now()-this.meta.created>4*3600000)return Response.json({ok:false,error:'Sala não encontrada ou encerrada.'},{status:404});
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return Response.json({error:'WebSocket necessário.'},{status:426});
  const user=request.headers.get('X-Games-User'),sessionId=request.headers.get('X-Games-Session');
  if(!user||!sessionId)return new Response('Não autorizado',{status:401});
  const existing=[...this.members].find(([,m])=>m.user===user);
  if(!existing&&this.match&&!this.match.finished)return new Response('Partida em andamento.',{status:409});
  if(!existing&&this.members.size>=this.meta.size*2)return new Response('Sala cheia.',{status:409});
  let id=existing?.[1].id;
  if(existing){this.members.delete(existing[0]);existing[0].close(1000,'Conectado em outra aba');}
  if(id===undefined){const used=new Set([...this.members.values()].map(m=>m.id));const slots=Array.from({length:this.meta.size},(_,i)=>[i,i+3]).flat();id=slots.find(n=>!used.has(n));}
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];
  const member={id,user,name:decodeURIComponent(request.headers.get('X-Games-Name')||user),sessionId,lastInput:0,window:0,count:0,ready:false};
  this.ctx.acceptWebSocket(server);server.serializeAttachment(member);this.members.set(server,member);if(!this.meta.host){this.meta.host=user;this.ctx.storage.put('meta',this.meta)}
  server.send(JSON.stringify({type:'welcome',id,code:this.meta.code}));this.broadcastLobby();
  if(this.match&&!this.match.finished)this.snapshot();
  return new Response(null,{status:101,webSocket:client});
 }
 broadcast(message){const json=JSON.stringify(message);for(const ws of this.members.keys()){try{ws.send(json)}catch{this.leave(ws)}}}
 broadcastLobby(){this.broadcast({type:'lobby',code:this.meta.code,size:this.meta.size,host:this.meta.host,playing:!!this.match&&!this.match.finished,members:[...this.members.values()].map(m=>({id:m.id,name:m.name,user:m.user,team:m.id<3?0:1,ready:m.ready}))});}
 webSocketMessage(ws,raw){
  const m=this.members.get(ws);if(!m)return;
  if(typeof raw!=='string'||raw.length>2048){ws.close(1008,'Mensagem inválida');this.leave(ws);return}
  const now=Date.now();if(now-m.window>1000){m.window=now;m.count=0}if(++m.count>90){ws.close(1008,'Muitas mensagens');this.leave(ws);return}
  let data;try{data=JSON.parse(raw)}catch{return}if(!data||typeof data!=='object'||Array.isArray(data))return;
  if(data.type==='input'&&this.match&&!this.match.finished){
   const next=sanitizeInput(data.input),prev=this.inputs[m.id];
   // Keep one-shot actions until the next server tick consumes them.
   for(const k of ['coffee','pickup','super'])next[k]=next[k]||prev?.[k]===true;
   this.inputs[m.id]=next;m.lastInput=now;return;
  }
  if(data.type==='ready'&&(!this.match||this.match.finished)){m.ready=data.ready===true;ws.serializeAttachment(m);this.broadcastLobby();return}
  if(data.type==='start'&&m.user===this.meta.host){
   if(this.match&&!this.match.finished)return;
   if(this.members.size!==this.meta.size*2||![...this.members.values()].every(p=>p.ready)){ws.send(JSON.stringify({type:'error',error:'Aguarde todos entrarem e ficarem prontos.'}));return}
   this.match=new Match(this.meta.size);this.inputs={};
   for(const p of this.match.players){const member=[...this.members.values()].find(m=>m.id===p.id);p.name=member.name;p.bot=false;p.local=false;}
   this.broadcast({type:'started'});this.snapshot();this.stop();this.timer=setInterval(()=>this.step(),1000/30);
  }
 }
 step(){
  if(!this.match||this.match.finished){this.stop();return}
  for(const m of this.members.values())if(Date.now()-m.lastInput>250)this.inputs[m.id]={};
  this.match.tick(1/30,{players:this.inputs});
  for(const input of Object.values(this.inputs))for(const key of ['coffee','pickup','super'])input[key]=false;
  this.snapshot();
  if(this.match.finished){this.stop();for(const m of this.members.values())m.ready=false;this.broadcastLobby();}
 }
 snapshot(){if(!this.match)return;const m=this.match;this.broadcast({type:'snapshot',tick:++this.tickCount,state:{players:m.players,score:m.score,time:m.time,elapsed:m.elapsed,overtime:m.overtime,finished:m.finished,bullets:m.bullets,fireballs:m.fireballs,puddles:m.puddles,effects:m.effects,stations:m.stations,powerCooldowns:m.powerCooldowns,events:m.events}});}
 stop(){if(this.timer)clearInterval(this.timer);this.timer=null;}
 leave(ws){
  const m=this.members.get(ws);if(!m)return;this.members.delete(ws);delete this.inputs[m.id];
  if(this.match&&!this.match.finished){this.match=null;this.stop();for(const member of this.members.values())member.ready=false;this.broadcast({type:'cancelled',error:'Um jogador desconectou. A partida foi encerrada; organize uma revanche.'});}
  if(this.meta?.host===m.user){this.meta.host=this.members.values().next().value?.user||'';this.ctx.storage.put('meta',this.meta);}
  if(this.members.size)this.broadcastLobby();
 }
 webSocketClose(ws){this.leave(ws)}
 webSocketError(ws){this.leave(ws)}
 async alarm(){
  if(this.meta&&Date.now()-this.meta.created>4*3600000){for(const ws of this.members.keys()){ws.close(1000,"Sala encerrada");this.leave(ws)}this.stop();this.meta=null;await this.ctx.storage.deleteAll();return}
  for(const [ws,m] of this.members){const s=await this.env.SESSIONS.get(`session:${m.sessionId}`,{type:'json'});if(!validSession(s)){ws.close(1008,'Sessão expirada ou acesso negado');this.leave(ws)}}
  if(!this.members.size&&this.meta&&Date.now()-this.meta.created>15*60000){this.stop();this.meta=null;await this.ctx.storage.deleteAll();return}
  await this.ctx.storage.setAlarm(Date.now()+30000);
 }
}
