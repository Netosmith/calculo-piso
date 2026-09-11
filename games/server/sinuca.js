import {newMatch,shoot} from '../sinuca/engine.js';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function sinucaController(request,env,session){
 if(!env.SINUCA_ROOMS)return reply({ok:false,error:'Sinuca online aguardando publicação no servidor.'},503);
 const path=new URL(request.url).pathname;
 let code=path.match(/^\/v1\/games\/sinuca\/([A-F0-9]{10})$/)?.[1];
 let action='state',data={};
 if(request.method==='POST'){const text=await request.text();if(text.length>1024)return reply({ok:false,error:'Pedido inválido.'},400);try{data=JSON.parse(text);action=data.action}catch{return reply({ok:false,error:'Pedido inválido.'},400)}}else if(request.method!=='GET')return reply({ok:false,error:'Método inválido.'},405);
 if(path==='/v1/games/sinuca'&&request.method==='POST'){
 const key=`sinuca-create:${session.usuario}`,last=Number(await env.SESSIONS.get(key)||0);if(Date.now()-last<10000)return reply({ok:false,error:'Aguarde 10 segundos para criar outra sala.'},429);await env.SESSIONS.put(key,String(Date.now()),{expirationTtl:60});code=crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase();action='create';
 }
 if(!code)return reply({ok:false,error:'Código de sala inválido.'},400);
 return env.SINUCA_ROOMS.get(env.SINUCA_ROOMS.idFromName(code)).fetch(new Request('https://sinuca/room',{method:'POST',body:JSON.stringify({action,data,code,user:session.usuario,name:session.nome||session.usuario})}));
}
export class SinucaRoom{
 constructor(ctx){this.ctx=ctx}
 async fetch(request){return this.ctx.blockConcurrencyWhile(async()=>{
  try{
   const {action,data,code,user,name}=await request.json();let room=await this.ctx.storage.get('room');const now=Date.now();
   if(action==='create'){if(room)throw Error('Sala já existe.');room={code,players:[{user,name:String(name).slice(0,60),seen:now}],match:newMatch(),availableAt:0,expires:now+7200000,shot:null};}
   if(!room||room.expires<now)return reply({ok:false,error:'Sala encerrada. Crie uma nova partida.'},404);
   let seat=room.players.findIndex(p=>p.user===user);
   if(action==='join'&&seat<0){if(room.players.length===2)throw Error('Sala cheia.');room.players.push({user,name:String(name).slice(0,60),seen:now});seat=1}
   if(action==='create')seat=0;if(seat<0)return reply({ok:false,error:'Entre na sala para jogar.'},403);
   if(!['create','join','state','shot'].includes(action))throw Error('Ação inválida.');
   if(action==='shot'){
    if(room.players.length!==2)throw Error('Aguarde o segundo jogador.');
    if(now-room.players[1-seat].seen>20000)throw Error('Aguarde o outro jogador reconectar.');
    if(room.match.turn!==seat||now<room.availableAt)throw Error('Aguarde a sua vez.');
    if(data.revision!==room.match.revision)throw Error('A mesa foi atualizada. Tente novamente.');
    const outcome=shoot(room.match,data);room.match=outcome.state;room.shot={revision:room.match.revision,frames:outcome.frames,startedAt:now};room.availableAt=now+outcome.frames.length*1000/30;
   }
   room.players[seat].seen=now;
   await this.ctx.storage.put('room',room);await this.ctx.storage.setAlarm(room.expires);
   return reply({ok:true,code,seat,players:room.players.map(p=>({name:p.name,online:now-p.seen<20000})),match:room.match,availableAt:room.availableAt,serverNow:now,shot:room.availableAt>now?room.shot:null});
  }catch(error){return reply({ok:false,error:error.message||'Não foi possível jogar.'},400)}
 })}
 async alarm(){await this.ctx.storage.deleteAll()}
}
