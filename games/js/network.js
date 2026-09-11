export const API='https://api.portalfrete.net.br';
export async function api(path,body){
 const response=await fetch(API+'/v1/games'+path,{method:body?'POST':'GET',credentials:'include',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 let data;try{data=await response.json()}catch{throw new Error('Serviço de jogos indisponível.')}
 if(!response.ok||!data.ok)throw new Error(response.status===404?'O multiplayer ainda não foi publicado na Cloudflare.':data.error||'Acesso negado.');return data;
}
export async function authorize(){
 try{
  const access=await api('/access');if(access.unlocked){document.body.classList.remove('games-locked');return access}
  const screen=document.getElementById('accessScreen'),form=document.getElementById('accessForm'),password=document.getElementById('accessPassword'),error=document.getElementById('accessError'),button=document.getElementById('unlockGames');
  document.getElementById('accessUser').textContent=access.name||access.user;screen.hidden=false;password.focus();
  return await new Promise(resolve=>{form.addEventListener('submit',async event=>{event.preventDefault();error.textContent='';const value=password.value.trim();if(!/^\d{4}$/.test(value)){error.textContent='Digite os 4 números da senha.';password.focus();return}button.disabled=true;button.textContent='Verificando…';try{const result=await api('/unlock',{password:value});password.value='';screen.hidden=true;document.body.classList.remove('games-locked');resolve(result)}catch(reason){password.value='';error.textContent=reason.message;password.focus()}finally{button.disabled=false;button.textContent='Entrar no Games ↗'}})})
 }catch(error){document.body.replaceChildren();const panel=document.createElement('main'),title=document.createElement('h1'),msg=document.createElement('p'),back=document.createElement('a');title.textContent='Nova Frota Games';msg.textContent=error.message;back.textContent='Voltar ao Portal';back.href='../pages/home.html';panel.append(title,msg,back);document.body.append(panel);throw error;}
}
export class Connection {
 constructor(onMessage,onClose){this.onMessage=onMessage;this.onClose=onClose;this.socket=null;}
 connect(code){return new Promise((resolve,reject)=>{
  this.close();const ws=new WebSocket(API.replace('https:','wss:')+'/v1/games/rooms/'+code+'/connect');this.socket=ws;let opened=false;
  const timeout=setTimeout(()=>{ws.close();reject(new Error('A sala não respondeu. Verifique o código e sua sessão.'))},10000);
  ws.onmessage=e=>{let msg;try{msg=JSON.parse(e.data)}catch{return}if(msg.type==='welcome'){opened=true;clearTimeout(timeout);resolve(msg)}this.onMessage(msg)};
  ws.onerror=()=>{clearTimeout(timeout);if(!opened)reject(new Error('Não foi possível entrar. Confira o código, o limite da sala e o acesso ADMINISTRADOR.'))};
  ws.onclose=()=>{clearTimeout(timeout);if(!opened)reject(new Error('Sala indisponível.'));if(this.socket===ws){this.socket=null;this.onClose()}};
 });}
 send(data){if(this.socket?.readyState===WebSocket.OPEN&&this.socket.bufferedAmount<16384)this.socket.send(JSON.stringify(data));}
 close(){const old=this.socket;this.socket=null;if(old)old.close(1000,'Saída da sala');}
}
