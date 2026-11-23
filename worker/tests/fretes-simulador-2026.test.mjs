import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=path=>fs.readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const javascript=read("assets/js/fretes-simulador.js");
const styles=read("assets/css/fretes-simulador.css");
const screen1=read("pages/fretes.html"),screen2=read("pages/fretes2.html");
const context={window:{},document:{readyState:"loading",addEventListener(){}},Intl};
vm.runInNewContext(javascript,context);
const {calculate,ir2026}=context.window.PortalFreteSimulador;
const base={companyRate:240,driverRate:230,tons:30,tollRate:0,tollFixed:0,
 merchandiseRate:0,insuranceRate:.06,cteCost:.38,ciotRate:0,other:0,extraCost:0,icmsRate:0,issRate:0,
 irpjReal:0,csllReal:0,dasRate:0,previousFreight:0,inssPreviousBase:0,inssAlready:0,
 dependents:0,cte:"CTE",regime:"PRESUMIDO",chargeEmployer:true};
test("Calculadora e telas carregam com sintaxe válida",()=>{
 assert.doesNotThrow(()=>new vm.Script(javascript));
 for(const page of [screen1,screen2]){
  assert.match(page,/fretes-simulador\.js\?v=20261123-layout-v7/);
  assert.match(page,/fretes-simulador\.css\?v=20261123-layout-v3/);
  assert.match(page,/id="btnOrdem"/);
 }
 assert.match(javascript,/order\.insertAdjacentElement\("afterend",btn\)/);
});
test("Layout do modal respeita ordem e fluxo vertical sem sobreposição",()=>{
 const fakeDoc={
  readyState:"complete",
  body:{},
  getElementById:name=>name==="btnOrdem"?{insertAdjacentElement(){}}:null,
  createElement:name=>({tagName:name}),addEventListener(){}
 };
 const capture=javascript.replace("document.body.append(overlay);",
  "document.__captured=overlay.innerHTML;return;");
 vm.runInNewContext(capture,{window:{},document:fakeDoc,Intl});
 const html=fakeDoc.__captured;
 assert.ok(html,"Falha ao gerar HTML do modal");
 const order=["class=\"fs-form-grid\"","class=\"fs-result\"",
  "id=\"fs_comparePanel\"","id=\"fs_notesPanel\""];
 let offset=-1;
 for(const term of order){
  const pos=html.indexOf(term);
  assert.ok(pos>offset, "Elemento fora da ordem: "+term);offset=pos;
 }
 assert.match(html,/fs-form-grid/);
 assert.match(html,/fs_notesPanel" class="fs-section fs-notes"/);
 const open=[],voidTags=new Set(["input","br","hr","img","meta","link"]);
 for(const match of html.matchAll(/<(\/?)([A-Za-z][\w-]*)\b[^>]*>/g)){
  const tag=match[2].toLowerCase();
  if(voidTags.has(tag)||match[0].endsWith("/>"))continue;
  if(match[1])assert.equal(open.pop(),tag, "Tag HTML sem fechamento correto");
  else open.push(tag);
 }
 assert.equal(open.length,0,"Tags abertas no layout");
 assert.match(styles,/\.fs-content\{[^}]*display:flex;flex-direction:column/);
 assert.match(styles,/\.fs-form-grid\{display:grid/);
 assert.match(styles,/\.fs-content > \.fs-form-grid/);
 assert.match(styles,/\.fs-notes > summary/);
});
test("Exemplo da planilha: PF frete 7200 motorista 6900",()=>{
 const result=calculate({...base,driverType:"PF"});
 assert.equal(result.gross,7200);
 assert.equal(result.driver,6900);
 assert.equal(result.spread,300);
 assert.equal(result.inssBase,1380);
 assert.equal(result.inss,151.8);
 assert.equal(result.sest,20.7);
 assert.equal(result.senat,13.8);
 assert.equal(result.patronal,276);
 assert.equal(result.pis,46.8);
 assert.equal(result.cofins,216);
 assert.equal(result.irpj,86.4);
 assert.equal(result.csll,77.76);
 assert.equal(result.netDriver,6713.7);
 assert.equal(result.balance,-403.34);
});
test("Retenções do PF não são cobradas duas vezes da empresa",()=>{
 const pf=calculate({...base,driverType:"PF"});
 const pj=calculate({...base,driverType:"PJ"});
 assert.equal(pf.cost-pj.cost,276);
 assert.equal(Math.round((pf.driver-pf.netDriver)*100)/100,186.3);
 assert.equal(pj.netDriver,pj.driver);
 assert.equal(pj.patronal,0);
});
test("Equiparado exige enquadramento explícito em PF ou PJ",()=>{
 const p=calculate({...base,driverType:"EQUIP",equipRule:"PF"});
 const j=calculate({...base,driverType:"EQUIP",equipRule:"PJ"});
 assert.equal(p.inss,151.8);
 assert.equal(j.inss,0);
 assert.equal(p.patronal,276);
 assert.equal(j.patronal,0);
});
test("Simples não soma PIS/COFINS separadamente quando DAS informado",()=>{
 const p=calculate({...base,driverType:"PJ",regime:"SIMPLES",dasRate:6.2});
 assert.equal(p.das,446.4);
 assert.equal(p.pis,0);
 assert.equal(p.cofins,0);
 assert.equal(p.irpj,0);
 assert.equal(p.csll,0);
});
test("Simples não duplica ICMS já dentro do DAS",()=>{
 const same=calculate({...base,driverType:"PJ",regime:"SIMPLES",dasRate:6.2,icmsRate:12});
 assert.equal(same.icms,0);
 const separate=calculate({...base,driverType:"PJ",regime:"SIMPLES",dasRate:6.2,
  icmsRate:12,icmsOutsideDas:true});
 assert.equal(separate.icms,864);
});
test("Pedágio, custos e seguro são descontados uma única vez",()=>{
 const p=calculate({...base,driverType:"PJ",tollRate:2,tollFixed:10,merchandiseRate:1000,
  insuranceRate:.06,cteCost:.38,other:15});
 assert.equal(p.toll,70);
 assert.equal(p.insurance,18);
 assert.equal(p.other,15.38);
});
test("Custo extra (lona) diminui apenas o saldo e não afeta impostos ou motorista",()=>{
 const sem=calculate({...base,driverType:"PF",extraCost:0});
 const lona=calculate({...base,driverType:"PF",extraCost:180});
 assert.equal(lona.extraCost,180);
 assert.equal(lona.cost,Math.round((sem.cost+180)*100)/100);
 assert.equal(lona.balance,Math.round((sem.balance-180)*100)/100);
 assert.equal(lona.gross,sem.gross);
 assert.equal(lona.driver,sem.driver);
 assert.equal(lona.netDriver,sem.netDriver);
 assert.equal(lona.totalTax,sem.totalTax);
 assert.match(javascript,/Custo extra da viagem \(ex\.: lona\)/);
 assert.match(javascript,/extraCost:getnum\("extraCost"\)/);
});
test("Custo extra negativo é descartado",()=>{
 const baseCalc=calculate({...base,driverType:"PJ"});
 const withNegative=calculate({...base,driverType:"PJ",extraCost:-120});
 assert.equal(baseCalc.balance,withNegative.balance);
 assert.equal(withNegative.extraCost,0);
});
test("2026 IRRF usa a redução de imposto mensal",()=>{
 assert.equal(ir2026(4000),0);
 assert.equal(ir2026(5000),0);
 assert.ok(ir2026(8000)>0);
});
test("Limite do INSS PF considera a base já utilizada no mês",()=>{
 const result=calculate({...base,driverType:"PF",inssPreviousBase:8475.55});
 assert.equal(result.inss,0);
 assert.equal(result.sest,20.7);
 assert.equal(result.senat,13.8);
});
test("NFS somente ISSQN não exige DAS e mostra saldo operacional parcial",()=>{
 const input={...base,companyRate:33,driverRate:30,tons:31,driverType:"PF",
  cte:"NFS",regime:"SIMPLES",dasRate:8.2,issRate:3,cashIssOnly:true};
 const calc=calculate(input);
 assert.equal(calc.gross,1023);
 assert.equal(calc.driver,930);
 assert.equal(calc.iss,30.69);
 assert.equal(calc.das,0);
 assert.equal(calc.pis,0);
 assert.equal(calc.cofins,0);
 assert.equal(calc.irpj,0);
 assert.equal(calc.csll,0);
 assert.equal(calc.patronal,37.2);
 assert.equal(calc.balance,24.73);
 assert.equal(calculate({...input,extraCost:10}).balance,14.73);
 assert.match(javascript,/Somente ISSQN pago na nota \(cálculo parcial\)/);
 assert.match(javascript,/Saldo operacional parcial \(somente ISSQN\)/);
 assert.match(javascript,/Cenário operacional parcial/);
});
test("DAS permanece no cálculo fiscal quando Simples for selecionado",()=>{
 const fiscal=calculate({...base,driverType:"PJ",cte:"NFS",
  regime:"SIMPLES",issRate:3,issOutsideDas:false,dasRate:8.2});
 assert.equal(fiscal.iss,0);
 assert.equal(fiscal.das,590.4);
 const retido=calculate({...base,driverType:"PJ",cte:"NFS",
  regime:"SIMPLES",issRate:3,issOutsideDas:true,dasRate:8.2});
 assert.equal(retido.iss,216);
});
test("Conciliação NFS reproduz os valores vistos nas três colunas da planilha",()=>{
 const old=context.window.PortalFreteSimulador.historicalNfs;
 assert.equal(old("REAL").saldo,53.33);
 assert.equal(old("SIMPLES").saldo,31.82);
 assert.equal(old("AUTONOMO").saldo,-9.25);
 assert.equal(old("AUTONOMO").iss,30.69);
 assert.equal(old("AUTONOMO").pis+old("AUTONOMO").cofins,30.11);
 assert.equal(old("AUTONOMO").other,4.25);
});
test("NFS no Simples não duplica ISS do DAS sem confirmação expressa",()=>{
 const v={...base,companyRate:33,driverRate:30,tons:31,
  cte:"NFS",driverType:"PF",regime:"SIMPLES",dasRate:0,
  issRate:3,issOutsideDas:false};
 const original=calculate(v);
 assert.equal(original.gross,1023);
 assert.equal(original.driver,930);
 assert.equal(original.patronal,37.2);
 assert.equal(original.iss,0);
 assert.equal(original.balance,55.42);
 const separate=calculate({...v,issOutsideDas:true});
 assert.equal(separate.iss,30.69);
 assert.equal(separate.balance,24.73);
 const adjusted=calculate({...v,issOutsideDas:true,other:3.87});
 assert.equal(adjusted.balance,20.86);
 assert.equal(Math.round((original.balance-(-9.25))*100)/100,64.67);
});
test("Nova seção esclarece diferenças de tributação e oferece exemplo NFS",()=>{
 assert.match(javascript,/fs_comparePanel/);
 assert.match(javascript,/fs_applyNfs/);
 assert.match(javascript,/fs_legacyMatrix/);
 assert.match(javascript,/fs_issOutsideDas/);
 assert.match(javascript,/Selecione o regime real/);
});
test("ICMS e ISS dependem do documento e da alíquota informada",()=>{
 const cte=calculate({...base,driverType:"PJ",icmsRate:12,issRate:5,cte:"CTE"});
 const nfs=calculate({...base,driverType:"PJ",icmsRate:12,issRate:5,cte:"NFS"});
 assert.equal(cte.icms,864);
 assert.equal(cte.iss,0);
 assert.equal(nfs.icms,0);
 assert.equal(nfs.iss,360);
});
