// Filtros locais: operam somente sobre os fretes já publicados pela API pública.
// Estado é a UF da origem e destino é a cidade de entrega.
const UFS=new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
const text=value=>String(value??"").trim();
const canon=value=>text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLocaleUpperCase("pt-BR").replace(/\s+/g," ");
export function locationUF(value){
  const input=text(value).toLocaleUpperCase("pt-BR");
  const match=input.match(/(?:^|[-\/,\s])\s*([A-Z]{2})\s*$/);
  return match&&UFS.has(match[1])?match[1]:"";
}
export function destinationCity(value){
  const dest=text(value);
  if(!dest)return "";
  if(locationUF(dest)){
    return dest.replace(/(?:\s*-\s*|\s*\/\s*|\s*,\s*|\s+)[A-Za-z]{2}\s*$/,"").trim();
  }
  return dest;
}
const sortedUnique=(values)=>{
  const map=new Map();
  for(const item of values){
    const label=text(item),key=canon(label);
    if(key&&!map.has(key))map.set(key,label);
  }
  return [...map.values()].sort((a,b)=>a.localeCompare(b,"pt-BR",{sensitivity:"base"}));
};
export function availableOriginStates(offers){
  return sortedUnique((offers||[]).map(offer=>locationUF(offer.origem)));
}
export function availableDestinationCities(offers,originUF=""){
  const state=text(originUF).toUpperCase();
  const candidates=(offers||[]).filter(offer=>!state||locationUF(offer.origem)===state);
  return sortedUnique(candidates.map(offer=>destinationCity(offer.destino)));
}
export function filterFreightOffers(offers,{originUF="",destination="",search=""}={}){
  const state=text(originUF).toUpperCase();
  const city=canon(destination);
  const needle=canon(search);
  return (offers||[]).filter(offer=>{
    if(state&&locationUF(offer.origem)!==state)return false;
    if(city&&canon(destinationCity(offer.destino))!==city)return false;
    if(!needle)return true;
    const fields=[offer.origem,offer.destino,offer.coleta,offer.descarga,
      offer.produto,offer.source].map(text);
    return canon(fields.join(" ")).includes(needle);
  });
}
