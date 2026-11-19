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
 function idDocument(text){return formatCNPJ(firstCNPJ(text))||formatCPF(firstCPF(text));}
 function dateLabel(text,labels){
  const value=labelled(text,labels,{min:8,max:75});
  return first(value,/\b(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})\b/)||
   first(text,new RegExp("(?:VALIDADE|NASCIMENTO)[^\\n]{0,35}?(\\d{2}[/.\\-]\\d{2}[/.\\-]\\d{4})","i"));
 }
 function detect(text){
  const t=fold(text);
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
  const f=fold(text);
  if(chosen==="cnh"){
   values.nome=nameFrom(text,["NOME(?: E SOBRENOME)?","NOME DO CONDUTOR"]);
   values.cpf=formatCPF(firstCPF(text));
   values.rg=labelled(text,["DOC(?:UMENTO)?(?: DE IDENTIDADE)?","IDENTIDADE","RG"],{min:5,max:50});
   values.nascimento=dateLabel(text,["DATA DE NASCIMENTO","NASCIMENTO","DT NASCIMENTO"]);
   values.registro=first(labelled(text,["N(?:UMERO)? DE REGISTRO","REGISTRO","N REGISTRO"],{min:7,max:35}),/\b(\d{9,12})\b/)||
    first(text,/(?:REGISTRO|N REGISTRO)\s*[:\-.]?\s*(\d{9,12})/i);
   values.categoria=first(text,/(?:CAT(?:EGORIA)?(?: HABILITACAO)?)[\s:\-.]{0,12}((?:ACC|[ABCDE]{1,3}))\b/i);
   values.validade=dateLabel(text,["VALIDADE","DATA DE VALIDADE"]);
   values.primeiraHabilitacao=dateLabel(text,["1.? HABILITACAO","PRIMEIRA HABILITACAO"]);
   values.localEmissao=labelled(text,["LOCAL(?: DE EMISSAO)?","LOCAL E DATA"],{min:4,max:75});
  }else if(chosen==="veiculo"){
   values.placa=first(f,/\b([A-Z]{3}[- ]?\d[A-Z0-9]\d{2})\b/).replace(/[-\s]/g,"");
   values.renavam=first(labelled(text,["COD(?:IGO)? RENAVAM","RENAVAM"],{min:9,max:30}),/\b(\d{9,11})\b/)||
    first(f,/(?:RENAVAM)[^\d\n]{0,8}(\d{9,11})/);
   values.chassi=first(f,/\b([A-HJ-NPR-Z0-9]{17})\b/);
   values.marcaModelo=labelled(text,["MARCA(?:\\s*\\/\\s*| E )MODELO","MARCA MODELO","MODELO"],{min:3,max:75});
   const anos=first(f,/\b((?:19|20)\d{2})\s*[\/\-]\s*((?:19|20)\d{2})\b/);
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
   values.numero=first(text,/(?:N[º°.]?|NUMERO)\s*[:\-.]?\s*(\d{1,7}[A-Z]?)/i);
   values.complemento=labelled(text,["COMPLEMENTO"],{min:2,max:75});
   values.bairro=labelled(text,["BAIRRO"],{min:3,max:60});
   values.cidade=labelled(text,["CIDADE","MUNICIPIO"],{min:3,max:60});
   values.uf=first(f,/\bUF\s*[:\-.]?\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
   values.cep=first(text,/\b(\d{5}[-.]?\d{3})\b/);
   values.referencia=labelled(text,["INSTALACAO","UNIDADE CONSUMIDORA","CODIGO DO CLIENTE","CONTA CONTRATO"],{min:3,max:70});
  }
  return {tipo:chosen,titulo:TYPES[chosen].title,campos:Object.fromEntries(
   (TYPES[chosen].fields||[]).map(([key])=>[key,String(values[key]||"").slice(0,120)])),
   camposDefinidos:TYPES[chosen].fields, texto:text};
 }
 return Object.freeze({TYPES,detect,extract,validCPF,validCNPJ});
});