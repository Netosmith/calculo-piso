import {LEGACY_NOVA_FROTA,tenantIdForLegacySession} from "../config/transportadoras.js";
import {getSession,readSessionId} from "../services/session.js";
import {hasModulePin} from "../services/module-pin.js";
import {isNovaFrotaModuleEnabled} from "../services/nova-frota-modules.js";
import {errorResponse,success} from "../utils/response.js";
import {parseCommissionSetting,calculateCommission} from "../services/rh-commissions.js";

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
const tonnesValid=value=>typeof value==="number"&&Number.isSafeInteger(value)&&
 value>=0&&value<=1000000000;
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
  if(!await hasModulePin(req,env,"funcionarios"))
    return {error:errorResponse("Informe a senha de Funcionários para liberar este módulo.",403)};
  return {session};
}
const toEmployee=e=>({
  id:e.id,name:e.name,role:e.role,city:e.city,branch:e.branch,
  salaryCents:Number(e.salary_cents),notes:e.notes,active:Boolean(e.active),
  valesCents:Number(e.vales_cents||0),costsCents:Number(e.costs_cents||0),
  commissionKind:String(e.commission_kind||"NONE"),
  commissionRate:Number(e.commission_rate||0),
  commissionsCents:0,
  createdAt:e.created_at,updatedAt:e.updated_at
});
const toEntry=e=>({
 id:e.id,employeeId:e.employee_id,employeeName:e.employee_name,
 kind:e.kind,description:e.description,amountCents:Number(e.amount_cents),
 date:e.date,createdAt:e.created_at,createdBy:e.created_by
});
const toCommission=c=>({
  id:c.id,employeeId:c.employee_id,employeeName:c.employee_name,
  kind:c.kind,rateValue:Number(c.rate_value),
  tonnesMilli:Number(c.tonnes_milli||0),
  freightCentsPerTon:Number(c.freight_cents_per_ton||0),
  amountCents:Number(c.amount_cents),
  date:c.date,description:c.description||"",
  createdAt:c.created_at,createdBy:c.created_by
});
export async function employeesController(req,env){
  const access=await authorize(req,env);
  if(access.error)return access.error;
  try{
   if(!await isNovaFrotaModuleEnabled(env,"funcionarios"))
    return errorResponse("Funcionários desativado pelo Super Admin.",403);
  }catch{return errorResponse("Permissão global indisponível.",503);}
  const db=env.FLEET_DB;
  if(!db)return errorResponse("Banco privado de funcionários indisponível.",503);
  const url=new URL(req.url);
  const path=url.pathname.replace(/\/+$/,"");
  const method=req.method;
  const part=path.split("/").filter(Boolean).slice(2);
  const resource=part[0]||"",id=part[1]||"";
  const actor=txt(access.session.usuario,100);
  try{
    // O volume mensal alimenta automaticamente as comissões da tabela.
    if(method==="POST"&&resource==="volume"&&!id){
      const p=await bodyJSON(req),month=String(p.month||"");
      if(!monthOK(month)||!tonnesValid(p.tonnesMilli))
        return errorResponse("Informe competência AAAA-MM e toneladas válidas.",400);
      await db.prepare("INSERT INTO rh_monthly_volumes(month,tonnes_milli,updated_by,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(month) DO UPDATE SET tonnes_milli=excluded.tonnes_milli,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(month,p.tonnesMilli,actor).run();
      return success({month,tonnesMilli:p.tonnesMilli,applied:true});
    }
    if(method==="GET"&&path==="/v1/funcionarios"){
      const month=String(url.searchParams.get("month")||new Date().toISOString().slice(0,7));
      if(!monthOK(month))return errorResponse("Competência inválida. Use AAAA-MM.",400);
      const [year,m]=month.split("-").map(Number);
      const first=month+"-01",next=new Date(Date.UTC(year,m,1)).toISOString().slice(0,10);
      const [people,launches,commissionRows,monthlyVolume]=await Promise.all([
        db.prepare("SELECT e.*,COALESCE(s.kind,'NONE') AS commission_kind,COALESCE(s.rate_value,0) AS commission_rate,COALESCE(SUM(CASE WHEN l.kind='VALE' THEN l.amount_cents ELSE 0 END),0) AS vales_cents,COALESCE(SUM(CASE WHEN l.kind='CUSTO' THEN l.amount_cents ELSE 0 END),0) AS costs_cents FROM rh_employees e LEFT JOIN rh_commission_settings s ON s.employee_id=e.id LEFT JOIN rh_entries l ON l.employee_id=e.id AND l.deleted_at IS NULL AND l.date>=? AND l.date<? GROUP BY e.id ORDER BY e.active DESC,e.name COLLATE NOCASE ASC LIMIT 3000")
        .bind(first,next).all(),
        db.prepare("SELECT l.id,l.employee_id,e.name AS employee_name,l.kind,l.description,l.amount_cents,l.date,l.created_at,l.created_by FROM rh_entries l JOIN rh_employees e ON e.id=l.employee_id WHERE l.deleted_at IS NULL AND l.date>=? AND l.date<? ORDER BY l.date DESC,l.created_at DESC LIMIT 5000").bind(first,next).all(),
        db.prepare("SELECT c.id,c.employee_id,e.name AS employee_name,c.kind,c.rate_value,c.tonnes_milli,c.freight_cents_per_ton,c.amount_cents,c.description,c.date,c.created_at,c.created_by FROM rh_commissions c JOIN rh_employees e ON e.id=c.employee_id WHERE c.voided_at IS NULL AND c.date>=? AND c.date<? ORDER BY c.date DESC,c.created_at DESC LIMIT 5000").bind(first,next).all(),
        db.prepare("SELECT tonnes_milli,updated_by,updated_at FROM rh_monthly_volumes WHERE month=?").bind(month).first()
      ]);
      const employees=(people.results||[]).map(toEmployee),entries=(launches.results||[]).map(toEntry);
      const commissions=(commissionRows.results||[]).map(toCommission);
      const employeeById=new Map(employees.map(e=>[e.id,e]));
      // A comissão gravada anteriormente continua no histórico. Quando o volume
      // mensal é informado, TON e PERCENT são recalculados uma única vez
      // automaticamente. Manual e Agência permanecem por lançamentos gravados.
      for(const record of commissions){
        const owner=employeeById.get(record.employeeId);
        if(owner && (!monthlyVolume || ["MANUAL","AGENCIA"].includes(record.kind)))
          owner.commissionsCents+=record.amountCents;
      }
      if(monthlyVolume){
        for(const person of employees){
          if(!["TON","PERCENT"].includes(person.commissionKind))continue;
          const t=Number(monthlyVolume.tonnes_milli);
          // Volumes muito pequenos podem produzir menos de R$ 0,01;
          // nesse caso a comissão mensal é zero, não um erro na API.
          const estimated=person.commissionKind==="TON"
            ?Math.round(t*person.commissionRate/1000)
            :Math.round(t*person.commissionRate/100000);
          person.commissionsCents=estimated>0?calculateCommission(
            {kind:person.commissionKind,rateValue:person.commissionRate},
            {tonnesMilli:t,freightCentsPerTon:0,manualAmountCents:0}
          ).amountCents:0;
        }
      }
      const active=employees.filter(x=>x.active);
      const totals={
        active:active.length,registered:employees.length,
        salaryCents:active.reduce((s,x)=>s+x.salaryCents,0),
        valesCents:active.reduce((s,x)=>s+x.valesCents,0),
        costsCents:active.reduce((s,x)=>s+x.costsCents,0),
        commissionsCents:active.reduce((sum,x)=>sum+x.commissionsCents,0)
      };
      return success({month,employees,entries,commissions,totals,
        monthlyVolume:monthlyVolume?{
          tonnesMilli:Number(monthlyVolume.tonnes_milli),
          updatedAt:String(monthlyVolume.updated_at||""),
          updatedBy:String(monthlyVolume.updated_by||"")
        }:null,
        complete:(people.results||[]).length<3000&&(launches.results||[]).length<5000&&(commissionRows.results||[]).length<5000});
    }
    if(resource==="people"){
      if(method==="POST"&&!id){
        const p=await bodyJSON(req),name=txt(p.name),role=txt(p.role,100),city=txt(p.city,100),
          branch=txt(p.branch,100),notes=txt(p.notes,800),salary=cents(p.salaryCents,true);
        if(name.length<2||!role||!branch||salary===null)
          return errorResponse("Preencha nome, função, filial e salário válido.",400);
        const setting=parseCommissionSetting(p);
        const employeeId=crypto.randomUUID();
        await db.batch([
          db.prepare("INSERT INTO rh_employees(id,name,role,city,branch,salary_cents,notes,active,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(employeeId,name,role,city,branch,salary,notes,1,actor,actor),
          db.prepare("INSERT INTO rh_commission_settings(employee_id,kind,rate_value,updated_by) VALUES(?,?,?,?)").bind(employeeId,setting.kind,setting.rateValue,actor)
        ]);
        return success({id:employeeId},201);
      }
      if(method==="PUT"&&uuid(id)){
        const p=await bodyJSON(req),name=txt(p.name),role=txt(p.role,100),city=txt(p.city,100),
          branch=txt(p.branch,100),notes=txt(p.notes,800),salary=cents(p.salaryCents,true);
        if(name.length<2||!role||!branch||salary===null||typeof p.active!=="boolean")
          return errorResponse("Dados do funcionário inválidos.",400);
        // Clientes antigos sem campo de comissão conservam a configuração atual.
        const commands=[
          db.prepare("UPDATE rh_employees SET name=?,role=?,city=?,branch=?,salary_cents=?,notes=?,active=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
            .bind(name,role,city,branch,salary,notes,p.active?1:0,actor,id)
        ];
        if(p.commissionKind!==undefined){
          const setting=parseCommissionSetting(p);
          commands.push(db.prepare("INSERT INTO rh_commission_settings(employee_id,kind,rate_value,updated_by,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(employee_id) DO UPDATE SET kind=excluded.kind,rate_value=excluded.rate_value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
            .bind(id,setting.kind,setting.rateValue,actor));
        }
        const results=await db.batch(commands);
        return results[0]?.meta?.changes?success({id}):errorResponse("Funcionário não encontrado.",404);
      }
      return errorResponse("Método não permitido.",405);
    }
    if(resource==="commissions"){
      if(method==="POST"&&!id){
        const p=await bodyJSON(req);
        const employeeId=String(p.employeeId||"");
        const date=String(p.date||"");
        const description=txt(p.description,320);
        if(!uuid(employeeId)||!dateOK(date))
          return errorResponse("Informe funcionário e data válidos.",400);
        const owner=await db.prepare("SELECT e.id,e.active,COALESCE(s.kind,'NONE') AS commission_kind,COALESCE(s.rate_value,0) AS commission_rate FROM rh_employees e LEFT JOIN rh_commission_settings s ON s.employee_id=e.id WHERE e.id=?").bind(employeeId).first();
        if(!owner||!owner.active)return errorResponse("Funcionário não encontrado ou inativo.",400);
        const calculated=calculateCommission(
          {kind:owner.commission_kind,rateValue:Number(owner.commission_rate)},
          {tonnesMilli:p.tonnesMilli??0,freightCentsPerTon:p.freightCentsPerTon??0,manualAmountCents:p.manualAmountCents??0}
        );
        const commissionId=crypto.randomUUID();
        await db.prepare("INSERT INTO rh_commissions(id,employee_id,date,kind,rate_value,tonnes_milli,freight_cents_per_ton,amount_cents,description,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)")
          .bind(commissionId,employeeId,date,calculated.kind,calculated.rateValue,
            calculated.tonnesMilli,calculated.freightCentsPerTon,
            calculated.amountCents,description,actor).run();
        return success({id:commissionId,commission:calculated},201);
      }
      if(method==="DELETE"&&uuid(id)){
        const result=await db.prepare("UPDATE rh_commissions SET voided_at=CURRENT_TIMESTAMP,voided_by=? WHERE id=? AND voided_at IS NULL")
          .bind(actor,id).run();
        return result.meta?.changes?success({deleted:true}):errorResponse("Comissão não encontrada.",404);
      }
      return errorResponse("Método não permitido.",405);
    }
    if(resource==="entries"){
      if(method==="POST"&&!id){
        const p=await bodyJSON(req),employeeId=String(p.employeeId||""),
          kind=String(p.kind||"").toUpperCase(),description=txt(p.description,320),
          amount=cents(p.amountCents,false),date=String(p.date||"");
        if(!uuid(employeeId)||kind!=="VALE"||description.length<3||
           amount===null||!dateOK(date))return errorResponse("Informe funcionário, vale, descrição, valor e data válidos.",400);
        const owner=await db.prepare("SELECT id,active FROM rh_employees WHERE id=?").bind(employeeId).first();
        if(!owner||!owner.active)return errorResponse("Funcionário inexistente ou inativo.",400);
        const entryId=crypto.randomUUID();
        await db.prepare("INSERT INTO rh_entries(id,employee_id,kind,description,amount_cents,date,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?)").bind(entryId,employeeId,kind,description,amount,date,actor,actor).run();
        return success({id:entryId},201);
      }
      if(method==="PUT"&&uuid(id)){
        const p=await bodyJSON(req),kind=String(p.kind||"").toUpperCase(),
          description=txt(p.description,320),amount=cents(p.amountCents,false),date=String(p.date||"");
        if(kind!=="VALE"||description.length<3||amount===null||!dateOK(date))
          return errorResponse("Somente vales podem ser alterados neste módulo.",400);
        const result=await db.prepare("UPDATE rh_entries SET kind=?,description=?,amount_cents=?,date=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL AND kind='VALE'")
          .bind(kind,description,amount,date,actor,id).run();
        return result.meta?.changes?success({id}):errorResponse("Lançamento não encontrado.",404);
      }
      if(method==="DELETE"&&uuid(id)){
        const result=await db.prepare("UPDATE rh_entries SET deleted_at=CURRENT_TIMESTAMP,deleted_by=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL AND kind='VALE'")
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
