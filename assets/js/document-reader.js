/* Portal Frete · OCR local. Arquivos jamais enviados por fetch ou formulário.
   Dependências fixadas por versão; resultados e anexos permanecem apenas em memória. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const MAX_BYTES=15*1024*1024,MAX_PAGES=8,MAX_FILES=10;
const TESSERACT="https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js";
const PDF_MODULE="https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/pdf.mjs";
const PDF_WORKER="https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/pdf.worker.mjs";
let file=null,kind=null,previewUrl=null,pdfjs=null,ocrWorker=null;
let entries=[],nextId=1,activeId=null;
let busy=false,cancelled=false,rawText="",lastResult=null,lastPages=0,lastConf=null;
const fieldsApi=window.PortalOCRFields;
if(!fieldsApi){console.error("[OCR] O extrator de campos não foi carregado.");return;}
const say=(message,type="")=>{
 const p=$("ocrMessage");p.textContent=message;p.className="ocr-message"+(type?" "+type:"");
};
function progress(label,value){
 const n=Math.max(0,Math.min(100,Math.round(Number(value)||0)));
 $("ocrProgressText").textContent=label;
 $("ocrProgressPct").textContent=n+"%";
 $("ocrProgress").value=n;
}
function setBusy(value){
 busy=value;
 $("ocrStart").disabled=value||!file;
 $("ocrType").disabled=value;
 $("ocrFile").disabled=value;
 for(const button of $("ocrFilesList").querySelectorAll("button,select"))button.disabled=value;
 $("ocrCancel").hidden=!value;
 $("ocrDropzone").setAttribute("aria-disabled",String(value));
}
function checkCancelled(){if(cancelled)throw new Error("Leitura cancelada pelo usuário.");}
function resetOutput(){
 rawText="";lastResult=null;lastPages=0;lastConf=null;
 $("ocrResults").hidden=true;$("ocrFieldsGrid").replaceChildren();$("ocrRawText").value="";
}
function clearPreview(){
 if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
 $("ocrPreviewImage").removeAttribute("src");
 $("ocrPreviewImage").hidden=true;$("ocrPreviewPdf").hidden=true;
 $("ocrEmptyPreview").hidden=false;
 const canvas=$("ocrPreviewPdf");
 canvas.width=1;canvas.height=1;
}
const getActive=()=>entries.find(x=>x.id===activeId)||null;
const labelStatus=s=>({aguardando:"Aguardando",lendo:"Lendo…",ok:"Concluído",erro:"Falha",cancelado:"Cancelado"})[s]||"Aguardando";
const displaySize=n=>(n/1024/1024).toFixed(2)+" MB";
function updateControls(){
 const remaining=entries.filter(x=>x.status!=="ok").length;
 $("ocrStart").disabled=busy||remaining===0;
 $("ocrStart").textContent=remaining?("🔎 Ler "+remaining+" documento"+(remaining===1?"":"s")):"✓ Todos os documentos lidos";
 $("ocrFileCount").textContent=entries.length+" / "+MAX_FILES;
 $("ocrCancel").hidden=!busy;
}
function updateResultSelector(){
 const select=$("ocrResultFile");
 select.replaceChildren();
 for(const entry of entries.filter(x=>x.status==="ok")){
  const option=document.createElement("option");
  option.value=String(entry.id);option.textContent=entry.file.name;
  select.append(option);
 }
 select.value=String(activeId||"");
}
function renderQueue(){
 const list=$("ocrFilesList");list.replaceChildren();
 for(const entry of entries){
  const row=document.createElement("div");row.className="ocr-file-item";
  if(entry.id===activeId)row.classList.add("active");
  const main=document.createElement("button");main.type="button";main.className="ocr-file-main";
  const name=document.createElement("strong");name.textContent=entry.file.name;
  const info=document.createElement("small");info.textContent=displaySize(entry.file.size)+" · "+(entry.kind==="pdf"?"PDF":"Imagem");
  const status=document.createElement("span");status.className="ocr-file-state";
  status.dataset.status=entry.status;status.textContent=labelStatus(entry.status);
  main.append(name,info,status);
  main.disabled=busy;main.onclick=()=>activate(entry.id);
  const type=document.createElement("select");type.className="ocr-file-type";
  type.setAttribute("aria-label","Tipo do documento "+entry.file.name);
  for(const [key,title] of [["auto","Detectar tipo"],["cnh","CNH"],["veiculo","CRLV / Veículo"],["endereco","Comprovante endereço"],["geral","Outros"]]){
   const opt=document.createElement("option");opt.value=key;opt.textContent=title;type.append(opt);
  }
  type.value=entry.type;type.disabled=busy;
  type.onchange=()=>{
   entry.type=type.value;
   if(entry.result){
    entry.result=fieldsApi.extract(entry.raw,entry.type);
    if(entry.id===activeId){lastResult=entry.result;present(false);}
   }
   if(entry.id===activeId)$("ocrType").value=entry.type;
  };
  const remove=document.createElement("button");remove.type="button";remove.className="ocr-file-remove";
  remove.textContent="Remover";remove.disabled=busy;
  remove.onclick=()=>removeEntry(entry.id);
  row.append(main,type,remove);list.append(row);
 }
 updateControls();
 updateResultSelector();
}
function clearAll(){
 if(busy)return;
 entries=[];activeId=null;file=null;kind=null;
 $("ocrFile").value="";
 clearPreview();resetOutput();
 $("ocrProgressBox").hidden=true;
 renderQueue();
 say("Adicione até 10 documentos para iniciar a leitura.");
}
function removeEntry(id){
 if(busy)return;
 entries=entries.filter(x=>x.id!==id);
 if(activeId===id){
  const replacement=entries[0]||null;
  activeId=null;clearPreview();resetOutput();
  if(replacement)activate(replacement.id);
  else{file=null;kind=null;}
 }
 renderQueue();
 if(!entries.length)say("Nenhum documento selecionado.");
}
function showPreview(entry){
 clearPreview();
 if(!entry)return;
 if(entry.kind==="image"){
  previewUrl=URL.createObjectURL(entry.file);
  $("ocrPreviewImage").src=previewUrl;
  $("ocrPreviewImage").hidden=false;
  $("ocrEmptyPreview").hidden=true;
 }else if(entry.previewData){
  $("ocrPreviewImage").src=entry.previewData;
  $("ocrPreviewImage").hidden=false;
  $("ocrEmptyPreview").hidden=true;
 }else{
  $("ocrEmptyPreview").querySelector("strong").textContent="PDF selecionado";
  $("ocrEmptyPreview").querySelector("small").textContent="Prévia disponível durante ou após a leitura.";
 }
}
function activate(id){
 if(busy)return;
 const entry=entries.find(x=>x.id===id);
 if(!entry)return;
 activeId=id;file=entry.file;kind=entry.kind;
 $("ocrType").value=entry.type;
 rawText=entry.raw||"";lastResult=entry.result||null;lastPages=entry.pages||0;lastConf=entry.conf??null;
 showPreview(entry);
 if(entry.result)present(false);
 else $("ocrResults").hidden=true;
 renderQueue();
 say(entry.status==="erro"?"Falha neste arquivo: "+entry.error:
  entry.status==="ok"?"Documento lido. Confira os dados extraídos.":
  "Arquivo selecionado. Clique em Ler documentos.",entry.status==="erro"?"error":"");
}
async function sniff(f){
 if(!f||f.size<4||f.size>MAX_BYTES)throw new Error("Cada arquivo deve ter entre 4 bytes e 15 MB.");
 const h=new Uint8Array(await f.slice(0,12).arrayBuffer());
 if(h[0]===0xFF&&h[1]===0xD8&&h[2]===0xFF)return "image";
 if(h[0]===0x89&&h[1]===0x50&&h[2]===0x4E&&h[3]===0x47)return "image";
 if(h[0]===0x25&&h[1]===0x50&&h[2]===0x44&&h[3]===0x46)return "pdf";
 throw new Error("Formato incompatível. Use JPG, PNG ou PDF válidos.");
}
async function selectFiles(selection){
 if(busy||!selection?.length)return;
 const rejected=[];
 for(const candidate of Array.from(selection)){
  if(entries.length>=MAX_FILES){rejected.push("Limite de 10 arquivos atingido.");break;}
  if(entries.some(e=>e.file.name===candidate.name&&e.file.size===candidate.size&&e.file.lastModified===candidate.lastModified)){
   rejected.push(candidate.name+" já está na lista.");continue;
  }
  try{
   const detected=await sniff(candidate);
   entries.push({id:nextId++,file:candidate,kind:detected,
    type:$("ocrType").value,status:"aguardando",result:null,raw:"",pages:0,conf:null,previewData:null,error:""});
  }catch(e){rejected.push(candidate.name+": "+e.message);}
 }
 $("ocrFile").value="";
 if(activeId===null&&entries.length)activate(entries[0].id);
 renderQueue();
 if(rejected.length)say(rejected.join(" "),"error");
 else say(entries.length+" documento(s) na lista. A leitura será feita em sequência.");
}

function loadScript(url){
 return new Promise((resolve,reject)=>{
  if(window.Tesseract)return resolve();
  const script=document.createElement("script");
  script.src=url;script.async=true;script.crossOrigin="anonymous";
  script.onload=()=>window.Tesseract?resolve():reject(new Error("Biblioteca OCR indisponível."));
  script.onerror=()=>reject(new Error("Não foi possível baixar o mecanismo OCR. Verifique a conexão."));
  document.head.append(script);
 });
}
async function ensureWorker(){
 if(ocrWorker)return ocrWorker;
 await loadScript(TESSERACT);
 checkCancelled();
 progress("Preparando idioma português…",6);
 const worker=await window.Tesseract.createWorker("por",1,{
  logger:event=>{
   if(!busy||cancelled)return;
   if(event?.status==="recognizing text"&&Number.isFinite(event.progress)){
    const pct=Number(event.progress);
    const prior=Number($("ocrProgress").dataset.page||0);
    const total=Number($("ocrProgress").dataset.pages||1);
    progress("Reconhecendo texto · página "+(prior+1)+" de "+total,
     8+((prior+pct)/Math.max(total,1))*85);
   }
  }
 });
 ocrWorker=worker;
 checkCancelled();
 return worker;
}
async function recognize(input){
 const w=await ensureWorker();
 checkCancelled();
 const result=await w.recognize(input);
 checkCancelled();
 const text=String(result?.data?.text||"");
 const c=Number(result?.data?.confidence);
 return {text,confidence:Number.isFinite(c)?c:null};
}
async function imageOCR(f){
 $("ocrProgress").dataset.page="0";$("ocrProgress").dataset.pages="1";
 progress("Preparando imagem…",9);
 if(typeof createImageBitmap!=="function")
  throw new Error("Este navegador não suporta preparação segura de imagens. Atualize o navegador.");
 const bitmap=await createImageBitmap(f);
 let canvas;
 try{
  if(bitmap.width>20000||bitmap.height>20000)
   throw new Error("Imagem com resolução excessiva. Reduza o tamanho da foto.");
  const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height),
   Math.sqrt(7_000_000/(bitmap.width*bitmap.height)));
  canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext("2d",{alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height);
  checkCancelled();
  progress("Lendo imagem…",12);
  const result=await recognize(canvas);
  if(!result.text.trim())
   throw new Error("Não foi possível identificar texto na imagem. Tente uma foto mais nítida.");
  return {text:result.text,pages:1,confidences:result.confidence===null?[]:[result.confidence]};
 }finally{
  if(canvas){canvas.width=1;canvas.height=1;}
  bitmap.close();
 }
}
async function ensurePdf(){
 if(pdfjs)return pdfjs;
 progress("Carregando leitor de PDF…",4);
 pdfjs=await import(PDF_MODULE);
 pdfjs.GlobalWorkerOptions.workerSrc=PDF_WORKER;
 return pdfjs;
}
function ensureCanvasSize(width,height){
 const maxPixels=7_000_000;
 const scale=Math.min(2,Math.sqrt(maxPixels/(width*height)));
 return Math.max(.0001,scale);
}
async function renderPage(page,firstPage=false){
 const base=page.getViewport({scale:1});
 const scale=ensureCanvasSize(base.width,base.height);
 const view=page.getViewport({scale});
 const canvas=document.createElement("canvas");
 canvas.width=Math.round(view.width);canvas.height=Math.round(view.height);
 const context=canvas.getContext("2d",{alpha:false,willReadFrequently:true});
 if(!context)throw new Error("Canvas indisponível neste navegador.");
 await page.render({canvasContext:context,viewport:view}).promise;
 checkCancelled();
 if(firstPage){
  const preview=$("ocrPreviewPdf");
  const max=1100,ratio=Math.min(1,max/Math.max(canvas.width,canvas.height));
  preview.width=Math.round(canvas.width*ratio);preview.height=Math.round(canvas.height*ratio);
  preview.getContext("2d",{alpha:false}).drawImage(canvas,0,0,preview.width,preview.height);
  $("ocrPreviewPdf").hidden=false;$("ocrEmptyPreview").hidden=true;
 }
 return canvas;
}
// Documentos oficiais costumam misturar texto digital com campos rasterizados.
// O CRLV de teste já contém números em texto; na CNH de teste, os dados
// pessoais aparecem em uma imagem no canto superior esquerdo.
function pdfSearchRegion(canvas,x,y,w,h){
 const sx=Math.floor(canvas.width*x),sy=Math.floor(canvas.height*y);
 const sw=Math.min(canvas.width-sx,Math.round(canvas.width*w));
 const sh=Math.min(canvas.height-sy,Math.round(canvas.height*h));
 if(sw<=0||sh<=0)throw new Error("Recorte inválido do PDF.");
 const scale=Math.min(2.5,2100/sw,Math.sqrt(6_000_000/(sw*sh)));
 const out=document.createElement("canvas");
 out.width=Math.max(1,Math.round(sw*scale));
 out.height=Math.max(1,Math.round(sh*scale));
 const ctx=out.getContext("2d",{alpha:false,willReadFrequently:true});
 if(!ctx)throw new Error("Canvas OCR indisponível.");
 ctx.fillStyle="#ffffff";
 ctx.fillRect(0,0,out.width,out.height);
 ctx.drawImage(canvas,sx,sy,sw,sh,0,0,out.width,out.height);
 return out;
}
function pdfRegions(hint,firstPage){
 if(!firstPage)return [];
 const text=String(hint||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
 // O texto informativo de um CRLV pode mencionar CNH. Priorizar o
 // documento de veículo quando houver RENAVAM/licenciamento e respeitar
 // a seleção explícita de tipo feita pelo usuário.
 if(/(?:CRLV|RENAVAM|LICENCIAMENTO|CAVALO|PLACA|DOCUMENTO DO VEICULO)/.test(text))
  return [
   {name:"Dados do veículo",rect:[.035,.055,.49,.50]},
   {name:"Dados do proprietário",rect:[.51,.055,.47,.50]}
  ];
 if(/(?:CNH|HABILITACAO|DRIVER.?S.?LICENSE|PERMISSAO PARA DIRIGIR)/.test(text))
  return [{name:"Dados da CNH",rect:[.035,.105,.49,.32]}];
 return []; // Outros PDFs: OCR na página inteira quando não houver texto pesquisável.
}
function pdfLayoutText(items,pageWidth){
 // Ordena as palavras por duas colunas antes da extração estruturada.
 // Esta representação auxilia quando a sequência interna do PDF separa todos
 // os títulos de todos os valores, como no CRLV digital.
 const parts=(items||[]).filter(x=>typeof x.str==="string"&&x.str.trim());
 const collect=arr=>arr.sort((a,b)=>{
  const yA=Number(a.transform?.[5]||0),yB=Number(b.transform?.[5]||0);
  return Math.abs(yA-yB)>2.5?yB-yA:
    Number(a.transform?.[4]||0)-Number(b.transform?.[4]||0);
 }).map(x=>String(x.str).trim()).join("\n");
 return [collect(parts.filter(x=>Number(x.transform?.[4]||0)<pageWidth*.5)),
  collect(parts.filter(x=>Number(x.transform?.[4]||0)>=pageWidth*.5))].join("\n");
}
async function pdfOCR(f){
 const pdfLib=await ensurePdf();checkCancelled();
 let task,pdf;
 try{
  const data=new Uint8Array(await f.arrayBuffer());
  task=pdfLib.getDocument({data,isEvalSupported:false,stopAtErrors:true});
  pdf=await task.promise;
  const pages=pdf.numPages;
  if(!Number.isInteger(pages)||pages<1)throw new Error("PDF sem páginas disponíveis.");
  if(pages>MAX_PAGES)throw new Error("PDF com "+pages+" páginas. Limite desta versão: "+MAX_PAGES+". Divida o arquivo para continuar.");
  const pieces=[],confidences=[];
  $("ocrProgress").dataset.pages=String(pages);
  for(let i=1;i<=pages;i++){
   checkCancelled();
   $("ocrProgress").dataset.page=String(i-1);
   progress("Analisando página "+i+" de "+pages+"…",Math.round(6+(i-1)/pages*85));
   const page=await pdf.getPage(i);
   let canvas=null;
   try{
    let embedded="",layout="";
    try{
     const text=await page.getTextContent();
     embedded=(text.items||[]).map(item=>item.str||"").join("\n").trim();
     layout=pdfLayoutText(text.items||[],page.getViewport({scale:1}).width).trim();
    }catch(e){console.warn("[OCR] Não foi possível ler a camada de texto do PDF.",e.message);}
    const hint=[f.name,$("ocrType").value,embedded.slice(0,400)].join(" ");
    const regions=pdfRegions(hint,i===1);
    const needOCR=regions.length>0||embedded.length<150;
    if(i===1||needOCR)canvas=await renderPage(page,i===1);
    const scan=[];
    if(needOCR){
     // Nas CNH e CRLV, ampliar as regiões legíveis é melhor do que
     // reconhecer o QR-code e o rodapé inteiro na mesma imagem.
     if(regions.length){
      for(const region of regions){
       checkCancelled();
       progress("Lendo "+region.name+" · página "+i+"…",Math.round(8+(i-1)/pages*85));
       const crop=pdfSearchRegion(canvas,...region.rect);
       try{
        const result=await recognize(crop);
        if(result.text.trim())scan.push(result.text.trim());
        if(result.confidence!==null)confidences.push(result.confidence);
       }finally{crop.width=1;crop.height=1;}
      }
     }else{
      const result=await recognize(canvas);
      if(result.text.trim())scan.push(result.text.trim());
      if(result.confidence!==null)confidences.push(result.confidence);
     }
    }
    // Texto das zonas primeiro, para facilitar o reconhecimento dos
    // rótulos junto a seus valores. Camada digital fica como complemento.
    const combined=[...scan,layout||embedded].filter(Boolean).join("\n");
    if(combined)pieces.push(combined);
   }finally{
    if(canvas){canvas.width=1;canvas.height=1;}
    if(typeof page.cleanup==="function")page.cleanup();
   }
  }
  const text=pieces.join("\n\n--- PÁGINA ---\n\n").trim();
  if(!text)throw new Error("Não foi possível reconhecer texto no PDF. Confira a resolução e tente novamente.");
  return {text,pages,confidences};
 }catch(e){
  if(/password/i.test(String(e.message)))throw new Error("PDF protegido por senha. Utilize um PDF desbloqueado.");
  throw e;
 }finally{
  // PDF.js 6 removeu PDFDocumentProxy.destroy(): encerrar SOMENTE a tarefa.
  if(task&&typeof task.destroy==="function"){
   try{await task.destroy();}catch(e){
    console.warn("[OCR] Falha não fatal ao liberar o leitor PDF.",e);
   }
  }
 }
}

async function terminateWorker(){
 if(!ocrWorker)return;
 const current=ocrWorker;ocrWorker=null;
 try{await current.terminate();}catch(e){console.warn("[OCR] Encerramento do worker:",e);}
}
function showTab(which){
 const raw=which==="raw";
 $("ocrTabFields").classList.toggle("active",!raw);
 $("ocrTabRaw").classList.toggle("active",raw);
 $("ocrTabFields").setAttribute("aria-selected",String(!raw));
 $("ocrTabRaw").setAttribute("aria-selected",String(raw));
 $("ocrFieldsPanel").hidden=raw;$("ocrRawPanel").hidden=!raw;
}
function present(){
 if(!rawText.trim())return;
 const type=$("ocrType").value;
 lastResult=fieldsApi.extract(rawText,type);
 $("ocrResults").hidden=false;
 $("ocrDetected").textContent=lastResult.titulo;
 $("ocrPages").textContent=lastPages+" "+(lastPages===1?"página analisada":"páginas analisadas");
 $("ocrConfidence").textContent=lastConf===null?
  "Leitura digital / sem índice de confiança":
  "Confiança média do OCR: "+Math.round(lastConf)+"%";
 $("ocrResultSub").textContent="Campos sugeridos, editáveis e ainda não validados. Revise antes de exportar.";
 const grid=$("ocrFieldsGrid");grid.replaceChildren();
 if(!lastResult.camposDefinidos.length){
  const notice=document.createElement("p");
  notice.className="ocr-empty-fields";
  notice.textContent="Nenhum modelo de campos selecionado. Confira o texto completo ou escolha CNH, CRLV ou endereço para sugerir campos.";
  grid.append(notice);
 }
 for(const [key,label] of lastResult.camposDefinidos){
  const field=document.createElement("label");field.className="ocr-field";
  field.textContent=label;
  const input=document.createElement("input");input.className="ocr-input";input.type="text";
  input.autocomplete="off";input.spellcheck=false;input.dataset.field=key;
  input.value=lastResult.campos[key]||"";input.placeholder="Não identificado · preencher manualmente";
  input.maxLength=180;
  input.addEventListener("input",()=>{if(lastResult)lastResult.campos[key]=input.value;});
  field.append(input);grid.append(field);
 }
 $("ocrRawText").value=rawText;
 showTab("fields");
 $("ocrResults").scrollIntoView({behavior:"smooth",block:"start"});
}
async function analyze(){
 if(!file||busy)return;
 cancelled=false;resetOutput();setBusy(true);
 $("ocrProgressBox").hidden=false;
 progress("Iniciando…",0);say("Analisando o documento localmente…");
 try{
  const result=kind==="pdf"?await pdfOCR(file):await imageOCR(file);
  checkCancelled();
  rawText=result.text;lastPages=result.pages;
  lastConf=result.confidences.length?
   result.confidences.reduce((a,b)=>a+b,0)/result.confidences.length:null;
  progress("Concluído",100);say("Leitura concluída. Confira os campos extraídos antes de utilizar.","success");
  present();
 }catch(e){
  say(String(e.message||"Erro inesperado ao ler o documento."),"error");
  $("ocrProgressBox").hidden=true;
 }finally{
  await terminateWorker();setBusy(false);
 }
}
async function cancel(){
 if(!busy)return;
 cancelled=true;say("Cancelando leitura…");
 await terminateWorker();
}
function payload(){
 if(!lastResult)return null;
 return {
  schema:"portal-frete.document-reader.v1",
  tipoDocumento:lastResult.tipo,
  tipoDescricao:lastResult.titulo,
  nomeArquivo:file?.name||"",
  paginasAnalisadas:lastPages,
  campos:{...lastResult.campos},
  textoReconhecido:rawText,
  somenteConferencia:true,
  revisadoPeloUsuario:false,
  exportadoEm:new Date().toISOString()
 };
}
async function copy(text){
 try{await navigator.clipboard.writeText(text);say("Conteúdo copiado para a área de transferência.","success");}
 catch{say("Não foi possível copiar automaticamente. Utilize o download JSON.","error");}
}
function download(){
 const data=payload();if(!data)return;
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");
 a.href=url;a.download="leitura-"+data.tipoDocumento+"-"+new Date().toISOString().slice(0,10)+".json";
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 say("JSON exportado para seu dispositivo. Nenhum dado foi salvo no Portal.","success");
}
async function authGate(){
 try{
  let session;
  if(window.portalAuthReady)session=await window.portalAuthReady;
  else if(typeof verifyPortalSession==="function")
   session=await verifyPortalSession({requireState:true,redirect:false});
  if(!session||typeof canAccessFeature!=="function"||!canAccessFeature("leitura-documentos")){
   location.replace(window.portalTenantHref?.("home.html")||"./home.html");return;
  }
  $("ocrMain").hidden=false;
  init();
 }catch(e){
  console.warn("[OCR] Acesso negado ou sessão indisponível:",e);
  location.replace(window.portalTenantHref?.("login.html")||"./login.html");
 }
}
function init(){
 const drop=$("ocrDropzone"),input=$("ocrFile");
 drop.addEventListener("click",()=>{if(!busy)input.click();});
 drop.addEventListener("keydown",e=>{
  if((e.key==="Enter"||e.key===" ")&&!busy){e.preventDefault();input.click();}
 });
 for(const event of ["dragenter","dragover"]){
  drop.addEventListener(event,e=>{e.preventDefault();if(!busy)drop.classList.add("dragover");});
 }
 for(const event of ["dragleave","drop"])
  drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove("dragover");});
 drop.addEventListener("drop",e=>{if(!busy)void selectFile(e.dataTransfer?.files?.[0]);});
 input.addEventListener("change",()=>void selectFile(input.files?.[0]));
 $("ocrRemove").addEventListener("click",clearAll);
 $("ocrStart").addEventListener("click",()=>void analyze());
 $("ocrCancel").addEventListener("click",()=>void cancel());
 $("ocrClear").addEventListener("click",clearAll);
 $("ocrType").addEventListener("change",()=>{if(lastResult)present();});
 $("ocrTabFields").addEventListener("click",()=>showTab("fields"));
 $("ocrTabRaw").addEventListener("click",()=>showTab("raw"));
 $("ocrCopyJson").addEventListener("click",()=>{const data=payload();if(data)void copy(JSON.stringify(data,null,2));});
 $("ocrDownloadJson").addEventListener("click",download);
 $("ocrCopyText").addEventListener("click",()=>void copy(rawText));
 window.addEventListener("pagehide",()=>{
  clearPreview();rawText="";lastResult=null;
  if(ocrWorker)void terminateWorker();
 },{once:true});
}
void authGate();
})();