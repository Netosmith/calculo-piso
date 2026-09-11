import {configuredSlots,sourceEnvironment,accessCall} from './cine-access.js';

const enc=new TextEncoder(),dec=new TextDecoder();
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const mediaPath='/v1/games/cine/media';
let cached=null;

function blockedHost(hostname){
  const host=String(hostname||'').toLowerCase();
  if(!host||host==='localhost'||host.endsWith('.local')||host.endsWith('.internal')||host.includes(':'))return true;
  const ip=host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if(!ip)return false;
  const parts=ip.slice(1).map(Number);
  if(parts.some(n=>n<0||n>255))return true;
  const [a,b]=parts;
  return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===198&&(b===18||b===19));
}

export function allowedURL(value,env,base,providerDerived=false){
  const url=new URL(value,base),source=new URL(env.CINE_PLAYLIST_URL);
  const origins=new Set([source.origin,...String(env.CINE_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean)]);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||(!providerDerived&&!origins.has(url.origin))||blockedHost(url.hostname)){
    throw new Error('Origem de transmissão não configurada.');
  }
  return url;
}

function normalizePlaylistText(text){
  let value=String(text||'').replace(/^\uFEFF/,'');
  const marker=value.indexOf('#EXTM3U');
  if(marker>=0&&marker<512)value=value.slice(marker);
  return value;
}

export function parseM3U(text){
  const source=normalizePlaylistText(text);
  if(!source.trimStart().startsWith('#EXTM3U'))throw new Error('O provedor não retornou uma lista M3U.');
  const channels=[];let info=null;
  for(const raw of source.split(/\r?\n/)){
    const line=raw.trim();
    if(line.startsWith('#EXTINF:')){
      const match=line.match(/^#EXTINF:(?:[^\",]|\"[^\"]*\")*,(.*)$/);
      info={name:(match?.[1]||'Canal').slice(0,160),group:(line.match(/group-title=\"([^\"]*)\"/)?.[1]||'Outros').slice(0,100)};
    }else if(line&&!line.startsWith('#')&&info){
      channels.push({...info,url:line});info=null;
      if(channels.length>20000)throw new Error('Lista muito grande. Configure uma lista de até 20 mil canais.');
    }
  }
  return channels;
}

async function readText(response,max){
  const reader=response.body?.getReader();
  if(!reader)throw new Error('Resposta vazia do provedor.');
  let size=0,text='';const decoder=new TextDecoder();
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      size+=value.length;if(size>max)throw new Error('Lista excedeu o tamanho permitido.');
      text+=decoder.decode(value,{stream:true});
    }
    return text+decoder.decode();
  }finally{await reader.cancel()}
}

function upstreamHeaders(headers={}){
  return {
    'Accept':'application/x-mpegURL,application/vnd.apple.mpegurl,application/json,text/plain,*/*',
    'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36',
    ...headers
  };
}

async function upstream(value,env,headers={},providerDerived=false){
  let url=allowedURL(value,env,undefined,providerDerived);
  for(let n=0;n<4;n++){
    const response=await fetch(url,{headers:upstreamHeaders(headers),redirect:'manual',signal:AbortSignal.timeout(20000)});
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('Location');await response.body?.cancel();
      if(!location)break;
      url=allowedURL(location,env,url,true);continue;
    }
    if(!response.ok){const status=response.status;await response.body?.cancel();throw new Error('UPSTREAM_HTTP_'+status)}
    return {response,url:url.href};
  }
  throw new Error('Redirecionamento inválido do provedor.');
}

async function channelId(url){
  const digest=await crypto.subtle.digest('SHA-256',enc.encode(url));
  return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
}

function xtreamConfig(env){
  let source;
  try{source=new URL(env.CINE_PLAYLIST_URL)}catch{return null}
  if(!/\/get\.php$/i.test(source.pathname))return null;
  const username=source.searchParams.get('username'),password=source.searchParams.get('password');
  if(!username||!password)return null;
  const api=new URL(source.href);api.pathname=source.pathname.replace(/get\.php$/i,'player_api.php');api.search='';api.hash='';
  const rootPath=source.pathname.replace(/get\.php$/i,'');
  return {source,api,rootPath,username,password};
}

async function xtreamRequest(env,config,action){
  const url=new URL(config.api.href);
  url.searchParams.set('username',config.username);
  url.searchParams.set('password',config.password);
  if(action)url.searchParams.set('action',action);
  const {response}=await upstream(url.href,env,{'Accept':'application/json,text/plain,*/*'});
  const text=await readText(response,25000000);
  try{return JSON.parse(text)}catch{throw new Error('A API compatível do provedor não retornou JSON válido.')}
}

function xtreamOrigins(info,config,env){
  const origins=[];
  const server=info?.server_info||{};
  const raw=String(server.url||server.domain||'').trim();
  if(raw){
    try{
      const protocol=String(server.server_protocol||config.source.protocol.replace(':','')).toLowerCase()==='https'?'https':'http';
      const base=new URL(/^https?:\/\//i.test(raw)?raw:protocol+'://'+raw);
      const port=protocol==='https'?(server.https_port||server.port):server.port;
      if(port&&!base.port&&String(port)!==(protocol==='https'?'443':'80'))base.port=String(port);
      origins.push(allowedURL(base.origin,env,undefined,true).origin);
    }catch{}
  }
  origins.push(config.source.origin);
  return [...new Set(origins)];
}

async function catalogXtream(env){
  const config=xtreamConfig(env);
  if(!config)return [];
  let accountInfo={};
  try{accountInfo=await xtreamRequest(env,config,null)}catch{}
  let streams;
  try{streams=await xtreamRequest(env,config,'get_live_streams')}catch{return []}
  if(!Array.isArray(streams)||!streams.length)return [];
  let categories=[];
  try{categories=await xtreamRequest(env,config,'get_live_categories')}catch{}
  const names=new Map(Array.isArray(categories)?categories.map(item=>[String(item.category_id??''),String(item.category_name||'Outros').slice(0,100)]):[]);
  const bases=xtreamOrigins(accountInfo,config,env);
  const channels=[];
  for(const item of streams.slice(0,20000)){
    const streamId=String(item?.stream_id??'').trim();if(!streamId)continue;
    const urls=[];
    const direct=String(item?.direct_source||'').trim();
    if(direct){
      try{
        const directUrl=allowedURL(direct,env,undefined,true);
        if(directUrl.pathname.toLowerCase().endsWith('.m3u8'))urls.push(directUrl.href);
      }catch{}
    }
    for(const origin of bases){
      try{
        const path=config.rootPath+'live/'+encodeURIComponent(config.username)+'/'+encodeURIComponent(config.password)+'/'+encodeURIComponent(streamId)+'.m3u8';
        const candidate=allowedURL(new URL(path,origin+'/').href,env,undefined,true);
        if(!urls.includes(candidate.href))urls.push(candidate.href);
      }catch{}
    }
    if(!urls.length)continue;
    channels.push({
      id:await channelId(config.source.origin+'|'+streamId),
      name:String(item?.name||'Canal').slice(0,160),
      group:names.get(String(item?.category_id??''))||'Ao vivo',
      url:urls[0],
      urls,
      providerDerived:true
    });
  }
  return channels;
}

async function catalog(env){
  if(cached?.source===env.CINE_PLAYLIST_URL&&cached.expires>Date.now())return cached.channels;

  const apiChannels=await catalogXtream(env);
  if(apiChannels.length){
    cached={source:env.CINE_PLAYLIST_URL,channels:apiChannels,expires:Date.now()+300000};
    return apiChannels;
  }

  const {response}=await upstream(env.CINE_PLAYLIST_URL,env);
  const body=await readText(response,25000000);
  let parsed=[];
  try{parsed=parseM3U(body)}catch(error){
    if(error?.message!=='O provedor não retornou uma lista M3U.')throw error;
  }
  const channels=[];
  for(const channel of parsed){
    let url;try{url=allowedURL(channel.url,env,env.CINE_PLAYLIST_URL,true)}catch{continue}
    if(!url.pathname.toLowerCase().endsWith('.m3u8'))continue;
    channels.push({...channel,url:url.href,id:await channelId(url.href),providerDerived:true});
  }
  if(!parsed.length&&!channels.length)throw new Error('O provedor não retornou uma lista M3U.');
  if(!channels.length)throw new Error('A lista não contém canais HLS compatíveis. Use a lista do provedor com output=hls e links .m3u8.');
  cached={source:env.CINE_PLAYLIST_URL,channels,expires:Date.now()+300000};return channels;
}

async function key(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(env.CINE_TOKEN_KEY)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
function base64(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
export async function seal(data,env){const iv=crypto.getRandomValues(new Uint8Array(12));const body=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),enc.encode(JSON.stringify(data))));return base64(iv)+'.'+base64(body)}
export async function unseal(token,env,sessionId){
  if(!token||token.length>16000)throw new Error('Acesso ao vídeo expirado.');
  const parts=token.split('.');if(parts.length!==2)throw new Error('Acesso inválido.');
  const bytes=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
  const data=JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(parts[0])},await key(env),bytes(parts[1]))));
  if(data.session!==sessionId||data.expires<=Date.now())throw new Error('Acesso ao vídeo expirado.');return data;
}

export async function rewriteManifest(text,base,issue){
  if(!normalizePlaylistText(text).trimStart().startsWith('#EXTM3U'))throw new Error('Formato de transmissão incompatível.');
  const source=normalizePlaylistText(text),lines=[];
  for(const line of source.split(/\r?\n/)){
    if(!line.trim()){lines.push(line);continue}
    if(!line.startsWith('#')){lines.push(await issue(new URL(line.trim(),base).href));continue}
    if(line.startsWith('#EXT-X-CONTENT-STEERING')||line.startsWith('#EXT-X-DEFINE')||line.startsWith('#EXT-X-SESSION-DATA'))continue;
    let result='',start=0;
    for(const match of line.matchAll(/URI=\"([^\"]*)\"/g)){
      result+=line.slice(start,match.index)+'URI=\"'+await issue(new URL(match[1],base).href)+'\"';start=match.index+match[0].length;
    }
    const rewritten=result+line.slice(start);
    if(/https?:\/\//i.test(rewritten))throw new Error('A transmissão usa metadados não suportados.');
    lines.push(rewritten);
  }
  return lines.join('\n');
}

function publicFailure(error){
  const message=String(error?.message||'');
  if(/^UPSTREAM_HTTP_\d{3}$/.test(message)){
    const status=message.slice(-3);
    return {code:'UPSTREAM_DENIED',error:'O provedor recusou a transmissão do canal (HTTP '+status+').'};
  }
  const known=new Map([
    ['Origem de transmissão não configurada.',['ORIGIN_NOT_ALLOWED','O servidor de mídia usado pela lista ainda não está autorizado no Cine.']],
    ['Redirecionamento inválido do provedor.',['BAD_REDIRECT','O provedor redirecionou a playlist para um endereço não permitido.']],
    ['O provedor não retornou uma lista M3U.',['NOT_M3U','O endereço configurado não retornou uma playlist M3U válida e a API compatível não disponibilizou canais HLS.']],
    ['Lista muito grande. Configure uma lista de até 20 mil canais.',['LIST_TOO_LARGE','A playlist ultrapassa o limite de 20 mil canais.']],
    ['Lista excedeu o tamanho permitido.',['LIST_TOO_LARGE','A playlist ultrapassa o limite de tamanho permitido pelo Cine.']],
    ['A lista não contém canais HLS compatíveis. Use a lista do provedor com output=hls e links .m3u8.',['NO_HLS_CHANNELS','A lista abriu, mas nenhum canal HLS com link .m3u8 foi encontrado.']],
    ['Formato de transmissão incompatível.',['BAD_MANIFEST','O canal selecionado não retornou um manifesto HLS válido.']],
    ['Formato de mídia não suportado.',['UNSUPPORTED_MEDIA','O canal usa um formato de mídia que este player não suporta.']],
    ['A transmissão usa metadados não suportados.',['UNSUPPORTED_HLS_METADATA','O manifesto HLS usa recursos ainda não suportados pelo Cine.']],
    ['Resposta vazia do provedor.',['EMPTY_RESPONSE','O provedor respondeu sem conteúdo.']]
  ]);
  const hit=known.get(message);return hit?{code:hit[0],error:hit[1]}:{code:'CINE_UPSTREAM_ERROR',error:'Não foi possível carregar a transmissão. O diagnóstico seguro não identificou a causa.'};
}

async function openGrant(grant,env,headers){
  const candidates=Array.isArray(grant.urls)&&grant.urls.length?grant.urls:[grant.url];
  let lastError=null;
  for(const candidate of candidates){
    try{return await upstream(candidate,env,headers,Boolean(grant.providerDerived))}
    catch(error){lastError=error}
  }
  throw lastError||new Error('Formato de transmissão incompatível.');
}

export async function cineController(request,env,sessionId,session){
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
  const slots=configuredSlots(env);
  if(path==='/v1/games/cine/accesses'&&request.method==='GET')return accessCall(env,sessionId,session,{action:'list',slots});
  const action=path.match(/^\/v1\/games\/cine\/accesses\/(0[1-9]|10)\/(claim|heartbeat|release)$/);
  if(action&&request.method==='POST'){
    const text=await request.text();if(text.length>256)return reply({ok:false,error:'Pedido inválido.'},400);
    let data;try{data=JSON.parse(text)}catch{return reply({ok:false,error:'Pedido inválido.'},400)}
    if(action[2]!=='release'&&!slots.find(s=>s.id===action[1])?.configured)return reply({ok:false,error:'Este acesso está em configuração.'},503);
    return accessCall(env,sessionId,session,{action:action[2],slot:action[1],lease:data?.lease});
  }
  if(request.method!=='GET')return reply({ok:false,error:'Método não permitido.'},405);
  let grant=null;
  if(path===mediaPath){
    try{grant=await unseal(url.searchParams.get('ticket'),env,sessionId);if(!grant.slot||!grant.lease||!grant.playback)throw new Error('Reserva ausente')}
    catch{return reply({ok:false,error:'Acesso ao vídeo expirado. Selecione o canal novamente.'},403)}
  }
  const slot=grant?.slot||url.searchParams.get('slot'),lease=grant?.lease||url.searchParams.get('lease');
  if(!slots.find(s=>s.id===slot)?.configured)return reply({ok:false,error:'Escolha um acesso configurado antes de assistir.'},503);
  const check=await accessCall(env,sessionId,session,{action:'check',slot,lease,...(grant?{playback:grant.playback}:{})});if(!check.ok)return check;
  const rootEnv=env;env=sourceEnvironment(env,slot);
  try{
    if(path==='/v1/games/cine/catalog')return reply({ok:true,channels:(await catalog(env)).map(({id,name,group})=>({id,name,group}))});
    const play=path.match(/^\/v1\/games\/cine\/play\/([a-f0-9]{64})$/);
    if(play){
      const channel=(await catalog(env)).find(c=>c.id===play[1]);if(!channel)return reply({ok:false,error:'Canal não encontrado.'},404);
      const start=await accessCall(rootEnv,sessionId,session,{action:'play',slot,lease});if(!start.ok)return start;
      const {playback}=await start.json();
      const urls=Array.isArray(channel.urls)&&channel.urls.length?channel.urls:[channel.url];
      const ticket=await seal({url:urls[0],urls,providerDerived:Boolean(channel.providerDerived),slot,lease,playback,session:sessionId,expires:Math.min(Date.parse(session.expiresAt),Date.now()+4*3600000)},env);
      return reply({ok:true,path:mediaPath+'?ticket='+ticket});
    }
    if(path===mediaPath){
      const headers={},range=request.headers.get('Range');if(range&&/^bytes=\d+-\d*$/.test(range))headers.Range=range;
      const {response,url:finalURL}=await openGrant(grant,env,headers);
      const type=response.headers.get('Content-Type')||'';
      if(type.includes('mpegurl')||new URL(finalURL).pathname.toLowerCase().endsWith('.m3u8')){
        const text=await readText(response,2000000);
        const rewritten=await rewriteManifest(text,finalURL,async target=>{
          allowedURL(target,env,finalURL,true);
          const next={...grant,url:target,providerDerived:true};delete next.urls;
          return mediaPath+'?ticket='+await seal(next,env)
        });
        return new Response(rewritten,{headers:{'Content-Type':'application/vnd.apple.mpegurl','Cache-Control':'no-store'}});
      }
      if(!/^(video\/|audio\/|application\/octet-stream)/i.test(type)){await response.body?.cancel();throw new Error('Formato de mídia não suportado.')}
      const outgoing=new Headers({'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      for(const name of ['Content-Length','Content-Range','Accept-Ranges'])if(response.headers.has(name))outgoing.set(name,response.headers.get(name));
      return new Response(response.body,{status:response.status,headers:outgoing});
    }
    return reply({ok:false,error:'Rota não encontrada.'},404);
  }catch(error){const safe=publicFailure(error);return reply({ok:false,...safe},502)}
}
