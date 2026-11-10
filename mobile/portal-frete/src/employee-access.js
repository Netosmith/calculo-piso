// O aplicativo apenas espelha permissões confirmadas pela HOME autenticada.
// O Worker continua sendo a autoridade para acessar cada módulo.
import {portalPage} from "./routes";

export const FEATURE_META={
  fretes:{page:"fretes",title:"Fretes (Operacional)",icon:"🚛",description:"Cargas e operação diária"},
  fretes2:{page:"fretes2",title:"Fretes (MT)",icon:"🚚",description:"Operação da base MT"},
  bi:{page:"bi",title:"B.I. Operacional",icon:"📊",description:"Indicadores e resultados"},
  monitoramento:{page:"monitoramento",title:"Monitoramento",icon:"📍",description:"Viagens e localizações"},
  piso2:{page:"calculo-antt",title:"Piso ANTT",icon:"📐",description:"Cálculo do piso mínimo"},
  piso:{page:"calculo-piso",title:"Cálculo de Piso 1",icon:"▤",description:"Cálculo simplificado"},
  funcionarios:{page:"funcionarios",title:"Funcionários",icon:"👥",description:"Colaboradores e acessos"},
  administrativo:{page:"administrativo",title:"Administrativo",icon:"📁",description:"Rotinas e solicitações"},
  chamados:{page:"chamados",title:"Chamados",icon:"🎧",description:"Acompanhe solicitações"},
  "fretes-mercado":{page:"fretes-mercado",title:"Fretes Mercado",icon:"📈",description:"Fretes por região"},
  controle:{page:"controle",title:"Controle Embarque",icon:"✅",description:"Acompanhamento por filial"},
  share:{page:"share-clientes",title:"Share Clientes",icon:"🤝",description:"Informações para clientes"},
  "custo-filial":{page:"custo-filial",title:"Custo / Filial",icon:"💰",description:"Metas e faturamento"},
  "custo-frota":{page:"custo-frota-pesada",title:"Cálculo Frota",icon:"🚚",description:"Custos por viagem"},
  divulgacao:{page:"divulgacao",title:"Divulgação",icon:"📣",description:"Artes e comunicação"},
  embarques:{page:"embarques",title:"Semente / Algodão",icon:"🌱",description:"Embarques e comprovantes"},
  cadastros:{page:"cadastros",title:"Cadastros",icon:"📋",description:"Cadastros do portal"},
  estadias:{page:"estadias",title:"Estadias",icon:"⏱",description:"Solicitações de estadia"},
  relatorio:{page:"relatorio",title:"Relatório",icon:"📑",description:"Análises e consultas"}
};
const BOARD_ORDER=[
  "fretes","fretes2","bi","monitoramento","piso2","piso",
  "funcionarios","administrativo","chamados","fretes-mercado",
  "controle","share","custo-filial","custo-frota","divulgacao",
  "embarques","cadastros","estadias","relatorio"
];
const numberOrNull=value=>{
  if(value===null||value===undefined||value==="")return null;
  const num=Number(value);
  return Number.isInteger(num)&&num>=0&&num<=100000000?num:null;
};
export function validEmployeeHomeUrl(url,tenant=""){
  try{
    const parsed=new URL(url);
    return parsed.origin==="https://portalfrete.net.br" &&
      parsed.pathname===new URL(portalPage("home",tenant)).pathname;
  }catch{return false;}
}
export function parseEmployeeSessionMessage(text,tenant="",sourceUrl=""){
  if(!validEmployeeHomeUrl(sourceUrl,tenant)||typeof text!=="string"||text.length>12000)return null;
  let payload;
  try{payload=JSON.parse(text);}catch{return null;}
  if(payload?.type!=="portal-employee-v1"||payload.verified!==true)return null;
  const expected=tenant||"nova-frota";
  if(payload.transportadoraId!==expected||
     Boolean(payload.tenantMode)!==Boolean(tenant))return null;
  const profile=String(payload.perfil||"").trim().toUpperCase();
  const usuario=String(payload.usuario||"").trim().slice(0,80);
  if(!profile||!usuario||!Array.isArray(payload.modules)||payload.modules.length>80)return null;
  const allowed=new Set();
  for(const item of payload.modules){
    const meta=FEATURE_META[item?.feature];
    if(meta&&meta.page===item.page&&item.feature!== "super-admin")allowed.add(item.feature);
  }
  // PISO nunca herda um atalho operacional, mesmo em caso de interface divergente.
  if(profile==="PISO")for(const key of allowed)if(key!=="piso2")allowed.delete(key);
  if(tenant){
    for(const key of ["fretes2","monitoramento","funcionarios"])allowed.delete(key);
  }
  const metrics=profile==="PISO"?{}:(payload.metrics||{});
  return {
    usuario,perfil:profile,
    nome:String(payload.nome||usuario).trim().slice(0,100),
    transportadoraNome:String(payload.transportadoraNome||"").trim().slice(0,100),
    modules:BOARD_ORDER.filter(key=>allowed.has(key)).map(key=>({key,...FEATURE_META[key]})),
    metrics:{
      fretesAtivos:numberOrNull(metrics.fretesAtivos),
      veiculos:numberOrNull(metrics.veiculos),
      solicitacoes:numberOrNull(metrics.solicitacoes)
    }
  };
}

// Executado exclusivamente na HOME web após confirmação de sessão assinada.
export const EMPLOYEE_HOME_BRIDGE=`(function(){
  if(window.__nfEmployeeBridgeStarted)return true;
  window.__nfEmployeeBridgeStarted=true;
  var publish=function(){
    Promise.resolve(window.portalAuthReady).then(function(session){
      if(!session||typeof window.canAccessFeature!=="function")return;
      var cards=Array.prototype.slice.call(document.querySelectorAll(".nf-tool[data-feature]"))
        .filter(function(card){return window.canAccessFeature(card.getAttribute("data-feature"),"navigation");})
        .map(function(card){
          var feature=card.getAttribute("data-feature");
          var href=card.getAttribute("href")||"";
          var page="";
          try{
            var target=new URL(href,location.href);
            if(target.origin!==location.origin)return null;
            var match=target.pathname.match(/\\/([a-z0-9-]+)\\.html$/i);
            if(match)page=match[1];
          }catch(e){return null;}
          return {feature:feature,page:page};
        }).filter(Boolean);
      var profile=String(session.perfil||"").toUpperCase();
      function metric(id,updated){
        if(profile==="PISO"||session.tenantMode===true)return null;
        var label=document.getElementById(updated);
        if(!label||/aguardando|carregando|restrito|erro/i.test(label.textContent))return null;
        var node=document.getElementById(id);
        if(!node)return null;
        var raw=String(node.textContent||"").trim().replace(/\\./g,"");
        return /^\\d+$/.test(raw)?Number(raw):null;
      }
      var go=metric("homeVeiculosGO","homeVeiculosAtualizacao");
      var mt=metric("homeVeiculosMT","homeVeiculosAtualizacao");
      var solicitacoes=window.canAccessFeature("administrativo")?
        metric("homeSolicStat","homeSolicAtualizacao"):null;
      var message={
        type:"portal-employee-v1",verified:true,
        usuario:session.usuario,nome:session.nome,perfil:session.perfil,
        tenantMode:session.tenantMode===true,
        transportadoraId:session.transportadoraId||"nova-frota",
        transportadoraNome:session.transportadoraNome||"",
        modules:cards,
        metrics:{
          fretesAtivos:metric("homeFretesAtivos","homeFretesAtualizacao"),
          veiculos:go===null||mt===null?null:go+mt,
          solicitacoes:solicitacoes
        }
      };
      window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }).catch(function(){});
  };
  publish();
  setTimeout(publish,1250);
  window.addEventListener("portal:session",publish);
  window.addEventListener("home:metrics",publish);
})(); true;`;
