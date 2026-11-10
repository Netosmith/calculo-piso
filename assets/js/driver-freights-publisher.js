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
    // As empresas terceiras usam páginas compartilhadas: não mostrar controles
    // da Nova Frota, mesmo antes de sua sessão ter sido carregada.
    const otherCompany=/^\/pages\/[^/]+\/fretes(?:2)?\.html$/i.test(location.pathname);
    return activeSource(source)&&!otherCompany&&
      window.__PORTAL_TENANT_SESSION?.tenantMode!==true&&
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
  // Planilhas legadas podem devolver cabeçalhos de diferentes formas
  // (ORIGEM, Origem, cidade_origem); a divulgação não depende da caixa
  // de seleção nem do campo visual do preview, que pode ter valores padrão.
  function field(row,aliases){
    if(!row||typeof row!=="object")return "";
    const normalize=key=>String(key||"").normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]/g,"").toLowerCase();
    const keys=Object.keys(row);
    for(const alias of aliases){
      const matched=keys.find(key=>normalize(key)===normalize(alias));
      if(matched){
        const value=String(row[matched]??"").trim();
        if(value)return value;
      }
    }
    return "";
  }
  function normalizeWhatsapp(value){
    const raw=String(value??"").trim();
    if(!raw||!/^[+\d()\s-]+$/.test(raw))return "";
    const digits=raw.replace(/\D/g,"");
    if(digits.length===10||digits.length===11)return "55"+digits;
    return /^55\d{10,11}$/.test(digits)?digits:"";
  }
  function snapshot(row,source,{whatsappEmbarcador=""}={}){
    return {
      source,sourceId:idOf(row),
      status:field(row,["status","situação","situacao"]).toUpperCase(),
      origem:field(row,["origem","cidadeOrigem","cidade de origem","municipioOrigem"]),
      destino:field(row,["destino","cidadeDestino","cidade de destino","municipioDestino"]),
      coleta:field(row,["coleta","localColeta","local de coleta","localizacaoColetaDescricao"]),
      descarga:field(row,["descarga","localDescarga","local de descarga","localizacaoDescargaDescricao"]),
      produto:field(row,["produto","mercadoria","tipoProduto"]),
      volume:field(row,["volume","cadencia"]),
      valorMotorista:field(row,["valorMotorista","vlrMotorista","valor motorista","freteMotorista"]),
      whatsappEmbarcador:normalizeWhatsapp(whatsappEmbarcador)
    };
  }
  function fillMissingForPublication(data,{silent=false}={}){
    const labels={origem:"ORIGEM (cidade/UF)",destino:"DESTINO (cidade/UF)",produto:"PRODUTO",
      whatsappEmbarcador:"WHATSAPP DO EMBARCADOR (DDD + número)"};
    const missing=Object.keys(labels).filter(key=>!data[key]);
    if(!missing.length)return data;
    if(silent)throw Error("Não foi possível atualizar o anúncio: faltam "+missing.map(key=>labels[key]).join(", ")+".");
    // Pede somente o que estiver faltando; a informação vale para este
    // anúncio e não altera o frete cadastrado no Google Sheets.
    for(const key of missing){
      const value=window.prompt("O frete selecionado não trouxe o campo "+labels[key]+
        " para a divulgação no app.\n\nInforme "+labels[key]+
        ":\n(Este preenchimento não altera o cadastro original.)","");
      if(value===null)return null;
      data[key]=key==="whatsappEmbarcador"?normalizeWhatsapp(value):String(value).trim();
      if(!data[key])throw Error("Informe um "+labels[key]+" válido para continuar.");
    }
    return data;
  }
  async function publish(row,source,{silent=false,whatsappEmbarcador=""}={}){
    if(!enabled(source)||!idOf(row))throw Error("Frete não autorizado.");
    const data=snapshot(row,source,{whatsappEmbarcador});
    if(data.status!=="LIBERADO")throw Error("Somente fretes LIBERADOS podem ser publicados.");
    if(!fillMissingForPublication(data,{silent}))return false;
    if(!silent){
      const summary=[
        data.origem+" → "+data.destino,
        "Local de coleta: "+(data.coleta||"Não informado"),
        "Local de descarga: "+(data.descarga||"Não informado"),
        "Produto: "+data.produto,
        "Volume: "+(data.volume||"A consultar"),"Valor do motorista: "+(data.valorMotorista||"A consultar"),
        "WhatsApp do embarcador: +"+data.whatsappEmbarcador+" (visível publicamente no app)"
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
  async function toggle(row,source,options={}){
    return isPublished(row,source)?unpublish(row,source):publish(row,source,options);
  }
  async function beforeDelete(row,source){
    if(!enabled(source))return;
    // Falha fechada: nunca remove da operação mantendo divulgação obsoleta.
    await unpublish(row,source,{silent:true});
  }
  async function afterSave(row,source,{whatsappEmbarcador=""}={}){
    if(!enabled(source)||!isPublished(row,source))return;
    const data=snapshot(row,source,{whatsappEmbarcador});
    if(data.status==="LIBERADO"&&data.origem&&data.destino&&data.produto&&data.whatsappEmbarcador)
      await publish(row,source,{silent:true,whatsappEmbarcador});
    else await unpublish(row,source,{silent:true});
  }
  window.NFDriverFreights={enabled,isPublished,refresh,toggle,beforeDelete,afterSave};
})();
