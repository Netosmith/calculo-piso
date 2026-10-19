(() => {
'use strict';
const fileInput=document.getElementById('nfgExcelInput'),target=document.getElementById('nfgExcelPreview');
if(!fileInput||!target)return;
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const clean=x=>String(x??'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plate=s=>clean(s).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7);
const val=v=>{if(typeof v==='number')return Number.isFinite(v)?v:0;if(v===null||v===undefined)return 0;let s=clean(v).replace(/R\$|\s/g,'');if(!s||s==='-'||s.toLowerCase()==='x')return 0;if(s.includes('.')&&s.includes(','))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');else if(s.includes(','))s=s.replace(',','.');return Number(s)||0};
const date=(v,date1904=false)=>{if(typeof v==='number'&&v>15000&&v<100000){const d=window.XLSX.SSF.parse_date_code(v,{date1904});return d?[d.y,String(d.m).padStart(2,'0'),String(d.d).padStart(2,'0')].join('-'):''}if(v instanceof Date&&!isNaN(v))return [v.getFullYear(),String(v.getMonth()+1).padStart(2,'0'),String(v.getDate()).padStart(2,'0')].join('-');const s=clean(v),m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);if(m)return (m[3].length===2?'20'+m[3]:m[3])+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):''};
const kindSuffix={freight:1,expense:2,commission:3,maintenance:4,diesel:5,arla:6};
const configs={
 freight:{name:'Viagens e faturamento',needed:['date','plate','driver','gross'],fields:[
 ['date','Data'],['plate','Placa'],['driver','Motorista'],['invoice','Nota fiscal'],['cte','CT-e'],['origin','Origem'],['originUf','UF origem'],['loadingPlace','Local carregamento'],['destination','Destino'],['destinationUf','UF destino'],['product','Produto'],['unloadingPlace','Local descarga'],['departureWeight','Peso saída'],['driverFreightRate','Frete motorista/ton'],['gross','Frete bruto'],['toll','Pedágio'],['insurance','Seguro'],['advance','Adiantamento'],['sourcePaymentStatus','Status do pagamento'],['otherSourceDiscount','Outros descontos'],['netFreight','Frete líquido'],['arrivalWeight','Peso chegada'],['sourceBalance','Saldo'],['sourceFinancialStatus','Status financeiro'],['carrier','Transportadora'],['unused','Coluna não identificada'],['weightLoss','Quebra'],['weightLossDiscount','Frete desconto'],['finalBalance','Saldo final']]},
 expense:{name:'Despesas da frota',needed:['date','plate','value'],fields:[['date','Data'],['plate','Placa'],['driver','Motorista'],['city','Cidade'],['uf','UF'],['supplier','Local'],['value','Valor R$ serviço'],['description','Discrição / descrição'],['status','Status pagamento']]},
 advance:{name:'Vales e adiantamentos',needed:['date','plate','value'],fields:[['date','Data'],['plate','Placa'],['driver','Motorista'],['value','Valor'],['category','Motivo'],['pix','PIX']]},
 revision:{name:'Programação de revisões',needed:['plate','odometer','nextOdometer'],fields:[['odometer','KM atual'],['plate','Placa'],['nextOdometer','Próxima revisão'],['supplier','Local revisão'],['city','Cidade'],['uf','UF'],['description','Observação']]},
 fuel:{name:'Diesel e ARLA',needed:['date','plate'],fields:[['date','Data'],['plate','Placa'],['driver','Motorista'],['dieselValue','Diesel valor'],['dieselKm','Diesel KM'],['dieselLiters','Diesel litros'],['dieselPrice','Diesel R$/L'],['dieselPayment','Diesel pagamento'],['dieselSupplier','Diesel posto'],['dieselCity','Diesel cidade'],['dieselUf','Diesel UF'],['separator','Separador'],['arlaValue','ARLA valor'],['arlaKm','ARLA KM'],['arlaInvoice','ARLA NF'],['arlaLiters','ARLA litros'],['arlaPrice','ARLA R$/L'],['arlaPayment','ARLA pagamento'],['arlaSupplier','ARLA posto'],['arlaCity','ARLA cidade'],['arlaUf','ARLA UF']]}
};
const matchTemplate=header=>{
 const v=header.map(norm);
 if(v.includes('fretebruto')&&v.some(x=>x==='cte'||x==='ctee')&&v.includes('notafiscal'))return 'freight';
 if(v.includes('kmproximarevisao'))return 'revision';
 if(v.some(x=>x.includes('arlavalor'))&&v.filter(x=>x.includes('litro')).length>=2)return 'fuel';
 if(v.includes('motivo')&&v.includes('pix'))return 'advance';
 if(v.includes('valorrservico')&&v.some(x=>x==='local'))return 'expense';
 return '';
};
let files=[],scans=[],selected=new Set(),allRows=[],started=false;
const sum=(v)=>v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
async function ensureLib(){if(window.XLSX)return;await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=res;s.onerror=()=>rej(Error('O leitor Excel não carregou. Verifique o bloqueador de scripts.'));document.head.appendChild(s)});if(!window.XLSX)throw Error('Leitor Excel indisponível')}
const hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
function makeId(filehash,sheetIndex,row,type){const n=(BigInt(sheetIndex)<<44n)|(BigInt(row)<<4n)|BigInt(kindSuffix[type]||0);return 'imp_'+filehash.slice(0,48)+n.toString(16).padStart(16,'0')}
function source(sheet,at,arr,header,bookSheet){
 const sourceColumns=[];let width=Math.max(arr.length,header.length);
 for(let c=0;c<width;c++){const h=clean(header[c])||'Coluna '+(c+1);const ref=window.XLSX.utils.encode_cell({r:at,c});sourceColumns.push({column:window.XLSX.utils.encode_col(c),header:h,value:arr[c]??'',...(bookSheet[ref]?.f?{formula:bookSheet[ref].f}:{})})}
 return sourceColumns;
}
function typeRow(kind,raw){
 const out={};configs[kind].fields.forEach(([key],i)=>{const value=raw[i];if(value!==null&&value!==undefined&&value!=='')out[key]=value});
 return out;
}
function reportRow(out,base,kind){
 const numeric=['value','gross','netFreight','toll','insurance','advance','otherSourceDiscount','departureWeight','arrivalWeight','driverFreightRate','weightLossDiscount','finalBalance','odometer','nextOdometer','dieselValue','dieselLiters','dieselPrice','dieselKm','arlaValue','arlaLiters','arlaPrice','arlaKm'];
 for(const k of numeric)if(k in out)out[k]=val(out[k]);
 out.plate=plate(out.plate||base.plate);out.driver=clean(out.driver||base.driver);
 return out;
}
function convert(entry,sheet,rowNum,raw,header){
 const mapping=typeRow(entry.template,raw);const parsed=reportRow(mapping,{plate:entry.plate,driver:entry.driver},entry.template);
 parsed.date=date(raw[0],entry.date1904)||date(parsed.date,entry.date1904);
 const base={plate:parsed.plate,driver:parsed.driver,date:parsed.date||(entry.template==='revision'?'0001-01-01':entry.periodDate),
   source:{filename:entry.file.name,sha256:entry.hash,sheet:sheet.name,row:rowNum,template:entry.template,
    columns:source(sheet,rowNum-1,raw,header,sheet.sheet),periodDateOnly:!parsed.date&&entry.template==='revision',undated:!parsed.date&&entry.template==='revision}};
 if(base.plate.length!==7)return {reason:'Placa ausente/inválida'};
 if(entry.template!=='revision'&&!/^\d{4}-\d{2}-\d{2}$/.test(base.date))return {reason:'Data inválida'};
 const result=[];
 const push=(suffix,data)=>result.push({...base,...data,id:makeId(entry.hash,entry.sheetIndex,rowNum,suffix)});
 if(entry.template==='expense'){if(!(parsed.value>0))return {reason:'Valor ausente / totalizador'};push('expense',{type:'expense',value:parsed.value,category:'Despesas gerais',city:clean(parsed.city),uf:clean(parsed.uf),supplier:clean(parsed.supplier),description:clean(parsed.description),status:clean(parsed.status),paymentMethod:clean(parsed.status)})}
 else if(entry.template==='advance'){if(!(parsed.value>0))return {reason:'Valor ausente'};push('commission',{type:'commission',value:parsed.value,category:'Adiantamento / vale',description:clean(parsed.category),pix:clean(parsed.pix),status:'Adiantamento (não somar aos custos)'})}
 else if(entry.template==='revision'){if(!(parsed.nextOdometer>0))return {reason:'Próxima revisão ausente'};push('maintenance',{type:'maintenance',value:0,category:'Revisão programada (sem despesa)',odometer:parsed.odometer||0,nextOdometer:parsed.nextOdometer,isSchedule:true,supplier:clean(parsed.supplier),city:clean(parsed.city),uf:clean(parsed.uf),description:clean(parsed.description)})}
 else if(entry.template==='freight'){
  if(!(parsed.gross>0))return {reason:'Frete bruto ausente'};
  const net=parsed.netFreight>0?parsed.netFreight:null;
  const warnings=[];
  if(net!==null){const expected=parsed.gross-parsed.toll-parsed.insurance-parsed.otherSourceDiscount;if(Math.abs(expected-net)>0.05)warnings.push('Líquido diverge do cálculo bruto-pedágio-seguro-outros: R$ '+sum(expected-net))}
  push('freight',{type:'freight',gross:parsed.gross,netFreight:net,
   discount:net!==null?Math.max(0,parsed.gross-net):0,otherDiscount:0,rate:0,
   invoice:clean(parsed.invoice),reference:clean(parsed.cte),cte:clean(parsed.cte),
   origin:clean(parsed.origin),originUf:clean(parsed.originUf),loadingPlace:clean(parsed.loadingPlace),
   destination:clean(parsed.destination),destinationUf:clean(parsed.destinationUf),product:clean(parsed.product),
   unloadingPlace:clean(parsed.unloadingPlace),departureWeight:parsed.departureWeight||0,arrivalWeight:parsed.arrivalWeight||0,
   driverFreightRate:parsed.driverFreightRate||0,toll:parsed.toll||0,insurance:parsed.insurance||0,
   advance:parsed.advance||0,otherSourceDiscount:parsed.otherSourceDiscount||0,
   sourcePaymentStatus:clean(parsed.sourcePaymentStatus),sourceFinancialStatus:clean(parsed.sourceFinancialStatus),
   sourceBalance:parsed.sourceBalance||0,carrier:clean(parsed.carrier),weightLoss:clean(parsed.weightLoss),
   weightLossDiscount:parsed.weightLossDiscount||0,finalBalance:parsed.finalBalance||0,
   status:'A conferir (importado)',importWarnings:warnings})
 }
 else if(entry.template==='fuel'){
  const fuel=(name,amt,liters,price,km,payment,supplier,city,uf,invoice)=>{
   const amount=val(amt),qty=val(liters),unit=val(price);
   if(!(amount>0))return;
   const warnings=[];
   if(qty>0&&unit>0&&Math.abs(amount-qty*unit)>1)warnings.push('Total da planilha difere de litros × preço: R$ '+sum(amount-qty*unit));
   push(name==='Diesel'?'diesel':'arla',{type:'fuel',category:name,value:amount,liters:qty,price:unit,odometer:val(km),status:clean(payment),supplier:clean(supplier),city:clean(city),uf:clean(uf),reference:clean(invoice),importWarnings:warnings});
  };
  fuel('Diesel',parsed.dieselValue,parsed.dieselLiters,parsed.dieselPrice,parsed.dieselKm,parsed.dieselPayment,parsed.dieselSupplier,parsed.dieselCity,parsed.dieselUf,'');
  fuel('ARLA 32',parsed.arlaValue,parsed.arlaLiters,parsed.arlaPrice,parsed.arlaKm,parsed.arlaPayment,parsed.arlaSupplier,parsed.arlaCity,parsed.arlaUf,parsed.arlaInvoice);
  if(!result.length)return {reason:'Valores diesel/ARLA ausentes'};
 }
 return {records:result};
}
function recognize(book,filename,buffer,sha){
 const date1904=!!book.Workbook?.WBProps?.date1904;
 const period=filename.match(/\b(20\d{2})\b/);
 const monthMatch=norm(filename).match(/(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/);
 const monthNames=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
 const periodDate=period&&monthMatch?period[1]+'-'+String(monthNames.indexOf(monthMatch[1])+1).padStart(2,'0')+'-01':'';
 return book.SheetNames.map((name,index)=>{
  const sh=book.Sheets[name],matrix=window.XLSX.utils.sheet_to_json(sh,{header:1,raw:true,defval:'',blankrows:true});
  let at=-1,template='';
  for(let i=0;i<Math.min(25,matrix.length);i++){const candidate=matchTemplate(matrix[i]||[]);if(candidate){template=candidate;at=i;break}}
  const sheetPlate=plate((name.match(/[A-Z]{3}[- ]?\d[A-Z0-9]{3}/i)||[])[0]);
  const driver=name.replace(/^[A-Z]{3}[- ]?\d[A-Z0-9]{3}/i,'').trim();
  return {key:sha.slice(0,12)+'_'+index,hash:sha,file:{name:filename},name,sheetIndex:index,
    sheet:sh,matrix,headerRow:at,template,plate:sheetPlate,driver,date1904,periodDate,header:at>=0?matrix[at]:[],candidateRows:0,valid:[],rejected:[],warnings:[]};
 });
}
function scanSheet(entry){
 if(!entry.template){entry.rejected=[{row:0,reason:'Estrutura desconhecida: revisar cabeçalhos antes de importar'}];return}
 for(let i=entry.headerRow+1;i<entry.matrix.length;i++){
  const raw=entry.matrix[i];if(!raw||raw.every(x=>clean(x)===''))continue;
  const out=convert(entry,{name:entry.name,sheet:entry.sheet},i+1,raw,entry.header);
  if(out.records){entry.valid.push(...out.records);entry.candidateRows++;
   for(const r of out.records)for(const w of r.importWarnings||[])entry.warnings.push('Linha '+(i+1)+': '+w)
  }else if(entry.rejected.length<40)entry.rejected.push({row:i+1,reason:out.reason})}
}
function show(){
 const all=scans.reduce((x,s)=>x+s.valid.length,0),ignored=scans.reduce((x,s)=>x+s.rejected.length,0);
 target.innerHTML='<div class="nfg-card"><h2>Conferência de importação de planilhas</h2><p class="nfg-muted">Importação ONLINE, em lotes. Todas as colunas originais de cada lançamento são preservadas como histórico da planilha. Não serão importadas linhas de totais. Marque as abas que deseja enviar ao D1.</p>'+
 '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px"><strong>'+all+' registros reconhecidos</strong><span>'+ignored+' linhas/abas para revisão</span></div>'+
 '<div class="nfg-tablewrap"><table class="nfg-table"><thead><tr><th>Importar</th><th>Arquivo</th><th>Aba</th><th>Modelo</th><th>Linhas</th><th>Registros</th><th>Alertas</th></tr></thead><tbody>'+
 scans.map(s=>'<tr><td><input type="checkbox" data-nfgi-select="'+esc(s.key)+'" '+(s.template?'checked':'disabled')+'></td><td>'+esc(s.file.name)+'</td><td>'+esc(s.name)+'</td><td>'+esc(configs[s.template]?.name||'Não reconhecida')+'</td><td>'+s.candidateRows+'</td><td>'+s.valid.length+'</td><td>'+s.warnings.length+' divergências; '+s.rejected.length+' ignoradas</td></tr>').join('')+
 '</tbody></table></div>'+
 '<p class="nfg-muted">Fretes importados mantêm o líquido original e ficam A CONFERIR no Financeiro. Vales não entram novamente como despesas. Revisões sem data utilizam somente a competência identificada no nome do arquivo.</p>'+
 '<details><summary>Conferência detalhada dos valores e colunas originais</summary><div id="nfgiDetails"></div></details>'+
 '<p id="nfgiProgress" class="nfg-muted" role="status" aria-live="polite"></p><button type="button" class="nfg-action" id="nfgiSubmit">Importar todas as abas marcadas para o D1</button></div>';
 document.querySelectorAll('[data-nfgi-select]').forEach(x=>x.onchange=()=>{if(x.checked)selected.add(x.dataset.nfgiSelect);else selected.delete(x.dataset.nfgiSelect)});
 document.getElementById('nfgiSubmit').onclick=commit;
 const details=document.getElementById('nfgiDetails');
 details.innerHTML=scans.map(s=>'<h3 style="margin:15px 0 5px">'+esc(s.name)+'</h3>'+
 '<p class="nfg-muted">Cabeçalhos: '+s.header.map(esc).join(' | ')+'</p>'+
 '<p class="nfg-muted">Exemplo de dados: '+(s.valid.slice(0,2).map(r=>esc(JSON.stringify({data:r.date,placa:r.plate,tipo:r.type,valor:r.value??r.gross,origem:r.source.columns.slice(0,8)}))).join('<hr>')||'Sem linhas reconhecidas')+'</p>'+
 (s.warnings.length?'<p class="nfg-muted">Divergências: '+s.warnings.slice(0,12).map(esc).join(' • ')+'</p>':'')+
 (s.rejected.length?'<p class="nfg-muted">Ignoradas: '+s.rejected.slice(0,12).map(x=>esc(x.row+': '+x.reason)).join(' • ')+'</p>':'')).join('');
}
async function commit(){
 if(started)return;
 const chosen=scans.filter(x=>selected.has(x.key)),list=chosen.flatMap(x=>x.valid);
 if(!list.length)return alert('Selecione ao menos uma aba válida.');
 const warnings=chosen.reduce((n,x)=>n+x.warnings.length,0);
 if(!confirm('Enviar '+list.length+' registros para o banco Cloudflare D1?\n'+warnings+' divergências foram sinalizadas. Importações repetidas do MESMO arquivo são ignoradas.\nConfira os valores e documentos antes de usar o Financeiro.'))return;
 if(typeof window.NFGImportRows!=='function')return alert('Carregamento do D1 ainda em andamento. Tente novamente.');
 started=true;document.getElementById('nfgiSubmit').disabled=true;
 const progress=document.getElementById('nfgiProgress');
 try{
  const result=await window.NFGImportRows(list,(processed,total,added,duplicates)=>{progress.textContent='Enviados '+processed+' de '+total+' registros. Novos: '+added+'; duplicados: '+duplicates});
  progress.textContent='Importação finalizada. Novos: '+result.added+'; duplicados ignorados: '+result.duplicates+'. Registros disponíveis em Fretes, Despesas, Abastecimentos, Manutenção, Comissões, Financeiro e B.I.';
  alert('Importação online concluída. Novos: '+result.added+'; repetidos: '+result.duplicates);
 }catch(e){progress.textContent='Importação interrompida: '+e.message+'. Reenvie o arquivo: os lotes concluídos não serão duplicados.'}
 finally{started=false;document.getElementById('nfgiSubmit').disabled=false}
}
fileInput.multiple=true;
fileInput.addEventListener('change',async ev=>{
 const incoming=[...(ev.target.files||[])];if(!incoming.length)return;
 target.textContent='Analisando '+incoming.length+' arquivo(s) Excel...';
 scans=[];selected.clear();started=false;
 try{
  await ensureLib();
  for(const file of incoming){
   if(file.size>40*1024*1024)throw Error(file.name+' excede o limite de 40 MB');
   if(!/\.(xlsx|xls|xlsm|xlsb|csv|ods)$/i.test(file.name))throw Error('Formato não suportado: '+file.name);
   const bytes=await file.arrayBuffer(),sha=await hash(bytes),book=window.XLSX.read(bytes,{type:'array',cellDates:false,cellFormula:true});
   const list=recognize(book,file.name,bytes,sha);
   for(const sheet of list){scanSheet(sheet);scans.push(sheet);if(sheet.template)selected.add(sheet.key)}
  }
  show();
 }catch(e){target.textContent='Falha na leitura: '+e.message;console.error(e)}
 finally{fileInput.value=''}
});
})();