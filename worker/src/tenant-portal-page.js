// Static same-origin tenant portal: no external scripts, fonts or production APIs.
export const tenantPortalPage = `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Portal Frete | Acesso da Transportadora</title>
<style>
:root{font-family:Inter,system-ui,Arial,sans-serif;color:#edf5ff;background:#071526}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,#071526,#0c263d)}
header{display:flex;justify-content:space-between;align-items:center;padding:19px clamp(18px,4vw,55px);background:#0b2139;border-bottom:1px solid #294764}
header strong{letter-spacing:.08em;font-size:18px}header small{display:block;color:#9ab8d2;margin-top:4px}
main{max-width:1150px;margin:38px auto;padding:0 20px}.card{background:#10283f;border:1px solid #31516d;border-radius:17px;padding:23px;box-shadow:0 10px 30px #0002}
.login{max-width:465px;margin:65px auto}h1{font-size:28px;margin:0 0 10px}h2{margin:0 0 15px;font-size:20px}
p{color:#abc2d8;line-height:1.5}label{display:block;font-size:13px;color:#c1d5e8;margin-top:13px}
input,select{display:block;width:100%;padding:12px;margin-top:6px;border:1px solid #426381;background:#0a1c30;color:#fff;border-radius:9px;font:inherit}
input:focus{outline:2px solid #58a3e8}button{cursor:pointer;border:1px solid #3c89ca;background:#1670b3;color:white;border-radius:9px;padding:11px 16px;font:inherit}
button:hover{filter:brightness(1.12)}button:disabled{opacity:.55;cursor:not-allowed}.ghost{background:transparent}
.row{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}
.module{padding:17px;border-radius:12px;border:1px solid #335e80;background:#14334f;text-align:left}
.module[disabled]{background:#122437}.module b{display:block;margin-bottom:6px}.muted{color:#9db8d0;font-size:13px}
#notice{margin-bottom:18px;border-radius:9px;padding:13px;background:#213b52;border:1px solid #416580}
#notice:empty{display:none}.cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}
table{width:100%;border-collapse:collapse}th,td{padding:11px 8px;text-align:left;border-bottom:1px solid #34536e;font-size:13px}
th{color:#9ebbd5}.hide{display:none!important}footer{text-align:center;color:#7896b0;font-size:12px;padding:28px}
@media(max-width:770px){.cols{grid-template-columns:1fr}header{padding:14px}main{margin:18px auto}.card{padding:16px}table{display:block;overflow-x:auto}}
</style></head><body>
<header><div><strong>PORTAL FRETE</strong><small id="topBrand">Ambiente das transportadoras</small></div><button id="logout" class="ghost hide">Sair</button></header>
<main>
<div id="notice" role="status"></div>
<section id="login" class="card login">
<h1>Acesso da transportadora</h1><p>Entre com a empresa, usuário e senha fornecidos pelo administrador.</p>
<form id="loginForm">
<label>Identificador da transportadora<input id="tenant" autocomplete="organization" placeholder="ex.: teste-01" required maxlength="48"></label>
<label>Usuário<input id="username" autocomplete="username" placeholder="ex.: USUARIO.TESTE" required maxlength="80"></label>
<label>Senha<input id="password" type="password" autocomplete="current-password" required></label>
<p><button type="submit" id="loginButton">Entrar no Portal Frete</button></p>
</form>
<p class="muted">Este ambiente é separado da Nova Frota. O primeiro acesso exige senha configurada pelo Super Admin e transportadora ativa.</p>
</section>
<section id="portal" class="hide">
<div class="row"><div><h1 id="companyTitle">Minha transportadora</h1><p id="userCaption"></p></div><span id="state">Ambiente de homologação</span></div>
<div class="card"><h2>Meus módulos</h2><div id="modules" class="grid"></div></div>
<section id="freightSection" class="card hide" style="margin-top:20px">
<div class="row"><h2>Fretes da transportadora</h2><button id="refreshFreights" class="ghost">Atualizar</button></div>
<p class="muted">Dados próprios desta empresa. Não inclui fretes de outras transportadoras nem da Nova Frota.</p>
<form id="freightForm" class="cols">
<div><label>Origem<input id="origin" required maxlength="100" placeholder="Ex.: Rio Verde - GO"></label>
<label>Destino<input id="destination" required maxlength="100" placeholder="Ex.: Santos - SP"></label></div>
<div><label>Produto<input id="product" required maxlength="60" placeholder="Ex.: Soja"></label>
<label>Valor por tonelada (R$)<input id="price" type="number" required min=".01" max="100000" step=".01" placeholder="Ex.: 220.00"></label></div>
<div><button type="submit" id="saveFreight">Cadastrar frete</button></div>
</form><div style="overflow:auto;margin-top:15px"><table><thead><tr><th>Origem</th><th>Destino</th><th>Produto</th><th>R$/ton</th><th>Status</th><th>Ação</th></tr></thead><tbody id="freights"></tbody></table></div>
<p id="emptyFreights" class="muted"></p>
</section>
<section id="biSection" class="card hide" style="margin-top:20px"><h2>BI da transportadora</h2><div class="grid" id="biCards"></div></section>
</section>
</main><footer>Portal Frete | Área isolada por transportadora</footer>
<script>
'use strict';
const $=id=>document.getElementById(id);
const EDIT_ROLES=new Set(['ADMINISTRADOR','COMERCIAL','OPERACIONAL','GOADM']);
let profile=null;
function notice(message){$('notice').textContent=String(message||'');}
async function api(path,options={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,
  headers:{'Accept':'application/json',...(options.headers||{})}});
 const data=await response.json().catch(()=>null);
 if(!response.ok){const error=new Error(data?.error||'Falha HTTP '+response.status);error.status=response.status;throw error;}
 return data;
}
async function post(path,data,method='POST'){
 return api(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
}
function text(el,value){el.textContent=String(value??'');}
function formatPrice(value){return Number(value).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function showLogin(){profile=null;$('portal').classList.add('hide');$('login').classList.remove('hide');$('logout').classList.add('hide');}
function showPortal(){
 $('login').classList.add('hide');$('portal').classList.remove('hide');$('logout').classList.remove('hide');
 text($('companyTitle'),profile.tenant.name);
 text($('topBrand'),profile.tenant.name);
 text($('userCaption'),'Usuário '+profile.usuario+' | Perfil '+profile.perfil);
 renderModules();
}
function renderModules(){
 const root=$('modules');root.replaceChildren();
 const labels={fretes:'Fretes',fretes2:'Fretes MT',bi:'BI',piso:'Piso ANTT',divulgacao:'Divulgação',
 controle:'Controle de Embarque',share:'Compartilhar com clientes',ordem:'Ordem de carregamento',
 cadastros:'Cadastros',estadias:'Estadias', 'custo-frota':'Custo de frota',
 administrativo:'Administrativo',monitoramento:'Monitoramento'};
 const active=profile.modules||[];
 if(!active.length){root.textContent='Nenhum módulo foi habilitado para esta transportadora.';return;}
 for(const key of active){
  const supported=key==='fretes'||key==='fretes2'||key==='bi';
  const button=document.createElement('button');button.className='module';button.disabled=!supported;
  const bold=document.createElement('b');text(bold,labels[key]||key);
  const description=document.createElement('span');description.className='muted';
  text(description,supported?'Abrir módulo':'Em preparação nesta transportadora');
  button.append(bold,description);
  if(supported)button.onclick=()=>openModule(key);
  root.append(button);
 }
}
async function openModule(key){
 $('freightSection').classList.add('hide');$('biSection').classList.add('hide');
 if(key==='fretes'||key==='fretes2'){
  $('freightSection').classList.remove('hide');
  $('freightForm').classList.toggle('hide',!EDIT_ROLES.has(profile.perfil));
  await loadFreights();
 }else if(key==='bi'){
  $('biSection').classList.remove('hide');
  try{
   const stats=await api('/api/bi');
   const root=$('biCards');root.replaceChildren();
   for(const [label,n] of [['Fretes cadastrados',stats.total],['Abertos',stats.abertos],['Finalizados',stats.finalizados]]){
    const box=document.createElement('div');box.className='module';
    const h=document.createElement('b');text(h,label);const val=document.createElement('strong');text(val,n);
    box.append(h,val);root.append(box);
   }
  }catch(error){notice(error.message);}
 }
}
async function loadFreights(){
 try{
  const result=await api('/api/fretes'),items=result.fretes||[],tbody=$('freights');tbody.replaceChildren();
  text($('emptyFreights'),items.length?'':'Ainda não há fretes cadastrados para esta transportadora.');
  for(const item of items){
   const tr=document.createElement('tr');
   for(const value of [item.origem,item.destino,item.produto,formatPrice(item.valorTon),item.status]){
    const td=document.createElement('td');text(td,value);tr.append(td);
   }
   const last=document.createElement('td');
   if(EDIT_ROLES.has(profile.perfil)){
    const btn=document.createElement('button');btn.textContent=item.status==='aberto'?'Finalizar':'Reabrir';
    btn.onclick=async()=>{try{
     await post('/api/fretes/'+encodeURIComponent(item.id),{status:item.status==='aberto'?'finalizado':'aberto'},'PATCH');
     await loadFreights();notice('Situação do frete atualizada.');
    }catch(error){notice(error.message);}};
    last.append(btn);
   }else{text(last,'Somente leitura');}
   tr.append(last);tbody.append(tr);
  }
 }catch(error){notice(error.message);}
}
$('loginForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=$('loginButton');button.disabled=true;notice('');
 try{
  await post('/api/login',{tenantId:$('tenant').value.trim().toLowerCase(),
   usuario:$('username').value.trim().toUpperCase(),senha:$('password').value});
  $('password').value='';await initialize();
 }catch(error){notice(error.status===429?'Muitas tentativas. Aguarde 15 minutos.':error.message);}
 finally{button.disabled=false;}
});
$('freightForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=$('saveFreight');button.disabled=true;
 try{
  await post('/api/fretes',{origem:$('origin').value,destino:$('destination').value,
   produto:$('product').value,valorTon:Number($('price').value)});
  $('freightForm').reset();await loadFreights();notice('Frete cadastrado para '+profile.tenant.name+'.');
 }catch(error){notice(error.message);}finally{button.disabled=false;}
});
$('refreshFreights').onclick=loadFreights;
$('logout').onclick=async()=>{try{await post('/api/logout',{});}finally{showLogin();notice('Sessão encerrada.');}};
async function initialize(){
 try{const me=await api('/api/me');profile=me;showPortal();notice('');
  const params=new URLSearchParams(location.search);
  if(params.has('tenant'))$('tenant').value=params.get('tenant');
 }catch{showLogin();}
}
const tenantHint=new URLSearchParams(location.search).get('tenant');
if(tenantHint)$('tenant').value=tenantHint;
initialize();
</script></body></html>`;
