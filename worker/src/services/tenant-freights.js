import {errorResponse,success} from "../utils/response.js";

const WRITER_ROLES=new Set(["ADMINISTRADOR","COMERCIAL","OPERACIONAL","GOADM"]);
const STATUSES=new Set(["aberto","finalizado"]);
const FIELDS=new Set(["origem","destino","produto","valorTon"]);
function clean(value,max=100){
 if(typeof value!=="string")return null;
 const text=value.trim();
 return text.length>0&&text.length<=max&&!/[\u0000-\u001f\u007f]/.test(text)?text:null;
}
function allowedModule(modules,key){
 return modules.includes(key);
}
async function jsonBody(request){
 const raw=await request.text();
 if(raw.length>2048)throw new TypeError("invalid body");
 const data=JSON.parse(raw);
 if(!data||typeof data!=="object"||Array.isArray(data))throw new TypeError("invalid body");
 return data;
}
function formatFreight(row){
 return {id:row.id,origem:row.origem,destino:row.destino,produto:row.produto,
  valorTon:row.valor_ton,status:row.status,criadoPor:row.criado_por,
  criadoEm:row.criado_em,atualizadoEm:row.atualizado_em};
}

export async function tenantFreights(request,db,principal,modules){
 const pathname=new URL(request.url).pathname;
 if(!allowedModule(modules,"fretes")&&!allowedModule(modules,"fretes2"))
  return errorResponse("Modulo de fretes indisponivel para sua transportadora.",403);
 if(request.method==="GET"&&pathname==="/api/fretes"){
  const rows=await db.prepare(`SELECT id,origem,destino,produto,valor_ton,status,criado_por,criado_em,atualizado_em
    FROM portal_tenant_freights WHERE tenant_id=? ORDER BY criado_em DESC,id DESC LIMIT 250`)
   .bind(principal.tenant_id).all();
  return success({fretes:(rows.results||[]).map(formatFreight)});
 }
 if(!WRITER_ROLES.has(principal.role))
  return errorResponse("Seu perfil nao pode alterar fretes.",403);
 if(request.method==="POST"&&pathname==="/api/fretes"){
  let body;
  try{body=await jsonBody(request);}catch{return errorResponse("Dados invalidos.",400);}
  if(Object.keys(body).some(k=>!FIELDS.has(k)))
   return errorResponse("Campos nao permitidos.",400);
  const origem=clean(body.origem),destino=clean(body.destino),produto=clean(body.produto,60);
  const valor=body.valorTon;
  if(!origem||!destino||!produto||typeof valor!=="number"||
     !Number.isFinite(valor)||valor<=0||valor>100000)
   return errorResponse("Origem, destino, produto e valor por tonelada sao obrigatorios.",400);
  const id=crypto.randomUUID();
  await db.batch([
   db.prepare(`INSERT INTO portal_tenant_freights
     (id,tenant_id,origem,destino,produto,valor_ton,status,criado_por)
     VALUES (?,?,?,?,?,?,'aberto',?)`)
    .bind(id,principal.tenant_id,origem,destino,produto,valor,principal.user_id),
   db.prepare("INSERT INTO portal_tenant_audit(id,actor_id,tenant_id,action,detail_json) VALUES(?,?,?,?,?)")
    .bind(crypto.randomUUID(),principal.user_id,principal.tenant_id,"freight.create",
      JSON.stringify({freteId:id}))
  ]);
  return success({frete:{id,origem,destino,produto,valorTon:valor,status:"aberto"}},201);
 }
 const match=pathname.match(/^\/api\/fretes\/([a-f0-9-]{36})$/);
 if(request.method==="PATCH"&&match){
  let body;
  try{body=await jsonBody(request);}catch{return errorResponse("Dados invalidos.",400);}
  if(Object.keys(body).length!==1 || !Object.hasOwn(body,"status") || !STATUSES.has(body.status))
   return errorResponse("Status invalido.",400);
  const row=await db.prepare("SELECT id FROM portal_tenant_freights WHERE tenant_id=? AND id=?")
   .bind(principal.tenant_id,match[1]).first();
  if(!row)return errorResponse("Frete nao encontrado.",404);
  await db.batch([
   db.prepare("UPDATE portal_tenant_freights SET status=?,atualizado_em=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?")
    .bind(body.status,principal.tenant_id,match[1]),
   db.prepare("INSERT INTO portal_tenant_audit(id,actor_id,tenant_id,action,detail_json) VALUES(?,?,?,?,?)")
    .bind(crypto.randomUUID(),principal.user_id,principal.tenant_id,"freight.status",
      JSON.stringify({freteId:match[1],status:body.status}))
  ]);
  return success({id:match[1],status:body.status});
 }
 return errorResponse("Rota de frete inexistente.",404);
}
export async function tenantBi(db,principal,modules){
 if(!allowedModule(modules,"bi"))return errorResponse("Modulo BI indisponivel.",403);
 const row=await db.prepare(`SELECT COUNT(*) AS total,
   SUM(CASE WHEN status='aberto' THEN 1 ELSE 0 END) AS abertos,
   SUM(CASE WHEN status='finalizado' THEN 1 ELSE 0 END) AS finalizados
   FROM portal_tenant_freights WHERE tenant_id=?`)
  .bind(principal.tenant_id).first();
 return success({total:Number(row?.total||0),abertos:Number(row?.abertos||0),
  finalizados:Number(row?.finalizados||0)});
}
