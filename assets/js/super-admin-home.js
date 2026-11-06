/* Navigation only. Owner authorization and tenant data access stay on the server. */
'use strict';
let adminHomeReady=false;
function adminRegistryTarget(company){
 const home=publicHomeForTenant(company);
 return home ? home.replace(/home\.html$/, 'cadastros.html') : '';
}
function renderAdminRegistry(){
 const root=document.getElementById('registryCompanies');
 const term=document.getElementById('registrySearch').value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const visible=companies.filter(company=>(company.name+' '+company.id).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(term));
 root.replaceChildren();
 document.getElementById('registryCount').textContent=visible.length+' de '+companies.length+' transportadoras';
 for(const company of visible){
  const card=document.createElement('article');card.className='registry-company';
  const title=document.createElement('h3');title.textContent=company.name;
  const status=document.createElement('span');status.className='company-state'+(company.active?' active':'');status.textContent=company.active?'Ativa':'Inativa';
  const description=document.createElement('p');description.textContent=company.id==='nova-frota'?'Usuários, regionais, filiais, clientes, contatos e funcionários da Nova Frota.':'Usuários e cadastros operacionais desta transportadora.';
  const actions=document.createElement('div');actions.className='registry-actions';
  const target=adminRegistryTarget(company);
  const enabled=company.id==='nova-frota'||company.modules?.includes('cadastros');
  if(target&&enabled){
   const link=document.createElement('a');link.href=target;link.target='_blank';link.rel='noopener';link.textContent='Abrir cadastros ↗';link.setAttribute('aria-label','Abrir cadastros de '+company.name+' em nova aba');actions.append(link);
  }else{
   const reason=document.createElement('p');reason.className='muted';reason.textContent=!target?'Página de cadastros ainda não vinculada.':'Módulo Cadastros desabilitado. Habilite em Transportadoras.';card.append(reason);
  }
  const usersButton=document.createElement('button');usersButton.type='button';usersButton.className='ghost';usersButton.textContent='Gerenciar usuários';
  usersButton.onclick=()=>{
   selected=company;rememberSelectedCompany(company.id);
   location.hash='transportadoras';showAdminView('transportadoras');
   render();loadUsers();loadAudit();loadBrand();loadIntegration();loadArtThemes();showGalleryDetail(true);
   document.querySelector('[data-tab="users"]').click();
  };
  actions.append(usersButton);card.prepend(title,status,description);card.append(actions);root.append(card);
 }
 if(!visible.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='Nenhuma transportadora encontrada para esta busca.';root.append(empty);}
}
function showAdminView(view,focus=true){
 if(!adminHomeReady)return;
 if(!['transportadoras','cadastros','manual'].includes(view))view='home';
 for(const [key,id] of [['home','adminHome'],['transportadoras','transportadorasView'],['cadastros','cadastrosView'],['manual','manualView']])document.getElementById(id).hidden=key!==view;
 document.getElementById('adminHomeBack').hidden=view==='home';
 if(view==='cadastros')renderAdminRegistry();
 if(focus){const heading=document.getElementById({home:'adminHomeTitle',cadastros:'cadastrosTitle',manual:'manualTitle',transportadoras:'companySearch'}[view]);heading?.focus({preventScroll:true});}
}
function initializeAdminHome(){
 if(adminHomeReady)return;
 adminHomeReady=true;
 document.querySelectorAll('[data-admin-view]').forEach(button=>button.addEventListener('click',()=>{location.hash=button.dataset.adminView;}));
 document.getElementById('adminHomeBack').onclick=()=>{location.hash='home';};
 document.getElementById('registrySearch').addEventListener('input',renderAdminRegistry);
 addEventListener('hashchange',()=>showAdminView(location.hash.slice(1)));
 showAdminView(location.hash.slice(1),false);
}
