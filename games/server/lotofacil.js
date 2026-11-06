import {callAppsScript} from '../../worker/src/services/appscript.js';

const json=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const MODES=new Set(['simple','eco1','eco2','eco3','inter']);
const VALID_METHODS=new Set(['diversificado','aleatorio']);
const PRICES={15:3.5,16:56,17:476};

function validGames(mode,raw){
  if(!Array.isArray(raw)||raw.length<1||raw.length>12)return null;
  const selected=new Set(),groups=[];
  for(const entry of raw){
    const arr=Array.isArray(entry)?entry:entry?.numbers;
    if(!Array.isArray(arr)||arr.length<15||arr.length>17)return null;
    const numbers=arr.map(Number);
    if(numbers.some(n=>!Number.isInteger(n)||n<1||n>25)||new Set(numbers).size!==numbers.length)return null;
    numbers.sort((a,b)=>a-b);
    const key=numbers.join(',');
    if(selected.has(key))return null;
    selected.add(key);
    groups.push({size:numbers.length,numbers});
  }
  const sizes=groups.map(g=>g.size).sort((a,b)=>a-b);
  const same=arr=>sizes.length===arr.length&&sizes.every((v,i)=>v===arr[i]);
  if(mode==='simple'&&!(sizes.length<=10&&sizes.every(n=>n===15)))return null;
  if(mode==='eco1'&&!same(Array(10).fill(15)))return null;
  if(mode==='eco2'&&!same([...Array(10).fill(15),16]))return null;
  if(mode==='eco3'&&!same([...Array(10).fill(15),16,16]))return null;
  if(mode==='inter'&&!same([...Array(10).fill(15),16,17]))return null;
  return groups;
}
function drawNumbers(arr){
  if(!Array.isArray(arr)||arr.length!==15)return null;
  const numbers=arr.map(Number);
  if(numbers.some(n=>!Number.isInteger(n)||n<1||n>25)||new Set(numbers).size!==15)return null;
  return numbers.sort((a,b)=>a-b);
}
async function parseBody(request,max=12000){
  const text=await request.text();
  if(!text||text.length>max)throw Error('Dados incompletos ou muito grandes.');
  const data=JSON.parse(text);
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Dados inválidos.');
  return data;
}
const BRIDGE_ACTION='lotofacil_bridge';
async function invoke(env,params){
  const result=await callAppsScript(env,{action:BRIDGE_ACTION,method:'POST',params});
  if(!result?.ok||!result?.combination){
    const msg=String(result?.error||'Integração do Lotofácil não está ativada no Apps Script.').slice(0,160);
    throw Error(msg);
  }
  const c=result.combination;
  const number=Number(c.number);
  if(!Number.isInteger(number)||number<1||!Array.isArray(c.groups))throw Error('Resposta da planilha inválida.');
  return {
    number,createdAt:String(c.createdAt||''),user:String(c.user||''),
    mode:String(c.mode||''),method:String(c.method||''),
    count:Number(c.count||c.groups.length),cost:Number(c.cost||0),
    groups:c.groups.map(g=>({size:Number(g.size),numbers:g.numbers.map(Number)})),
    status:String(c.status||'GERADO'),
    draw:Array.isArray(c.draw)?c.draw.map(Number):[],
    prizes:c.prizes||null,
    fixedPrize:Number(c.fixedPrize||0),
    duplicate:Boolean(result.duplicate)
  };
}
export async function lotofacilController(request,env,session){
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
  const base='/v1/games/lotofacil/combination';
  const item=path.match(/^\/v1\/games\/lotofacil\/combination\/([1-9][0-9]{0,8})(\/check)?$/);
  if(path!==base&&!item)return json({ok:false,error:'Endereço de combinação inválido.'},404);
  if(!env.APPS_SCRIPT_URL||!env.PORTAL_KEY)
    return json({ok:false,error:'Integração com a planilha indisponível.'},503);
  try{
    if(path===base&&request.method==='POST'){
      const body=await parseBody(request);
      const mode=String(body.mode||'');
      const method=String(body.method||'');
      const requestId=String(body.requestId||'');
      if(!MODES.has(mode)||!VALID_METHODS.has(method)||
         !/^[a-f0-9-]{30,64}$/i.test(requestId))
        return json({ok:false,error:'Dados da combinação inválidos.'},400);
      const games=validGames(mode,body.groups);
      if(!games)return json({ok:false,error:'Confira quantidade de bilhetes e dezenas.'},400);
      const combination=await invoke(env,{
        op:'create',requestId,mode,method,
        user:String(session.usuario||''),games
      });
      return json({ok:true,combination});
    }
    if(item&&request.method==='GET'&&!item[2]){
      const combination=await invoke(env,{op:'get',number:Number(item[1])});
      return json({ok:true,combination});
    }
    if(item&&request.method==='POST'&&item[2]){
      const body=await parseBody(request,1200);
      const draw=drawNumbers(body.draw);
      if(!draw)return json({ok:false,error:'Selecione exatamente 15 dezenas, sem repetir.'},400);
      const combination=await invoke(env,{op:'check',number:Number(item[1]),draw});
      return json({ok:true,combination});
    }
    return json({ok:false,error:'Método não permitido.'},405);
  }catch(err){
    const msg=String(err?.message||'Falha ao acessar o Google Sheets.');
    console.warn('[LOTOFACIL] Falha de integração',{operation:request.method,path,reason:msg.slice(0,120)});
    // AppScript may still require the extension to be added and redeployed.
    const isMissing=/módulo|m[oó]dulo|a[cç][aã]o|action|rot[aá]|unknown|invalid|inv[aá]lid|bridge/i.test(msg);
    const notFound=/combina[cç][aã]o n[aã]o encontrada/i.test(msg);
    return json({ok:false,error:isMissing?'Integração do Lotofácil pendente de ativação no Apps Script.':msg.slice(0,180)},notFound?404:503);
  }
}
