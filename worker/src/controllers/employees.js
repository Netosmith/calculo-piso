import {LEGACY_NOVA_FROTA,tenantIdForLegacySession} from "../config/transportadoras.js";
import {getSession,readSessionId} from "../services/session.js";
import {errorResponse,success} from "../utils/response.js";

// RH exclusivo Nova Frota. Valores em centavos inteiros. Sem endpoints públicos.
const MONEY_MAX=100000000000;
const txt=(v,max=160)=>String(v??"").replace(/[\u0000-\u001F\u007F]/g," ").trim().slice(0,max);
const uuid=v=>/^[a-f0-9-]{36}$/i.test(String(v??""));
const monthOK=v=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(String(v??""));
const dateOK=v=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||"")))return false;
  const [year,month,day]=String(v).split("-").map(Number);
  const d=new Date(Date.UTC(year,month-1,day));
  return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day;
};
const cents=(value,allowZero)=>typeof value==="number"&&Number.isSafeInteger(value)&&
  value>=(allowZero?0:1)&&value<=MONEY_MAX?value:null;
async function bodyJSON(request){
  if(Number(request.headers.get("Content-Length")||0)>6000)throw Error("Dados acima do limite.");
  const raw=await request.text();
  if(raw.length>6000)throw Error("Dados acima do limite.");
  const value=JSON.parse(raw);
  if(!value||Array.isArray(value)||typeof value!=="object")throw Error("Dados inválidos.");
  return value;
}
async function authorize(req,env){
  const session=await getSession(env,readSessionId(req));
  if(!session)return {error:errorResponse("Faça login no Portal Frete.",401)};
  if(session.tenantMode===true||tenantIdForLegacySession(session)!==LEGACY_NOVA_FROTA.id)
    return {error:errorResponse("Recurso exclusivo da Nova Frota.",403)};
  if(String(session.perfil||"").trim().toUpperCase()!=="ADMINISTRADOR")
    return {error:errorResponse("Acesso restrito à administração da Nova Frota.",403)};
  return {session};
}
const toEmployee=e=>({
  id:e.id,name:e.name,role:e.role,city:e.city,branch:e.branch,
  salaryCents:Number(e.salary_cents),notes:e.notes,active:Boolean(e.active),
  valesCents:Number(e.vales_cents||0),costsCents:Number(e.costs_cents||0),
  createdAt:e.created_at,updatedAt:e.updated_at
});
const toEntry=e=>({
 id:e.id,employeeId:e.employee_id,employeeName:e.employee_name,
 kind:e.kind,description:e.description,amountCents:Number(e.amount_cents),
 date:e.date,createdAt:e.created_at,createdBy:e.created_by
});
export async function employeesController(req,env){
  const access=await authorize(req,env);
  if(access.error)return access.error;
  const db=env.FLEET_DB;
  if(!db)return errorResponse("Banco privado de funcionários indisponível.",503);
  const url=new URL(req.url);
  const path=url.pathname.replace(/\/+$/,"");
  const method=req.method;
  const part=path.split("/").filter(Boolean).slice(2);
  const resource=part[0]||"",id=part[1]||"";
  const actor=txt(access.session.usuario,100);
  try{
    if(method==="GET"&&path==="/v1/funcionarios"){
      const month=String(url.searchParams.get("month")||new Date().toISOString().slice(0,7));
      if(!monthOK(month))return errorResponse("Competência inválida. Use AAAA-MM.",400);
      const [year,m]=month.split("-").map(Number);
      const first=month+"-01",next=new Date(Date.UTC(year,m,1)).toISOString().slice(0,10);
      const [people,launches]=await Promise.all([
        db.prepare("SELECT e.*,COALESCE(SUM(CASE WHEN l.kind='VALE' THEN l.amount_cents ELSE 0 END),0) AS vales_cents,COALESCE(SUM(CASE WHEN l.kind='CUSTO' THEN l.amount_cents ELSE 0 END),0) AS costs_cents FROM rh_employees e LEFT JOIN rh_entries l ON l.employee_id=e.id AND l.deleted_at IS NULL AND l.date>=? AND l.date<? GROUP BY e.id ORDER BY e.active DESC,e.name COLLATE NOCASE ASC LIMIT 3000")
        .bind(first,next).all(),
        db.prepare("SELECT l.id,l.employee_id,e.name AS employee_name,l.kind,l.description,l.amount_cents,l.date,l.created_at,l.created_by FROM rh_entries l JOIN rh_employees e ON e.id=l.employee_id WHERE l.deleted_at IS NULL AND l.date>=? AND l.date<? ORDER BY l.date DESC,l.created_at DESC LIMIT 5000").bind(first,next).all()
      ]);
      const employees=(people.results||[]).map(toEmployee),entries=(launches.results||[]).map(toEntry);
      const active=employees.filter(x=>x.active);
      const totals={
        active:active.length,registered:employees.length,
        salaryCents:active.reduce((s,x)=>s+x.salaryCents,0),
        valesCents:active.reduce((s,x)=>s+x.valesCents,0),
        costsCents:active.reduce((s,x)=>s+x.costsCents,0)
      };
      return success({month,employees,entries,totals,complete:(people.results||[]).length<3000&&(launches.results||[]).length<5000});
    }
    if(resource==="people"){
      if(method==="POST"&&!id){
        const p=await bodyJSON(req),name=txt(p.name),role=txt(p.role,100),city=txt(p.city,100),
          branch=txt(p.branch,100),notes=txt(p.notes,800),salary=cents(p.salaryCents,true);
        if(name.length<2||!role||!city||!branch||salary===null)
          return errorResponse("Preencha nome, função, cidade, filial e salário válido.",400);
        const employeeId=crypto.randomUUID();
        await db.prepare("INSERT INTO rh_employees(id,name,role,city,branch,salary_cents,notes,active,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(employeeId,name,role,city,branch,salary,notes,1,actor,actor).run();
        return success({id:employeeId},201);
      }
      if(method==="PUT"&&uuid(id)){
        const p=await bodyJSON(req),name=txt(p.name),role=txt(p.role,100),city=txt(p.city,100),
          branch=txt(p.branch,100),notes=txt(p.notes,800),salary=cents(p.salaryCents,true);
        if(name.length<2||!role||!city||!branch||salary===null||typeof p.active!=="boolean")
          return errorResponse("Dados do funcionário inválidos.",400);
        const result=await db.prepare("UPDATE rh_employees SET name=?,role=?,city=?,branch=?,salary_cents=?,notes=?,active=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
          .bind(name,role,city,branch,salary,notes,p.active?1:0,actor,id).run();
        return result.meta?.changes?success({id}):errorResponse("Funcionário não encontrado.",404);
      }
      return errorResponse("Método não permitido.",405);
    }
    if(resource==="entries"){
      if(method==="POST"&&!id){
        const p=await bodyJSON(req),employeeId=String(p.employeeId||""),
          kind=String(p.kind||"").toUpperCase(),description=txt(p.description,320),
          amount=cents(p.amountCents,false),date=String(p.date||"");
        if(!uuid(employeeId)||!["VALE","CUSTO"].includes(kind)||description.length<3||
           amount===null||!dateOK(date))return errorResponse("Informe funcionário, tipo, descrição, valor e data válidos.",400);
        const owner=await db.prepare("SELECT id,active FROM rh_employees WHERE id=?").bind(employeeId).first();
        if(!owner||!owner.active)return errorResponse("Funcionário inexistente ou inativo.",400);
        const entryId=crypto.randomUUID();
        await db.prepare("INSERT INTO rh_entries(id,employee_id,kind,description,amount_cents,date,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?)").bind(entryId,employeeId,kind,description,amount,date,actor,actor).run();
        return success({id:entryId},201);
      }
      if(method==="PUT"&&uuid(id)){
        const p=await bodyJSON(req),kind=String(p.kind||"").toUpperCase(),
          description=txt(p.description,320),amount=cents(p.amountCents,false),date=String(p.date||"");
        if(!["VALE","CUSTO"].includes(kind)||description.length<3||amount===null||!dateOK(date))
          return errorResponse("Lançamento inválido.",400);
        const result=await db.prepare("UPDATE rh_entries SET kind=?,description=?,amount_cents=?,date=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL")
          .bind(kind,description,amount,date,actor,id).run();
        return result.meta?.changes?success({id}):errorResponse("Lançamento não encontrado.",404);
      }
      if(method==="DELETE"&&uuid(id)){
        const result=await db.prepare("UPDATE rh_entries SET deleted_at=CURRENT_TIMESTAMP,deleted_by=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL")
          .bind(actor,actor,id).run();
        return result.meta?.changes?success({deleted:true}):errorResponse("Lançamento não encontrado.",404);
      }
      return errorResponse("Método não permitido.",405);
    }
    return errorResponse("Recurso não encontrado.",404);
  }catch(error){
    console.error("[RH] Erro no módulo RH",String(error?.message||error).slice(0,180));
    return errorResponse("Não foi possível carregar ou salvar os dados de funcionários. Confira a implantação do banco D1.",503);
  }
}
