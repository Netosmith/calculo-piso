import { errorResponse, success } from "../utils/response.js";

const BASE="/v1/super-admin/monitor/viagens";
const VALID_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BATCH=10;
const MAX_POSITIONS=50000;
const PAGE_SIZE=1000;
const stamp=()=>new Date().toISOString();

function respondDbError(e,at){
  console.error("[SUPER-ADMIN-MONITOR]",at,String(e?.message||e));
  return errorResponse("Falha na gestão das viagens. Nenhuma nova exclusão deve ser presumida.",503);
}
async function all(db,sql,...args){
  return (await db.prepare(sql).bind(...args).all()).results||[];
}
async function tripSnapshot(db,id) {
  const trip=await db.prepare(
    "SELECT id,plate,driver,origin,destination,created_by,created_at,updated_at,active,token_expires_at,lat,lng,accuracy,last_position_at "+
    "FROM monitor_trips WHERE id=?"
  ).bind(id).first();
  if(!trip)return null;
  const extras=await db.prepare("SELECT branch FROM monitor_trip_extras WHERE trip_id=?").bind(id).first();
  const proof=await db.prepare("SELECT * FROM monitor_trip_proofs WHERE trip_id=?").bind(id).first();
  const document=await db.prepare("SELECT * FROM monitor_trip_documents WHERE trip_id=?").bind(id).first();
  const notes=await all(db,"SELECT * FROM monitor_proof_audit WHERE trip_id=? ORDER BY id ASC",id);
  const revisions=await all(db,"SELECT * FROM monitor_trip_documents_audit WHERE trip_id=? ORDER BY id ASC",id);
  const positions=[];
  let cursor=0;
  while(true){
    const page=await all(db,
      "SELECT id,lat,lng,accuracy,recorded_at FROM monitor_positions WHERE trip_id=? AND id>? ORDER BY id ASC LIMIT ?",
      id,cursor,PAGE_SIZE);
    positions.push(...page);
    if(positions.length>MAX_POSITIONS)throw new Error("historico-excede-limite");
    if(page.length<PAGE_SIZE)break;
    cursor=page[page.length-1].id;
  }
  const nativePositions=await all(db,
    "SELECT id,lat,lng,accuracy,captured_at,received_at,platform FROM monitor_native_positions WHERE trip_id=? ORDER BY captured_at ASC",id);
  return {trip,branch:extras?.branch||"",proof,document,notes,revisions,positions,nativePositions};
}
async function copyProofs(store,snapshot,prefix){
  const files={};
  for(const kind of ["selfie","receipt"]){
    const key=snapshot.proof?.[kind+"_key"];
    if(!key)continue;
    const item=await store.get(key);
    if(!item||!item.body)throw Error("arquivo-original-indisponivel");
    const target=prefix+"/"+kind;
    await store.put(target,item.body,{
      httpMetadata:{contentType:snapshot.proof?.[kind+"_mime"]||"application/octet-stream",
        cacheControl:"private, no-store"},
      customMetadata:{archivedAt:stamp(),kind}
    });
    files[kind]={backupKey:target,originalKey:key};
  }
  return files;
}
async function archiveAndDelete(env,id,actor,reason){
  const db=env.FLEET_DB,store=env.FLEET_FILES;
  const snapshot=await tripSnapshot(db,id);
  if(!snapshot)return {error:"Viagem não encontrada.",id};
  const auditId=crypto.randomUUID(),time=stamp();
  const prefix="monitor/nova-frota/archive/"+id+"/"+auditId;
  const files=await copyProofs(store,snapshot,prefix);
  const archiveKey=prefix+"/backup.json";
  const backup={
    version:1,archivedAt:time,archivedBy:actor,reason,
    ...snapshot,files:Object.fromEntries(
      Object.entries(files).map(([kind,value])=>[kind,{backupKey:value.backupKey}]))
  };
  await store.put(archiveKey,JSON.stringify(backup),{
    httpMetadata:{contentType:"application/json; charset=utf-8",
      cacheControl:"private, no-store"},
    customMetadata:{kind:"nova-frota-trip-backup",trip:id,deletedBy:actor}
  });
  // D1 batch is transactional: a failed statement leaves trip and children intact.
  const statements=[
    db.prepare("INSERT INTO monitor_trip_deletion_audit "+
      "(id,trip_id,plate,driver,was_active,actor,reason,backup_key,positions_count,deleted_at) "+
      "SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM monitor_trips WHERE id=?)")
      .bind(auditId,id,snapshot.trip.plate,snapshot.trip.driver,
        snapshot.trip.active===1?1:0,actor,reason,archiveKey,(snapshot.positions.length+snapshot.nativePositions.length),time,id),
    db.prepare("DELETE FROM monitor_positions WHERE trip_id=?").bind(id),
    db.prepare("DELETE FROM monitor_native_positions WHERE trip_id=?").bind(id),
    db.prepare("DELETE FROM monitor_proof_audit WHERE trip_id=?").bind(id),
    db.prepare("DELETE FROM monitor_trip_documents_audit WHERE trip_id=?").bind(id),
    db.prepare("DELETE FROM monitor_trip_documents WHERE trip_id=?").bind(id),
    db.prepare("DELETE FROM monitor_trip_proofs WHERE trip_id=?").bind(id),
    db.prepare("DELETE FROM monitor_trip_extras WHERE trip_id=?").bind(id),
    db.prepare("DELETE FROM monitor_trips WHERE id=?").bind(id)
  ];
  const changes=await db.batch(statements);
  if(changes[changes.length-1]?.meta?.changes!==1)
    return {error:"A viagem já foi excluída por outra sessão.",id};
  const cleanFailures=[];
  for(const item of Object.values(files)){
    try{await store.delete(item.originalKey);}
    catch(e){cleanFailures.push("documento original");
      console.error("[SUPER-ADMIN-MONITOR] Falha ao limpar origem",String(e?.message||e));}
  }
  return {id,plate:snapshot.trip.plate,archiveId:auditId,backupKey:archiveKey,
    positionsCount:snapshot.positions.length+snapshot.nativePositions.length,
    warning:cleanFailures.length?"Cópia de origem não removida; backup privado foi preservado.":null};
}

/** Owner authentication / action-header enforcement is performed by superAdminController. */
export async function superAdminMonitorDeletion(request,env,actor){
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(!env.FLEET_DB)return errorResponse("Banco Nova Frota indisponível.",503);
  const db=env.FLEET_DB;
  if(path===BASE&&method==="GET"){
    try{
      const q=url.searchParams.get("q")?.trim().slice(0,70)||"";
      const rawOffset=Number(url.searchParams.get("offset")||0);
      if(!Number.isInteger(rawOffset)||rawOffset<0||rawOffset>100000)
        return errorResponse("Paginação inválida.",400);
      const status=url.searchParams.get("status")||"all";
      if(!["all","active","closed"].includes(status))return errorResponse("Filtro inválido.",400);
      const like="%"+q.toUpperCase()+"%";
      const rows=await all(db,
        "SELECT t.id,t.plate,t.driver,t.origin,t.destination,t.created_at,t.updated_at,t.active,t.last_position_at, "+
        "COALESCE(e.branch,'') AS branch,COALESCE(d.nf,'') AS nf,COALESCE(d.cte,'') AS cte "+
        "FROM monitor_trips t LEFT JOIN monitor_trip_extras e ON e.trip_id=t.id "+
        "LEFT JOIN monitor_trip_documents d ON d.trip_id=t.id "+
        "WHERE (?='all' OR (?='active' AND t.active=1) OR (?='closed' AND t.active=0)) AND "+
        "(?='' OR UPPER(t.plate) LIKE ? OR UPPER(t.driver) LIKE ? OR "+
        "UPPER(COALESCE(e.branch,'')) LIKE ? OR UPPER(t.origin) LIKE ? OR "+
        "UPPER(t.destination) LIKE ? OR UPPER(COALESCE(d.nf,'')) LIKE ? OR "+
        "UPPER(COALESCE(d.cte,'')) LIKE ?) "+
        "ORDER BY t.created_at DESC,t.id DESC LIMIT 101 OFFSET ?",
        status,status,status,q,like,like,like,like,like,like,like,rawOffset);
      const page=rows.slice(0,100);
      return success({trips:page.map(t=>({id:t.id,plate:t.plate,driver:t.driver,branch:t.branch,
          origin:t.origin,destination:t.destination,active:t.active===1,
          createdAt:t.created_at,lastPositionAt:t.last_position_at,nf:t.nf,cte:t.cte})),
        nextOffset:rows.length>100?rawOffset+100:null,
        limit:100});
    }catch(e){return respondDbError(e,"list");}
  }
  if(path===BASE+"/auditoria"&&method==="GET"){
    try{
      const rows=await all(db,
        "SELECT id,trip_id,plate,driver,was_active,actor,reason,positions_count,deleted_at "+
        "FROM monitor_trip_deletion_audit ORDER BY deleted_at DESC LIMIT 100");
      return success({audits:rows.map(t=>({
        id:t.id,tripId:t.trip_id,plate:t.plate,driver:t.driver,activeAtDeletion:t.was_active===1,
        actor:t.actor,reason:t.reason,positionsCount:t.positions_count,deletedAt:t.deleted_at
      }))});
    }catch(e){return respondDbError(e,"audit");}
  }
  const backupMatch=path.match(/^\/v1\/super-admin\/monitor\/viagens\/auditoria\/([a-f0-9-]{36})\/backup$/);
  if(backupMatch&&method==="GET"){
    if(!env.FLEET_FILES)return errorResponse("Backup privado indisponível.",503);
    try{
      const row=await db.prepare("SELECT backup_key,plate FROM monitor_trip_deletion_audit WHERE id=?")
        .bind(backupMatch[1]).first();
      if(!row)return errorResponse("Arquivo de auditoria não encontrado.",404);
      const obj=await env.FLEET_FILES.get(row.backup_key);
      if(!obj?.body)return errorResponse("Backup indisponível.",503);
      return new Response(obj.body,{headers:{
        "Content-Type":"application/json; charset=utf-8",
        "Content-Disposition":'attachment; filename="viagem-'+row.plate+'-backup.json"',
        "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
        "Content-Security-Policy":"sandbox"
      }});
    }catch(e){return respondDbError(e,"backup");}
  }
  if(path===BASE+"/excluir"&&method==="POST"){
    if(!env.FLEET_FILES)return errorResponse("Armazenamento de backup indisponível. Exclusão bloqueada.",503);
    let body;
    try{
      const raw=await request.text();
      if(raw.length>5000) return errorResponse("Solicitação acima do limite.",413);
      body=JSON.parse(raw);
    }catch{return errorResponse("Solicitação inválida.",400);}
    const ids=body?.tripIds;
    const reason=typeof body?.reason==="string"?body.reason.trim():"";
    if(!Array.isArray(ids)||ids.length<1||ids.length>MAX_BATCH||
      ids.some(id=>typeof id!=="string"||!VALID_ID.test(id))||
      new Set(ids).size!==ids.length||body?.confirmation!=="EXCLUIR"||
      body?.backupAcknowledged!==true||reason.length<12||reason.length>300)
      return errorResponse("Selecione até 10 viagens e confirme EXCLUIR, o backup e a justificativa (12 a 300 caracteres).",400);
    const deleted=[];
    try{
      for(const id of ids){
        const result=await archiveAndDelete(env,id,actor,reason);
        if(result.error)return success({deleted,failed:{id,message:result.error},partial:deleted.length>0});
        deleted.push(result);
      }
      return success({deleted,partial:false,message:"Viagens removidas do monitoramento e backups privados preservados."});
    }catch(e){
      console.error("[SUPER-ADMIN-MONITOR] Exclusão interrompida",String(e?.message||e));
      return success({deleted,partial:true,
        failed:{message:"Falha no backup ou na exclusão. As viagens restantes não foram removidas."}});
    }
  }
  return errorResponse("Rota administrativa de viagens não encontrada.",404);
}
