import {authorize,api,API} from '../js/network.js';
await authorize();
const $=id=>document.getElementById(id),video=$('video');
let channels=[],hls=null,current='',onlyFavorites=false,limit=80,sequence=0;
let favorites=new Set();try{favorites=new Set(JSON.parse(localStorage.getItem('cine.favorites')||'[]'))}catch{}
function status(message){$('status').textContent=message}
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
async function play(channel){
 stop();const attempt=sequence;current=channel.id;$('channelTitle').textContent=channel.name;$('stop').disabled=false;render();status('Conectando ao canal…');
 try{
  const data=await api('/cine/play/'+channel.id);if(attempt!==sequence)return;
  const source=new URL(data.path,API).href;
  $('placeholder').hidden=true;
  if(window.Hls?.isSupported()){
   hls=new window.Hls({maxBufferLength:30,xhrSetup:xhr=>{xhr.withCredentials=true}});hls.loadSource(source);hls.attachMedia(video);
   hls.on(window.Hls.Events.MANIFEST_PARSED,()=>{if(attempt===sequence)video.play().catch(()=>status('Clique no botão de reprodução para assistir.'))});
   hls.on(window.Hls.Events.ERROR,(_,error)=>{if(error.fatal&&attempt===sequence){stop();render();status('Não foi possível reproduzir este canal. Selecione novamente ou tente outro canal.')}});
  }else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=source;await video.play()}else{throw new Error('Seu navegador não oferece suporte a este formato de vídeo.')}
 }catch(error){if(attempt!==sequence)return;stop();render();status(error.message)}
}
video.addEventListener('playing',()=>status('Reproduzindo · '+$('channelTitle').textContent));video.addEventListener('waiting',()=>{if(current)status('Carregando vídeo…')});video.addEventListener('error',()=>{if(current){stop();render();status('O canal está indisponível ou usa um formato incompatível.')}});
$('stop').onclick=()=>{stop();render();status('Reprodução encerrada.')};
$('search').oninput=$('group').onchange=()=>{limit=80;render()};$('favorites').onclick=()=>{onlyFavorites=!onlyFavorites;$('favorites').setAttribute('aria-pressed',String(onlyFavorites));limit=80;render()};$('more').onclick=()=>{limit+=80;render()};
try{const data=await api('/cine/catalog');channels=data.channels;for(const group of [...new Set(channels.map(c=>c.group))].sort()){const option=document.createElement('option');option.value=option.textContent=group;$('group').append(option)}status('Escolha um canal para começar.')}catch(error){status(error.message)}render();
setInterval(async()=>{try{const access=await api('/access');if(!access.unlocked)throw new Error()}catch{stop();location.reload()}},30000);
window.addEventListener('pagehide',stop);
