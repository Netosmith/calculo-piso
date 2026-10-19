(()=>{'use strict';
const host=document.getElementById('nfGestao');if(!host)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={date:'Data',plate:'Placa',driver:'Motorista',invoice:'Nota fiscal',cte:'CT-e',reference:'Referência',carrier:'Transportadora',origin:'Cidade origem',originUf:'UF origem',loadingPlace:'Local carregamento',destination:'Cidade destino',destinationUf:'UF destino',unloadingPlace:'Local descarga',product:'Produto',departureWeight:'Peso saída (kg)',arrivalWeight:'Peso chegada (kg)',gross:'Frete bruto (R$)',netFreight:'Frete líquido da planilha (R$)',toll:'Pedágio (R$)',insurance:'Seguro (R$)',advance:'Adiantamento (R$)',otherSourceDiscount:'Outros descontos (R$)',weightLoss:'Quebra',weightLossDiscount:'Desconto quebra (R$)',finalBalance:'Saldo final (R$)',driverFreightRate:'Frete motorista (R$/t)',sourcePaymentStatus:'Status de pagamento original',sourceFinancialStatus:'Status financeiro original',sourceBalance:'Saldo original',rate:'Comissão %',value:'Valor (R$)',liters:'Litros',price:'Preço por litro',odometer:'KM atual',nextOdometer:'Próxima revisão (KM)',supplier:'Fornecedor / posto',city:'Cidade',uf:'UF',description:'Descrição',status:'Situação',paymentMethod:'Forma de pagamento',pix:'PIX',category:'Categoria'};
const numbers=new Set(['gross','netFreight','discount','otherDiscount','rate','km','value','liters','price','odometer','nextOdometer','toll','insurance','advance','otherSourceDiscount','driverFreightRate','departureWeight','arrivalWeight','weightLossDiscount','finalBalance','sourceBalance']);
const ignore=new Set(['id','type','source','receipts','createdAt','created_by','importWarnings','isSchedule','undated']);
const presets={freight:['date','plate','driver','invoice','cte','reference','carrier','origin','originUf','loadingPlace','destination','destinationUf','unloadingPlace','product','departureWeight','arrivalWeight','gross','netFreight','toll','insurance','advance','otherSourceDiscount','weightLoss','weightLossDiscount','finalBalance','driverFreightRate','sourcePaymentStatus','sourceFinancialStatus','sourceBalance','status','rate'],
expense:['date','plate','driver','city','uf','supplier','description','category','value','paymentMethod','status','reference'],
fuel:['date','plate','driver','category','value','liters','price','odometer','supplier','city','uf','status','reference'],
commission:['date','plate','driver','category','value','description','pix','status','reference'],
maintenance:['date','plate','driver','category','value','odometer','nextOdometer','supplier','city','uf','description','status']};
const overlay=document.createElement('div');overlay.id='nfgeOverlay';overlay.style.cssText='position:fixed;inset:0;z-index:99999;display:none;background:#061b2bd8;padding:3vh 3vw;overflow:auto';
overlay.innerHTML='<div style="max-width:1200px;margin:auto;background:white;color:#142e4a;border-radius:18px;padding:22px"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><h2>Detalhes completos do lançamento</h2><button type="button" class="nfg-action secondary" id="nfgeClose">Fechar</button></div><p class="nfg-muted">Editar os campos operacionais não altera a cópia das colunas originais. Recebimentos são alterados apenas na aba Financeiro.</p><form id="nfgeForm"><div class="nfg-fields" id="nfgeFields"></div><button type="submit" class="nfg-action" id="nfgeSave" style="margin-top:16px">Salvar alterações online</button></form><details style="margin-top:24px"><summary>Ver TODAS as colunas e fórmulas originais da planilha</summary><div id="nfgeOriginal" class="nfg-tablewrap"></div></details><p id="nfgeStatus" role="status" class="nfg-muted"></p></div>';
document.body.appendChild(overlay);
let active=null;
const $=id=>document.getElementById(id);
function close(){overlay.style.display='none';active=null}
$('nfgeClose').onclick=close;overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
host.addEventListener('click',e=>{
 const b=e.target.closest('[data-nfg-detail]');if(!b)return;
 const r=window.NFGFetchRows?.().find(x=>x.id===b.dataset.nfgDetail);if(!r)return;active=r;
 const keys=[...new Set([...(presets[r.type]||[]),...Object.keys(r)])].filter(k=>!ignore.has(k)&&(r[k]===undefined||typeof r[k]!=='object'));
 $('nfgeFields').innerHTML=keys.map(k=>{const v=r[k]??'';const kind=k==='date'?'date':numbers.has(k)?'number':'text';return '<label>'+esc(names[k]||k)+'<input data-nfge-field="'+esc(k)+'" type="'+kind+'" '+(kind==='number'?'min="0" step="0.001"':'')+' value="'+esc(v)+'"></label>'}).join('');
 const src=r.source||{},cols=src.columns||[];
 $('nfgeOriginal').innerHTML='<p class="nfg-muted">Arquivo: '+esc(src.filename||'Lançamento manual')+' • Aba: '+esc(src.sheet||'')+' • Linha: '+esc(src.row||'')+'</p>'+
 (cols.length?'<table class="nfg-table"><thead><tr><th>Coluna</th><th>Título</th><th>Valor de origem</th><th>Fórmula</th></tr></thead><tbody>'+cols.map(c=>'<tr><td>'+esc(c.column)+'</td><td>'+esc(c.header)+'</td><td>'+esc(c.value)+'</td><td>'+esc(c.formula||'')+'</td></tr>').join('')+'</tbody></table>':'<p class="nfg-muted">Sem planilha de origem.</p>')+
 ((r.importWarnings||[]).length?'<p style="color:#ad6717">Divergências: '+r.importWarnings.map(esc).join('; ')+'</p>':'');
 $('nfgeStatus').textContent='';overlay.style.display='block';
});
$('nfgeForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!active)return;
 const next={...active};
 for(const el of overlay.querySelectorAll('[data-nfge-field]'))next[el.dataset.nfgeField]=numbers.has(el.dataset.nfgeField)?Number(el.value||0):el.value.trim();
 if(!/^[A-Z0-9]{7}$/.test(String(next.plate||'').replace('-','').toUpperCase())||!/^\d{4}-\d{2}-\d{2}$/.test(next.date)){ $('nfgeStatus').textContent='Placa ou data inválida.';return;}
 $('nfgeSave').disabled=true;$('nfgeStatus').textContent='Salvando no D1...';
 try{await window.NFGRequest('/records/'+encodeURIComponent(active.id),{method:'PUT',json:next});await window.NFGReload();$('nfgeStatus').textContent='Alterações salvas. Original preservado.';setTimeout(close,700)}
 catch(err){$('nfgeStatus').textContent='Não foi possível salvar: '+err.message}
 finally{$('nfgeSave').disabled=false}
});
})();