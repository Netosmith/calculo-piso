(()=>{'use strict';
const API='https://api.portalfrete.net.br/v1/fleet',cash=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),val=n=>Number(n||0),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),$=id=>document.getElementById(id);
let allRows=[],loading=false;
const request=async(path,method='GET',data)=>{const r=await fetch(API+path,{method,credentials:'include',cache:'no-store',headers:{Accept:'application/json',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});const v=await r.json().catch(()=>({}));if(!r.ok||!v.ok)throw Error(v.error||'Falha na API financeira');return v};
const read=()=>allRows;
async function refresh(){
 if(loading)return;loading=true;
 try{
  if(typeof window.NFGFetchRows==='function')allRows=window.NFGFetchRows();
  else {const res=await request('/records?limit=500');allRows=res.records||[]}
  render();
 }catch(e){console.error(e);const el=$('nffBody');if(el)el.innerHTML='<tr><td colspan="9">Erro ao consultar D1. Atualize a página.</td></tr>'}
 finally{loading=false}
}
const store=async item=>{await request('/records/'+encodeURIComponent(item.id),'PUT',item);if(typeof window.NFGReload==='function')await window.NFGReload();await refresh();return true};
const receivable=r=>Math.max(0,r.netFreight!=null&&r.netFreight!==''?val(r.netFreight):val(r.gross)-val(r.discount)-val(r.otherDiscount));
const receipts=r=>(r.receipts||[]).filter(x=>x&&val(x.value)>0);
const received=r=>receipts(r).reduce((s,x)=>s+val(x.value),0);
const escAttr=esc;
function render(){
 const filters={plate:$('nffPlate').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,''),driver:$('nffDriver').value.trim().toLowerCase(),status:$('nffStatus').value,month:$('nffMonth').value};
 const list=read().filter(r=>r.type==='freight').filter(r=>(!filters.plate||String(r.plate||'').replace(/[^A-Z0-9]/g,'').includes(filters.plate))&&(!filters.driver||String(r.driver||'').toLowerCase().includes(filters.driver))&&(!filters.month||String(r.date||'').slice(0,7)===filters.month)).filter(r=>{const due=receivable(r),paid=received(r);return !filters.status||(filters.status==='pending'&&paid<due-.005)||(filters.status==='paid'&&paid>=due-.005)||(filters.status==='partial'&&paid>0&&paid<due-.005)}).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 let total=0,paidTotal=0,dueTotal=0,pending=0;for(const r of list){let t=receivable(r),p=Math.min(t,received(r)),d=Math.max(0,t-p);total+=t;paidTotal+=p;dueTotal+=d;if(d>.005)pending++}
 $('nffTotal').textContent=cash(total);$('nffReceived').textContent=cash(paidTotal);$('nffPending').textContent=cash(dueTotal);$('nffPendingCount').textContent=pending;
 $('nffBody').innerHTML=list.length?list.slice(0,200).map(r=>{const t=receivable(r),p=received(r),d=Math.max(0,t-p),status=d<.005?'Recebido':p>0?'Parcial':'A receber';return '<tr><td>'+esc(r.date)+'</td><td>'+esc(r.plate)+'</td><td>'+esc(r.driver)+'</td><td>'+esc(r.client||[r.origin,r.destination].filter(Boolean).join(' → '))+'</td><td>'+cash(t)+'</td><td>'+cash(p)+'</td><td>'+cash(d)+'</td><td>'+status+'</td><td>'+(d>.005?'<button class="nfg-action" type="button" data-nff-pay="'+escAttr(r.id)+'">Registrar recebimento</button>':'Quitado')+'</td></tr>'}).join('')+(list.length>200?'<tr><td colspan="9">Exibindo 200 de '+list.length+' fretes. Use os filtros para reduzir a listagem.</td></tr>':''):'<tr><td colspan="9">Nenhum frete encontrado. Lance os fretes na aba Fretes.</td></tr>';
 $('nffReceipts').innerHTML=list.flatMap(r=>receipts(r).map(x=>({r,x}))).sort((a,b)=>String(b.x.date||'').localeCompare(String(a.x.date||''))).slice(0,200).map(({r,x})=>'<tr><td>'+esc(x.date)+'</td><td>'+esc(r.plate)+'</td><td>'+esc(r.driver)+'</td><td>'+cash(x.value)+'</td><td>'+esc(x.reference)+'</td><td><button type="button" class="nfg-action secondary" data-nff-delete="'+escAttr(r.id)+'" data-nff-receipt="'+escAttr(x.id)+'">Estornar</button></td></tr>').join('')||'<tr><td colspan="6">Nenhum recebimento registrado.</td></tr>';
}
for(const id of ['nffPlate','nffDriver','nffStatus','nffMonth'])$(id)?.addEventListener('input',render);
document.querySelector('[data-nfg-panel="financeiro"]')?.addEventListener('click',async e=>{
 const pay=e.target.closest('[data-nff-pay]');if(pay){const all=read(),r=all.find(x=>x.id===pay.dataset.nffPay&&x.type==='freight');if(!r)return;const due=Math.max(0,receivable(r)-received(r));if(due<=.005)return;const amount=prompt('Valor recebido (saldo: '+cash(due)+'):',due.toFixed(2).replace('.',','));if(amount===null)return;const n=Number(String(amount).trim().replace(/^R\$\s*/,'').replace(/\s/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.'));if(!(n>0)||n>due+.005)return alert('Informe um valor positivo, limitado ao saldo a receber.');const date=prompt('Data do recebimento (AAAA-MM-DD):',new Date().toLocaleDateString('sv-SE'));if(date===null)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+'T12:00:00').getTime()))return alert('Data inválida');const reference=prompt('Referência / observação (opcional):','');if(reference===null)return;r.receipts=receipts(r).concat({id:'rec-'+Date.now()+'-'+Math.random().toString(36).slice(2),date,value:n,reference:reference.slice(0,200)});try{await store(r)}catch(err){alert('Não foi possível registrar recebimento online: '+err.message)}return}
 const del=e.target.closest('[data-nff-delete]');if(del){if(!confirm('Estornar este recebimento?'))return;const all=read(),r=all.find(x=>x.id===del.dataset.nffDelete);if(!r)return;r.receipts=receipts(r).filter(x=>x.id!==del.dataset.nffReceipt);try{await store(r)}catch(err){alert('Falha ao estornar: '+err.message)}}
});
window.addEventListener('nfg-records-changed',refresh);
refresh();
})();