/* Migração D1 -> Sheets por transportadora, somente Super Admin.
 * Nunca transfere chave/credenciais Google ao navegador.
 * Exige implantação atualizada do Apps Script privado e conferência de hashes.
 */
(function(){
 "use strict";
 const $=id=>document.getElementById(id);
 if(!$("pedSheetsStatus"))return;
 const API="https://api.portalfrete.net.br/v1/abertura-pedidos/sheets/";
 let loadedTenant="",current=null,busy=false,loadSeq=0;
 const tenant=()=>selected?.id||"";
 function inform(text){$("pedSheetsMessage").textContent=text;}
 function controls(){
  const ready=current?.ready===true,source=current?.origem,dest=current?.destino;
  const verified=ready&&source&&dest&&source.count===dest.count&&
    source.fingerprint===dest.fingerprint&&["anexos","mensagens","historico"].every(key=>
      source[key]?.count===dest[key]?.count&&source[key]?.fingerprint===dest[key]?.fingerprint);
  $("pedSheetsImport").disabled=busy||!ready||current?.mode==="sheets";
  $("pedSheetsActivate").disabled=busy||!verified||current?.mode==="sheets";
  $("pedSheetsStatus").disabled=busy;
  $("pedSheetsLink").hidden=!current?.sheetId;
  if(current?.sheetId)
   $("pedSheetsLink").href="https://docs.google.com/spreadsheets/d/"+encodeURIComponent(current.sheetId)+"/edit";
 }
 async function api(action,method="GET",data,company=tenant()){
  const headers={Accept:"application/json"};
  if(company!=="nova-frota")headers["X-Portal-Support-Tenant"]=company;
  if(data!==undefined)headers["Content-Type"]="application/json";
  const response=await fetch(API+action+"?visao=execucao",{
   method,credentials:"include",cache:"no-store",headers,
   ...(data===undefined?{}:{body:JSON.stringify(data)})
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw Error(payload?.error||"Falha na API (HTTP "+response.status+").");
  return payload;
 }
 async function status(){
  const company=tenant(),seq=++loadSeq;
  if(!company)return inform("Selecione uma transportadora.");
  busy=true;loadedTenant="";current=null;controls();
  inform("Verificando banco D1, planilha e Apps Script de "+company+"...");
  try{
   const data=await api("status","GET",undefined,company);
   if(seq!==loadSeq||company!==tenant())return;
   loadedTenant=company;current=data;
   const d1=data.origem?.count??0,google=data.destino?.count??0;
   if(!data.ready)inform("Apps Script ainda não está pronto. "+(data.aviso||"Atualize a implantação privada antes da importação."));
   else if(data.mode==="sheets")inform("Google Sheets ATIVO para "+company+". "+google+" chamados migrados e vinculados.");
   else if(d1===google&&data.origem.fingerprint===data.destino.fingerprint&&["anexos","mensagens","historico"].every(k=>data.origem[k]?.count===data.destino[k]?.count&&data.origem[k]?.fingerprint===data.destino[k]?.fingerprint))
    inform("Integridade conferida. "+d1+" registros iguais no D1 e Google Sheets. Pode ativar.");
   else inform("D1: "+d1+" chamados. Google Sheets: "+google+". Importe os registros para conferir a integridade.");
  }catch(error){if(seq===loadSeq)inform(error.message);}
  finally{if(seq===loadSeq){busy=false;controls();}}
 }
 async function importAll(){
  const company=tenant();
  if(!current?.ready||company!==loadedTenant||busy)return;
  if(!window.confirm("Importar os chamados de "+company+" do D1 para Google Sheets? Os registros originais continuarão preservados."))return;
  busy=true;controls();
  try{
   let offset=0,total=0,batches=0;
   while(true){
    if(company!==tenant())throw Error("Empresa alterada durante a importação. Verifique o status.");
    const result=await api("importar","POST",{offset},company);
    total+=Number(result.importados)||0;batches++;
    inform("Importação em andamento: "+total+" registro(s) processado(s). Lote "+batches+".");
    if(result.nextOffset===null||result.nextOffset===undefined)break;
    offset=result.nextOffset;
    if(batches>10001)throw Error("Limite de lotes atingido.");
   }
   inform("Transferência solicitada: "+total+" chamados. Conferindo integridade dos dados...");
  }catch(error){inform("Importação interrompida: "+error.message+" Os dados originais permanecem no D1.");}
  finally{busy=false;controls();}
  await status();
 }
 async function activate(){
  const company=tenant();
  if(busy||!current||company!==loadedTenant)return;
  if(!window.confirm("Confirmar a troca do armazenamento de chamados de "+company+" para Google Sheets? O banco D1 será preservado como cópia histórica."))return;
  busy=true;controls();inform("Verificando os dados e ativando Google Sheets...");
  try{
   const data=await api("ativar","POST",{},company);
   inform("Armazenamento Google Sheets ativado para "+company+". "+data.importados+" chamados conferidos.");
  }catch(error){inform("Não foi possível ativar: "+error.message);}
  finally{busy=false;controls();}
  await status();
 }
 $("pedSheetsStatus").onclick=status;
 $("pedSheetsImport").onclick=importAll;
 $("pedSheetsActivate").onclick=activate;
 document.querySelector('[data-tab="profiles"]')?.addEventListener("click",()=>{
  if(tenant()!==loadedTenant)void status();
 });
 window.addEventListener("superadmin:company-changed",()=>void status());
 controls();
})();