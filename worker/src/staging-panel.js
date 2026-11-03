import {stagingPage} from "./staging-page.js";

// Dedicated Cloudflare Access UI for this isolated staging Worker.
// It never asks the owner to paste an OIDC token into the browser.
function required(html,from,to){
  if(!html.includes(from))throw new Error("Staging UI out of sync: "+from.slice(0,70));
  return html.replace(from,to);
}
const GALLERY_CSS="\nmain{max-width:1420px;padding:26px 22px 60px}h1{font-size:clamp(27px,3vw,36px);letter-spacing:-.04em}\n.layout{grid-template-columns:minmax(0,1fr);gap:18px}\n#galleryPanel{background:linear-gradient(140deg,#122e49,#0c2239);border-radius:20px;padding:24px}\n.gallery-tools{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:17px}\n.gallery-tools h2{margin:0}.gallery-counter{border-radius:22px;padding:5px 11px;background:#204661;color:#e2f4ff;font-size:12px}\n#companySearch{width:min(380px,100%);padding:12px 14px;color:#fff;background:#071a2c;border:1px solid #3b6789;border-radius:11px}\n#companySearch:focus{outline:2px solid #60a5fa}\n#companies.company-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:15px}\n.company-card{border:1px solid #406581;background:#16314b;border-radius:17px;overflow:hidden;padding:0;min-height:233px;display:flex;flex-direction:column;text-align:left;transition:transform .15s,border-color .15s}\n.company-card:hover,.company-card:focus-visible{transform:translateY(-3px);border-color:#7ec4fa}\n.company-card.selected{box-shadow:0 0 0 2px #4db2f8}\n.company-card-visual{background:linear-gradient(135deg,#fff,#e2edf6);height:125px;padding:18px;display:flex;align-items:center;justify-content:center}\n.company-card-visual img{object-fit:contain;max-width:100%;max-height:90px}\n.company-monogram{font-size:38px;letter-spacing:.05em;color:#163d64;font-weight:900}\n.company-card-body{padding:15px;flex:1;display:flex;flex-direction:column;gap:10px}\n.company-card-name{font-weight:850;color:#fff;font-size:15px;overflow-wrap:anywhere}\n.company-card-meta{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-top:auto}\n.company-state{border-radius:25px;font-size:11px;padding:5px 9px;background:#3d4c5b;color:#fff}\n.company-state.active{background:#165a49;color:#a5f3d6}\n.company-card-modules{font-size:11px;color:#bed1e4}\n.company-card-bottom{margin:0 14px 14px;background:#236696;padding:8px;text-align:center;border-radius:9px;font-weight:750;font-size:12px}\n#companyDetail{border-radius:19px;padding:24px;min-width:0}#companyDetail[hidden]{display:none!important}\n#galleryBack{background:transparent;color:#cae6fb;border-color:#547a9a}\n#artThemePanel{padding:18px;margin-top:23px;background:#0b2237;border:1px solid #365d7e;border-radius:15px}\n#artThemePanel h3{margin:0 0 6px}.art-model-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:13px;margin-top:18px}\n.art-model{background:#173650;border:1px solid #426581;border-radius:14px;padding:13px}.art-model h4{margin:0 0 5px;font-size:15px}\n.art-sample{--primary:#113c70;--accent:#08a968;--surface:#f4f8fb;background:var(--surface);border-radius:10px;overflow:hidden;border:2px solid #d8e5ed;margin:13px 0}\n.art-sample-head{padding:12px;background:var(--primary);color:white;font-size:16px;font-weight:900}\n.art-sample-head span{color:var(--accent)}.art-sample-content{display:grid;gap:6px;padding:9px}\n.art-sample-row{height:24px;background:white;border-radius:5px;display:grid;grid-template-columns:24px 1fr 48px;gap:6px;padding:3px}\n.art-sample-row b{background:var(--primary);border-radius:3px}.art-sample-row i{background:#e3ebef;border-radius:3px}.art-sample-row strong{background:var(--accent);border-radius:3px}\n.art-sample-footer{height:11px;background:var(--primary)}\n.art-model-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}\n.art-model-controls label{font-size:11px;display:grid;gap:6px;color:#e2edfa}\n.art-model-controls input[type=color]{width:100%;height:37px;border:1px solid #7694ae;background:#10273d;border-radius:7px;padding:2px}\n.art-watermark{display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:12px}\n.art-watermark input{width:70px;background:#061d30;color:#fff;border:1px solid #6888a5;border-radius:7px;padding:6px}\n.art-actions{display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap;margin-top:16px}\n#artStatus{font-size:12px;color:#abc8e3}\n@media(max-width:780px){main{padding:18px 12px 40px}#galleryPanel,#companyDetail{padding:15px}#companies.company-gallery{grid-template-columns:repeat(auto-fill,minmax(155px,1fr))}.company-card{min-height:219px}.company-card-visual{height:110px}}\n";
const GALLERY_JS="\nconst galleryLogoUrls=new Map(),galleryLogoLoading=new Set();\nlet galleryOpen=false,artLoadSerial=0,artSaving=false;\nconst modelKeys=['modelo3','modelo4a','modelo4b','modelo4c'];\nconst modelTitles=[['Modelo 3','1 frete · vertical'],['Modelo 4A','2 fretes'],['Modelo 4B','3 fretes'],['Modelo 4C','4 fretes']];\nconst defaultVisual={primary:'#113c70',accent:'#08a968',surface:'#f4f8fb',watermark:8};\nfunction createArtEditor(){\n const root=$('artModelGrid');root.replaceChildren();\n modelKeys.forEach((key,index)=>{\n  const section=document.createElement('section');section.className='art-model';\n  const heading=document.createElement('h4');heading.textContent=modelTitles[index][0];\n  const note=document.createElement('small');note.textContent=modelTitles[index][1];\n  const sample=document.createElement('div');sample.className='art-sample';sample.dataset.preview=key;\n  const hero=document.createElement('div');hero.className='art-sample-head';\n  hero.textContent='FRETES ';const accent=document.createElement('span');accent.textContent='DISPONÍVEIS';hero.append(accent);sample.append(hero);\n  const content=document.createElement('div');content.className='art-sample-content';\n  for(let i=0;i<(index===0?1:index+1);i++){\n   const line=document.createElement('div');line.className='art-sample-row';\n   line.append(document.createElement('b'),document.createElement('i'),document.createElement('strong'));content.append(line);\n  }\n  sample.append(content);const footer=document.createElement('div');footer.className='art-sample-footer';sample.append(footer);\n  const controls=document.createElement('div');controls.className='art-model-controls';\n  [['primary','Primária'],['accent','Destaque'],['surface','Fundo']].forEach(([field,label])=>{\n   const wrapper=document.createElement('label');wrapper.textContent=label;\n   const input=document.createElement('input');input.type='color';input.value=defaultVisual[field];\n   input.dataset.artModel=key;input.dataset.artField=field;\n   input.addEventListener('input',drawArtPreviews);wrapper.append(input);controls.append(wrapper);\n  });\n  const wm=document.createElement('label');wm.className='art-watermark';\n  wm.textContent='Marca d’água (%)';const wmInput=document.createElement('input');\n  wmInput.type='number';wmInput.min='0';wmInput.max='14';wmInput.step='1';\n  wmInput.value=String(defaultVisual.watermark);wmInput.dataset.artModel=key;\n  wmInput.dataset.artField='watermark';wm.append(wmInput);\n  section.append(heading,note,sample,controls,wm);root.append(section);\n });\n drawArtPreviews();\n}\nfunction allArtValues(){\n const models={};\n for(const key of modelKeys){\n  const get=field=>document.querySelector('[data-art-model=\"'+key+'\"][data-art-field=\"'+field+'\"]');\n  models[key]={\n   primary:get('primary').value.toLowerCase(),accent:get('accent').value.toLowerCase(),\n   surface:get('surface').value.toLowerCase(),watermark:Number(get('watermark').value)\n  };\n }\n return {models};\n}\nfunction drawArtPreviews(){\n for(const key of modelKeys){\n  const sample=document.querySelector('[data-preview=\"'+key+'\"]');\n  if(!sample)continue;\n  const get=field=>document.querySelector('[data-art-model=\"'+key+'\"][data-art-field=\"'+field+'\"]');\n  for(const field of ['primary','accent','surface'])\n   sample.style.setProperty('--'+field,get(field).value);\n }\n}\nfunction applyArtValues(data){\n for(const key of modelKeys){\n  for(const field of ['primary','accent','surface','watermark']){\n   const input=document.querySelector('[data-art-model=\"'+key+'\"][data-art-field=\"'+field+'\"]');\n   input.value=String(data?.models?.[key]?.[field]??defaultVisual[field]);\n  }\n }\n drawArtPreviews();\n}\nasync function loadArtThemes(){\n const id=selected?.id,serial=++artLoadSerial;applyArtValues(null);\n const status=$('artStatus');$('artSave').disabled=!canEditBrand()||!id||id==='nova-frota';\n if(!id||id==='nova-frota'){status.textContent='A Nova Frota conserva seus modelos originais.';return;}\n status.textContent='Consultando os quatro modelos...';\n try{\n  const data=await request('/v1/super-admin/transportadoras/'+encodeURIComponent(id)+'/artes');\n  if(serial!==artLoadSerial||selected?.id!==id)return;\n  applyArtValues(data.artes);\n  status.textContent=data.configured?'Personalização salva para '+selected.name+'.':'Personalize e salve para esta empresa.';\n }catch(error){if(serial===artLoadSerial&&selected?.id===id)status.textContent=error.message;}\n}\n$('artSave').onclick=async()=>{\n if(!canEditBrand()||!selected?.id||artSaving)return;\n const tenant=selected.id,body=allArtValues();\n if(Object.values(body.models).some(model=>!Number.isInteger(model.watermark)||model.watermark<0||model.watermark>14)){\n  $('artStatus').textContent='Opacidade permitida: 0 a 14%.';return;\n }\n artSaving=true;$('artSave').disabled=true;\n $('artStatus').textContent='Salvando personalização no R2...';\n try{\n  await writeRequest('/v1/super-admin/transportadoras/'+encodeURIComponent(tenant)+'/artes','PUT',body);\n  if(selected?.id!==tenant)return;\n  const saved=await request('/v1/super-admin/transportadoras/'+encodeURIComponent(tenant)+'/artes');\n  if(!saved.configured||JSON.stringify(saved.artes?.models)!==JSON.stringify(body.models))\n   throw new Error('Não foi possível confirmar a gravação.');\n  $('artStatus').textContent='Quatro modelos salvos para '+selected.name+'.';\n  notice('Cores salvas com sucesso. A logo oficial continua única por transportadora.');\n  await loadAudit();\n }catch(error){$('artStatus').textContent=error.message||'Falha ao salvar.';}\n finally{artSaving=false;$('artSave').disabled=!canEditBrand();}\n};\nfunction galleryLogoImage(company,img,initials){\n if(company.id==='nova-frota'){\n  img.src='https://portalfrete.net.br/assets/img/logo-novafrota.png';\n  img.hidden=false;initials.hidden=true;return;\n }\n if(galleryLogoUrls.has(company.id)){\n  img.src=galleryLogoUrls.get(company.id);img.hidden=false;initials.hidden=true;return;\n }\n if(galleryLogoLoading.has(company.id))return;\n galleryLogoLoading.add(company.id);\n fetch('/v1/super-admin/transportadoras/'+encodeURIComponent(company.id)+'/logo',{\n  credentials:'include',cache:'no-store'\n }).then(async response=>{\n  if(!response.ok)return;\n  const blob=await response.blob();\n  if(!['image/png','image/jpeg','image/webp'].includes(blob.type))return;\n  galleryLogoUrls.set(company.id,URL.createObjectURL(blob));\n  document.querySelectorAll('[data-company-logo]').forEach(el=>{\n   if(el.dataset.companyLogo===company.id){\n    el.src=galleryLogoUrls.get(company.id);el.hidden=false;\n    el.previousElementSibling.hidden=true;\n   }\n  });\n }).catch(()=>{}).finally(()=>galleryLogoLoading.delete(company.id));\n}\nasync function refreshGalleryLogo(id){\n const old=galleryLogoUrls.get(id);if(old)URL.revokeObjectURL(old);\n galleryLogoUrls.delete(id);galleryLogoLoading.delete(id);renderCompanies();\n}\nfunction showGalleryDetail(open){\n galleryOpen=Boolean(open);\n $('companyDetail').hidden=!galleryOpen;\n (galleryOpen?$('companyDetail'):$('galleryPanel')).scrollIntoView({behavior:'smooth',block:'start'});\n renderCompanies();\n}\nrenderCompanies=function(){\n const root=$('companies');root.replaceChildren();\n const term=String($('companySearch').value||'').trim().toUpperCase();\n const filtered=companies.filter(company=>(company.name+' '+company.id).toUpperCase().includes(term));\n $('companyCount').textContent=companies.length+' cadastrada'+(companies.length===1?'':'s');\n if(!filtered.length){root.className='empty';root.textContent='Nenhuma empresa encontrada.';return;}\n root.className='company-gallery';\n for(const company of filtered){\n  const button=document.createElement('button');button.type='button';\n  button.className='company-card'+(galleryOpen&&selected?.id===company.id?' selected':'');\n  button.setAttribute('aria-label','Abrir '+company.name);\n  const imageBox=document.createElement('div');imageBox.className='company-card-visual';\n  const initials=document.createElement('strong');initials.className='company-monogram';\n  initials.textContent=company.name.trim().split(/\\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'PF';\n  const image=document.createElement('img');image.hidden=true;image.alt='Logo de '+company.name;\n  image.dataset.companyLogo=company.id;imageBox.append(initials,image);\n  const body=document.createElement('div');body.className='company-card-body';\n  const title=document.createElement('div');title.className='company-card-name';title.textContent=company.name;\n  const meta=document.createElement('div');meta.className='company-card-meta';\n  const status=document.createElement('span');status.className='company-state'+(company.active?' active':'');\n  status.textContent=company.active?'Ativa':'Inativa';\n  const modules=document.createElement('span');modules.className='company-card-modules';\n  modules.textContent=(company.modules?.length||0)+' módulos';\n  meta.append(status,modules);body.append(title,meta);\n  const open=document.createElement('div');open.className='company-card-bottom';open.textContent='Abrir configurações';\n  button.append(imageBox,body,open);\n  button.onclick=()=>{\n   selected=company;rememberSelectedCompany(company.id);\n   render();loadUsers();loadAudit();loadBrand();loadIntegration();loadArtThemes();\n   showGalleryDetail(true);\n  };\n  root.append(button);galleryLogoImage(company,image,initials);\n }\n};\n$('galleryBack').onclick=()=>showGalleryDetail(false);\n$('companySearch').addEventListener('input',renderCompanies);\ncreateArtEditor();\naddEventListener('pagehide',()=>{\n for(const url of galleryLogoUrls.values())URL.revokeObjectURL(url);\n galleryLogoUrls.clear();\n});\n";
export function stagingPanelHtml(){
  let html=stagingPage;
  html=required(html,"const API_BASE = 'https://api.portalfrete.net.br';","const API_BASE = '';");
  html=required(html,"location.assign('home.html')","location.assign('https://portalfrete.net.br/pages/home.html')");
  html=required(html,'const canEdit=()=>Boolean(writeReady&&mfaActive&&selected&&selected.id!=="nova-frota");','const canEdit=()=>Boolean(writeReady&&selected&&selected.id!=="nova-frota");');
  html=required(html,"const canEditMembership=()=>Boolean(canEdit()&&membershipReady&&mfaMembershipActive);","const canEditMembership=()=>Boolean(canEdit()&&membershipReady);");
  html=required(html,"const canEditBrand=()=>Boolean(canEdit()&&brandReady&&mfaBrandActive);","const canEditBrand=()=>Boolean(canEdit()&&brandReady);");
  html=required(html,"$('newCompany').disabled=!(writeReady&&mfaActive);","$('newCompany').disabled=!writeReady;");
  html=required(html,"$('adminAuth').hidden=!writeReady;","$('adminAuth').hidden=true;");
  html=required(html,"writeReady?'requer validação MFA':'não configurada'","writeReady?'liberada pelo Cloudflare Access':'não configurada'");
  html=required(html,"const ROLES=[", "let credentialReady=false,credentialProblem=\'\';\nconst ROLES=[");
  html=required(html,
   "brandReady=Boolean(capabilities.brandWrite);",
   "brandReady=Boolean(capabilities.brandWrite);credentialReady=Boolean(capabilities.credentialWrite);credentialProblem=Array.isArray(capabilities.credentialMissing)&&capabilities.credentialMissing.length?\'Definir senha indisponível: estrutura D1 incompleta (\'+capabilities.credentialMissing.join(\', \')+\').\':\'\';");
  html=required(html,
   "if(companies.length){selected=companies[0];render();",
   "if(credentialProblem)notice(credentialProblem);if(companies.length){selected=companies[0];render();");
  html=required(html,
   "actions.append(role,status);row.append(actions);",
   "actions.append(role,status);if(credentialReady){const passwordButton=document.createElement('button');passwordButton.type='button';passwordButton.textContent='Definir senha';passwordButton.onclick=()=>setTenantPassword(u);actions.append(passwordButton);}row.append(actions);");
  const start=html.indexOf("async function writeRequest(");
  const end=html.indexOf("async function refreshCompanies(",start);
  if(start<0||end<=start)throw new Error("Staging write form markers missing");
  html=html.slice(0,start)+
    "async function writeRequest(path,method,data,contentType='application/json'){\n"+
    " return request(path,{method,headers:{'Content-Type':contentType},body:contentType==='application/json'?JSON.stringify(data):data});\n"+
    "}\n"+html.slice(end);
  // Private Apps Script integration form, hosted only behind Cloudflare Access.
  html=required(html,
    '<div id="settings" class="tab" hidden><h2>Histórico de auditoria</h2>',
    '<div id="settings" class="tab" hidden>'+
    '<section class="panel" id="integrationPanel" style="margin-bottom:22px">'+
    '<h2>Planilha individual da transportadora</h2>'+
    '<p class="muted">O link e a chave ficam exclusivamente no armazenamento privado do Worker, não nos assets públicos. A Nova Frota permanece intacta.</p>'+
    '<p class="muted" id="integrationStatus">Selecione uma empresa.</p>'+
    '<label>Base para configurar <select id="integrationBase" style="display:block;width:100%;padding:9px;background:#071525;color:#fff;margin:7px 0 12px"><option value="">Geral / estrutura atual</option><option>GO</option><option>MT</option><option>SP</option><option>MS</option><option>BA</option><option>PR</option><option>SC</option><option>RO</option><option>TO</option><option>MA</option></select></label>'+
    '<label>ID da planilha Google Sheets<input id="integrationSheetId" autocomplete="off" placeholder="ID da cópia no Sheets" style="display:block;width:100%;margin:7px 0 12px;padding:10px;background:#071525;color:#fff;border:1px solid #55718a;border-radius:8px"></label>'+
    '<label>Implantação do Apps Script (somente quando alterar)<input id="integrationUrl" type="url" autocomplete="off" placeholder="https://script.google.com/macros/s/.../exec" style="display:block;width:100%;margin:7px 0 12px;padding:10px;background:#071525;color:#fff;border:1px solid #55718a;border-radius:8px"></label>'+
    '<label>Chave exclusiva do Apps Script (somente quando alterar)<input id="integrationKey" type="password" autocomplete="off" placeholder="No mínimo 24 caracteres" style="display:block;width:100%;margin:7px 0 12px;padding:10px;background:#071525;color:#fff;border:1px solid #55718a;border-radius:8px"></label>'+
    '<p><button type="button" id="integrationGenerate">Gerar chave nova</button> <button type="button" id="integrationCopy" class="ghost">Copiar chave digitada</button></p>'+
    '<label>UF inicial <select id="integrationUf" style="display:block;padding:9px;background:#071525;color:#fff;margin:7px 0 12px"><option>GO</option><option>MT</option><option>MG</option><option>SP</option><option>PR</option><option>SC</option><option>MS</option><option>BA</option><option>RO</option><option>TO</option><option>PA</option><option>MA</option></select></label>'+
    '<label><input id="integrationEnabled" type="checkbox"> Ativar integração após verificar que o Apps Script copiado utiliza a planilha correta</label>'+
    '<p><button type="button" id="integrationSave">Salvar integração privada</button> <button type="button" id="integrationTest" class="ghost">Testar conexão (somente leitura)</button></p>'+
    '<p class="muted">Primeiro salve desativada, confirme a planilha no Apps Script e configure a chave correspondente em Propriedades do script. Depois marque Ativar.</p>'+
    '</section><h2>Histórico de auditoria</h2>');
  const integrationJs=`
const SELECTED_KEY='pf:super-admin:selected-company';
function selectedFromThisBrowser(){
 try{const id=sessionStorage.getItem(SELECTED_KEY)||'';return /^[a-z][a-z0-9-]{2,48}$/.test(id)?id:'';}
 catch{return '';}
}
function rememberSelectedCompany(id){
 if(!id)return;
 try{sessionStorage.setItem(SELECTED_KEY,id);}catch{}
}
let integrationRequest=0;
function baseIntegrationPath(id){
 const uf=$('integrationBase')?.value||'';
 return '/v1/super-admin/transportadoras/'+encodeURIComponent(id)+
   (uf?'/bases/'+encodeURIComponent(uf)+'/integracao':'/integracao');
}
$('integrationBase').addEventListener('change',()=>{
 const base=$('integrationBase').value;
 if(base)$('integrationUf').value=base;
 void loadIntegration();
});
async function loadIntegration(){
  const id=selected?.id,serial=++integrationRequest;
  const status=$('integrationStatus');
  $('integrationUrl').value='';$('integrationKey').value='';
  $('integrationSheetId').value='';$('integrationUf').value=$('integrationBase').value||'GO';$('integrationEnabled').checked=false;
  $('integrationUrl').placeholder='https://script.google.com/macros/s/.../exec';
  $('integrationKey').placeholder='No mínimo 24 caracteres';
  if(!id||id==='nova-frota'){
    status.textContent='A Nova Frota continua utilizando a integração original.';
    $('integrationSave').disabled=true;$('integrationTest').disabled=true;return;
  }
  $('integrationSave').disabled=!canEdit();
  $('integrationTest').disabled=!canEdit();
  status.textContent='Consultando integração da transportadora...';
  try{
    const basePath=baseIntegrationPath(id);
    const res=await request(basePath);
    if(serial!==integrationRequest||selected?.id!==id)return;
    const config=res.integracao||{};
    $('integrationSheetId').value=config.spreadsheetId||'';
    $('integrationUf').value=config.estado||'GO';
    $('integrationEnabled').checked=config.enabled===true;
    const configuredUrl=config.scriptUrlConfigured===true;
    $('integrationUrl').placeholder=configuredUrl?
      'URL armazenada com segurança. Deixe em branco para manter.':
      'https://script.google.com/macros/s/.../exec';
    $('integrationKey').placeholder=config.gatewayKeyConfigured?
      'Chave salva com segurança. Deixe em branco para manter.':
      'No mínimo 24 caracteres';
    status.textContent=config.configured?
      'Integração salva para '+selected.name+' ('+id+') · '+
      (config.enabled?'ATIVA':'DESATIVADA')+
      ' · Apps Script: '+(configuredUrl?'configurado':'pendente')+
      ' · Chave: '+(config.gatewayKeyConfigured?'configurada':'pendente')+'.':
      'Nenhuma integração salva para '+selected.name+' ('+id+').';
  }catch(error){
    if(serial===integrationRequest&&selected?.id===id)status.textContent=error.message;
  }
}
$('integrationTest').onclick=async()=>{
  if(!canEdit()||!selected?.id)return;
  const id=selected.id,button=$('integrationTest'),status=$('integrationStatus');
  button.disabled=true;
  status.textContent='Testando chave e vinculo do Apps Script sem alterar dados...';
  try{
    const result=await request('/v1/super-admin/transportadoras/'+
      encodeURIComponent(id)+($('integrationBase').value?'/bases/'+encodeURIComponent($('integrationBase').value):'')+'/integracao/testar');
    if(selected?.id!==id)return;
    if(result.conectado!==true||result.empresaCorreta!==true||
      result.planilhaCorreta!==true)throw new Error('Conexao nao confirmada.');
    status.textContent='Conexao validada: empresa correta, planilha correta e chave autorizada. Nenhum dado foi alterado.';
    notice('Teste somente de leitura aprovado. Antes de ativar, revise os registros herdados e compartilhamentos da planilha.');
  }catch(error){
    if(selected?.id===id){
      const detail=error?.details;
      status.textContent='Teste nao aprovado: '+(error?.message||'Verifique a configuracao.')+
        (detail && detail.tenantMatch===false?' Empresa divergente.':'')+
        (detail && detail.spreadsheetMatch===false?' Planilha divergente.':'');
    }
  }finally{
    button.disabled=!canEdit();
  }
};
$('integrationGenerate').onclick=()=>{
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  $('integrationKey').type='text';
  $('integrationKey').value=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  notice('Chave gerada. Copie e configure em PORTAL_GATEWAY_KEY no Apps Script copiado antes de ativar.');
};
$('integrationCopy').onclick=async()=>{
  const value=$('integrationKey').value;
  if(!value)return notice('Gere ou digite a chave para copiar.');
  try{await navigator.clipboard.writeText(value);notice('Chave copiada. Não compartilhe em links ou capturas de tela.');}
  catch{notice('Cópia bloqueada pelo navegador. Selecione o campo e copie manualmente.');}
};
$('integrationSave').onclick=async()=>{
  if(!canEdit())return;
  const id=selected.id;
  const data={spreadsheetId:$('integrationSheetId').value.trim(),estado:$('integrationUf').value,
    enabled:$('integrationEnabled').checked};
  if($('integrationUrl').value.trim())data.scriptUrl=$('integrationUrl').value.trim();
  if($('integrationKey').value.trim())data.gatewayKey=$('integrationKey').value.trim();
  $('integrationSave').disabled=true;
  try{
    await writeRequest(baseIntegrationPath(id),'PUT',data);
    $('integrationKey').value='';$('integrationKey').type='password';
    $('integrationUrl').value='';
    const persisted=await request(baseIntegrationPath(id));
    if(!persisted?.integracao?.configured ||
       persisted.integracao.spreadsheetId!==data.spreadsheetId ||
       persisted.integracao.enabled!==data.enabled ||
       (data.scriptUrl&&!persisted.integracao.scriptUrlConfigured) ||
       (data.gatewayKey&&!persisted.integracao.gatewayKeyConfigured))
      throw new Error('A gravação não pôde ser confirmada. Verifique a integração antes de continuar.');
    await loadIntegration();await loadAudit();
    rememberSelectedCompany(id);
    notice('Integração de '+selected.name+' salva e confirmada no servidor. Recarregar a página não apagará os dados.');
  }catch(error){writeError(error);}
  finally{$('integrationSave').disabled=!canEdit();}
};
`;
  html=required(html,"async function refreshCompanies(",integrationJs+"\nasync function refreshCompanies(");
  html=required(html,"renderModules();renderUsers();","renderModules();renderUsers();$('integrationSave').disabled=!canEdit();");
  // Preserve only the selected tenant identifier, never script URLs or keys.
  html=required(html,
    "button.textContent=company.name;button.onclick=()=>{selected=company;render();loadUsers();loadAudit();loadBrand();};root.append(button);",
    "button.textContent=company.name;button.onclick=()=>{selected=company;rememberSelectedCompany(company.id);render();loadUsers();loadAudit();loadBrand();loadIntegration();};root.append(button);");
  html=required(html,
    "selected=companies.find(company=>company.id===(preferred||selected?.id))||companies[0]||null;",
    "selected=companies.find(company=>company.id===(preferred||selected?.id||selectedFromThisBrowser()))||companies[0]||null;if(selected)rememberSelectedCompany(selected.id);");
  html=required(html,
    "if(companies.length){selected=companies[0];render();loadUsers();loadAudit();loadBrand();}else{render();}",
    "if(companies.length){selected=companies.find(company=>company.id===selectedFromThisBrowser())||companies[0];rememberSelectedCompany(selected.id);render();loadUsers();loadAudit();loadBrand();loadIntegration();}else{render();}");
  html=required(html,
    "render();loadUsers();loadAudit();loadBrand();\n}",
    "render();loadUsers();loadAudit();loadBrand();loadIntegration();\n}");
  // Password never enters a prompt, URL, localStorage or logs.
  const method=`async function setTenantPassword(user){
    if(!credentialReady||!canEditMembership()||!user?.id||!selected?.id)return;
    const tenant=selected.id;
    const overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;inset:0;background:#000b;display:grid;place-items:center;z-index:9999;padding:16px';
    const panel=document.createElement('form');panel.style.cssText='background:#10283f;border:1px solid #4a7496;padding:24px;border-radius:14px;width:min(460px,100%)';
    const title=document.createElement('h2');title.textContent='Definir senha: '+user.id;
    const note=document.createElement('p');note.textContent='Esta senha será usada no portal separado desta transportadora. Mínimo 12 caracteres. As sessões anteriores serão encerradas.';
    const password=document.createElement('input');password.type='password';password.required=true;password.minLength=12;password.maxLength=128;
    password.autocomplete='new-password';password.placeholder='Nova senha (12 caracteres ou mais)';
    password.style.cssText='width:100%;padding:12px;background:#081a2d;color:white;border:1px solid #577d9a;border-radius:8px';
    const actions=document.createElement('div');actions.style.cssText='display:flex;gap:12px;justify-content:flex-end;margin-top:16px';
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancelar';
    cancel.onclick=()=>{password.value='';overlay.remove();};
    const save=document.createElement('button');save.type='submit';save.textContent='Salvar senha';
    actions.append(cancel,save);panel.append(title,note,password,actions);overlay.append(panel);document.body.append(overlay);
    password.focus();
    panel.onsubmit=async event=>{
      event.preventDefault();save.disabled=true;
      try{
        await writeRequest('/v1/super-admin/transportadoras/'+encodeURIComponent(tenant)+'/usuarios/'+encodeURIComponent(user.id)+'/credenciais','PUT',{senha:password.value});
        password.value='';overlay.remove();await loadAudit();
        notice('Senha configurada e sessões anteriores encerradas. Oriente o usuário a acessar o Portal Frete da transportadora.');
      }catch(error){writeError(error);password.value='';}
      finally{save.disabled=false;}
    };
  }
`;
  html=required(html,"async function editMembership(user,field){",method+"\nasync function editMembership(user,field){");

  // Owner-only gallery with private logo thumbnails and four art palettes.
  html=required(html,"</style>",GALLERY_CSS+"</style>");
  html=required(html,'<aside class="panel"><div class="row"><h2>Transportadoras</h2>',
    '<aside class="panel" id="galleryPanel"><div class="gallery-tools"><div><h2>Transportadoras</h2><span class="gallery-counter" id="companyCount">0 cadastradas</span></div><input id="companySearch" type="search" placeholder="Pesquisar transportadora" aria-label="Buscar transportadora"></div><div class="row"><h2 style="display:none">Transportadoras</h2>');
  html=required(html,'<div id="companies" class="empty">','<div id="companies" class="company-gallery empty">');
  html=required(html,'<section class="panel"><div class="row"><div><h2 id="companyName">',
    '<section class="panel" id="companyDetail" hidden><div class="row"><button id="galleryBack" type="button" class="ghost">← Todas as transportadoras</button><div><h2 id="companyName">');
  html=required(html,
    '<p class="muted">Gravação autenticada com MFA em biblioteca R2 separada. Não modifica logos de clientes nem arquivos da Nova Frota.</p></div>',
    '<p class="muted">Uma logo oficial por empresa: card do Super Admin, arte de divulgação e imagens de Fretes. A barra superior do portal continua apenas com o nome.</p><section id="artThemePanel"><h3>Personalização dos quatro modelos</h3><p class="muted">Mesmo layout para todas as transportadoras, cores individuais por modelo. Marca d’água usa a mesma logo cadastrada acima.</p><div class="art-model-grid" id="artModelGrid"></div><div class="art-actions"><span id="artStatus">Selecione uma empresa.</span><button id="artSave" type="button" disabled>Salvar os quatro modelos</button></div></section></div>');
  html=required(html,
    "await loadBrand();await loadAudit();notice('Logo salva",
    "await loadBrand();await refreshGalleryLogo(tenant);await loadAudit();notice('Logo salva");
  html=required(html,"</script>",GALLERY_JS+"\n</script>");
  return html;
}
