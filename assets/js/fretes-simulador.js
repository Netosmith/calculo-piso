/* PORTAL FRETE - Simulador financeiro indicativo (2026). Sem persistência de dados. */
(function(){
"use strict";
const VERSION="20261123-portal-v8";
const BRL=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const fmt=n=>BRL.format(Math.round((n+Number.EPSILON)*100)/100);
const max=n=>Math.max(0,Number.isFinite(n)?n:0);
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const id=x=>document.getElementById(x);
const src=[
["INSS/IRRF de autônomos (eSocial)","https://www.gov.br/esocial/pt-br/acesso-ao-sistema/cronograma-de-implantacao/perguntas-frequentes-producao-empresas-e-producao-restrita"],
["Tabela IRRF 2026","https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026"],
["INSS 2026","https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal"],
["Instrução Normativa RFB 2.110/2022","https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=126687"],
["Simples Nacional - LC 123/2006","https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"],
["Equiparação à PJ - Receita Federal","https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/ecf/perguntas-e-respostas-pessoa-juridica-2021-arquivos/capitulo-i-declaracoes-da-pessoa-juridica-2021.pdf"]
];
function ir2026(renda,contrib=0,dependentes=0){
 const taxable=max(renda),ded=max(max(contrib)+max(dependentes)*189.59,607.20);
 const base=max(taxable-ded);
 let tax=base>4664.68?base*.275-908.73:base>3751.05?base*.225-675.49:
 base>2826.65?base*.15-394.16:base>2428.8?base*.075-182.16:0;
 tax=max(tax);
 const reduction=taxable<=5000?tax:taxable<=7350?max(978.62-.133145*taxable):0;
 return round(max(tax-reduction));
}
function calculate(v){
 const gross=round(max(v.tons)*max(v.companyRate)),driver=round(max(v.tons)*max(v.driverRate));
 const auto=v.driverType==="PF"||(v.driverType==="EQUIP"&&v.equipRule==="PF");
 const inssBase=auto?round(driver*.20):0;
 const inss=auto?round(Math.min(inssBase,max(8475.55-max(v.inssPreviousBase)))*.11):0;
 const sest=auto?round(inssBase*.015):0,senat=auto?round(inssBase*.01):0;
 const patronal=auto&&v.chargeEmployer?round(inssBase*.20):0;
 const prevFrete=max(v.previousFreight)*.10;
 const irrf=auto?max(round(ir2026(prevFrete+driver*.10,max(v.inssAlready)+inss,v.dependents)-
   ir2026(prevFrete,max(v.inssAlready),v.dependents))):0;
 const netDriver=round(driver-inss-sest-senat-irrf);
 const pisPct=v.cashIssOnly?0:v.regime==="PRESUMIDO"?.65:v.regime==="REAL"?1.65:0;
 const cofinsPct=v.cashIssOnly?0:v.regime==="PRESUMIDO"?3:v.regime==="REAL"?7.6:0;
 const pis=round(gross*pisPct/100),cofins=round(gross*cofinsPct/100);
 const irpj=round(gross*(v.cashIssOnly?0:v.regime==="PRESUMIDO"?1.2:v.regime==="REAL"?max(v.irpjReal):0)/100);
 const csll=round(gross*(v.cashIssOnly?0:v.regime==="PRESUMIDO"?1.08:v.regime==="REAL"?max(v.csllReal):0)/100);
 const das=round(gross*(v.cashIssOnly?0:v.regime==="SIMPLES"?max(v.dasRate):0)/100);
 const icms=round(gross*max(v.cte==="CTE"&&(v.regime!=="SIMPLES"||v.icmsOutsideDas)?v.icmsRate:0)/100);
 // No Simples o ISS costuma compor o DAS. Só somar separadamente quando
 // a contabilidade confirmar retenção/recolhimento fora do DAS.
 const iss=round(gross*max(v.cte==="NFS"&&(v.cashIssOnly||v.regime!=="SIMPLES"||v.issOutsideDas)?v.issRate:0)/100);
 const totalTax=round(pis+cofins+irpj+csll+das+icms+iss);
 const toll=round(max(v.tons)*max(v.tollRate)+max(v.tollFixed));
 const insurance=round(max(v.tons)*max(v.merchandiseRate)*max(v.insuranceRate)/100);
 const other=round(max(v.other)+max(v.cteCost)+driver*max(v.ciotRate)/100);
 const extraCost=round(max(v.extraCost));
 const cost=round(driver+patronal+totalTax+toll+insurance+other+extraCost);
 const balance=round(gross-cost);
 return {gross,driver,netDriver,spread:round(gross-driver),inssBase,inss,sest,senat,
  patronal,irrf,pis,cofins,irpj,csll,das,icms,iss,totalTax,toll,insurance,other,
  cost,extraCost,balance,margin:gross?balance/gross:0,auto};
}
function input(name,label,value,unit,step){
 return '<label class="fs-field"><span>'+label+'</span><div class="fs-input">'+
 '<input type="number" id="fs_'+name+'" min="0" step="'+(step||"0.01")+'" inputmode="decimal" value="'+value+'"><small>'+unit+'</small></div></label>';
}
function select(name,label,opts){
 return '<label class="fs-field"><span>'+label+'</span><select id="fs_'+name+'">'+
 opts.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select></label>';
}
function line(name,amount,detail,important){
 const div=document.createElement("div");div.className="fs-line"+(important?" fs-line-total":"");
 const text=document.createElement("span");text.textContent=name;
 if(detail){const small=document.createElement("small");small.textContent=detail;text.append(small)}
 const val=document.createElement("strong");val.textContent=fmt(amount);
 div.append(text,val);return div;
}
function getnum(name){const raw=(id("fs_"+name)?.value||"").replace(",",".");return max(Number(raw))}
function getstr(name){return id("fs_"+name)?.value||""}
function text(name,v){if(id("fs_"+name))id("fs_"+name).textContent=v}
function fill(){
 const typ=getstr("driverType"),equip=getstr("equipRule"),regime=getstr("regime");
 const cashIssOnly=getstr("cte")==="NFS"&&getstr("nfsMode")==="ISS_ONLY";
 id("fs_equipPanel").hidden=typ!=="EQUIP";
 id("fs_regimePanel").hidden=cashIssOnly;
 id("fs_nfsModePanel").hidden=getstr("cte")!=="NFS";
 id("fs_simplesPanel").hidden=cashIssOnly||regime!=="SIMPLES";
 id("fs_realPanel").hidden=cashIssOnly||regime!=="REAL";
 id("fs_pfPanel").hidden=!(typ==="PF"||(typ==="EQUIP"&&equip==="PF"));
 id("fs_icmsPanel").hidden=getstr("cte")!=="CTE";
 id("fs_issPanel").hidden=getstr("cte")!=="NFS";
 id("fs_issStandalone").hidden=cashIssOnly||!(getstr("cte")==="NFS"&&regime==="SIMPLES");
 const v={driverType:typ,equipRule:equip,regime,cte:getstr("cte"),cashIssOnly,
  chargeEmployer:id("fs_chargeEmployer").checked,
  icmsOutsideDas:id("fs_icmsOutsideDas").checked,
  issOutsideDas:id("fs_issOutsideDas").checked,
  companyRate:getnum("companyRate"),driverRate:getnum("driverRate"),tons:getnum("tons"),
  tollRate:getnum("tollRate"),tollFixed:getnum("tollFixed"),
  merchandiseRate:getnum("merchandiseRate"),insuranceRate:getnum("insuranceRate"),
  cteCost:getnum("cteCost"),ciotRate:getnum("ciotRate"),other:getnum("other"),
  extraCost:getnum("extraCost"),
  icmsRate:getnum("icmsRate"),issRate:getnum("issRate"),
  irpjReal:getnum("irpjReal"),csllReal:getnum("csllReal"),dasRate:getnum("dasRate"),
  previousFreight:getnum("previousFreight"),inssPreviousBase:getnum("inssPreviousBase"),
  inssAlready:getnum("inssAlready"),dependents:getnum("dependents")
 };
 const r=calculate(v);
 text("gross",fmt(r.gross));text("driverGross",fmt(r.driver));
 text("driverNet",fmt(r.netDriver));text("balance",fmt(r.balance));
 text("margin",new Intl.NumberFormat("pt-BR",{style:"percent",minimumFractionDigits:2}).format(r.margin));
 text("spread",fmt(r.spread));text("tax",fmt(r.totalTax));text("cost",fmt(r.cost));
 id("fs_balance").classList.toggle("negative",r.balance<0);
 id("fs_companyDetails").replaceChildren(
  line("Receita empresa",r.gross),line("Frete motorista contratado",-r.driver),
  line("INSS patronal sobre autônomo",-r.patronal,"20% sobre base de 20% do frete"),
  ...(v.cashIssOnly?[]:[
   line("PIS",-r.pis),line("COFINS",-r.cofins),line("IRPJ (estimativa)",-r.irpj),
   line("CSLL (estimativa)",-r.csll),line("DAS (Simples)",-r.das)
  ]),
  line("ICMS",-r.icms),line("ISS",-r.iss),
  line("Pedágio",-r.toll,"Custo efetivo do pedágio informado para esta viagem"),
  line("Seguro",-r.insurance),line("Outros custos",-r.other),
  line("Custo extra da viagem",-r.extraCost,"Ex.: lona para envelopamento, despesas adicionais"),
  line("SALDO DA TRANSPORTADORA",r.balance,"Projeção financeira, não apuração fiscal",true)
 );
 id("fs_driverDetails").replaceChildren(
  line("Frete motorista",r.driver),line("INSS retido",-r.inss,"11% sobre base de 20% (teto mensal 2026)"),
  line("SEST retido",-r.sest,"1,5% sobre base de 20%"),
  line("SENAT retido",-r.senat,"1% sobre base de 20%"),
  line("IRRF indicativo",-r.irrf,"Base de 10% do frete, tabela mensal de 2026"),
  line("MOTORISTA RECEBE",r.netDriver,"Retenções não são custo extra da transportadora",true)
 );
 const warnings=[];
 const pending=cashIssOnly||!regime||typ==="EQUIP"&&!equip||
  regime==="SIMPLES"&&!v.dasRate||regime==="REAL"&&!v.irpjReal&&!v.csllReal||
  regime==="PRESUMIDO"&&v.cte==="NFS";
 if(!regime&&!cashIssOnly)warnings.push("Informe o regime tributário real da transportadora.");
 if(cashIssOnly)warnings.push("Cenário operacional parcial: somente ISSQN desta NFS e os custos/encargos informados. DAS, PIS, COFINS, IRPJ e CSLL empresariais não são provisionados. Isso não comprova isenção dos demais tributos.");
 if(typ==="EQUIP")warnings.push(equip?
  "Equiparado: tratamento de "+(equip==="PF"?"contribuinte individual":"PJ")+
  " selecionado para simulação. Confirme com a contabilidade.":
  "Equiparado não determina automaticamente o INSS/IRRF. Selecione o tratamento fiscal confirmado.");
 if(regime==="SIMPLES"&&!cashIssOnly&&!v.dasRate)
  warnings.push("Simples Nacional exige alíquota efetiva de DAS obtida no PGDAS-D e RBT12. Sem ela, saldo é provisório.");
 if(regime==="SIMPLES"&&!cashIssOnly)warnings.push("No Simples, PIS e COFINS integram o DAS. Evite descontá-los novamente sem confirmar o regime fiscal.");
 if(regime==="SIMPLES"&&!cashIssOnly&&v.cte==="NFS"){
  warnings.push("O ISS da NFS normalmente integra o DAS. Só marque ISS separado se houver retenção/recolhimento fora do DAS e o DAS informado estiver ajustado para não contar esse ISS duas vezes.");
  if(v.issRate&&!v.issOutsideDas)warnings.push("ISS informado de "+v.issRate.toFixed(2).replace(".",",")+"%, mas não debitado separadamente porque já pode integrar o DAS.");
 }
 if(regime==="SIMPLES"&&!cashIssOnly&&v.cte==="CTE")warnings.push("ICMS normalmente já compõe o DAS do transporte intermunicipal/interestadual. Só marque ICMS separado quando a contabilidade confirmar recolhimento fora do DAS.");
 if(regime==="REAL"&&!cashIssOnly)warnings.push("Lucro Real: créditos de PIS/COFINS e IRPJ/CSLL reais dependem da apuração; preencher estimativas.");
 if(regime==="PRESUMIDO"&&!cashIssOnly)warnings.push("Lucro Presumido: 1,20% IRPJ + 1,08% CSLL são aproximações para transporte de cargas, sem adicional trimestral de IRPJ.");
 if(v.cte==="NFS")warnings.push("Para transporte de carga, NFS/ISS normalmente se aplica a serviço municipal. Transporte intermunicipal ou interestadual costuma exigir CT-e/ICMS. Confirme a natureza da operação.");
 if(v.cte==="NFS")warnings.push("NFS: incidência de ISS e presunção de IRPJ/CSLL variam conforme o serviço; confirme os parâmetros contábeis.");
 if(v.insuranceRate&&v.merchandiseRate===0)warnings.push("Seguro está em zero porque o valor da mercadoria por tonelada não foi informado.");
 warnings.push("2026: IBS/CBS têm regras de teste e compensação, não somamos 1% automaticamente ao custo do frete.");
 warnings.push("Para PF, IRRF/INSS são estimativas por viagem e dependem das demais remunerações no mês. SEST e SENAT são retenções do motorista.");
 id("fs_warnings").replaceChildren(...warnings.map(s=>{const p=document.createElement("p");p.textContent=s;return p}));
 id("fs_preliminary").hidden=!pending;
 id("fs_preliminary").textContent=cashIssOnly?
  "Cenário de caixa: apenas ISSQN desta nota. Outros tributos empresariais não estão incluídos. Não utilize como lucro líquido fiscal.":
  "Complete os parâmetros obrigatórios antes de usar o resultado como referência.";
 text("titleBalance",cashIssOnly?"Saldo operacional parcial (somente ISSQN)":
  pending?"Saldo provisório (faltam parâmetros)":"Saldo líquido estimado");
 window.__FRETES_SIMULACAO__={entradas:v,resultado:r,provisorio:pending};
}
function attach(){
 const order=id("btnOrdem");
 if(!order||id("btnSimuladorFrete"))return;
 const btn=document.createElement("button");
 btn.type="button";btn.id="btnSimuladorFrete";btn.className="btnTiny fs-btn";btn.textContent="▣ Simular Frete";
 btn.title="Simular impostos e margem por tipo de motorista";
 order.insertAdjacentElement("afterend",btn);
 const overlay=document.createElement("div");overlay.id="fs_overlay";overlay.className="fs-overlay";overlay.hidden=true;
 overlay.innerHTML=[
 '<div class="fs-modal" role="dialog" aria-modal="true" aria-labelledby="fs_heading">',
 '<header class="fs-head"><div><span>PORTAL FRETE · FINANCEIRO 2026</span>',
 '<h2 id="fs_heading">Simulador de Resultado do Frete</h2>',
 '<p>Calcule a margem da transportadora com os valores reais da viagem, impostos e custos.</p></div>',
 '<button type="button" id="fs_close" aria-label="Fechar simulador">×</button></header>',
 '<div class="fs-content"><div class="fs-form-grid"><section class="fs-section"><h3>01 · Frete e peso</h3><div class="fs-fields">',
 input("companyRate","Frete empresa / tonelada",240,"R$/t"),
 input("driverRate","Frete motorista / tonelada",230,"R$/t"),
 input("tons","Peso transportado",30,"t"),
 input("tollRate","Pedágio / tonelada",0,"R$/t"),
 input("tollFixed","Pedágio fixo adicional",0,"R$"),
 input("merchandiseRate","Valor da mercadoria / tonelada",0,"R$/t"),
 '</div></section><section class="fs-section"><h3>02 · Tipo e impostos</h3><div class="fs-fields">',
 select("driverType","Tipo do motorista",[["PF","Físico · TAC/RPA"],["PJ","Jurídico · CNPJ"],["EQUIP","Equiparado"]]),
 '<div id="fs_regimePanel">',
 select("regime","Regime tributário da transportadora",[["","Selecione o regime real"],["PRESUMIDO","Lucro Presumido"],["REAL","Lucro Real"],["SIMPLES","Simples Nacional"]]),
 '</div>',
 select("cte","Documento de transporte",[["CTE","CT-e · Transporte de carga"],["NFS","NFS · Serviços municipais"]]),
 '<div id="fs_nfsModePanel" hidden>',
 select("nfsMode","Cenário de cálculo da NFS",[
 ["FISCAL","Tributos conforme regime fiscal"],
 ["ISS_ONLY","Somente ISSQN pago na nota (cálculo parcial)"]]),
 '</div>',
 '<div id="fs_equipPanel" hidden>',
 select("equipRule","Tratamento confirmado do equiparado",[["","Selecione"],["PJ","Tributação como PJ"],["PF","Retenções do contribuinte individual"]]),
 '</div><div id="fs_simplesPanel" hidden>',
 input("dasRate","DAS efetivo do PGDAS-D",0,"%"),'</div>',
 '<div id="fs_realPanel" hidden>',input("irpjReal","IRPJ efetivo estimado",0,"%"),
 input("csllReal","CSLL efetiva estimada",0,"%"),'</div>',
 '<div id="fs_icmsPanel">',input("icmsRate","ICMS embutido no frete",0,"%"),
 '<label class="fs-check"><input id="fs_icmsOutsideDas" type="checkbox">No Simples: ICMS devido fora do DAS</label></div>',
 '<div id="fs_issPanel" hidden>',input("issRate","ISSQN da NFS",0,"%"),
 '<label class="fs-check" id="fs_issStandalone" hidden><input id="fs_issOutsideDas" type="checkbox">Descontar ISS separadamente do DAS (retenção/recolhimento confirmado)</label></div>',
 '</div><p class="fs-help">ICMS depende de UF, trajeto, benefício e incidência. Não presumimos uma alíquota fixa.</p>',
 '</section><section class="fs-section"><h3>03 · Custos e retenções</h3><div class="fs-fields">',
 input("insuranceRate","Seguro sobre mercadoria",.06,"%"),
 input("cteCost","Taxa fixa por CT-e",.38,"R$"),
 input("ciotRate","Tarifa operacional CIOT (não imposto)",0,"%"),
 input("other","Outros custos diretos",0,"R$"),
 input("extraCost","Custo extra da viagem (ex.: lona)",0,"R$"),
 '<label class="fs-check"><input id="fs_chargeEmployer" type="checkbox" checked>Incluir INSS patronal de autônomo</label>',
 '</div><details id="fs_pfPanel" class="fs-advanced"><summary>Dados acumulados PF no mês (opcional)</summary>',
 '<div class="fs-fields">',
 input("previousFreight","Fretes anteriores no mês",0,"R$"),
 input("inssPreviousBase","Base de INSS já utilizada no mês",0,"R$"),
 input("inssAlready","INSS já descontado no mês",0,"R$"),
 input("dependents","Dependentes para IR",0,"", "1"),
 '</div></details></section></div>',
 '<section class="fs-result"><div class="fs-kpis">',
 '<div><small>Frete bruto empresa</small><strong id="fs_gross"></strong></div>',
 '<div><small>Frete bruto motorista</small><strong id="fs_driverGross"></strong></div>',
 '<div><small>Motorista recebe</small><strong id="fs_driverNet"></strong></div>',
 '<div class="fs-final"><small id="fs_titleBalance">Saldo líquido estimado</small><strong id="fs_balance"></strong>',
 '<span id="fs_margin"></span></div></div>',
 '<p id="fs_preliminary" class="fs-warning" hidden>Complete os parâmetros obrigatórios antes de usar o resultado como referência.</p>',
 '<div class="fs-totals"><span>Diferença bruta: <b id="fs_spread"></b></span>',
 '<span>Impostos da empresa: <b id="fs_tax"></b></span>',
 '<span>Custo total: <b id="fs_cost"></b></span></div>',
 '<div class="fs-breakdown"><section><h3>Transportadora</h3><div id="fs_companyDetails"></div></section>',
 '<section><h3>Motorista</h3><div id="fs_driverDetails"></div></section></div></section>',
 '<details id="fs_notesPanel" class="fs-section fs-notes"><summary>Premissas e alertas · clique para expandir</summary><div id="fs_warnings"></div>',
 '<details class="fs-sources"><summary>Fontes tributárias oficiais (2026)</summary><div id="fs_sources"></div></details></details></div>',
 '<footer class="fs-foot"><span>Simulador local. Não altera o frete salvo.</span>',
 '<div><button type="button" id="fs_reset">Reiniciar</button>',
 '<button type="button" id="fs_print">Imprimir cálculo</button>',
 '<button type="button" id="fs_done">Concluir</button></div></footer></div>'
 ].join("");
 document.body.append(overlay);
 const close=()=>{overlay.hidden=true;document.body.classList.remove("fs-show");btn.focus()};
 btn.onclick=()=>{overlay.hidden=false;document.body.classList.add("fs-show");fill();id("fs_companyRate").focus()};
 id("fs_close").onclick=close;id("fs_done").onclick=close;
 overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay.hidden)close()});
 overlay.addEventListener("input",fill);overlay.addEventListener("change",fill);
 id("fs_print").onclick=()=>window.print();
 id("fs_reset").onclick=()=>{
  for(const [name,val] of Object.entries({companyRate:240,driverRate:230,tons:30,tollRate:0,
   tollFixed:0,merchandiseRate:0,insuranceRate:.06,cteCost:.38,ciotRate:0,other:0,extraCost:0,
   icmsRate:0,issRate:0,dasRate:0,irpjReal:0,csllReal:0,
   previousFreight:0,inssPreviousBase:0,inssAlready:0,dependents:0}))id("fs_"+name).value=val;
  id("fs_regime").value="";id("fs_driverType").value="PF";id("fs_equipRule").value="";
  id("fs_cte").value="CTE";id("fs_nfsMode").value="FISCAL";id("fs_chargeEmployer").checked=true;id("fs_icmsOutsideDas").checked=false;id("fs_issOutsideDas").checked=false;fill();
 };
 const root=id("fs_sources");
 for(const [title,url] of src){const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=title;root.append(a)}
 fill();
}
window.PortalFreteSimulador=Object.freeze({calculate,ir2026,version:VERSION});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",attach,{once:true});
else attach();
})();