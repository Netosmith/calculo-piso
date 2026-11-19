/* Leitura de documentos: extração heurística, SEM enviar ou salvar dados.
   Todos os campos devem ser confirmados visualmente antes de uso operacional. */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.PortalOCRFields=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const TYPES=Object.freeze({
  cnh:{title:"CNH / documento de habilitação",fields:[
   ["nome","Nome completo"],["cpf","CPF"],["rg","RG / documento de identidade"],
   ["nascimento","Data de nascimento"],["registro","Registro da CNH"],
   ["categoria","Categoria"],["validade","Validade"],["primeiraHabilitacao","1ª habilitação"],
   ["localEmissao","Local de emissão"]]},
  veiculo:{title:"CRLV / documento do veículo",fields:[
   ["placa","Placa"],["renavam","RENAVAM"],["chassi","Chassi"],
   ["marcaModelo","Marca / modelo"],["anoFabricacao","Ano fabricação"],
   ["anoModelo","Ano modelo"],["cor","Cor"],["proprietario","Proprietário"],
   ["cpfCnpj","CPF / CNPJ do proprietário"],["municipio","Município"],
   ["uf","UF"],["combustivel","Combustível"]]},
  endereco:{title:"Comprovante de endereço",fields:[
   ["titular","Titular"],["cpfCnpj","CPF / CNPJ"],
   ["logradouro","Logradouro"],["numero","Número"],["complemento","Complemento"],
   ["bairro","Bairro"],["cidade","Cidade"],["uf","UF"],["cep","CEP"],
   ["referencia","Referência / instalação"]]},
  geral:{title:"Documento genérico",fields:[]}
 });
 const clean=s=>String(s||"").replace(/\u00a0/g," ").replace(/[ \t]+/g," ").trim();
 const fold=s=>clean(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
 const linesOf=t=>String(t||"").split(/\r?\n/).map(clean).filter(Boolean);
 const digits=s=>String(s||"").replace(/\D/g,"");
 function validCPF(v){
  const d=digits(v);if(d.length!==11||/^(\d)\1+$/.test(d))return false;
  for(let i=9;i<=10;i++){
   const sum=[...d.slice(0,i)].reduce((s,c,n)=>s+Number(c)*(i+1-n),0);
   if((sum*10%11)%10!==Number(d[i]))return false;
  }
  return true;
 }
 function validCNPJ(v){
  const d=digits(v);if(d.length!==14||/^(\d)\1+$/.test(d))return false;
  for(const weights of [[5,4,3,2,9,8,7,6,5,4,3,2],[6,5,4,3,2,9,8,7,6,5,4,3,2]]){
   const sum=weights.reduce((a,n,i)=>a+Number(d[i])*n,0);
   const dv=sum%11<2?0:11-sum%11;
   if(d[weights.length]!==String(dv))return false;
  }
  return true;
 }
 function first(text,pattern){
  const match=String(text||"").match(pattern);
  return match?clean(match[1]??match[0]):"";
 }
 function labelled(text,labels,{min=2,max=100,next=true}={}){
  const lines=linesOf(text);
  const tests=labels.map(s=>new RegExp("^(?:(?:\\d{1,2}[.\\s-]+)?)"+s+"\\s*(?:[:\\-–]\\s*|\\s{2,})?(.*)$","i"));
  for(let i=0;i<lines.length;i++){
   const flat=fold(lines[i]);
   for(const re of tests){
    const m=flat.match(re);
    if(!m)continue;
    // Manter grafia original da linha quando o campo vem após o separador.
    const sep=lines[i].match(/[:：]\s*(.+)$/);
    let candidate=sep?sep[1]:m[1]||"";
    if(next&&(!candidate||fold(candidate)===fold(lines[i])) && i+1<lines.length)
     candidate=lines[i+1];
    candidate=clean(candidate).slice(0,max);
    if(candidate.length>=min && !/^(?:NOME|CPF|DATA|DOCUMENTO|REGISTRO|PLACA|CHASSI|UF|CIDADE|VALIDADE)$/i.test(candidate))
     return candidate;
   }
  }
  return "";
 }
 const matchAll=(text,re)=>[...String(text||"").matchAll(re)].map(m=>m[0]);
 const nameFrom=(text,labels)=>labelled(text,labels,{min:5,max:100}).replace(/^\d{1,2}[.\s-]+/,"").trim();
 function firstCPF(text){return matchAll(text,/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}\b/g).find(validCPF)||"";}
 function firstCNPJ(text){return matchAll(text,/\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/.\s]?\d{4}[-.\s]?\d{2}\b/g).find(validCNPJ)||"";}
 function formatCPF(v){const d=digits(v);return validCPF(d)?d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.$2.$3-$4"):"";}
 function formatCNPJ(v){const d=digits(v);return validCNPJ(d)?d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,"$1.$2.$3/$4-$5"):"";}
 function idDocument(text){
  // Números de RENAVAM ou instalação podem passar matematicamente na regra
  // de CPF por coincidência. Exigir o rótulo antes de propor um documento.
  const f=fold(text);
  if(!/\bCPF\b|\bCNPJ\b/.test(f))return "";
  return formatCNPJ(firstCNPJ(text))||formatCPF(firstCPF(text));
 }
 function dateLabel(text,labels){
  const lines=linesOf(text);
  const date=/\b(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})\b/;
  for(let i=0;i<lines.length;i++){
   const normalized=fold(lines[i]);
   if(!labels.some(label=>new RegExp(label,"i").test(normalized)))continue;
   // Somente a linha do próprio rótulo ou a linha seguinte.
   const same=first(lines[i],date);
   if(same)return same;
   if(i+1<lines.length){
    const next=first(lines[i+1],date);
    if(next)return next;
   }
  }
  return "";
 }
 // Leitura adicional para CNH digital: zona de leitura mecânica (MRZ) visível
 // no rodapé. A versão reduzida do nome pode conter abreviações; sempre revisar.
 function mrzData(text){
  const lines=linesOf(text).map(x=>fold(x).replace(/[|]/g,"I"));
  let name="",birth="",expiry="";
  for(const line of lines){
   const match=line.match(/\b([A-Z]{3,})<<([A-Z<]{5,})/);
   if(match&&!/^(?:BRA|NOME|CARTEIRA)$/.test(match[1])){
    const candidate=[match[1],match[2].replace(/<+/g," ")].join(" ").replace(/\s+/g," ").trim();
    if(candidate.length>name.length)name=candidate;
   }
   const codes=line.match(/\b(\d{6})\d?[MF](\d{6})\d?[A-Z]{3}\b/);
   if(codes){
    const date=(code,kind)=>{
     const yy=Number(code.slice(0,2)),mm=Number(code.slice(2,4)),dd=Number(code.slice(4,6));
     if(mm<1||mm>12||dd<1||dd>31)return "";
     const current=new Date().getFullYear();
     const year=kind==="expiry"?(yy+2000):(yy+2000>current?yy+1900:yy+2000);
     const dt=new Date(Date.UTC(year,mm-1,dd));
     if(dt.getUTCDate()!==dd||dt.getUTCMonth()!==mm-1)return "";
     if(kind==="expiry"&&(year<2000||year>current+30))return "";
     return String(dd).padStart(2,"0")+"/"+String(mm).padStart(2,"0")+"/"+year;
    };
    birth=date(codes[1],"birth")||birth;
    expiry=date(codes[2],"expiry")||expiry;
   }
  }
  return {name,birth,expiry};
 }
 function nearby(text,labelPattern,pattern,{maxLines=4}={}){
  const list=linesOf(text);
  for(let i=0;i<list.length;i++){
   if(!labelPattern.test(fold(list[i])))continue;
   for(let j=i;j<=Math.min(list.length-1,i+maxLines);j++){
    const t=j===i?list[j].replace(labelPattern,""):list[j];
    const match=t.match(pattern);
    if(match)return clean(match[1]||match[0]);
   }
  }
  return "";
 }
 const isProbableName=value=>{
  const text=fold(value);
  return /^[A-ZÀ-Ú][A-ZÀ-Ú .'’-]{5,95}$/.test(text)&&
   text.split(/\s+/).length>=2&&
   !/(ASSINADO|VALIDADE|DOCUMENTO|REPUBLICA|FEDERATIVA|NACIONALIDADE|TERRITORIO|SENATRAN)/.test(text);
 };
 function cnhFullName(text){
  const rows=linesOf(text);
  for(let i=0;i<rows.length;i++){
   if(!/(NOME\s*E\s*SOBRENOME|NOME DO CONDUTOR|NOME\s*\/\s*SOBRENOME)/.test(fold(rows[i])))continue;
   for(let j=i+1;j<=Math.min(rows.length-1,i+2);j++){
    const candidate=clean(rows[j]
     .replace(/\b\d{2}[\/.\-]\d{2}[\/.\-]\d{4}\b/g,"")
     .replace(/[|{}\[\]<>]/g," ")).replace(/\s+/g," ");
    if(isProbableName(candidate)&&candidate.split(/\s+/).length>=3)
     return candidate;
   }
  }
  return "";
 }

 // CNH em colunas: o OCR coloca os rótulos em uma linha e os valores
 // correspondentes na próxima, com barras, parênteses e outros ruídos.
 // Buscar o par rótulo/valor, nunca capturar palavras soltas do documento.
 function cnhVisualRows(text){
  const rows=linesOf(text);
  const folded=rows.map(fold);
  const locate=pattern=>folded.findIndex(row=>pattern.test(row));
  const dates=row=>[...String(row||"").matchAll(/\b(\d{2}[\/.-]\d{2}[\/.-]\d{4})\b/g)].map(m=>m[1]);
  const next=i=>i>=0?rows[i+1]||"":"";
  const output={nome:"",rg:"",registro:"",categoria:"",validade:"",primeiraHabilitacao:""};
  const nameIdx=locate(/NOME\s*(?:E|\/)\s*SOBRENOME|NOME DO CONDUTOR/);
  if(nameIdx>=0){
   const raw=next(nameIdx).split(/\b\d{2}[\/.-]\d{2}[\/.-]\d{4}\b/)[0];
   const candidate=clean(raw.replace(/[^A-Za-zÀ-ÿ\s'’-]/g," "))
     .replace(/^(?:I|L)\s+/,"").replace(/\s+/g," ");
   if(isProbableName(candidate)&&candidate.split(/\s+/).length>=3)output.nome=candidate;
  }
  const identityIdx=locate(/\bIDENTIDADE\b/);
  if(identityIdx>=0){
   const raw=[rows[identityIdx],next(identityIdx)].join("\n");
   const match=raw.match(/\b(\d{5,12})\s+([A-Z]{2,8})\s+([A-Z]{2})\b/);
   if(match)output.rg=[match[1],match[2],match[3]].join(" ");
  }
  const regIdx=locate(/REGISTRO/);
  if(regIdx>=0){
   const block=[rows[regIdx],next(regIdx)].join("\n");
   const matches=[...block.matchAll(/(?:^|[^\d.])(\d{9,12})(?!\d)/g)].map(m=>m[1]);
   const preferred=matches.filter(x=>x.length===11);
   output.registro=(preferred.length===1?preferred[0]:(matches.length===1?matches[0]:""));
  }
  const catIdx=locate(/\bCAT\b|\bCATEGORIA\b/);
  if(catIdx>=0){
   const inline=rows[catIdx].match(/(?:\bCAT(?:EGORIA)?(?:\s+HAB(?:ILITACAO)?)?)\s*[:=]\s*(ACC|AB|AC|AD|AE|A|B|C|D|E)\b/i);
   if(inline)output.categoria=inline[1].toUpperCase();
   else{
    const tokens=[...next(catIdx).matchAll(/\b(ACC|AB|AC|AD|AE|A|B|C|D|E)\b/g)].map(m=>m[1]);
    // A categoria fica na última coluna da linha de dados da CNH.
    if(tokens.length)output.categoria=tokens[tokens.length-1];
   }
  }
  const validityIdx=locate(/\bVALIDADE\b/);
  if(validityIdx>=0){
   const same=dates(rows[validityIdx]);
   const following=dates(next(validityIdx));
   output.validade=same.length?same[same.length-1]:
    (following.length>=2?following[1]:(following[0]||""));
  }
  const firstIdx=locate(/(?:\b1\s*[º°ªo]?\s*HABILITACAO\b|\bPRIMEIRA\s+HABILITACAO\b)/);
  if(firstIdx>=0){
   const same=dates(rows[firstIdx]),following=dates(next(firstIdx));
   output.primeiraHabilitacao=same[0]||following[0]||"";
  }
  return output;
 }

 function detect(text){
  const t=fold(text);
  // Identificadores inequívocos prevalecem sobre termos genéricos
  // encontrados em rodapés (p.ex. CRLV que menciona a CNH digital).
  if(/CERTIFICADO DE REGISTRO E LICENCIAMENTO|\bCRLV\b|\bCODIGO RENAVAM\b/.test(t))return "veiculo";
  if(/CARTEIRA NACIONAL DE HABILITACAO|DRIVER LICENSE|PERMISO DE CONDUC/.test(t))return "cnh";
  const scores={
   cnh:["CARTEIRA NACIONAL DE HABILITACAO","PERMISSAO PARA DIRIGIR","CATEGORIA","PRIMEIRA HABILITACAO","N REGISTRO","ACC"].reduce((a,x)=>a+(t.includes(x)?1:0),0),
   veiculo:["CRLV","RENAVAM","CHASSI","PLACA","LICENCIAMENTO","ANO FABRICACAO","CERTIFICADO DE REGISTRO"].reduce((a,x)=>a+(t.includes(x)?1:0),0),
   endereco:["CEP","FATURA","ENDERECO","INSTALACAO","CONSUMIDOR","ENERGIA ELETRICA","AGUA","CONTA"].reduce((a,x)=>a+(t.includes(x)?1:0),0)
  };
  const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  return sorted[0][1]>=2?sorted[0][0]:"geral";
 }
 function extract(raw,type="auto"){
  const text=String(raw||"").slice(0,160000);
  const chosen=Object.hasOwn(TYPES,type)?type:detect(text);
  const values={};
  const warnings=[];
  const f=fold(text);
  if(chosen==="cnh"){
   const mrz=mrzData(text);
   const visual=cnhVisualRows(text);
   values.nome=visual.nome||cnhFullName(text)||nameFrom(text,["NOME(?: E SOBRENOME)?","NOME DO CONDUTOR"])||
    first(text,/(?:\b(?:NOME E SOBRENOME|NOME DO CONDUTOR)[^\n]*\n)([A-ZÀ-Ú][^\n]{5,95})/i);
   values.cpf=formatCPF(firstCPF(text));
   const rgCandidate=labelled(text,["(?:4[º°a-z. ]*)?DOC(?:UMENTO)?(?: DE IDENTIDADE)?(?:\s*\/?\s*ORG.*)?","IDENTIDADE","RG"],{min:5,max:50});
   values.rg=visual.rg||(rgCandidate&&/\d{4,}/.test(rgCandidate)&&
    !/(ASSINADO|DOCUMENTO ASSINADO|EMISSOR)/i.test(rgCandidate)?rgCandidate:"");
   if(!values.rg)values.rg=nearby(text,/DOC(?:UMENTO)?(?: DE IDENTIDADE)?/,/\b(\d{5,12}(?:\s+[A-Z]{2,6}\s+[A-Z]{2})?)\b/,{maxLines:3});
   values.nascimento=mrz.birth||dateLabel(text,["DATA DE NASCIMENTO","NASCIMENTO","DT NASCIMENTO"]);
   values.registro=visual.registro||nearby(text,/\b(?:N\s*REGISTRO|NUMERO DE REGISTRO|REGISTRO DA CNH|REGISTRO)\b/,/\b(\d{9,12})\b/,{maxLines:3})||
    first(labelled(text,["N(?:UMERO)? DE REGISTRO","REGISTRO","N REGISTRO"],{min:7,max:35}),/\b(\d{9,12})\b/)||
    first(text,/(?:REGISTRO|N REGISTRO)\s*[:\-.]?\s*(\d{9,12})/i);
   // Fallback apenas para categoria claramente rotulada. Nunca inferir
   // "DE" de uma palavra comum do OCR como categoria de habilitação.
   values.categoria=visual.categoria||
    first(text,/\bCAT(?:EGORIA)?(?:\s+HAB(?:ILITACAO)?)?\s*[:=]\s*(ACC|AB|AC|AD|AE|A|B|C|D|E)\b/i);
   values.categoria=/^(?:ACC|AB|AC|AD|AE|A|B|C|D|E)$/.test(values.categoria.toUpperCase())?
    values.categoria.toUpperCase():"";
   values.validade=mrz.expiry||visual.validade||dateLabel(text,["VALIDADE","DATA DE VALIDADE"]);
   values.primeiraHabilitacao=visual.primeiraHabilitacao||dateLabel(text,["1.? HABILITACAO","PRIMEIRA HABILITACAO"]); 
   if(!isProbableName(values.nome)){
    values.nome=mrz.name||"";
    if(values.nome)warnings.push("Nome da CNH extraído da MRZ, pode estar abreviado.");
   }
   values.localEmissao=labelled(text,["LOCAL(?: DE EMISSAO)?","LOCAL E DATA"],{min:4,max:75});
  }else if(chosen==="veiculo"){
   values.placa=first(f,/\b([A-Z]{3}[- ]?\d[A-Z0-9]\d{2})\b/).replace(/[-\s]/g,"");
   values.renavam=first(labelled(text,["COD(?:IGO)? RENAVAM","RENAVAM"],{min:9,max:30}),/\b(\d{9,11})\b/)||
    first(f,/(?:RENAVAM)[^\d\n]{0,8}(\d{9,11})/);
   values.chassi=first(f,/\b([A-HJ-NPR-Z0-9]{17})\b/);
   values.marcaModelo=labelled(text,["MARCA\\s*(?:\\/|E)\\s*MODELO(?:\\s*\\/\\s*VERSAO)?","MARCA MODELO","MODELO"],{min:3,max:75});
   const match=f.match(/\b((?:19|20)\d{2})\s*[\/\-]\s*((?:19|20)\d{2})\b/);
   values.anoFabricacao=match?.[1]||first(labelled(text,["ANO FABRICACAO"],{max:30}),/\b((?:19|20)\d{2})\b/);
   values.anoModelo=match?.[2]||first(labelled(text,["ANO MODELO"],{max:30}),/\b((?:19|20)\d{2})\b/);
   values.cor=labelled(text,["COR PREDOMINANTE","COR"],{min:3,max:35});
   values.proprietario=nameFrom(text,["NOME DO PROPRIETARIO","PROPRIETARIO","NOME"]);
   values.cpfCnpj=idDocument(text);
   values.municipio=labelled(text,["MUNICIPIO DE REGISTRO","MUNICIPIO"],{min:3,max:70});
   values.uf=first(f,/\bUF\s*[:\-.]?\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
   values.combustivel=labelled(text,["COMBUSTIVEL"],{min:3,max:35});
  }else if(chosen==="endereco"){
   values.titular=nameFrom(text,["NOME DO TITULAR","CONSUMIDOR","TITULAR","CLIENTE"]);
   values.cpfCnpj=idDocument(text);
   values.logradouro=first(text,/\b((?:RUA|AVENIDA|AV\.|TRAVESSA|RODOVIA|ALAMEDA|ESTRADA|R\.|PRAÇA|PRACA)\s+[^\n,]{4,110})/i);
   values.numero=first(text,/(?:N[º°.]?|NUMERO)\s*[:\-.]?\s*(\d{1,7}[A-Z]?)/i)||
     first(text,/\b(?:RUA|AVENIDA|AV\.|TRAVESSA|RODOVIA|ALAMEDA|ESTRADA|R\.|PRAÇA|PRACA)\s+[^\n,]{4,110},\s*(\d{1,7}[A-Z]?)\b/i);
   values.complemento=labelled(text,["COMPLEMENTO"],{min:2,max:75});
   values.bairro=labelled(text,["BAIRRO"],{min:3,max:60});
   values.cidade=labelled(text,["CIDADE","MUNICIPIO"],{min:3,max:60});
   values.uf=first(f,/\bUF\s*[:\-.]?\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
   values.cep=first(text,/\b(\d{5}[-.]?\d{3})\b/);
   values.referencia=labelled(text,["INSTALACAO","UNIDADE CONSUMIDORA","CODIGO DO CLIENTE","CONTA CONTRATO"],{min:3,max:70});
  }
  return {tipo:chosen,titulo:TYPES[chosen].title,campos:Object.fromEntries(
   (TYPES[chosen].fields||[]).map(([key])=>[key,String(values[key]||"").slice(0,120)])),
   camposDefinidos:TYPES[chosen].fields, avisos:warnings, texto:text};
 }
 return Object.freeze({TYPES,detect,extract,validCPF,validCNPJ});
});