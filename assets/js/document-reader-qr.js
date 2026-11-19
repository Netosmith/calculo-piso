/* Leitor local de QR Code: BarcodeDetector ou jsQR como alternativa.
   Não acessa URLs lidas, não consulta serviços de validação, não envia imagens.
   QR Vio da Senatran pode exigir decodificação/validação oficial. */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.PortalOCRQRCode=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const JSQR_URL="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
 const MAX_RAW=20000;
 const ALIASES=Object.freeze({
  PLACA:["veiculo","placa"],PLACA_VEICULO:["veiculo","placa"],
  RENAVAM:["veiculo","renavam"],CODIGO_RENAVAM:["veiculo","renavam"],
  CHASSI:["veiculo","chassi"],VIN:["veiculo","chassi"],
  NOME_COMPLETO:["cnh","nome"],NOME_CONDUTOR:["cnh","nome"],
  REGISTRO_CNH:["cnh","registro"],NUMERO_REGISTRO_CNH:["cnh","registro"],
  CATEGORIA_CNH:["cnh","categoria"],VALIDADE_CNH:["cnh","validade"],
  CPF_CONDUTOR:["cnh","cpf"]
 });
 const normalizeKey=value=>String(value||"").normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g,"_").replace(/^_+|_+$/g,"");
 const validValue=(key,val)=>{
  const v=String(val||"").replace(/[\u0000-\u001f\u007f]/g," ").trim();
  if(!v||v.length>150)return "";
  if(key==="placa")return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(v.replace(/[-\s]/g,"").toUpperCase())
   ? v.replace(/[-\s]/g,"").toUpperCase():"";
  if(key==="renavam")return /^\d{9,11}$/.test(v.replace(/\s/g,""))?v.replace(/\s/g,""):"";
  if(key==="chassi")return /^[A-HJ-NPR-Z0-9]{17}$/.test(v.toUpperCase())?v.toUpperCase():"";
  if(key==="registro")return /^\d{9,12}$/.test(v)?v:"";
  if(key==="cpf"){
   const d=v.replace(/\D/g,"");
   return d.length===11?d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.$2.$3-$4"):"";
  }
  if(key==="validade")return /^\d{2}[/.\-]\d{2}[/.\-]\d{4}$/.test(v)?v:"";
  if(key==="categoria")return /^(ACC|AB|AC|AD|AE|A|B|C|D|E)$/i.test(v)?v.toUpperCase():"";
  if(key==="nome")return /^[a-zA-ZÀ-ÿ '’.-]{5,100}$/.test(v)&&v.trim().includes(" ")?v:"";
  return "";
 };
 function structured(raw){
  const str=String(raw||"");
  if(str.length>MAX_RAW)return {fields:{},documentType:null};
  let pairs=[];
  const trimmed=str.trim();
  if(trimmed.startsWith("{")&&trimmed.endsWith("}")){
   try{
    const obj=JSON.parse(trimmed);
    if(obj&&typeof obj==="object"&&!Array.isArray(obj))
     pairs=Object.entries(obj).filter(([k,v])=>typeof v==="string"||typeof v==="number");
   }catch{}
  }
  if(!pairs.length){
   // Somente linhas/itens chave=valor; não transformar mensagens livres
   // ou links criptográficos em campos de documento.
   pairs=trimmed.split(/[\r\n;]+/).map(line=>{
    const m=line.trim().match(/^([A-ZÀ-ÿ_ /.-]{3,45})\s*[:=]\s*(.{1,150})$/i);
    return m?[m[1],m[2]]:null;
   }).filter(Boolean);
  }
  const candidates={veiculo:{},cnh:{}};
  for(const [key,rawValue] of pairs.slice(0,80)){
   const mapping=ALIASES[normalizeKey(key)];
   if(!mapping)continue;
   const [type,field]=mapping;
   const value=validValue(field,rawValue);
   if(value)candidates[type][field]=value;
  }
  const hasVehicle=Object.keys(candidates.veiculo).length>0;
  const hasCnh=Object.keys(candidates.cnh).length>0;
  if(hasVehicle&&hasCnh)return {fields:{},documentType:null};
  return hasVehicle?{fields:candidates.veiculo,documentType:"veiculo"}:
   hasCnh?{fields:candidates.cnh,documentType:"cnh"}:
   {fields:{},documentType:null};
 }
 function interpret(raw,method="qr"){
  const value=String(raw??"");
  if(!value)return null;
  const parsed=structured(value);
  const fieldCount=Object.keys(parsed.fields).length;
  const isUrl=/^https?:\/\/\S+$/i.test(value.trim());
  const isPrintable=!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/.test(value);
  let kind="nao_estruturado",message="QR Code detectado, mas sem campos de cadastro diretamente utilizáveis.";
  if(fieldCount){
   kind="dados_estruturados";
   message=fieldCount+" campo(s) em texto estruturado encontrados no QR. Confira os valores.";
  }else if(isUrl){
   kind="url";
   message="QR Code de endereço eletrônico detectado. O Portal não abre o link automaticamente.";
  }else if(!isPrintable||value.length>280){
   kind="protegido_ou_binario";
   message="QR Code detectado. Conteúdo codificado/protegido ou não estruturado; pode exigir validação pelo aplicativo oficial Vio.";
  }
  return {
   detectado:true,tipoConteudo:kind,metodo:method,
   resumo:message,tamanhoConteudo:value.length,
   documentoSugerido:parsed.documentType,camposQR:parsed.fields,
   validadoOficialmente:false
  };
 }
 function merge(extracted,qr){
  if(!extracted||!qr?.detectado||!qr.documentoSugerido||
    qr.documentoSugerido!==extracted.tipo)
   return extracted;
  const fields=extracted.campos||{};
  const applied=[],conflicts=[];
  for(const [key,value] of Object.entries(qr.camposQR||{})){
   if(!Object.hasOwn(fields,key)||!value)continue;
   if(!String(fields[key]||"").trim()){
    fields[key]=value;applied.push(key);
   }else if(String(fields[key]).replace(/[\W_]/g,"").toUpperCase()!==
             String(value).replace(/[\W_]/g,"").toUpperCase()){
    conflicts.push(key);
   }
  }
  qr.camposPreenchidos=applied;
  qr.camposDivergentes=conflicts;
  if(conflicts.length)
   extracted.avisos=[...(extracted.avisos||[]),
    "O QR Code divergiu do OCR em "+conflicts.length+" campo(s). Os valores não foram substituídos."];
  return extracted;
 }
 function safeExport(qr){
  if(!qr?.detectado)return {detectado:false,validadoOficialmente:false};
  return {
   detectado:true,tipoConteudo:qr.tipoConteudo,
   metodo:qr.metodo,tamanhoConteudo:qr.tamanhoConteudo,
   camposPreenchidos:[...(qr.camposPreenchidos||[])],
   camposDivergentes:[...(qr.camposDivergentes||[])],
   validadoOficialmente:false
  };
 }
 function cropCanvas(canvas,rect,maxSide){
  const sx=Math.floor(canvas.width*rect[0]),sy=Math.floor(canvas.height*rect[1]);
  const sw=Math.min(canvas.width-sx,Math.ceil(canvas.width*rect[2]));
  const sh=Math.min(canvas.height-sy,Math.ceil(canvas.height*rect[3]));
  if(sw<16||sh<16)return null;
  const scale=Math.min(1.9,maxSide/Math.max(sw,sh),Math.sqrt(2_400_000/(sw*sh)));
  const out=document.createElement("canvas");
  out.width=Math.max(32,Math.round(sw*scale));
  out.height=Math.max(32,Math.round(sh*scale));
  const ctx=out.getContext("2d",{willReadFrequently:true});
  if(!ctx){out.width=out.height=1;return null;}
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(canvas,sx,sy,sw,sh,0,0,out.width,out.height);
  return out;
 }
 const RECTS=Object.freeze({
  cnh:[[.51,.08,.46,.53],[.45,.03,.53,.90]],
  veiculo:[[.15,.05,.45,.42],[.05,.05,.55,.55]],
  auto:[[.10,.05,.47,.45],[.51,.05,.46,.55]]
 });
 let scriptPromise=null;
 function ensureJsQr(){
  if(typeof window.jsQR==="function")return Promise.resolve(window.jsQR);
  if(scriptPromise)return scriptPromise;
  scriptPromise=new Promise((resolve,reject)=>{
   const node=document.createElement("script");
   node.src=JSQR_URL;node.async=true;node.crossOrigin="anonymous";
   node.onload=()=>typeof window.jsQR==="function"?
    resolve(window.jsQR):reject(new Error("Biblioteca jsQR indisponível."));
   node.onerror=()=>reject(new Error("Falha ao carregar jsQR."));
   document.head.append(node);
  }).catch(error=>{scriptPromise=null;throw error;});
  return scriptPromise;
 }
 async function nativeDecode(image){
  if(typeof window.BarcodeDetector!=="function")return null;
  try{
   if(typeof window.BarcodeDetector.getSupportedFormats==="function"){
    const formats=await window.BarcodeDetector.getSupportedFormats();
    if(!formats.includes("qr_code"))return null;
   }
   const decoder=new window.BarcodeDetector({formats:["qr_code"]});
   const items=await decoder.detect(image);
   const qr=items?.find(x=>x.format==="qr_code"&&x.rawValue);
   return qr?interpret(qr.rawValue,"BarcodeDetector"):null;
  }catch{return null;}
 }
 async function jsDecode(image){
  const decode=await ensureJsQr();
  const ctx=image.getContext("2d",{willReadFrequently:true});
  const pixels=ctx?.getImageData(0,0,image.width,image.height);
  if(!pixels)return null;
  const result=decode(pixels.data,pixels.width,pixels.height,{inversionAttempts:"attemptBoth"});
  return result?.data?interpret(result.data,"jsQR"):null;
 }
 async function scanCanvas(canvas,docType="auto"){
  if(!canvas||!canvas.width||!canvas.height)return null;
  const native=await nativeDecode(canvas);
  if(native)return native;
  const type=Object.hasOwn(RECTS,docType)?docType:"auto";
  const full=[0,0,1,1],regions=[...RECTS[type],full];
  let ready=true;
  for(const rect of regions){
   const crop=cropCanvas(canvas,rect,1700);
   if(!crop)continue;
   try{
    const decoded=await nativeDecode(crop);
    if(decoded)return decoded;
    if(ready){
     try{
      const found=await jsDecode(crop);
      if(found)return found;
     }catch{ready=false;}
    }
   }finally{crop.width=1;crop.height=1;}
  }
  return null;
 }
 return Object.freeze({interpret,structured,merge,safeExport,scanCanvas});
});