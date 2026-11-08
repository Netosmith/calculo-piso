// Nova Frota RH: parâmetros de comissões e cálculo oficial no servidor.
// Sem valores em ponto flutuante no armazenamento: centavos e milésimos de tonelada.
export const COMMISSION_TYPES=Object.freeze(["NONE","TON","PERCENT","MANUAL","AGENCIA"]);
export const TON_RATES=Object.freeze([5,6,7,8,9,10,15,20]); // centavos / tonelada
export const PERCENT_RATES=Object.freeze([10,15,20,25,100]); // basis points: 10=0,10%; 100=1%
const validInt=(v,min,max)=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const MONEY_MAX=100000000000;

export function parseCommissionSetting(p){
  const kind=String(p?.commissionKind??"NONE").trim().toUpperCase();
  const rateValue=p?.commissionRate??0;
  if(!COMMISSION_TYPES.includes(kind)||!validInt(rateValue,0,100))
    throw new Error("Tipo ou taxa de comissão inválidos.");
  if(kind==="TON"&&!TON_RATES.includes(rateValue))
    throw new Error("Escolha 5, 6, 7, 8, 9, 10, 15 ou 20 centavos por tonelada.");
  if(kind==="PERCENT"&&!PERCENT_RATES.includes(rateValue))
    throw new Error("Escolha 0,10%, 0,15%, 0,20%, 0,25% ou 1%.");
  if(["NONE","MANUAL","AGENCIA"].includes(kind)&&rateValue!==0)
    throw new Error("Comissão manual ou de agência não possui taxa pré-definida.");
  return {kind,rateValue};
}

export function calculateCommission(setting,values){
  const {kind,rateValue}=parseCommissionSetting({
    commissionKind:setting.kind,
    commissionRate:setting.rateValue
  });
  if(kind==="NONE")throw new Error("Defina a modalidade de comissão no cadastro do funcionário.");
  const tonnesMilli=values.tonnesMilli??0;
  const freightCentsPerTon=values.freightCentsPerTon??0;
  const manualAmountCents=values.manualAmountCents??0;
  if(!validInt(tonnesMilli,0,1000000000))
    throw new Error("Toneladas inválidas. Informe até 1.000.000 t, com três casas decimais.");
  if(!validInt(freightCentsPerTon,0,100000000))
    throw new Error("Valor do frete por tonelada inválido.");
  if(!validInt(manualAmountCents,0,MONEY_MAX))
    throw new Error("Valor manual inválido.");
  let amountCents=0;
  if(kind==="TON"){
    if(tonnesMilli<=0)throw new Error("Informe as toneladas para a comissão por tonelada.");
    if(freightCentsPerTon!==0||manualAmountCents!==0)
      throw new Error("Esta modalidade usa somente o volume em toneladas.");
    amountCents=Math.round(tonnesMilli*rateValue/1000);
  }else if(kind==="PERCENT"){
    if(tonnesMilli<=0||freightCentsPerTon<=0)
      throw new Error("Informe as toneladas e o valor do frete (R$/t) para calcular o percentual.");
    if(manualAmountCents!==0)throw new Error("O percentual deve ser calculado, não informado manualmente.");
    const totalFreightCents=Math.round(tonnesMilli*freightCentsPerTon/1000);
    if(!Number.isSafeInteger(totalFreightCents)||totalFreightCents>MONEY_MAX)
      throw new Error("Valor total do frete excede o limite permitido.");
    amountCents=Math.round(totalFreightCents*rateValue/10000);
  }else{
    // MANUAL e AGENCIA: usuário define o valor ao lançar.
    if(manualAmountCents<=0)throw new Error("Informe o valor manual da comissão.");
    if(freightCentsPerTon!==0)throw new Error("O frete por tonelada não é necessário nesta modalidade.");
    amountCents=manualAmountCents;
  }
  if(!validInt(amountCents,1,MONEY_MAX))
    throw new Error("Comissão calculada inválida. Confira toneladas e valores.");
  return {kind,rateValue,tonnesMilli,freightCentsPerTon,amountCents};
}
