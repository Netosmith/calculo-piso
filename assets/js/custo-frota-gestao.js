(()=>{'use strict';
const KEY='nf_frota_gestao_v1',money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),num=v=>Number(v||0),$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const API='https://api.portalfrete.net.br/v1/fleet';
let records=[],loaded=false,loadingPromise=null,lastLoadError='';
async function request(path,options={}) {
 const response=await fetch(API+path,{method:options.method||'GET',credentials:'include',cache:'no-store',headers:{Accept:'application/json',...(options.json!==undefined?{'Content-Type':'application/json'}:{})},body:options.json===undefined?undefined:JSON.stringify(options.json)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok!==true)throw Error(data.error||'Erro na API de frota');
 return data;
}
async function loadRecords(){
 if(loadingPromise)return loadingPromise;
 loadingPromise=(async()=>{
  try{
   const all=[];let offset=0;const limit=500;
   for(let page=0;page<100;page++){
    const result=await request('/records?limit='+limit+'&offset='+offset);
    if(!Array.isArray(result.records))throw Error('Resposta inesperada da API: campo records ausente');
    all.push(...result.records);offset+=result.records.length;
    if(!result.hasMore)break;
    if(page===99)throw Error('Mais de 50 mil registros; use consulta paginada no servidor');
   }
   records=all;loaded=true;lastLoadError='';
   render();window.dispatchEvent(new Event('nfg-records-changed'));
   const warn=document.querySelector('.nfg-warning');
   if(warn)warn.textContent='DADOS ONLINE: '+records.length+' lançamentos carregados do Cloudflare D1. Dados de origem e divergências permanecem preservados.';
   const signal=document.getElementById('nfgDbStatus');
   if(signal){signal.textContent='D1 conectado: '+records.length+' lançamentos';signal.style.color='#047857'}
   return true;
  }catch(e){
   lastLoadError=String(e?.message||e);loaded=false;
   console.error('[FROTA D1]',e);
   const warn=document.querySelector('.nfg-warning');
   if(warn)warn.textContent='Erro de conexão com o D1: '+lastLoadError+'. Os dados NÃO serão gravados no navegador. Clique em Reconectar D1.';
   const signal=document.getElementById('nfgDbStatus');
   if(signal){signal.textContent='Falha na conexão: '+lastLoadError;signal.style.color='#b91c1c'}
   return false;
  }
 })();
 try{return await loadingPromise}finally{loadingPromise=null}
}
window.NFGFetchRows=()=>records.slice();window.NFGReload=loadRecords;window.NFGRequest=request;
const plate=x=>String(x||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7);
const norm=(f)=>Object.fromEntries(new FormData(f).entries());
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T12:00:00').getTime());
const dateNow=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const typeLabels={expense:'Despesa',freight:'Frete',commission:'Comissão',fuel:'Abastecimento',maintenance:'Manutenção'};
async function add(type,v){v.plate=plate(v.plate);if(!v.plate||!validDate(v.date))return alert('Informe placa e data válidas.'),false;
const fields=type==='freight'?['gross','discount','otherDiscount','km','rate']:type==='fuel'?['liters','price','odometer']:['value','odometer'];
for(const k of fields){if(k in v){const val=num(v[k]);if(!Number.isFinite(val)||val<0)return alert('Valor inválido em '+k),false;v[k]=val}}
if(type==='freight'&&(v.gross<=0||v.discount+v.otherDiscount>v.gross||v.rate>100))return alert('Confira bruto, descontos e percentual de comissão.'),false;
if(type==='fuel'&&(!(v.liters>0)||v.price<0))return alert('Informe litros e preço válidos.'),false;
if(['expense','commission'].includes(type)&&!(v.value>0)||type==='maintenance'&&num(v.value)<0)return alert('Informe valor maior que zero.'),false;
v.type=type;try{const result=await request('/records',{method:'POST',json:v});v.id=result.id;await loadRecords();return true}catch(err){alert('Não foi possível salvar no D1: '+err.message);return false}}
function selectTab(tab){$$('[data-nfg-panel]').forEach(e=>e.hidden=e.dataset.nfgPanel!==tab);$$('[data-nfg-tab]').forEach(e=>{e.classList.toggle('active',e.dataset.nfgTab===tab);e.setAttribute('aria-pressed',String(e.dataset.nfgTab===tab))});}
$$('[data-nfg-tab]').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.nfgTab)));
function attach(id,type){const f=$('#'+id);if(!f)return;f.querySelector('[name=date]').value=dateNow();f.addEventListener('submit',async e=>{e.preventDefault();if(await add(type,norm(f))){f.reset();f.querySelector('[name=date]').value=dateNow();alert('Lançamento salvo online no D1.')}})}
attach('nfgExpenseForm','expense');attach('nfgFreightForm','freight');attach('nfgCommissionForm','commission');attach('nfgFuelForm','fuel');attach('nfgMaintenanceForm','maintenance');
function expense(r){if(r.type==='expense'||r.type==='maintenance')return num(r.value);if(r.type==='commission')return r.category==='Adiantamento / vale'?0:num(r.value);if(r.type==='fuel')return r.value!==undefined&&r.value!==''?num(r.value):num(r.liters)*num(r.price);return 0}
function commission(r){return r.type==='freight'?num(r.gross)*num(r.rate)/100:0}
function rows(){const p=plate($('#nfgPlaca')?.value),m=$('#nfgMes')?.value,d=($('#nfgMotorista')?.value||'').toLocaleLowerCase('pt-BR');return records.filter(r=>(!p||r.plate.includes(p))&&(!m||r.date?.slice(0,7)===m)&&(!d||(r.driver||'').toLocaleLowerCase('pt-BR').includes(d))).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||'').localeCompare(a.createdAt||''))}
function summary(items){return items.reduce((a,r)=>{if(r.type==='freight'){a.gross+=num(r.gross);a.discount+=r.netFreight!=null&&r.netFreight!==''?num(r.gross)-num(r.netFreight):num(r.discount)+num(r.otherDiscount);a.expenses+=commission(r)}else a.expenses+=expense(r);return a},{gross:0,discount:0,expenses:0})}
function table(items){if(!items.length)return '<p class="nfg-muted">Ainda não há lançamentos para este filtro.</p>';return '<table class="nfg-table"><thead><tr><th>Data</th><th>Placa</th><th>Tipo</th><th>Motorista / descrição</th><th>Categoria</th><th>Receita bruta</th><th>Descontos</th><th>Despesa</th><th>Ação</th></tr></thead><tbody>'+items.map(r=>{const isFreight=r.type==='freight';return '<tr><td>'+escape(r.isSchedule&&r.source?.undated?'Sem data':(r.date||'').split('-').reverse().join('/'))+'</td><td>'+escape(r.plate)+'</td><td>'+escape(typeLabels[r.type]||r.type)+'</td><td>'+escape(r.driver||r.description||[r.origin,r.destination].filter(Boolean).join(' → ')||'')+'</td><td>'+escape(r.category||r.client||'')+'</td><td>'+money(isFreight?r.gross:0)+'</td><td>'+money(isFreight?(r.netFreight!=null&&r.netFreight!==''?num(r.gross)-num(r.netFreight):num(r.discount)+num(r.otherDiscount)):0)+'</td><td>'+money(isFreight?commission(r):expense(r))+'</td><td><button class="nfg-action secondary" type="button" data-nfg-detail="'+escape(r.id)+'">Detalhes / editar</button> <button class="nfg-action secondary" type="button" data-delete="'+escape(r.id)+'">Excluir</button></td></tr>'}).join('')+'</tbody></table>'}
function grouped(items,key){const m=new Map();for(const r of items){let k=String(r[key]||'Não informado').trim()||'Não informado';let v=m.get(k)||{gross:0,discount:0,expenses:0};if(r.type==='freight'){v.gross+=num(r.gross);v.discount+=r.netFreight!=null&&r.netFreight!==''?num(r.gross)-num(r.netFreight):num(r.discount)+num(r.otherDiscount);v.expenses+=commission(r)}else v.expenses+=expense(r);m.set(k,v)}return [...m].sort((a,b)=>(b[1].gross-b[1].discount-b[1].expenses)-(a[1].gross-a[1].discount-a[1].expenses))}
function renderExtra(){const items=rows(),cats=new Map();for(const r of items){if(r.type==='freight')continue;const k=r.type==='fuel'?r.category||'Combustível':r.type==='commission'?'Comissão':r.category||typeLabels[r.type]||'Outros';cats.set(k,(cats.get(k)||0)+expense(r))}const catRows=[...cats].filter(v=>v[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,9),top=Math.max(1,...catRows.map(x=>x[1]));$('#nfgCategories').innerHTML=catRows.length?catRows.map(([name,n])=>'<div class="nfg-hbar"><span>'+escape(name)+'</span><div class="nfg-track"><div class="nfg-fill" style="width:'+(n/top*100).toFixed(1)+'%"></div></div><b>'+money(n)+'</b></div>').join(''):'<p class="nfg-muted">Nenhuma despesa registrada.</p>';const fuelByMonth=new Map();
for(const r of items.filter(x=>x.type==='fuel')){
 const key=(r.date||'').slice(0,7);if(!/^\d{4}-\d{2}$/.test(key))continue;
 const value=fuelByMonth.get(key)||{diesel:0,arla:0};
 if(String(r.category||'').toUpperCase().includes('ARLA'))value.arla+=expense(r);else value.diesel+=expense(r);
 fuelByMonth.set(key,value);
}
const fuelSeries=[...fuelByMonth].sort((a,b)=>a[0].localeCompare(b[0])).slice(-10);
const fuelMax=Math.max(1,...fuelSeries.map(x=>Math.max(x[1].diesel,x[1].arla)));
const fuelNode=$('#nfgFuelTrend');
if(fuelNode)fuelNode.innerHTML=fuelSeries.length?fuelSeries.map(([date,m])=>'<div class="nfg-barwrap" title="'+escape(date+' • Diesel '+money(m.diesel)+' • ARLA '+money(m.arla))+'"><div style="height:90%;width:100%;display:flex;align-items:end;justify-content:center;gap:3px"><div class="nfg-bar" style="width:38%;height:'+Math.max(1,m.diesel/fuelMax*100)+'%;background:#2563eb"></div><div class="nfg-bar" style="width:38%;height:'+Math.max(1,m.arla/fuelMax*100)+'%;background:#0f9e75"></div></div><small>'+escape(date.slice(5))+'/'+escape(date.slice(2,4))+'</small></div>').join(''):'<p class="nfg-muted">Cadastre ou importe abastecimentos para visualizar os custos por mês.</p>';
for(const [key,id] of [['plate','nfgByPlate'],['driver','nfgByDriver']]){const gg=grouped(items,key);$('#'+id).innerHTML=gg.length?'<table class="nfg-table"><thead><tr><th>'+(key==='plate'?'Placa':'Motorista')+'</th><th>Receita</th><th>Gastos</th><th>Resultado</th></tr></thead><tbody>'+gg.map(([name,v])=>'<tr><td>'+escape(name)+'</td><td>'+money(v.gross-v.discount)+'</td><td>'+money(v.expenses)+'</td><td><b>'+money(v.gross-v.discount-v.expenses)+'</b></td></tr>').join('')+'</tbody></table>':'<p class="nfg-muted">Sem lançamentos.</p>'}}
function render(){const items=rows(),s=summary(items);$('#nfgFat').textContent=money(s.gross);$('#nfgDesc').textContent=money(s.discount);$('#nfgDesp').textContent=money(s.expenses);const net=s.gross-s.discount-s.expenses;$('#nfgResultado').textContent=money(net);$('#nfgMargem').textContent=(s.gross-s.discount>0?(net/(s.gross-s.discount)*100):0).toFixed(1).replace('.',',')+'%';$('#nfgResultado').style.color=net<0?'#ff91a6':'#76e8b1';$('#nfgRecent').innerHTML=table(items.slice(0,8));$('#nfgAllRows').innerHTML=table(items.slice(0,200))+(items.length>200?'<p class="nfg-muted">Exibindo 200 de '+items.length+' registros. Use os filtros no B.I. para reduzir a lista. O backup CSV exporta todos.</p>':'');for(const k of ['fretes','lancamentos','combustivel','manutencao','comissoes']){const t={fretes:'freight',lancamentos:'expense',combustivel:'fuel',manutencao:'maintenance',comissoes:'commission'}[k];const el=$('#nfgModule-'+k);if(el)el.innerHTML=table(items.filter(r=>r.type===t).slice(0,200))}const byMonth=new Map;for(const r of items){if(r.isSchedule&&r.source?.undated)continue;const key=r.date.slice(0,7),d=byMonth.get(key)||{gross:0,discount:0,expenses:0};if(r.type==='freight'){d.gross+=num(r.gross);d.discount+=r.netFreight!=null&&r.netFreight!==''?num(r.gross)-num(r.netFreight):num(r.discount)+num(r.otherDiscount);d.expenses+=commission(r)}else d.expenses+=expense(r);byMonth.set(key,d)}
const months=[...byMonth].sort((a,b)=>a[0].localeCompare(b[0])).slice(-8),values=months.map(([m,v])=>({m,val:v.gross-v.discount,expense:v.expenses}));const max=Math.max(1,...values.flatMap(v=>[v.val,v.expense]));renderExtra();$('#nfgChart').innerHTML=values.length?values.map(v=>'<div class="nfg-barwrap" title="'+escape(v.m+' • Receita líquida '+money(v.val)+' • Custos '+money(v.expense))+'"><div style="height:90%;width:100%;display:flex;align-items:end;justify-content:center;gap:3px"><div class="nfg-bar" style="height:'+Math.max(1,Math.max(0,v.val)/max*100)+'%;background:#35c68c;width:40%"></div><div class="nfg-bar" style="height:'+Math.max(1,v.expense/max*100)+'%;background:#e7a65d;width:40%"></div></div><small>'+escape(v.m.slice(5))+'/'+escape(v.m.slice(2,4))+'</small></div>').join(''):'<p class="nfg-muted">Lance fretes ou despesas para gerar o gráfico.</p>'}
$('#nfgPlaca').addEventListener('input',render);$('#nfgMotorista').addEventListener('input',render);$('#nfgMes').addEventListener('change',render);$('#nfgLimparFiltros').addEventListener('click',()=>{$('#nfgPlaca').value='';$('#nfgMes').value='';$('#nfgMotorista').value='';render()});
document.querySelector('main.fleet-shell').addEventListener('click',async e=>{
 const b=e.target.closest('[data-delete]');if(!b||!loaded)return;
 const row=records.find(r=>r.id===b.dataset.delete);
 if(!row||!confirm('Excluir PERMANENTEMENTE o lançamento de '+row.plate+' do D1?'))return;
 try{await request('/records/'+encodeURIComponent(row.id),{method:'DELETE'});await loadRecords();}catch(err){alert('Não foi possível excluir: '+err.message)}
});
const csvCell=x=>'"'+String(x??'').replace(/^[=+@\-\t\r]/,x=>"'"+x).replace(/"/g,'""')+'"';
function download(){
 const first=['id','type','date','plate','driver','category','description','gross','netFreight','value','receipts','source'];
 const cols=[...new Set([...first,...records.flatMap(r=>Object.keys(r))])];
 const cell=(r,k)=>{const v=r[k];return csvCell(typeof v==='object'&&v!==null?JSON.stringify(v):v)};
 const payload='\uFEFF'+[cols.join(';'),...records.map(r=>cols.map(k=>cell(r,k)).join(';'))].join('\r\n');
 const url=URL.createObjectURL(new Blob([payload],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='nova-frota-d1-completo-'+dateNow()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
$('#nfgExport').addEventListener('click',download);$('#nfgGoNew')?.addEventListener('click',()=>selectTab('lancamentos'));$('#nfgGoReport')?.addEventListener('click',()=>selectTab('relatorios'));
function parseCSV(content){content=content.replace(/^\uFEFF/,'');const result=[];let field='',cells=[],inQuote=false;for(let i=0;i<content.length;i++){const c=content[i];if(c==='"'){if(inQuote&&content[i+1]==='"'){field+='"';i++}else inQuote=!inQuote}else if(c===';'&&!inQuote){cells.push(field);field=''}else if((c==='\n'||c==='\r')&&!inQuote){if(c==='\r'&&content[i+1]==='\n')i++;cells.push(field);if(cells.some(Boolean))result.push(cells);field='';cells=[]}else field+=c}cells.push(field);if(cells.some(Boolean))result.push(cells);return result}

const hash=async value=>{const bytes=new TextEncoder().encode(value);const buf=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')};
window.NFGImportRows=async function(items,onProgress){
 if(!loaded && !(await loadRecords()))throw Error('Não foi possível conectar ao D1: '+(lastLoadError||'verifique sua sessão e tente novamente.'));
 let added=0,duplicates=0;
 for(let i=0;i<items.length;i+=80){
  const batch=items.slice(i,i+80);
  const response=await request('/import',{method:'POST',json:{rows:batch}});
  added+=response.added;duplicates+=response.duplicates;
  if(onProgress)onProgress(Math.min(i+batch.length,items.length),items.length,added,duplicates);
 }
 await loadRecords();return {added,duplicates};
};
$('#nfgImport').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>35e6)throw Error('Arquivo muito grande (máximo 35 MB)');
  const lines=parseCSV(await file.text()),header=lines.shift();
  if(!header||!['type','date','plate'].every(x=>header.includes(x)))throw Error('Backup CSV não reconhecido');
  const data=lines.map((line,i)=>({...Object.fromEntries(header.map((key,j)=>[key,line[j]??''])),source:{file:file.name,sheet:'Backup CSV',row:i+2}}));
  const valid=[];
  for(let i=0;i<data.length;i++){const r=data[i];if(!validDate(r.date)||plate(r.plate).length!==7||!typeLabels[r.type])continue;
   for(const k of ['value','gross','liters','price','discount','otherDiscount','rate'])if(r[k]!=='')r[k]=Number(r[k])||0;
   for(const field of ['receipts','source','importWarnings'])if(r[field]){try{r[field]=JSON.parse(r[field])}catch{if(field==='receipts')r[field]=[]}}
   r.id='imp_'+await hash('backup:'+file.name+':'+(i+2)+':'+JSON.stringify(r));
   valid.push(r)}
  if(!valid.length)throw Error('Nenhuma linha válida no backup');
  if(!confirm('Importar '+valid.length+' registros válidos para o D1? Registros repetidos serão ignorados.'))return;
  const summary=await window.NFGImportRows(valid);alert('Importados: '+summary.added+'; repetidos: '+summary.duplicates);
 }catch(err){alert('Falha na importação: '+err.message)}finally{e.target.value=''}
});
$('#nfgReconnect')?.addEventListener('click',async()=>{const ok=await loadRecords();if(!ok)alert('Falha na conexão com o D1: '+lastLoadError);});
$('#nfgMigrateLocal')?.addEventListener('click',async()=>{
 if(!loaded && !(await loadRecords()))return alert('Falha na conexão: '+lastLoadError);
 let old;try{old=JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return alert('Histórico local inválido.')}
 if(!Array.isArray(old)||!old.length)return alert('Nenhum lançamento antigo salvo neste navegador.');
 const candidates=old.filter(r=>r&&typeLabels[r.type]&&validDate(r.date)&&plate(r.plate).length===7);
 if(!candidates.length)return alert('Não há lançamentos locais com placa, data e tipo válidos.');
 if(!confirm('Migrar '+candidates.length+' lançamentos locais para o D1?\nAtenção: se os mesmos dados já foram importados por Excel, poderão aparecer duplicados. Confira antes de continuar.\nO histórico local NÃO será apagado.'))return;
 try{
  const batch=[];
  for(let i=0;i<candidates.length;i++){
   const r=candidates[i],fingerprint=await hash('local-v1:'+String(r.id||i)+':'+JSON.stringify(r));
   batch.push({...r,id:'imp_'+fingerprint,plate:plate(r.plate),source:r.source||{filename:'Histórico local anterior',sheet:'Portal antigo',row:i+1}});
  }
  const res=await window.NFGImportRows(batch);
  alert('Migração concluída. Novos: '+res.added+'; duplicados ignorados: '+res.duplicates+'. Dados antigos preservados neste navegador.');
 }catch(err){alert('Falha na migração: '+err.message)}
});
window.addEventListener('nfg-finance-changed',loadRecords);
selectTab('painel');render();loadRecords();
})();