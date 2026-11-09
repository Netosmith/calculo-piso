/* Nova Frota | publicação explícita para a área pública de fretes do app.
 * Campos internos da planilha NUNCA são enviados à API pública.
 * Carregado nas páginas legadas Fretes / Fretes2. Outras empresas não usam.
 */
(function(){
  "use strict";
  const ENDPOINT="https://api.portalfrete.net.br/v1/driver-freights";
  const published={fretes:new Set(),fretes2:new Set()};
  const activeSource=value=>value==="fretes"||value==="fretes2";
  function enabled(source){
    return activeSource(source)&&window.__PORTAL_TENANT_SESSION?.tenantMode!==true&&
      !window.__PORTAL_TENANT_EXPECTED;
  }
  function idOf(row){return String(row?.id||"").trim();}
  function isPublished(row,source){return enabled(source)&&published[source].has(idOf(row));}
  async function request(endpoint,method="GET",data){
    const response=await fetch(ENDPOINT+endpoint,{
      method,credentials:"include",cache:"no-store",
      headers:{"Accept":"application/json",...(method!=="GET"?{"Content-Type":"application/json"}:{})},
      ...(method!=="GET"?{body:JSON.stringify(data)}:{})
    });
    const body=await response.json().catch(()=>({ok:false}));
    if(!response.ok||!body.ok)throw new Error(body.error||"Falha ao comunicar com o Portal.");
    return body;
  }
  async function refresh(source){
    if(!enabled(source))return;
    const result=await request("/manage?source="+encodeURIComponent(source));
    published[source]=new Set((result.published||[]).map(row=>String(row.sourceId||"")));
  }
  function snapshot(row,source){
    return {
      source,sourceId:idOf(row),status:String(row.status||"").trim().toUpperCase(),
      origem:String(row.origem||"").trim(),
      destino:String(row.destino||"").trim(),
      produto:String(row.produto||"").trim(),
      volume:String(row.volume||"").trim(),
      valorMotorista:String(row.valorMotorista||"").trim()
    };
  }
  async function publish(row,source,{silent=false}={}){
    if(!enabled(source)||!idOf(row))throw Error("Frete não autorizado.");
    const data=snapshot(row,source);
    if(data.status!=="LIBERADO")throw Error("Somente fretes LIBERADOS podem ser publicados.");
    if(!data.origem||!data.destino||!data.produto)throw Error("Informe origem, destino e produto antes da divulgação.");
    if(!silent){
      const summary=[
        data.origem+" → "+data.destino, "Produto: "+data.produto,
        "Volume: "+(data.volume||"A consultar"),"Valor do motorista: "+(data.valorMotorista||"A consultar")
      ].join("\n");
      if(!confirm("Divulgar este frete para TODOS os motoristas que usam o aplicativo?\n\n"+
        summary+"\n\nCliente, valor empresa e observações internas não serão publicados."))return false;
    }
    await request("/publish","POST",data);
    published[source].add(idOf(row));
    return true;
  }
  async function unpublish(row,source,{silent=false}={}){
    if(!enabled(source)||!idOf(row))throw Error("Frete não autorizado.");
    if(!silent&&!confirm("Retirar este frete da lista pública do aplicativo?"))return false;
    await request("/publish","DELETE",{source,sourceId:idOf(row)});
    published[source].delete(idOf(row));
    return true;
  }
  async function toggle(row,source){
    return isPublished(row,source)?unpublish(row,source):publish(row,source);
  }
  async function beforeDelete(row,source){
    if(!enabled(source))return;
    // Falha fechada: nunca remove da operação mantendo divulgação obsoleta.
    await unpublish(row,source,{silent:true});
  }
  async function afterSave(row,source){
    if(!enabled(source)||!isPublished(row,source))return;
    if(String(row.status||"").trim().toUpperCase()==="LIBERADO")
      await publish(row,source,{silent:true});
    else await unpublish(row,source,{silent:true});
  }
  window.NFDriverFreights={enabled,isPublished,refresh,toggle,beforeDelete,afterSave};
})();
