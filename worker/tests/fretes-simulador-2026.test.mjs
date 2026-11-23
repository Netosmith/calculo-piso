import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=path=>fs.readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const javascript=read("assets/js/fretes-simulador.js");
const screen1=read("pages/fretes.html"),screen2=read("pages/fretes2.html");
const context={window:{},document:{readyState:"loading",addEventListener(){}},Intl};
vm.runInNewContext(javascript,context);
const {calculate,ir2026}=context.window.PortalFreteSimulador;
const base={companyRate:240,driverRate:230,tons:30,tollRate:0,tollFixed:0,
 merchandiseRate:0,insuranceRate:.06,cteCost:.38,ciotRate:0,other:0,icmsRate:0,issRate:0,
 irpjReal:0,csllReal:0,dasRate:0,previousFreight:0,inssPreviousBase:0,inssAlready:0,
 dependents:0,cte:"CTE",regime:"PRESUMIDO",chargeEmployer:true};
test("Calculadora e telas carregam com sintaxe válida",()=>{
 assert.doesNotThrow(()=>new vm.Script(javascript));
 for(const page of [screen1,screen2]){
  assert.match(page,/fretes-simulador\.js\?v=20261123-v1/);
  assert.match(page,/fretes-simulador\.css\?v=20261123-v1/);
  assert.match(page,/id="btnOrdem"/);
 }
 assert.match(javascript,/order\.insertAdjacentElement\("afterend",btn\)/);
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
test("ICMS e ISS dependem do documento e da alíquota informada",()=>{
 const cte=calculate({...base,driverType:"PJ",icmsRate:12,issRate:5,cte:"CTE"});
 const nfs=calculate({...base,driverType:"PJ",icmsRate:12,issRate:5,cte:"NFS"});
 assert.equal(cte.icms,864);
 assert.equal(cte.iss,0);
 assert.equal(nfs.icms,0);
 assert.equal(nfs.iss,360);
});
