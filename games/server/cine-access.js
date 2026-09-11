const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export const LEASE_MS=90000;
export function configuredSlots(env){
 const seen=new Set();
 return Array.from({length:10},(_,i)=>{
  const id=String(i+1).padStart(2,'0'),source=env['CINE_PLAYLIST_'+id]||(i===0?env.CINE_PLAYLIST_URL:'');
  let configured=false;
  try{const url=new URL(source);configured=url.protocol==='https:'&&!seen.has(url.href)&&Boolean(env.CINE_TOKEN_KEY?.length>=32);seen.add(url.href)}catch{}
  return {id,configured};
 });
}
export function sourceEnvironment(env,id){
 return {...env,CINE_PLAYLIST_URL:env['CINE_PLAYLIST_'+id]||(id==='01'?env.CINE_PLAYLIST_URL:''),CINE_ALLOWED_ORIGINS:env['CINE_ALLOWED_ORIGINS_'+id]||env.CINE_ALLOWED_ORIGINS||''};
}
// A single Durable Object serializes reservations across every user and all ten seats.
export class CineAccess {
 constructor(ctx){this.ctx=ctx}
 async fetch(request){
  const d=await request.json();
  return this.ctx.storage.transaction(async tx=>{
   const now=Date.now(),all=await tx.get('leases')||{};
   for(const [id,value] of Object.entries(all))if(value.expires<=now)delete all[id];
   if(d.action==='list')return json({ok:true,slots:d.slots.map(s=>({...s,state:!s.configured?'unconfigured':all[s.id]?'busy':'free'}))});
   if(!/^0[1-9]$|^10$/.test(d.slot)||!d.user||!d.session)return json({ok:false,error:'Acesso inválido.'},400);
   let lease=all[d.slot];
   if(d.action==='claim'){
    if(lease)return json({ok:false,error:'Este acesso já está em uso. Escolha outro.'},409);
    if(Object.values(all).some(l=>l.user===d.user))return json({ok:false,error:'Você já tem um acesso reservado. Saia dele antes de entrar em outro.'},409);
    lease={id:crypto.randomUUID(),user:d.user,session:d.session,expires:Math.min(now+LEASE_MS,d.sessionExpires),playback:''};
    all[d.slot]=lease;await tx.put('leases',all);return json({ok:true,lease:lease.id,expires:lease.expires});
   }
   if(!lease||lease.id!==d.lease||lease.user!==d.user||lease.session!==d.session)return json({ok:false,error:'Sua reserva terminou. Escolha um acesso livre.'},409);
   if(d.action==='release'){delete all[d.slot];await tx.put('leases',all);return json({ok:true})}
   if(d.action==='check'&&d.playback!==undefined&&d.playback!==lease.playback)return json({ok:false,error:'Esta reprodução foi encerrada.'},409);
   if(d.action==='play')lease.playback=crypto.randomUUID();
   if(!['check','heartbeat','play'].includes(d.action))return json({ok:false,error:'Ação inválida.'},400);
   lease.expires=Math.min(now+LEASE_MS,d.sessionExpires);await tx.put('leases',all);
   return json({ok:true,expires:lease.expires,playback:lease.playback});
  });
 }
}
export async function accessCall(env,sessionId,session,data){
 if(!env.CINE_ACCESS)return json({ok:false,error:'Os acessos do Cine aguardam publicação no servidor.'},503);
 return env.CINE_ACCESS.get(env.CINE_ACCESS.idFromName('cine-access-v1')).fetch(new Request('https://cine-access/',{method:'POST',body:JSON.stringify({...data,user:session.usuario,session:sessionId,sessionExpires:Date.parse(session.expiresAt)})}));
}
