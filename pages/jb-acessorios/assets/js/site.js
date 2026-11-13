(() => {
'use strict';
const ITEMS = [
  {id:1,name:'Smartphone Android 128 GB',category:'celulares',price:1199,tag:'DESTAQUE',art:'phone'},
  {id:2,name:'Caixa de som Bluetooth portátil',category:'audio',price:229.9,tag:'SOM',art:'speaker'},
  {id:3,name:'Fone de ouvido Bluetooth',category:'audio',price:149.9,tag:'POPULARES',art:'earbuds'},
  {id:4,name:'Carrinho de controle remoto',category:'brinquedos',price:179.9,tag:'DIVERSÃO',art:'toy'},
  {id:5,name:'Carregador rápido USB-C',category:'acessorios',price:69.9,tag:'ACESSÓRIOS',art:'charger'},
  {id:6,name:'Copo térmico personalizado',category:'personalizados',price:89.9,tag:'PERSONALIZADO',art:'cup'},
  {id:7,name:'Controle para jogos sem fio',category:'brinquedos',price:189.9,tag:'GAMES',art:'controller'},
  {id:8,name:'Power bank portátil 10.000 mAh',category:'acessorios',price:129.9,tag:'ENERGIA',art:'powerbank'},
  {id:9,name:'Smartphone compacto',category:'celulares',price:899,tag:'CELULARES',art:'phone'},
  {id:10,name:'Caixa de som com iluminação',category:'audio',price:359,tag:'MÚSICA',art:'speaker'},
  {id:11,name:'Película de proteção para celular',category:'acessorios',price:29.9,tag:'PROTEÇÃO',art:'phone'},
  {id:12,name:'Caneca personalizada com nome',category:'personalizados',price:59.9,tag:'PRESENTES',art:'cup'}
];
const CATS={celulares:'Celulares',audio:'Som e Áudio',brinquedos:'Brinquedos',acessorios:'Acessórios',personalizados:'Personalizados'};
const KEY_CART='jb-acessorios.cart.demo.v1', KEY_FAV='jb-acessorios.fav.demo.v1';
const $=s=>document.querySelector(s);
let active='todos',query='',favOnly=false,timer;
const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k));return Array.isArray(v)?v:f}catch{return f}};
let cart=load(KEY_CART,[]).filter(x=>ITEMS.some(p=>p.id===x.id)&&Number.isInteger(x.qty)&&x.qty>0);
let favorites=load(KEY_FAV,[]).filter(x=>ITEMS.some(p=>p.id===x));
const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
const escapeHtml=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function persist(){try{localStorage.setItem(KEY_CART,JSON.stringify(cart));localStorage.setItem(KEY_FAV,JSON.stringify(favorites))}catch{}}
function art(type){
 const shellStart='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 240" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffb345"/><stop offset="1" stop-color="#e77a0b"/></linearGradient><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#767680"/><stop offset=".5" stop-color="#28282e"/><stop offset="1" stop-color="#717078"/></linearGradient><radialGradient id="w"><stop stop-color="#ffbc63"/><stop offset=".5" stop-color="#a94a44"/><stop offset="1" stop-color="#28243b"/></radialGradient></defs>';
 const shapes={
 phone:'<g transform="rotate(-11 125 120)"><rect x="77" y="16" width="103" height="208" rx="19" fill="#54545d" stroke="#17171c" stroke-width="5"/><rect x="84" y="25" width="89" height="188" rx="12" fill="url(#w)"/><rect x="110" y="30" width="40" height="8" rx="4" fill="#1c1c24"/><circle cx="129" cy="190" r="7" fill="#ffe4a8" opacity=".45"/></g>',
 speaker:'<g transform="rotate(-9 125 120)"><rect x="69" y="22" width="114" height="194" rx="23" fill="url(#m)" stroke="#766a5d" stroke-width="3"/><rect x="80" y="35" width="92" height="169" rx="17" fill="#25242a"/><circle cx="126" cy="97" r="43" fill="#0c0c11" stroke="#4a474e" stroke-width="10"/><circle cx="126" cy="97" r="19" fill="url(#g)"/><circle cx="126" cy="172" r="19" fill="#101014" stroke="#504c4d" stroke-width="6"/><circle cx="126" cy="172" r="8" fill="url(#g)"/></g>',
 earbuds:'<rect x="48" y="125" width="154" height="85" rx="37" fill="url(#m)" stroke="#8c7965" stroke-width="4"/><rect x="64" y="138" width="123" height="51" rx="25" fill="#19181d"/><rect x="76" y="28" width="38" height="122" rx="18" fill="url(#m)"/><rect x="142" y="28" width="38" height="122" rx="18" fill="url(#m)"/><circle cx="94" cy="53" r="8" fill="#eda552"/><circle cx="160" cy="53" r="8" fill="#eda552"/>',
 toy:'<g transform="rotate(-8 125 120)"><path d="M50 147L70 100H173L198 147V185H50Z" fill="url(#g)" stroke="#9e5632" stroke-width="5"/><path d="M87 113H159L177 144H75Z" fill="#3e3838"/><rect x="50" y="151" width="148" height="33" rx="12" fill="#e98e1c"/><circle cx="84" cy="186" r="25" fill="#27252d" stroke="#7d716a" stroke-width="8"/><circle cx="165" cy="186" r="25" fill="#27252d" stroke="#7d716a" stroke-width="8"/></g>',
 charger:'<rect x="77" y="59" width="99" height="135" rx="22" fill="url(#m)"/><rect x="105" y="32" width="12" height="40" rx="4" fill="#c4bcb2"/><rect x="139" y="32" width="12" height="40" rx="4" fill="#c4bcb2"/><path d="M136 91L106 139H132L120 173L158 121H130L142 91Z" fill="url(#g)"/>',
 cup:'<g transform="rotate(-10 125 120)"><rect x="74" y="28" width="104" height="18" rx="7" fill="url(#m)"/><path d="M81 48H171L161 207Q125 222 91 207Z" fill="url(#m)" stroke="#948376" stroke-width="4"/><path d="M104 55L101 202" stroke="#fff" stroke-opacity=".17" stroke-width="8"/><text x="126" y="122" text-anchor="middle" fill="#ffc173" font-size="17" font-weight="800" font-family="sans-serif">SEU</text><text x="126" y="143" text-anchor="middle" fill="#ffc173" font-size="17" font-weight="800" font-family="sans-serif">NOME</text></g>',
 controller:'<path d="M68 84Q92 62 126 74Q160 62 183 84L208 144Q218 184 186 187Q169 188 147 158H104Q81 188 64 187Q33 185 45 144Z" fill="url(#m)" stroke="#85796b" stroke-width="4"/><path d="M83 118H125M104 97V139" stroke="#e7ad58" stroke-width="10" stroke-linecap="round"/><circle cx="169" cy="107" r="9" fill="#ee9d3b"/><circle cx="187" cy="124" r="9" fill="#e7b476"/><circle cx="149" cy="125" r="9" fill="#c17a3b"/><circle cx="167" cy="143" r="9" fill="#d99f62"/>',
 powerbank:'<g transform="rotate(10 126 120)"><rect x="82" y="23" width="95" height="194" rx="18" fill="url(#m)" stroke="#9b8872" stroke-width="3"/><rect x="100" y="46" width="60" height="9" rx="4" fill="#28272b"/><rect x="99" y="99" width="62" height="62" rx="15" fill="#201f25"/><path d="M133 105L112 131H132L122 155L153 120H132L141 105Z" fill="url(#g)"/></g>'
 };
 return shellStart+(shapes[type]||shapes.phone)+'</svg>';
}
function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('show'),2600)}
function render(){
 const count=cart.reduce((sum,x)=>sum+x.qty,0);
 $('#cart-count').textContent=count;
 $('#favorite-count').textContent=favorites.length;
 const list=ITEMS.filter(p=>(active==='todos'||p.category===active)&&(!favOnly||favorites.includes(p.id))&&(!query||(p.name+' '+CATS[p.category]).toLocaleLowerCase('pt-BR').includes(query)));
 $('#product-grid').innerHTML=list.map(p=>'<article class="product"><div class="product-media" data-category="'+p.category+'"><span class="product-tag">'+escapeHtml(p.tag)+'</span><button type="button" class="fav '+(favorites.includes(p.id)?'on':'')+'" data-fav="'+p.id+'" aria-label="Favoritar '+escapeHtml(p.name)+'">'+(favorites.includes(p.id)?'♥':'♡')+'</button><div class="art">'+art(p.art)+'</div></div><div class="product-body"><span class="product-category">'+escapeHtml(CATS[p.category])+'</span><h3>'+escapeHtml(p.name)+'</h3><div class="price">'+brl(p.price)+'</div><small class="price-note">Valor ilustrativo • confirmar disponibilidade</small><button type="button" class="add" data-add="'+p.id+'">Adicionar ao carrinho +</button></div></article>').join('');
 $('#empty-products').hidden=list.length>0;
 document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===active));
 renderCart();
}
function renderCart(){
 const filtered=cart.map(row=>({p:ITEMS.find(x=>x.id===row.id),qty:row.qty})).filter(row=>row.p);
 $('#cart-items').innerHTML=filtered.length?filtered.map(({p,qty})=>'<div class="cart-row"><div class="cart-art">'+({phone:'📱',speaker:'🔊',earbuds:'🎧',toy:'🚘',charger:'🔌',cup:'🥤',controller:'🎮',powerbank:'🔋'}[p.art]||'📦')+'</div><div><b>'+escapeHtml(p.name)+'</b><small>'+brl(p.price)+' por unidade</small><div class="qty"><button type="button" data-qty="'+p.id+'" data-delta="-1" aria-label="Reduzir quantidade">−</button><span>'+qty+'</span><button type="button" data-qty="'+p.id+'" data-delta="1" aria-label="Aumentar quantidade">+</button></div></div><strong>'+brl(p.price*qty)+'</strong></div>').join(''):'<p style="font-size:13px;color:#777">Seu carrinho está vazio. Adicione produtos na vitrine.</p>';
 $('#cart-total').textContent=brl(filtered.reduce((sum,row)=>sum+row.qty*row.p.price,0));
}
function filterTo(c){active=c;query='';favOnly=false;$('#search-input').value='';render();$('#catalogo').scrollIntoView({behavior:'smooth'})}
function openCart(){renderCart();$('#cart-veil').hidden=false;$('#cart-drawer').classList.add('open');$('#cart-drawer').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('#close-cart').focus()}
function closeCart(){$('#cart-veil').hidden=true;$('#cart-drawer').classList.remove('open');$('#cart-drawer').setAttribute('aria-hidden','true');document.body.style.overflow=''}
async function copyText(text){
 try{await navigator.clipboard.writeText(text);toast('Texto copiado para você enviar ao atendimento.')}
 catch{const temp=document.createElement('textarea');temp.value=text;temp.style.position='fixed';temp.style.left='-9999px';document.body.appendChild(temp);temp.select();let ok=false;try{ok=document.execCommand('copy')}catch{}temp.remove();toast(ok?'Texto copiado!':'Não foi possível copiar. Verifique a permissão do navegador.')}
}
document.addEventListener('click',e=>{
 const add=e.target.closest('[data-add]');if(add){const id=Number(add.dataset.add);let row=cart.find(x=>x.id===id);if(row)row.qty=Math.min(50,row.qty+1);else cart.push({id,qty:1});persist();render();toast('Adicionado ao carrinho!');return}
 const fav=e.target.closest('[data-fav]');if(fav){const id=Number(fav.dataset.fav);favorites=favorites.includes(id)?favorites.filter(n=>n!==id):[...favorites,id];persist();render();toast(favorites.includes(id)?'Adicionado aos favoritos!':'Removido dos favoritos.');return}
 const qty=e.target.closest('[data-qty]');if(qty){const id=Number(qty.dataset.qty),delta=Number(qty.dataset.delta);const row=cart.find(x=>x.id===id);if(row){row.qty+=delta;if(row.qty<=0)cart=cart.filter(x=>x!==row);else row.qty=Math.min(50,row.qty);persist();render()}return}
 const filter=e.target.closest('[data-filter],[data-category],[data-nav-filter]');if(filter){e.preventDefault();filterTo(filter.dataset.filter||filter.dataset.category||filter.dataset.navFilter);return}
});
$('#search-form').addEventListener('submit',e=>{e.preventDefault();active='todos';favOnly=false;query=$('#search-input').value.trim().toLocaleLowerCase('pt-BR');render();$('#catalogo').scrollIntoView({behavior:'smooth'})});
$('#favorites-button').addEventListener('click',()=>{favOnly=!favOnly;active='todos';query='';$('#search-input').value='';render();$('#catalogo').scrollIntoView({behavior:'smooth'});toast(favOnly?'Exibindo favoritos':'Exibindo todos os produtos')});
$('#cart-button').addEventListener('click',openCart);
$('#close-cart').addEventListener('click',closeCart);
$('#cart-veil').addEventListener('click',closeCart);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCart()});
$('#copy-cart').addEventListener('click',()=>{
 if(!cart.length){toast('Adicione algum produto primeiro.');return}
 const rows=cart.map(r=>{const p=ITEMS.find(p=>p.id===r.id);return r.qty+'x '+p.name+' • '+brl(p.price*r.qty)});
 const total=cart.reduce((sum,r)=>sum+ITEMS.find(p=>p.id===r.id).price*r.qty,0);
 copyText(['JB ACESSÓRIOS • Lista de interesse (demonstração)','',...rows,'','Total ilustrativo: '+brl(total),'','Confirmar valores, estoque, entrega e formas de pagamento com a loja.'].join('\n'));
});
$('#service-form').addEventListener('submit',e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);
 copyText(['Solicitação de avaliação • JB Acessórios','Nome: '+f.get('nome'),'Marca: '+f.get('marca'),'Modelo: '+f.get('modelo'),'Problema: '+f.get('problema'),'','Solicito avaliação e orçamento antes de qualquer reparo.'].join('\n'));
});
$('#custom-form').addEventListener('submit',e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);
 copyText(['Pedido de gravação • JB Acessórios','Tipo de copo: '+f.get('tipo'),'Texto: '+f.get('texto'),'','Solicito orçamento e prazo para personalização.'].join('\n'));
});
$('#year').textContent=new Date().getFullYear();
render();
})();