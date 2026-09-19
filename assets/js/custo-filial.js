/* CUSTO / FILIAL | NOVA FROTA | versão simplificada */
(function(){
"use strict";

const $=id=>document.getElementById(id);
const DAILY_MARKER="CF_SIMPLE|";
const COST_MARKER="CF_COST|";
const CACHE_KEY="nf_custo_filial_simple_v2";

const FILIAIS=[
  {id:"RIO VERDE",label:"RIO VERDE",salarios:159200,carros:7},
  {id:"JATAI",label:"JATAÍ",salarios:34000,carros:2},
  {id:"MONTIVIDIU",label:"MONTIVIDIU",salarios:13000,carros:1},
  {id:"ITUMBIARA",label:"ITUMBIARA",salarios:38000,carros:3},
  {id:"MINEIROS",label:"MINEIROS",salarios:13000,carros:1},
  {id:"INDIARA",label:"INDIARA",salarios:17000,carros:1},
  {id:"ANAPOLIS",label:"ANÁPOLIS",salarios:20000,carros:2},
  {id:"FORMOSA",label:"FORMOSA",salarios:15000,carros:1},
  {id:"VIANOPOLIS",label:"VIANÓPOLIS",salarios:9000,carros:1},
  {id:"URUAÇU",label:"URUAÇU",salarios:10000,carros:1},
  {id:"CRISTALINA",label:"CRISTALINA",salarios:11000,carros:1},
  {id:"UBERLANDIA",label:"UBERLÂNDIA",salarios:23000,carros:1},
  {id:"SOROCABA",label:"SOROCABA",salarios:18500,carros:0,combustivelFixo:800}
];

const FIXOS={aluguel:3500,carro:2000,combustivelCarro:800,aguaEnergia:1000};
let DB={lancamentos:[]};
let STATE={filial:"",ano:0,mes:0,editId:"",editSnapshot:null,costEditFilial:""};
let charts={resultado:null,volume:null,lucroDia:null,volumeDia:null};

function text(v){return String(v??"").trim()}
function up(v){return text(v).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function num(v){if(typeof v==="number")return Number.isFinite(v)?v:0;let s=text(v).replace(/[^\d,.-]/g,"");if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");const n=Number(s);return Number.isFinite(n)?n:0}
function brl(v){return num(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function tons(v){return num(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+" t"}
function pct(v){return num(v).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+"%"}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function pad(v){return String(v).padStart(2,"0")}
function todayYmd(){const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function monthValue(ano,mes){return `${ano}-${pad(mes)}`}
function parseYmd(v){const m=text(v).match(/^(\d{4})-(\d{2})-(\d{2})/);return m?{ano:+m[1],mes:+m[2],dia:+m[3]}:null}
function dateBR(v){const p=parseYmd(v);return p?`${pad(p.dia)}/${pad(p.mes)}/${p.ano}`:text(v)}
function filialById(id){return FILIAIS.find(f=>f.id===up(id))||null}
function filialLabel(id){return filialById(id)?.label||text(id)}
function combustivel(f){return f.combustivelFixo!=null?f.combustivelFixo:f.carros*FIXOS.combustivelCarro}
function custoFixoBase(f){return f.salarios+FIXOS.aluguel+(f.carros*FIXOS.carro)+combustivel(f)+FIXOS.aguaEnergia}
function costOverrideRecord(id){
  return DB.lancamentos
    .filter(x=>x.tipo==="custo"&&x.filial===id&&Number(x.ano)===STATE.ano&&Number(x.mes)===STATE.mes)
    .sort((a,b)=>String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||"")))[0]||null;
}
function custoFixo(f){
  const override=costOverrideRecord(f.id);
  return override&&num(override.custo)>0?num(override.custo):custoFixoBase(f);
}
function metaFilial(f){return custoFixo(f)*1.40}
function setText(id,v){const el=$(id);if(el)el.textContent=v}
function setStatus(msg,type=""){const el=$("syncStatus");if(!el)return;el.textContent=msg;el.className="sync"+(type?` ${type}`:"")}
function loading(show,msg="Processando..."){const el=$("loading");el?.classList.toggle("show",!!show);setText("loadingText",msg)}

async function portalCall(action,params={}){
  const session=window.portalAuthReady?await window.portalAuthReady:null;
  if(!session)throw new Error("Sessão inválida ou expirada.");
  if(!window.PortalAPI)throw new Error("API segura do Portal indisponível.");
  return window.PortalAPI.call("custo-filial",action,params);
}
async function readAll(){const r=await portalCall("read",{resource:"all"});return r?.data||{}}
async function saveLaunch(payload,isUpdate){return portalCall(isUpdate?"update":"create",{...payload,resource:"lancamentos"})}

function normalizeLaunch(x){
  const rawObs=text(x.observacao);
  const isDaily=rawObs.startsWith(DAILY_MARKER);
  const isCost=rawObs.startsWith(COST_MARKER);
  const p=parseYmd(x.data);
  const cleanObs=isDaily?rawObs.slice(DAILY_MARKER.length):isCost?rawObs.slice(COST_MARKER.length):rawObs;
  return {
    id:text(x.id),data:text(x.data),ano:Number(x.ano||(p?.ano||0)),mes:Number(x.mes||(p?.mes||0)),
    filial:up(x.filial),volume:num(x.toneladas),lucro:num(x.faturamento),custo:num(x.custo),
    observacao:cleanObs,tipo:isDaily?"diario":isCost?"custo":"legado",
    createdAt:x.createdAt||"",updatedAt:x.updatedAt||""
  };
}
function newLaunches(){return DB.lancamentos.filter(x=>x.tipo==="diario"&&FILIAIS.some(f=>f.id===x.filial))}
function filteredLaunches(){return newLaunches().filter(x=>Number(x.ano)===STATE.ano&&Number(x.mes)===STATE.mes&&(!STATE.filial||x.filial===STATE.filial))}
function launchesForFilial(id){return newLaunches().filter(x=>x.filial===id&&Number(x.ano)===STATE.ano&&Number(x.mes)===STATE.mes)}
function sum(list,key){return list.reduce((a,x)=>a+num(x[key]),0)}
function daysInMonth(){return new Date(STATE.ano,STATE.mes,0).getDate()}
function elapsedDays(){const now=new Date();if(STATE.ano<now.getFullYear()||(STATE.ano===now.getFullYear()&&STATE.mes<now.getMonth()+1))return daysInMonth();if(STATE.ano>now.getFullYear()||(STATE.ano===now.getFullYear()&&STATE.mes>now.getMonth()+1))return 0;return now.getDate()}

function saveCache(){try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),rows:DB.lancamentos}))}catch{}}
function restoreCache(){try{const c=JSON.parse(sessionStorage.getItem(CACHE_KEY)||"null");if(!c||!Array.isArray(c.rows)||Date.now()-c.ts>10*60*1000)return false;DB.lancamentos=c.rows;return true}catch{return false}}

function initPeriod(){const d=new Date();STATE.ano=d.getFullYear();STATE.mes=d.getMonth()+1;$("filtroMes").value=monthValue(STATE.ano,STATE.mes);$("lancData").value=todayYmd()}
function fillFiliais(){
  const opts=FILIAIS.map(f=>`<option value="${f.id}">${f.label}</option>`).join("");
  $("filtroFilial").innerHTML='<option value="">Todas as filiais</option>'+opts;
  $("lancFilial").innerHTML='<option value="">Selecione</option>'+opts;
  $("costEditFilial").innerHTML='<option value="">Selecione a filial</option>'+opts;
}
function applyFilters(){
  STATE.filial=up($("filtroFilial").value);
  const mv=text($("filtroMes").value);
  const m=mv.match(/^(\d{4})-(\d{2})$/);
  if(m){STATE.ano=+m[1];STATE.mes=+m[2]}
  if(STATE.filial){
    $("lancFilial").value=STATE.filial;
    STATE.costEditFilial=STATE.filial;
    $("costEditFilial").value=STATE.filial;
  }
  renderAll();
}

function filialSummary(f){const rows=launchesForFilial(f.id);const lucro=sum(rows,"lucro");const volume=sum(rows,"volume");const fixo=custoFixo(f);const meta=metaFilial(f);const metaPct=meta>0?lucro/meta*100:0;const diff=lucro-meta;const status=lucro>=meta?"META ATINGIDA":lucro>=fixo?"ACIMA DO CUSTO":"ABAIXO DO CUSTO";const level=lucro>=meta?"good":lucro>=fixo?"mid":"bad";return {f,rows,lucro,volume,fixo,meta,metaPct,diff,status,level}}
function selectedFiliais(){return STATE.filial?FILIAIS.filter(f=>f.id===STATE.filial):FILIAIS}
function summaries(){return selectedFiliais().map(filialSummary)}

function renderCost(){
  const list=selectedFiliais();
  const agg={salarios:0,aluguel:0,carros:0,carroCusto:0,comb:0,agua:0,fixo:0,meta:0};

  list.forEach(f=>{
    agg.salarios+=f.salarios;
    agg.aluguel+=FIXOS.aluguel;
    agg.carros+=f.carros;
    agg.carroCusto+=f.carros*FIXOS.carro;
    agg.comb+=combustivel(f);
    agg.agua+=FIXOS.aguaEnergia;
    agg.fixo+=custoFixo(f);
    agg.meta+=metaFilial(f);
  });

  setText("costFilialName",STATE.filial?filialLabel(STATE.filial):`${list.length} filiais`);
  setText("costSalarios",brl(agg.salarios));
  setText("costAluguel",brl(agg.aluguel));
  setText("costCarros",`${agg.carros} carro(s) • ${brl(agg.carroCusto)}`);
  setText("costCombustivel",brl(agg.comb));
  setText("costAguaEnergia",brl(agg.agua));
  setText("costFixo",brl(agg.fixo));
  setText("costMeta",brl(agg.meta));

  renderCostEditor();
}

function renderCostEditor(){
  const select=$("costEditFilial");
  const input=$("costOverrideInput");
  const saveBtn=$("btnSalvarCusto");
  const autoBtn=$("btnCustoAutomatico");
  if(!select||!input||!saveBtn||!autoBtn)return;

  const id=up(select.value||STATE.costEditFilial);
  STATE.costEditFilial=id;

  if(!id){
    input.value="";
    input.disabled=true;
    saveBtn.disabled=true;
    autoBtn.disabled=true;
    setText("costAutoPreview","R$ 0,00");
    setText("costEffectivePreview","R$ 0,00");
    setText("costGoalPreview","R$ 0,00");
    setText("costEditNote","Escolha uma filial para editar o custo do mês selecionado.");
    return;
  }

  const f=filialById(id);
  if(!f)return;

  const base=custoFixoBase(f);
  const override=costOverrideRecord(f.id);
  const efetivo=custoFixo(f);

  input.disabled=false;
  saveBtn.disabled=false;
  autoBtn.disabled=false;
  input.value=efetivo.toFixed(2);

  setText("costAutoPreview",brl(base));
  setText("costEffectivePreview",brl(efetivo));
  setText("costGoalPreview",brl(efetivo*1.40));
  setText("costEditNote",override&&num(override.custo)>0
    ?`Custo manual ativo para ${f.label} em ${pad(STATE.mes)}/${STATE.ano}. O cálculo automático seria ${brl(base)}.`
    :`Usando cálculo automático para ${f.label} em ${pad(STATE.mes)}/${STATE.ano}.`);
}

function openCostEditor(id){
  const filial=up(id);
  if(!filialById(filial))return;
  STATE.costEditFilial=filial;
  $("costEditFilial").value=filial;
  renderCostEditor();
  $("secaoCustos")?.scrollIntoView({behavior:"smooth",block:"start"});
}
function renderKpis(){
  const s=summaries();const lucro=sum(s,"lucro"),volume=sum(s,"volume"),fixo=sum(s,"fixo"),meta=sum(s,"meta");const diff=lucro-meta;const dias=elapsedDays();const proj=dias>0?lucro/dias*daysInMonth():0;
  setText("kpiLucro",brl(lucro));setText("kpiVolume",tons(volume));setText("kpiCusto",brl(fixo));setText("kpiMeta",brl(meta));setText("kpiSaldo",brl(Math.abs(diff)));setText("kpiSaldoSub",diff>=0?"Acima da meta":"Falta para atingir a meta");setText("kpiProjecao",brl(proj));setText("kpiProjecaoSub",dias?`Projeção com ${dias} dia(s) transcorridos`:"Período futuro");
  const card=$("kpiSaldoCard");card?.classList.remove("good","bad");card?.classList.add(diff>=0?"good":"bad");
}
function renderResultTable(){
  const s=summaries();
  setText("resultMeta",`${s.length} filial(is)`);
  const tb=$("tbodyResultados");

  if(!s.length){
    tb.innerHTML='<tr><td colspan="11" class="cfEmpty">Sem filiais para o período selecionado.</td></tr>';
    return;
  }

  tb.innerHTML=s.map(x=>`<tr>
    <td><b>${esc(x.f.label)}</b></td>
    <td class="num">${brl(x.f.salarios)}</td>
    <td class="num">${x.f.carros}</td>
    <td class="num">${brl(x.fixo)}</td>
    <td class="num">${brl(x.meta)}</td>
    <td class="num money ${x.lucro>=x.fixo?'good':'bad'}">${brl(x.lucro)}</td>
    <td class="num">${tons(x.volume)}</td>
    <td class="num">${pct(x.metaPct)}</td>
    <td class="num money ${x.diff>=0?'good':'bad'}">${x.diff>=0?'+':''}${brl(x.diff)}</td>
    <td><span class="statusPill ${x.level}">${x.status}</span></td>
    <td><button class="miniBtn" data-edit-cost="${esc(x.f.id)}">Editar custo</button></td>
  </tr>`).join("");

  tb.querySelectorAll("[data-edit-cost]").forEach(btn=>{
    btn.addEventListener("click",()=>openCostEditor(btn.dataset.editCost));
  });
}
function renderLaunchTable(){
  const rows=filteredLaunches().slice().sort((a,b)=>b.data.localeCompare(a.data)||a.filial.localeCompare(b.filial,"pt-BR"));const tb=$("tbodyLancamentos");if(!rows.length){tb.innerHTML='<tr><td colspan="6" class="cfEmpty">Nenhum lançamento neste período.</td></tr>';return}
  tb.innerHTML=rows.map(x=>`<tr>
    <td>${dateBR(x.data)}</td>
    <td>${esc(filialLabel(x.filial))}</td>
    <td class="num">${tons(x.volume)}</td>
    <td class="num money ${x.lucro>=0?'good':'bad'}">${brl(x.lucro)}</td>
    <td>${esc(x.observacao||'-')}</td>
    <td><button class="miniBtn editLaunch" data-edit="${esc(x.id)}">✏ Editar lançamento</button></td>
  </tr>`).join("");
  tb.querySelectorAll("[data-edit]").forEach(btn=>btn.addEventListener("click",()=>editLaunch(btn.dataset.edit)));
}
function dailySeries(key){
  const rows=filteredLaunches();const map=new Map();for(let d=1;d<=daysInMonth();d++)map.set(d,0);rows.forEach(x=>{const p=parseYmd(x.data);if(p)map.set(p.dia,(map.get(p.dia)||0)+num(x[key]))});return [...map.values()];
}
function destroy(name){if(charts[name]){charts[name].destroy();charts[name]=null}}
function chartBase(){
  return {
    responsive:true,
    maintainAspectRatio:false,
    animation:{duration:300},
    plugins:{
      legend:{
        position:"top",
        align:"start",
        labels:{color:"#52627a",font:{size:11,weight:"bold"},boxWidth:14,boxHeight:8,usePointStyle:true}
      },
      tooltip:{
        backgroundColor:"#102846",
        titleColor:"#fff",
        bodyColor:"#fff",
        padding:10,
        cornerRadius:8
      }
    },
    scales:{
      x:{
        beginAtZero:true,
        ticks:{color:"#68778e",font:{size:10}},
        grid:{color:"#edf1f6"}
      },
      y:{
        ticks:{color:"#44546b",font:{size:10,weight:"bold"}},
        grid:{display:false}
      }
    }
  };
}

function horizontalMoneyOptions(){
  const base=chartBase();
  return {
    ...base,
    indexAxis:"y",
    scales:{
      ...base.scales,
      x:{
        ...base.scales.x,
        ticks:{
          ...base.scales.x.ticks,
          callback:value=>Number(value).toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0})
        }
      }
    },
    plugins:{
      ...base.plugins,
      tooltip:{
        ...base.plugins.tooltip,
        callbacks:{
          label:ctx=>`${ctx.dataset.label}: ${brl(ctx.raw)}`
        }
      }
    }
  };
}

function horizontalTonsOptions(){
  const base=chartBase();
  return {
    ...base,
    indexAxis:"y",
    scales:{
      ...base.scales,
      x:{
        ...base.scales.x,
        ticks:{
          ...base.scales.x.ticks,
          callback:value=>`${Number(value).toLocaleString("pt-BR",{maximumFractionDigits:0})} t`
        }
      }
    },
    plugins:{
      ...base.plugins,
      tooltip:{
        ...base.plugins.tooltip,
        callbacks:{label:ctx=>`${ctx.dataset.label}: ${tons(ctx.raw)}`}
      }
    }
  };
}

function dailyMoneyOptions(){
  const base=chartBase();
  return {
    ...base,
    scales:{
      ...base.scales,
      y:{
        beginAtZero:true,
        ticks:{
          color:"#68778e",
          font:{size:10},
          callback:value=>Number(value).toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0})
        },
        grid:{color:"#edf1f6"}
      }
    },
    plugins:{
      ...base.plugins,
      tooltip:{
        ...base.plugins.tooltip,
        callbacks:{label:ctx=>`Lucro: ${brl(ctx.raw)}`}
      }
    }
  };
}

function dailyTonsOptions(){
  const base=chartBase();
  return {
    ...base,
    scales:{
      ...base.scales,
      y:{
        beginAtZero:true,
        ticks:{
          color:"#68778e",
          font:{size:10},
          callback:value=>`${Number(value).toLocaleString("pt-BR",{maximumFractionDigits:0})} t`
        },
        grid:{color:"#edf1f6"}
      }
    },
    plugins:{
      ...base.plugins,
      tooltip:{
        ...base.plugins.tooltip,
        callbacks:{label:ctx=>`Volume: ${tons(ctx.raw)}`}
      }
    }
  };
}

function renderCharts(){
  if(typeof Chart==="undefined")return;

  const s=summaries();
  const labels=s.map(x=>x.f.label);

  destroy("resultado");
  charts.resultado=new Chart($("chartResultado"),{
    type:"bar",
    data:{
      labels,
      datasets:[
        {
          label:"Custo fixo",
          data:s.map(x=>x.fixo),
          backgroundColor:"rgba(37,99,235,.20)",
          borderColor:"#2563eb",
          borderWidth:1,
          borderRadius:6,
          barPercentage:.76,
          categoryPercentage:.82
        },
        {
          label:"Meta +40%",
          data:s.map(x=>x.meta),
          backgroundColor:"rgba(15,61,120,.55)",
          borderColor:"#0f3d78",
          borderWidth:1,
          borderRadius:6,
          barPercentage:.76,
          categoryPercentage:.82
        },
        {
          label:"Lucro do mês",
          data:s.map(x=>x.lucro),
          backgroundColor:s.map(x=>x.level==="good"?"rgba(5,150,105,.72)":x.level==="bad"?"rgba(220,38,38,.68)":"rgba(37,99,235,.72)"),
          borderColor:s.map(x=>x.level==="good"?"#059669":x.level==="bad"?"#dc2626":"#2563eb"),
          borderWidth:1,
          borderRadius:6,
          barPercentage:.76,
          categoryPercentage:.82
        }
      ]
    },
    options:horizontalMoneyOptions()
  });

  destroy("volume");
  charts.volume=new Chart($("chartVolume"),{
    type:"bar",
    data:{
      labels,
      datasets:[{
        label:"Toneladas embarcadas",
        data:s.map(x=>x.volume),
        backgroundColor:"rgba(5,150,105,.62)",
        borderColor:"#059669",
        borderWidth:1,
        borderRadius:6,
        barPercentage:.7,
        categoryPercentage:.76
      }]
    },
    options:horizontalTonsOptions()
  });

  const days=Array.from({length:daysInMonth()},(_,i)=>String(i+1));
  setText("dailyProfitLabel",STATE.filial?filialLabel(STATE.filial):"Todas as filiais somadas");
  setText("dailyVolumeLabel",STATE.filial?filialLabel(STATE.filial):"Todas as filiais somadas");

  destroy("lucroDia");
  charts.lucroDia=new Chart($("chartLucroDia"),{
    type:"line",
    data:{
      labels:days,
      datasets:[{
        label:"Lucro diário",
        data:dailySeries("lucro"),
        borderColor:"#059669",
        backgroundColor:"rgba(5,150,105,.10)",
        fill:true,
        tension:.28,
        pointRadius:2.5,
        pointHoverRadius:5,
        borderWidth:2
      }]
    },
    options:dailyMoneyOptions()
  });

  destroy("volumeDia");
  charts.volumeDia=new Chart($("chartVolumeDia"),{
    type:"bar",
    data:{
      labels:days,
      datasets:[{
        label:"Volume diário",
        data:dailySeries("volume"),
        backgroundColor:"rgba(37,99,235,.64)",
        borderColor:"#2563eb",
        borderWidth:1,
        borderRadius:4,
        maxBarThickness:28
      }]
    },
    options:dailyTonsOptions()
  });
}
function renderAll(){renderCost();renderKpis();renderResultTable();renderLaunchTable();renderCharts()}

function clearLaunch(){
  STATE.editId="";
  STATE.editSnapshot=null;
  $("lancFilial").value=STATE.filial||"";
  $("lancData").value=todayYmd();
  $("lancVolume").value="";
  $("lancLucro").value="";
  $("lancObs").value="";
  setText("editHint","Novo lançamento");
  setText("btnSalvarLanc","Salvar lançamento");
  $("btnSalvarLanc")?.classList.remove("editing");
  $("editNotice")?.classList.remove("show");
}
function editLaunch(id){
  const x=DB.lancamentos.find(r=>r.id===id&&r.tipo==="diario");
  if(!x)return;

  STATE.editId=x.id;
  STATE.editSnapshot={...x};

  $("lancFilial").value=x.filial;
  $("lancData").value=x.data;
  $("lancVolume").value=x.volume;
  $("lancLucro").value=x.lucro;
  $("lancObs").value=x.observacao;

  setText("editHint","Modo edição");
  setText("btnSalvarLanc","Salvar alterações");
  $("btnSalvarLanc")?.classList.add("editing");

  setText("editNoticeTitle",`Editando • ${filialLabel(x.filial)} • ${dateBR(x.data)}`);
  setText("editNoticeText",`Antes: ${tons(x.volume)} • ${brl(x.lucro)}. Corrija os valores e clique em Salvar alterações.`);
  $("editNotice")?.classList.add("show");

  $("secaoLancamento")?.scrollIntoView({behavior:"smooth",block:"start"});
  setTimeout(()=>$("lancVolume")?.focus(),320);
}
async function saveDaily(){
  const filial=up($("lancFilial").value);
  const data=text($("lancData").value);
  const volume=num($("lancVolume").value);
  const lucro=num($("lancLucro").value);
  const obs=text($("lancObs").value);

  if(!filial)return alert("Selecione a filial.");
  if(!data)return alert("Informe a data.");
  if(!text($("lancVolume").value))return alert("Informe o volume embarcado.");
  if(!text($("lancLucro").value))return alert("Informe o lucro do dia.");

  const p=parseYmd(data);
  const editing=!!STATE.editId;
  const byId=editing?DB.lancamentos.find(x=>x.id===STATE.editId&&x.tipo==="diario"):null;

  if(editing&&!byId){
    STATE.editId="";
    STATE.editSnapshot=null;
    return alert("Este lançamento não está mais disponível para edição. Atualize a página e tente novamente.");
  }

  const conflicting=newLaunches().find(x=>
    x.filial===filial &&
    x.data===data &&
    (!editing||x.id!==STATE.editId)
  );

  if(conflicting){
    return alert("Já existe outro lançamento para esta filial nesta data. Edite o lançamento existente em vez de criar uma duplicidade.");
  }

  const existing=editing?byId:newLaunches().find(x=>x.filial===filial&&x.data===data);

  const payload={
    id:existing?.id||"",
    filial,
    data,
    ano:p?.ano||0,
    mes:p?.mes||0,
    faturamento:lucro,
    toneladas:volume,
    custo:0,
    observacao:DAILY_MARKER+obs
  };

  loading(true,existing?"Atualizando lançamento...":"Salvando lançamento...");

  try{
    const r=await saveLaunch(payload,!!existing);
    if(r?.ok===false)throw new Error(r.error||"Falha ao salvar.");

    const local=normalizeLaunch({
      ...payload,
      id:existing?.id||r?.data?.id||`LOCAL-${Date.now()}`,
      updatedAt:new Date().toISOString()
    });

    if(existing){
      const i=DB.lancamentos.findIndex(x=>x.id===existing.id);
      if(i>=0)DB.lancamentos[i]=local;
    }else{
      DB.lancamentos.push(local);
    }

    saveCache();
    clearLaunch();
    renderAll();
    setStatus(existing?"Lançamento corrigido com sucesso. Sincronizando...":"Lançamento salvo. Sincronizando...","ok");
    setTimeout(()=>loadData(true),120);
  }catch(e){
    console.error(e);
    setStatus(e.message,"bad");
    alert(`Não foi possível ${existing?"atualizar":"salvar"} o lançamento.\n\n${e.message}`);
  }finally{
    loading(false);
  }
}

async function saveCostOverride(useAutomatic=false){
  const filial=up($("costEditFilial")?.value||STATE.costEditFilial);
  if(!filial)return alert("Selecione a filial que deseja editar.");

  const f=filialById(filial);
  if(!f)return;

  STATE.costEditFilial=filial;
  const value=useAutomatic?0:num($("costOverrideInput")?.value);
  if(!useAutomatic&&value<=0)return alert("Informe um custo fixo maior que zero.");

  const existing=costOverrideRecord(f.id);
  const data=`${STATE.ano}-${pad(STATE.mes)}-01`;
  const payload={
    id:existing?.id||"",
    filial:f.id,
    data,
    ano:STATE.ano,
    mes:STATE.mes,
    faturamento:0,
    toneladas:0,
    custo:value,
    observacao:COST_MARKER+(useAutomatic?"AUTOMATICO":"MANUAL")
  };

  loading(true,useAutomatic?"Restaurando custo automático...":"Salvando custo fixo...");
  try{
    const r=await saveLaunch(payload,!!existing);
    if(r?.ok===false)throw new Error(r.error||"Falha ao salvar o custo fixo.");

    const local=normalizeLaunch({
      ...payload,
      id:existing?.id||r?.data?.id||`LOCAL-COST-${Date.now()}`,
      updatedAt:new Date().toISOString()
    });

    if(existing){
      const i=DB.lancamentos.findIndex(x=>x.id===existing.id);
      if(i>=0)DB.lancamentos[i]=local;
    }else{
      DB.lancamentos.push(local);
    }

    saveCache();
    renderAll();
    setStatus(useAutomatic
      ?`Cálculo automático restaurado para ${f.label}.`
      :`Custo fixo de ${f.label} atualizado.`,"ok");

    setTimeout(()=>loadData(true),120);
  }catch(e){
    console.error(e);
    setStatus(e.message,"bad");
    alert(`Não foi possível atualizar o custo fixo.\n\n${e.message}`);
  }finally{
    loading(false);
  }
}

async function loadData(silent=false){if(!silent)loading(true,"Carregando resultados...");try{const data=await readAll();DB.lancamentos=Array.isArray(data.lancamentos)?data.lancamentos.map(normalizeLaunch):[];saveCache();renderAll();setStatus("Dados sincronizados.","ok")}catch(e){console.error(e);setStatus(e.message,"bad")}finally{if(!silent)loading(false)}}

function bind(){
  fillFiliais();
  initPeriod();

  $("btnAplicar").addEventListener("click",applyFilters);
  $("filtroFilial").addEventListener("change",applyFilters);
  $("filtroMes").addEventListener("change",applyFilters);

  $("btnMesAtual").addEventListener("click",()=>{
    const d=new Date();
    $("filtroMes").value=monthValue(d.getFullYear(),d.getMonth()+1);
    STATE.ano=d.getFullYear();
    STATE.mes=d.getMonth()+1;
    renderAll();
  });

  $("btnAtualizar").addEventListener("click",()=>loadData(false));
  $("btnSalvarLanc").addEventListener("click",saveDaily);
  $("btnLimparLanc").addEventListener("click",clearLaunch);
  $("btnCancelarEdicao").addEventListener("click",clearLaunch);

  $("costEditFilial").addEventListener("change",e=>{
    STATE.costEditFilial=up(e.target.value);
    renderCostEditor();
  });
  $("costOverrideInput").addEventListener("input",()=>{
    const id=STATE.costEditFilial;
    if(!id)return;
    const valor=num($("costOverrideInput").value);
    setText("costEffectivePreview",brl(valor));
    setText("costGoalPreview",brl(valor*1.40));
  });

  $("btnSalvarCusto").addEventListener("click",()=>saveCostOverride(false));
  $("btnCustoAutomatico").addEventListener("click",()=>saveCostOverride(true));
}
document.addEventListener("DOMContentLoaded",()=>{bind();const cached=restoreCache();if(cached){renderAll();setStatus("Exibindo dados em cache. Atualizando...","");loadData(true)}else loadData(false)});
})();
