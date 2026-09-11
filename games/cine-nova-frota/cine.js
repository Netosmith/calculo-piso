import {authorize,api,API} from '../js/network.js';
await authorize();
const $=id=>document.getElementById(id),video=$('video');
let seat=null,claiming=false;
let channels=[],hls=null,current='',onlyFavorites=false,limit=80,sequence=0;
let favorites=new Set();try{favorites=new Set(JSON.parse(localStorage.getItem('cine.favorites')||'[]'))}catch{}
function status(message){$('status').textContent=message;$('accessStatus').textContent=message}
function seatQuery(){return '?slot='+seat.id+'&lease='+encodeURIComponent(seat.lease)}
function stop(){sequence++;hls?.destroy();hls=null;video.pause();video.removeAttribute('src');video.load();$('placeholder').hidden=false;$('stop').disabled=true;current=''}
function render(){
 const query=$('search').value.trim().toLocaleLowerCase('pt-BR'),group=$('group').value;
 const filtered=channels.filter(c=>(!group||c.group===group)&&(!onlyFavorites||favorites.has(c.id))&&c.name.toLocaleLowerCase('pt-BR').includes(query));
 $('count').textContent=filtered.length;$('channels').replaceChildren();
 for(const channel of filtered.slice(0,limit)){
  const row=document.createElement('div'),button=document.createElement('button'),name=document.createElement('span'),groupLabel=document.createElement('small'),star=document.createElement('button');
  row.className='channel';name.textContent=channel.name;groupLabel.textContent=channel.group;button.append(name,groupLabel);button.classList.toggle('chosen',current===channel.id);button.onclick=()=>play(channel);
  star.className='star';star.textContent=favorites.has(channel.id)?'★':'☆';star.setAttribute('aria-label','Favoritar '+channel.name);star.setAttribute('aria-pressed',String(favorites.has(channel.id)));star.onclick=()=>{favorites.has(channel.id)?favorites.delete(channel.id):favorites.add(channel.id);try{localStorage.setItem('cine.favorites',JSON.stringify([...favorites]))}catch{}render()};
  row.append(button,star);$('channels').append(row);
 }
 if(!filtered.length){const empty=document.createElement('p');empty.className='empty';empty.textContent=channels.length?'Nenhum canal encontrado.':'A lista de canais ainda não está disponível.';$('channels').append(empty)}
 $('more').hidden=filtered.length<=limit;
}
function responseError(error,fallback){
 const text=error?.response?.text;
 if(text){try{const data=JSON.parse(text);if(data?.error)return data.error}catch{}}
 const code=error?.response?.code;
 return code?fallback+' (HTTP '+code+')':fallback;
}
async function play(channel){
 stop();const attempt=sequence;current=channel.id;$('channelTitle').textContent=channel.name;$('stop').disabled=false;render();status('Conectando ao canal…');
 try{
  const data=await api('/cine/play/'+channel.id+seatQuery());if(attempt!==sequence)return;
  const source=new URL(data.path,API).href;
  const probe=await fetch(source,{credentials:'include',cache:'no-store'});
  if(!probe.ok){
   let message='Não foi possível abrir a transmissão deste canal.';
   try{const body=await probe.json();if(body?.error)message=body.error}catch{}
   throw new Error(message+' (HTTP '+probe.status+')');
  }
  const probeType=probe.headers.get('Content-Type')||'';
  if(probeType.includes('json')){let body=null;try{body=await probe.json()}catch{}throw new Error(body?.error||'O servidor não retornou um manifesto HLS válido.')}
  await probe.body?.cancel();
  $('placeholder').hidden=true;
  if(window.Hls?.isSupported()){
   hls=new window.Hls({maxBufferLength:30,xhrSetup:xhr=>{xhr.withCredentials=true}});hls.loadSource(source);hls.attachMedia(video);
   hls.on(window.Hls.Events.MANIFEST_PARSED,()=>{if(attempt===sequence)video.play().catch(()=>status('Clique no botão de reprodução para assistir.'))});
   hls.on(window.Hls.Events.ERROR,(_,error)=>{if(error.fatal&&attempt===sequence){const message=responseError(error,'Não foi possível reproduzir este canal. Selecione novamente ou tente outro canal.');stop();render();status(message)}});
  }else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=source;await video.play()}else{throw new Error('Seu navegador não oferece suporte a este formato de vídeo.')}
 }catch(error){if(attempt!==sequence)return;stop();render();status(error.message)}
}
video.addEventListener('playing',()=>status('Reproduzindo · '+$('channelTitle').textContent));video.addEventListener('waiting',()=>{if(current)status('Carregando vídeo…')});video.addEventListener('error',()=>{if(current){stop();render();status('O canal está indisponível ou usa um formato incompatível.')}});
$('stop').onclick=()=>{stop();render();status('Reprodução encerrada.')};
$('search').oninput=$('group').onchange=()=>{limit=80;render()};$('favorites').onclick=()=>{onlyFavorites=!onlyFavorites;$('favorites').setAttribute('aria-pressed',String(onlyFavorites));limit=80;render()};$('more').onclick=()=>{limit+=80;render()};
async function refreshSeats(){
 const data=await api('/cine/accesses');
 for(const entry of data.slots){const button=document.querySelector('[data-access="'+entry.id+'"]');button.disabled=claiming||entry.state!=='free';button.dataset.state=entry.state;button.querySelector('.seat-state').textContent={free:'Livre · Entrar',busy:'Em uso',unconfigured:'Em configuração'}[entry.state]}
}
async function claimSeat(id){
 if(claiming||seat)return;claiming=true;document.querySelectorAll('[data-access]').forEach(b=>b.disabled=true);status('Reservando acesso…');
 try{
  const reservation=await api('/cine/accesses/'+id+'/claim',{});seat={id,lease:reservation.lease};
  $('search').value='';$('group').replaceChildren(new Option('Todas as categorias',''));channels=[];limit=80;onlyFavorites=false;$('favorites').setAttribute('aria-pressed','false');render();
  status('Carregando canais…');const selected=seat,data=await api('/cine/catalog'+seatQuery());if(seat!==selected)return;
  channels=data.channels;for(const group of [...new Set(channels.map(c=>c.group))].sort())$('group').append(new Option(group,group));
  $('activeSeat').textContent='Acesso '+id;$('accessPicker').hidden=true;$('watchArea').hidden=false;render();status('Escolha um canal para começar.');
 }catch(error){const message=error.message;if(seat)await releaseSeat(false);status(message)}finally{claiming=false;refreshSeats().catch(()=>{})}
}
async function releaseSeat(update=true){
 stop();const old=seat;seat=null;channels=[];render();$('watchArea').hidden=true;$('accessPicker').hidden=false;
 if(old){try{await api('/cine/accesses/'+old.id+'/release',{lease:old.lease})}catch{status('Reprodução encerrada. O acesso será liberado automaticamente em até 90 segundos.');return}}
 if(update){status('Acesso liberado.');refreshSeats().catch(()=>{})}
}
$('releaseSeat').onclick=()=>releaseSeat();
document.querySelectorAll('[data-access]').forEach(button=>button.onclick=()=>claimSeat(button.dataset.access));
try{await refreshSeats();status('Selecione um acesso livre para assistir.')}catch(error){status(error.message)}
setInterval(async()=>{
 const selected=seat;
 try{
  const access=await api('/access');if(!access.unlocked)throw new Error('Sua sessão terminou.');
  if(selected)await api('/cine/accesses/'+selected.id+'/heartbeat',{lease:selected.lease});else await refreshSeats();
 }catch(error){if(seat===selected&&selected){stop();seat=null;$('watchArea').hidden=true;$('accessPicker').hidden=false}status(error.message)}
},15000);
window.addEventListener('pagehide',()=>{
 stop();const old=seat;seat=null;
 if(old)fetch(API+'/v1/games/cine/accesses/'+old.id+'/release',{method:'POST',credentials:'include',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({lease:old.lease})}).catch(()=>{});
});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()});
