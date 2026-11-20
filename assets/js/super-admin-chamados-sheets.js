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
 const integrityChecks=data=>{
  if(!data?.ready||!data.origem||!data.destino)return [];
  const names=[["","Chamados"],["anexos","Anexos"],["mensagens","Mensagens"],["historico","Histórico"]];
  return names.map(([key,label])=>{
   const origem=key?data.origem[key]:data.origem;
   const destino=key?data.destino[key]:data.destino;
   const countEqual=origem&&destino&&Number(origem.count)===Number(destino.count);
   const hashEqual=origem&&destino&&origem.fingerprint===destino.fingerprint;
   return {label,ok:Boolean(countEqual&&hashEqual),countEqual:Boolean(countEqual),
    from:origem?.count??"?",to:destino?.count??"?"};
  });
 };
 function drawChecks(data){
  const area=$("pedSheetsChecks");if(!area)return;
  area.replaceChildren();
  for(const check of integrityChecks(data)){
   const item=document.createElement("span");item.className="ped-sheets-check "+(check.ok?"ok":"warning");
   item.textContent=(check.ok?"✓ ":"! ")+check.label+": D1 "+check.from+" · Sheets "+check.to+
    (check.ok?" · conferido":check.countEqual?" · dados diferentes":" · quantidades diferentes");
   area.append(item);
  }
 }
 function controls(){
  const ready=current?.ready===true;
  const checks=integrityChecks(current);
  const verified=ready&&checks.length===4&&checks.every(x=>x.ok);
  const dest=current?.destino;
  const emptyReady=ready&&[dest,dest?.anexos,dest?.mensagens,dest?.historico].every(
    item=>item&&Number(item.count)===0);
  $("pedSheetsImport").disabled=busy||!ready||current?.mode==="sheets";
  $("pedSheetsActivate").disabled=busy||!verified||current?.mode==="sheets";
  $("pedSheetsStartEmpty").disabled=busy||!emptyReady||current?.mode==="sheets";
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
  busy=true;loadedTenant="";current=null;controls();drawChecks(null);
  inform("Verificando banco D1, planilha e Apps Script de "+company+"...");
  try{
   const data=await api("status","GET",undefined,company);
   if(seq!==loadSeq||company!==tenant())return;
   loadedTenant=company;current=data;drawChecks(data);
   const checks=integrityChecks(data);
   const d1=data.origem?.count??0,google=data.destino?.count??0;
   const different=checks.filter(x=>!x.ok);
   if(!data.ready)inform("Apps Script ainda não está pronto. "+(data.aviso||"Atualize a implantação privada antes da importação."));
   else if(data.mode==="sheets")inform("Google Sheets ATIVO para "+company+". "+google+" chamados migrados e vinculados.");
   else if(!different.length&&checks.length===4)
    inform("Integridade conferida: chamados, anexos, mensagens e histórico coincidem. Botão 3 liberado.");
   else if([data.destino,data.destino?.anexos,data.destino?.mensagens,data.destino?.historico]
     .every(item=>item&&Number(item.count)===0))
    inform("A planilha Google Sheets está vazia. Se você quer COMEÇAR DO ZERO, use 3B. Iniciar base vazia. "+
      "Não precisa importar os "+d1+" chamados antigos: eles ficam preservados exclusivamente no D1.");
   else {
    const missing=Number(google)<Number(d1);
    const reason=different.some(x=>!x.countEqual)?
     "Há diferenças nas quantidades. ":"As quantidades são iguais em algumas abas, mas as assinaturas dos registros ainda divergem. ";
    inform("Ativação protegida: "+different.map(x=>x.label).join(", ")+" ainda não "+
     (different.length===1?"confere":"conferem")+". "+reason+
     (missing?"Clique em 2. Importar chamados existentes para repor os dados preservados no D1. ":
     "Confira os itens indicados; se necessário, importe novamente com o Apps Script atualizado. ")+
     "Depois clique em 1. Verificar integração.");
   }
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
 async function startEmpty(){
  const company=tenant();
  if(busy||!current?.ready||company!==loadedTenant||!current?.sheetId)return;
  const confirmation=window.prompt(
   "ATENÇÃO: começar uma base vazia faz o Portal usar o Google Sheets sem importar registros antigos. "+
   "Os registros anteriores continuam guardados no Cloudflare D1, sem aparecer na nova fila. "+
   "Para confirmar, digite exatamente: INICIAR DO ZERO"
  );
  if(confirmation!=="INICIAR DO ZERO"){
   inform("Ativação da nova base cancelada: confirmação não informada.");
   return;
  }
  busy=true;controls();inform("Conferindo se todas as abas operacionais estão vazias...");
  try{
   const data=await api("iniciar-vazio","POST",{confirmacao:confirmation,sheetId:current.sheetId},company);
   inform("Nova base Google Sheets ativada: 0 chamados. "+
     data.d1RegistrosPreservados+" registro(s) antigos preservados no D1 para consulta histórica.");
  }catch(error){inform("Ativação não realizada: "+error.message);}
  finally{busy=false;controls();}
  await status();
 }
 async function bindSheet(){
  const company=tenant(),id=$("pedSheetsNewId").value.trim();
  if(busy||!/^[A-Za-z0-9_-]{25,120}$/.test(id))
   return inform("Informe o ID válido da planilha Google que pertence à transportadora.");
  if(!window.confirm("Vincular esta planilha ao perfil "+company+"? A base D1 continuará ativa até a migração."))return;
  busy=true;controls();inform("Verificando a estrutura e o identificador da transportadora...");
  try{
   await api("vincular","POST",{sheetId:id},company);
   inform("Planilha vinculada. Agora pode iniciar a verificação dos chamados.");
  }catch(e){inform(e.message);}
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
 $("pedSheetsBind").onclick=bindSheet;
 $("pedSheetsStatus").onclick=status;
 $("pedSheetsImport").onclick=importAll;
 $("pedSheetsActivate").onclick=activate;
 $("pedSheetsStartEmpty").onclick=startEmpty;
 document.querySelector('[data-tab="profiles"]')?.addEventListener("click",()=>{
  if(tenant()!==loadedTenant)void status();
 });
 window.addEventListener("superadmin:company-changed",()=>void status());
 controls();
})();