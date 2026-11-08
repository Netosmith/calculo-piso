import test from "node:test";
import assert from "node:assert/strict";
import {calculateCommission,parseCommissionSetting} from "../src/services/rh-commissions.js";

test("Opções previstas para toneladas e percentuais",()=>{
 for(const rate of [5,6,7,8,9,10,15,20])
  assert.equal(parseCommissionSetting({commissionKind:"TON",commissionRate:rate}).rateValue,rate);
 for(const rate of [10,15,20,25,100,150])
  assert.equal(parseCommissionSetting({commissionKind:"PERCENT",commissionRate:rate}).rateValue,rate);
 for(const [kind,rate] of [["NONE",0],["MANUAL",0],["AGENCIA",0]])
  assert.equal(parseCommissionSetting({commissionKind:kind,commissionRate:rate}).kind,kind);
 for(const invalid of [{commissionKind:"TON",commissionRate:21},{commissionKind:"PERCENT",commissionRate:50},
   {commissionKind:"AGENCIA",commissionRate:5},{commissionKind:"PERCENT",commissionRate:0}])
  assert.throws(()=>parseCommissionSetting(invalid));
});

test("Por tonelada: 150 t a 5 centavos = R$ 7,50",()=>{
 const result=calculateCommission({kind:"TON",rateValue:5},{tonnesMilli:150000});
 assert.equal(result.amountCents,750);
 assert.equal(result.tonnesMilli,150000);
});

test("Por tonelada: 1.350,500 t a 20 centavos = R$ 270,10",()=>{
 const result=calculateCommission({kind:"TON",rateValue:20},{tonnesMilli:1350500});
 assert.equal(result.amountCents,27010);
});

test("Porcentagem 0,10%: 80.000 toneladas = R$ 80,00",()=>{
 const result=calculateCommission({kind:"PERCENT",rateValue:10},{tonnesMilli:80000000});
 assert.equal(result.amountCents,8000);
});

test("Porcentagem 1,5%: 80.000 toneladas = R$ 1.200,00",()=>{
 const result=calculateCommission({kind:"PERCENT",rateValue:150},{tonnesMilli:80000000});
 assert.equal(result.amountCents,120000);
});
test("Por tonelada R$ 0,15: 80.000 toneladas = R$ 12.000,00",()=>{
 const result=calculateCommission({kind:"TON",rateValue:15},{tonnesMilli:80000000});
 assert.equal(result.amountCents,1200000);
});

test("Manual e agência respeitam o valor definido e preservam toneladas opcionais",()=>{
 for(const kind of ["MANUAL","AGENCIA"]){
  const result=calculateCommission({kind,rateValue:0},{
   tonnesMilli:250000,manualAmountCents:5800
  });
  assert.equal(result.amountCents,5800);
  assert.equal(result.tonnesMilli,250000);
 }
});

test("Não aceitar cálculos com modalidade incorreta, campos ausentes ou valores negativos",()=>{
 const examples=[
  [{kind:"NONE",rateValue:0},{tonnesMilli:100000}],
  [{kind:"TON",rateValue:5},{tonnesMilli:0}],
  [{kind:"PERCENT",rateValue:15},{tonnesMilli:0}],
  [{kind:"PERCENT",rateValue:15},{tonnesMilli:100000,manualAmountCents:100}],
  [{kind:"MANUAL",rateValue:0},{tonnesMilli:100000,manualAmountCents:0}],
  [{kind:"AGENCIA",rateValue:0},{tonnesMilli:100000,manualAmountCents:-100}],
  [{kind:"TON",rateValue:5},{tonnesMilli:100000,freightCentsPerTon:10000}]
 ];
 for(const [setting,entry] of examples)assert.throws(()=>calculateCommission(setting,entry));
});
