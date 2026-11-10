import { LEGACY_NOVA_FROTA, tenantIdForLegacySession } from "../config/transportadoras.js";
import { getSession, readSessionId } from "../services/session.js";
import { errorResponse, success } from "../utils/response.js";
import { monitorDriverUpload, monitorManagerProof } from "./monitor-proof.js";

// O monitoramento legado continua exclusivo da Nova Frota.
const PROFILES = new Set(["ADMINISTRADOR", "COMERCIAL", "OPERACIONAL"]);
const LINK_DAYS = 7;
const HISTORY_PAGE_SIZE = 1000;
const clean = (v, n = 100) => String(v ?? "").trim().slice(0, n);
const plate = v => clean(v, 12).toUpperCase().replace(/[^A-Z0-9]/g, "");
const validToken = v => /^[a-f0-9]{64}$/.test(String(v || ""));
const validId = v => /^[a-f0-9-]{36}$/.test(String(v || ""));
const parse = async req => {
  try {
    const x = await req.json();
    return x && typeof x === "object" && !Array.isArray(x) ? x : null;
  } catch { return null; }
};
const now = () => new Date().toISOString();
const makeToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, "0")).join("");

async function hashToken(value) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, "0")).join("");
}
async function manager(req, env) {
  const session = await getSession(env, readSessionId(req));
  if (!session) return { error: errorResponse("Sessão inválida.", 401) };
  if (tenantIdForLegacySession(session) !== LEGACY_NOVA_FROTA.id)
    return { error: errorResponse("Monitoramento não provisionado para esta transportadora.", 403) };
  if (!PROFILES.has(clean(session.perfil).toUpperCase()))
    return { error: errorResponse("Sem permissão para Monitoramento.", 403) };
  return { session };
}
const toTrip = row => ({
  id: row.id, plate: row.plate, driver: row.driver, branch: row.branch || "",
  origin: row.origin, destination: row.destination,
  nf: row.nf || "", cte: row.cte || "",
  documentsUpdatedAt:row.documents_updated_at || null,
  startedAt:row.started_at || row.gps_consent_at || row.last_position_at || null,
  active: row.active === 1, createdAt: row.created_at, updatedAt: row.updated_at,
  linkExpiresAt: row.token_expires_at,
  selfieRequired: Number(row.proof_required||0)===1,
  selfieStatus: row.selfie_status||"missing", receiptStatus:row.receipt_status||"missing",
  selfieSubmittedAt:row.selfie_at||null,receiptSubmittedAt:row.receipt_at||null,
  gpsStoppedAt:row.gps_stopped_at||null,
  gpsConsentAt:row.gps_consent_at||null,
  gpsFinishedAt:row.gps_finished_at||null,
  lastPosition: row.last_position_at ? {
    lat: row.lat, lng: row.lng, accuracy: row.accuracy, at: row.last_position_at
  } : null
});
async function tripForToken(db, value) {
  if (!validToken(value)) return null;
  return db.prepare("SELECT t.*,COALESCE(p.proof_required,0) AS proof_required,p.selfie_key,p.selfie_status,p.receipt_key,p.receipt_status,p.selfie_at,p.receipt_at, "+
    "(SELECT a.created_at FROM monitor_proof_audit a WHERE a.trip_id=t.id AND a.proof_kind='gps' AND a.action='consent' ORDER BY a.id DESC LIMIT 1) AS gps_consent_at, "+
    "(SELECT a.created_at FROM monitor_proof_audit a WHERE a.trip_id=t.id AND a.proof_kind='gps' AND a.action='finished' ORDER BY a.id DESC LIMIT 1) AS gps_finished_at "+
    "FROM monitor_trips t LEFT JOIN monitor_trip_proofs p ON p.trip_id=t.id WHERE t.token_hash=? AND t.token_expires_at>?")
    .bind(await hashToken(value), now()).first();
}
function dbError(error, stage) {
  console.error("[MONITOR] " + stage, String(error?.message || error));
  return errorResponse("Falha no banco do monitoramento.", 503, { stage });
}

export async function monitorController(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;
  if (path === "/v1/monitor/health" && method === "GET") {
    if (!env.FLEET_DB) return errorResponse("Banco D1 indisponível.", 503, { stage: "db-binding" });
    try {
      const result = await env.FLEET_DB.prepare("SELECT 1 AS ok").first();
      return success({ storage: result?.ok === 1 ? "available" : "unavailable", database: "D1" });
    } catch (e) { return dbError(e, "db-health"); }
  }
  if (!env.FLEET_DB) return errorResponse("Banco D1 não configurado.", 503, { stage: "db-binding" });
  const db = env.FLEET_DB;

  // Uploads privados vinculados à viagem autenticada pelo token.
  if(path==="/v1/monitor/selfie"&&method==="POST")return monitorDriverUpload(request,env,"selfie");
  if(path==="/v1/monitor/receipt"&&method==="POST")return monitorDriverUpload(request,env,"receipt");

  // Acesso por token: apenas a viagem, nunca dados de outras viagens.
  if (path === "/v1/monitor/driver" && method === "POST") {
    const body = await parse(request);
    try {
      const row = await tripForToken(db, body?.token);
      if (!row) return errorResponse("Link inválido ou expirado.", 404);
      return success({ trip: toTrip(row) });
    } catch (e) { return dbError(e, "driver-read"); }
  }
  // O aceite do termo é registrado antes do início do monitoramento das novas viagens.
  if (path === "/v1/monitor/consent" && method === "POST") {
    const body = await parse(request);
    if (body?.accepted !== true || body?.version !== "gps-viagem-v1")
      return errorResponse("É necessário aceitar o termo de monitoramento da viagem.",400);
    try {
      const row=await tripForToken(db,body.token);
      if(!row)return errorResponse("Link inválido ou expirado.",404);
      if(row.active!==1)return errorResponse("Viagem encerrada.",409);
      if(Number(row.proof_required||0)===1&&!row.selfie_key)
        return errorResponse("Envie a selfie antes de aceitar o termo.",409);
      if(row.gps_finished_at)return errorResponse("Acompanhamento já concluído.",409);
      if(!row.gps_consent_at){
        await db.prepare(
          "INSERT INTO monitor_proof_audit (trip_id,proof_kind,action,actor,note,created_at) VALUES (?,'gps','consent','MOTORISTA',?,?)"
        ).bind(row.id,"Termo de rastreamento da viagem gps-viagem-v1 aceito; localização durante o percurso, encerramento normal após validação de documentos e possibilidade de revogação da permissão.",now()).run();
      }
      return success({accepted:true,version:"gps-viagem-v1",consentAt:row.gps_consent_at||now()});
    }catch(e){return dbError(e,"gps-consent");}
  }
  // Interrupção voluntária registra um alerta imediato, sem impedir a escolha do motorista.
  if (path === "/v1/monitor/gps-event" && method === "POST") {
    const body=await parse(request);
    if(!["stopped","finished"].includes(body?.action))return errorResponse("Evento GPS inválido.",400);
    try{
      const row=await tripForToken(db,body?.token);
      if(!row)return errorResponse("Link inválido ou expirado.",404);
      if(row.active!==1)return errorResponse("Viagem já encerrada.",409);
      if(body.action==="finished"){
        // TODAS as viagens, inclusive antigas, exigem comprovante anexado
        // e aprovado antes da conclusão normal desta etapa.
        const receiptApproved=Boolean(row.receipt_key)&&row.receipt_status==="approved";
        const selfieApproved=Number(row.proof_required||0)!==1||row.selfie_status==="approved";
        if(!receiptApproved||!selfieApproved)
          return errorResponse("Finalize a descarga, anexe o comprovante e aguarde a conferência e aprovação pela Nova Frota antes de concluir a viagem.",409);
        await db.prepare("INSERT INTO monitor_proof_audit (trip_id,proof_kind,action,actor,note,created_at) VALUES (?,'gps','finished','MOTORISTA','Finalização do compartilhamento após aprovação documental',?)").bind(row.id,now()).run();
        return success({recorded:true,tripActive:true,documentsApproved:true});
      }
      // Interrupção revogável, distinta de finalizar a viagem.
      const last=await db.prepare("SELECT created_at FROM monitor_proof_audit WHERE trip_id=? AND proof_kind='gps' AND action='stopped' ORDER BY id DESC LIMIT 1").bind(row.id).first();
      // Evita eventos repetidos se o motorista tocar várias vezes sem novas coordenadas.
      if(!last?.created_at||(row.last_position_at&&Date.parse(row.last_position_at)>Date.parse(last.created_at))){
        const source=body.platform==="android"?"aplicativo Android":
          body.platform==="ios"?"aplicativo iOS":"navegador";
        const pending=row.receipt_status==="approved"?"Comprovante aprovado":
          "Comprovante de descarga pendente de conferência";
        await db.prepare("INSERT INTO monitor_proof_audit (trip_id,proof_kind,action,actor,note,created_at) "+
          "VALUES (?,'gps','stopped','MOTORISTA',?,?)")
          .bind(row.id,"Localização interrompida voluntariamente no "+source+". "+pending+".",now()).run();
      }
      return success({recorded:true,tripActive:true,receiptRequired:row.receipt_status!=="approved",
        completionBlocked:row.receipt_status!=="approved"});
    }catch(e){return dbError(e,"gps-stop-event");}
  }
  // Posições do aplicativo nativo: timestamps originais, idempotência e
  // atualização da última posição apenas se a coleta for mais recente.
  if (path === "/v1/monitor/mobile/position" && method === "POST") {
    const body = await parse(request);
    const lat = body?.latitude, lng = body?.longitude, accuracy = body?.accuracy;
    const id = body?.fixId, captured = body?.capturedAt, platform = body?.platform;
    const stamp = typeof captured === "string" ? Date.parse(captured) : NaN;
    const age = Date.now() - stamp;
    if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
        typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180 ||
        typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 10000 ||
        typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id) ||
        !["android","ios"].includes(platform) || !Number.isFinite(stamp) ||
        age < -120000 || age > 72 * 3600000)
      return errorResponse("Posição nativa inválida ou fora da janela de sincronização.",400);
    try {
      const row = await tripForToken(db, body?.token);
      if (!row) return errorResponse("Link inválido ou expirado.",404);
      if (row.active !== 1 || row.gps_finished_at)
        return errorResponse("Viagem encerrada ou acompanhamento finalizado.",409);
      if (Number(row.proof_required||0)===1 && (!row.selfie_key || !row.gps_consent_at))
        return errorResponse("Selfie e aceite do termo são necessários para iniciar.",409);
      if (!row.gps_consent_at)
        return errorResponse("Aceite o termo da viagem antes de transmitir.",409);
      const capturedAt = new Date(stamp).toISOString(), receivedAt=now();
      const updates=await db.batch([
        db.prepare("INSERT OR IGNORE INTO monitor_native_positions "+
          "(id,trip_id,lat,lng,accuracy,captured_at,received_at,platform) VALUES (?,?,?,?,?,?,?,?)")
          .bind(id,row.id,lat,lng,accuracy,capturedAt,receivedAt,platform),
        db.prepare("UPDATE monitor_trips SET lat=?,lng=?,accuracy=?,last_position_at=?,updated_at=? "+
          "WHERE id=? AND active=1 AND (last_position_at IS NULL OR last_position_at<?)")
          .bind(lat,lng,accuracy,capturedAt,receivedAt,row.id,capturedAt)
      ]);
      return success({receivedAt,accepted:true,duplicate:updates[0]?.meta?.changes===0});
    }catch(e){return dbError(e,"mobile-position-write");}
  }
  if (path === "/v1/monitor/position" && method === "POST") {
    const body = await parse(request);
    const lat = Number(body?.latitude), lng = Number(body?.longitude), accuracy = Number(body?.accuracy);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
        !Number.isFinite(lng) || lng < -180 || lng > 180 ||
        !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000)
      return errorResponse("Coordenadas inválidas.", 400);
    try {
      const row = await tripForToken(db, body?.token);
      if (!row) return errorResponse("Link inválido ou expirado.", 404);
      if (row.active !== 1) return errorResponse("Viagem encerrada.", 409);
      if(Number(row.proof_required||0)===1&&!row.selfie_key)
        return errorResponse("Envie uma selfie para iniciar a viagem.",409);
      if(Number(row.proof_required||0)===1&&!row.gps_consent_at)
        return errorResponse("Aceite o termo de acompanhamento para iniciar a viagem.",409);
      if(row.gps_finished_at)return errorResponse("O compartilhamento já foi concluído.",409);
      const time = now();
      // O batch é atômico. Uma viagem encerrada não recebe novas posições.
      await db.batch([
        db.prepare("UPDATE monitor_trips SET lat=?,lng=?,accuracy=?,last_position_at=?,updated_at=? WHERE id=? AND active=1")
          .bind(lat, lng, accuracy, time, time, row.id),
        db.prepare("INSERT INTO monitor_positions (trip_id,lat,lng,accuracy,recorded_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM monitor_trips WHERE id=? AND active=1)")
          .bind(row.id, lat, lng, accuracy, time, row.id)
      ]);
      return success({ receivedAt: time });
    } catch (e) { return dbError(e, "position-write"); }
  }

  let auth;
  try { auth = await manager(request, env); } catch (e) { return dbError(e, "session"); }
  if (auth.error) return auth.error;

  if (path === "/v1/monitor/trips" && method === "GET") {
    try {
      const result = await db.prepare(
        "SELECT t.*, COALESCE(e.branch,'') AS branch,COALESCE(p.proof_required,0) AS proof_required,p.selfie_status,p.receipt_status,p.selfie_at,p.receipt_at, "+
        "COALESCE(d.nf,'') AS nf,COALESCE(d.cte,'') AS cte,d.updated_at AS documents_updated_at, "+
        "(SELECT a.created_at FROM monitor_proof_audit a WHERE a.trip_id=t.id AND a.proof_kind='gps' AND a.action='consent' ORDER BY a.id DESC LIMIT 1) AS started_at, "+
        "(SELECT a.created_at FROM monitor_proof_audit a WHERE a.trip_id=t.id AND a.proof_kind='gps' AND a.action='stopped' ORDER BY a.id DESC LIMIT 1) AS gps_stopped_at "+
        "FROM monitor_trips t LEFT JOIN monitor_trip_extras e ON e.trip_id=t.id LEFT JOIN monitor_trip_proofs p ON p.trip_id=t.id "+
        "LEFT JOIN monitor_trip_documents d ON d.trip_id=t.id ORDER BY t.active DESC,t.created_at DESC LIMIT 300"
      ).all();
      return success({ trips: (result.results || []).map(toTrip), complete: true,
        canReview:["ADMINISTRADOR","OPERACIONAL"].includes(clean(auth.session.perfil).toUpperCase()), canEmergency:clean(auth.session.perfil).toUpperCase()==="ADMINISTRADOR" });
    } catch (e) { return dbError(e, "trips-read"); }
  }
  if (path === "/v1/monitor/trips" && method === "POST") {
    const body = await parse(request), p = plate(body?.plate), driver = clean(body?.driver);
    if (p.length !== 7 || driver.length < 2) return errorResponse("Informe placa e motorista válidos.", 400);
    const access = makeToken(), tokenHash = await hashToken(access), time = now(), tripId = crypto.randomUUID();
    const expires = new Date(Date.now() + LINK_DAYS * 86400000).toISOString();
    const origin = clean(body?.origin), destination = clean(body?.destination),
      branch = clean(body?.branch, 60), actor = clean(auth.session.usuario);
    try {
      await db.batch([
        db.prepare("INSERT INTO monitor_trips (id,plate,driver,origin,destination,created_by,created_at,updated_at,active,token_hash,token_expires_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)")
          .bind(tripId, p, driver, origin, destination, actor, time, time, tokenHash, expires),
        db.prepare("INSERT INTO monitor_trip_extras (trip_id,branch) VALUES (?,?)").bind(tripId, branch),
        db.prepare("INSERT INTO monitor_trip_proofs (trip_id,proof_required) VALUES (?,1)").bind(tripId)
      ]);
      return success({
        trip: { id: tripId, plate: p, driver, origin, destination, branch, active: true,
          createdAt: time, updatedAt: time, linkExpiresAt: expires, lastPosition: null,
          selfieRequired:true,selfieStatus:"missing",receiptStatus:"missing" },
        token: access, linkExpiresDays: LINK_DAYS
      }, 201);
    } catch (e) { return dbError(e, "trip-create"); }
  }
  const parts = path.split("/").filter(Boolean);
  // Documentos fiscais são editados pelo operacional, somente depois da abertura da viagem.
  // O link do motorista nunca acessa esta rota: ela está depois da validação da sessão interna.
  if(parts.length===5&&parts[0]==="v1"&&parts[1]==="monitor"&&parts[2]==="trips"&&
     parts[4]==="documents"&&method==="PUT"){
    if(!validId(parts[3]))return errorResponse("Identificador da viagem inválido.",400);
    const body=await parse(request);
    if(!body||typeof body.nf!=="string"||typeof body.cte!=="string"||
       body.nf.length>200||body.cte.length>200||
       /[\x00-\x1f\x7f]/.test(body.nf)||/[\x00-\x1f\x7f]/.test(body.cte))
      return errorResponse("Informe NF e CT-e válidos (até 200 caracteres por campo).",400);
    const nf=body.nf.trim(),cte=body.cte.trim(),id=parts[3];
    try{
      const trip=await db.prepare("SELECT id,active,last_position_at FROM monitor_trips WHERE id=?").bind(id).first();
      if(!trip)return errorResponse("Viagem não encontrada.",404);
      if(trip.active!==1)return errorResponse("Uma viagem encerrada não pode ser editada.",409);
      const start=await db.prepare(
        "SELECT created_at FROM monitor_proof_audit WHERE trip_id=? AND proof_kind='gps' AND action='consent' ORDER BY id DESC LIMIT 1"
      ).bind(id).first();
      if(!start?.created_at&&!trip.last_position_at)
        return errorResponse("Inicie a viagem antes de editar NF e CT-e.",409);
      const previous=await db.prepare("SELECT nf,cte FROM monitor_trip_documents WHERE trip_id=?").bind(id).first();
      if((previous?.nf||"")===nf&&(previous?.cte||"")===cte)
        return success({nf,cte,unchanged:true});
      const time=now(),actor=clean(auth.session.usuario);
      await db.batch([
        db.prepare("INSERT INTO monitor_trip_documents (trip_id,nf,cte,updated_at,updated_by) VALUES (?,?,?,?,?) "+
          "ON CONFLICT(trip_id) DO UPDATE SET nf=excluded.nf,cte=excluded.cte,updated_at=excluded.updated_at,updated_by=excluded.updated_by")
          .bind(id,nf,cte,time,actor),
        db.prepare("INSERT INTO monitor_trip_documents_audit (trip_id,nf_before,nf_after,cte_before,cte_after,changed_by,changed_at) VALUES (?,?,?,?,?,?,?)")
          .bind(id,previous?.nf||"",nf,previous?.cte||"",cte,actor,time)
      ]);
      return success({nf,cte,documentsUpdatedAt:time});
    }catch(e){return dbError(e,"trip-documents-edit");}
  }

  if(parts.length===7&&parts[0]==="v1"&&parts[1]==="monitor"&&parts[2]==="trips"&&
    parts[4]==="proofs"&&["selfie","receipt"].includes(parts[5])&&
    ((parts[6]==="download"&&method==="GET")||(parts[6]==="review"&&method==="POST")))
    return monitorManagerProof(request,env,parts[3],parts[5],parts[6],auth.session);
  if (parts.length === 5 && parts[0] === "v1" && parts[1] === "monitor" &&
      parts[2] === "trips" && parts[4] === "positions" && method === "GET") {
    if (!validId(parts[3])) return errorResponse("Identificador inválido.", 400);
    const before = url.searchParams.get("before");
    if (before && (!Number.isFinite(Date.parse(before)) || before.length > 35))
      return errorResponse("Data de paginação inválida.", 400);
    try {
      const trip = await db.prepare("SELECT id FROM monitor_trips WHERE id=?").bind(parts[3]).first();
      if (!trip) return errorResponse("Viagem não encontrada.", 404);
      const common = "SELECT lat,lng,accuracy,recorded_at AS at FROM monitor_positions WHERE trip_id=? "+
        "UNION ALL SELECT lat,lng,accuracy,captured_at AS at FROM monitor_native_positions WHERE trip_id=?";
      const query = before
        ? db.prepare("SELECT * FROM ("+common+") WHERE at<? ORDER BY at DESC LIMIT ?").bind(parts[3],parts[3], before, HISTORY_PAGE_SIZE + 1)
        : db.prepare("SELECT * FROM ("+common+") ORDER BY at DESC LIMIT ?").bind(parts[3],parts[3], HISTORY_PAGE_SIZE + 1);
      const rows = (await query.all()).results || [];
      const hasMore = rows.length > HISTORY_PAGE_SIZE;
      const page = rows.slice(0, HISTORY_PAGE_SIZE);
      return success({
        points: page.reverse(), hasMore,
        nextBefore: hasMore && page.length ? page[0].at : null,
        scope: "nova-frota"
      });
    } catch (e) { return dbError(e, "positions-read"); }
  }
  if (parts.length === 5 && parts[0] === "v1" && parts[1] === "monitor" &&
      parts[2] === "trips" && parts[4] === "stop" && method === "POST") {
    if (!validId(parts[3])) return errorResponse("Identificador inválido.", 400);
    try {
      const doc=await db.prepare("SELECT proof_required,selfie_status,receipt_key,receipt_status FROM monitor_trip_proofs WHERE trip_id=?").bind(parts[3]).first();
      // Não permitir o encerramento normal sem comprovante real e conferido.
      // Para viagens novas, a selfie também precisa estar aprovada.
      const complete=Boolean(doc?.receipt_key)&&doc.receipt_status==="approved"&&
        (Number(doc.proof_required||0)!==1||doc.selfie_status==="approved");
      const body=await parse(request);
      const actorRole=clean(auth.session.perfil).toUpperCase();
      const reason=clean(body?.reason,500);
      // Encerramento excepcional continua exclusivo de ADMINISTRADOR e auditado,
      // nunca é uma alternativa de finalização para o motorista.
      const emergency=!complete&&actorRole==="ADMINISTRADOR"&&
        body?.emergency===true&&reason.length>=15;
      if(!complete&&!emergency)
        return errorResponse("Encerramento exige comprovante de descarga anexado e aprovado pela Nova Frota. Para viagens novas, selfie aprovada também. Apenas o administrador pode registrar emergência justificada.",409);
      const time=now();
      // Confirmação final em consulta atômica: não encerra se a aprovação
      // documental for revogada entre a leitura e a escrita.
      const normalSql="UPDATE monitor_trips SET active=0,updated_at=? WHERE id=? AND active=1 "+
        "AND EXISTS (SELECT 1 FROM monitor_trip_proofs p WHERE p.trip_id=monitor_trips.id "+
        "AND p.receipt_key IS NOT NULL AND p.receipt_key<>'' AND p.receipt_status='approved' "+
        "AND (COALESCE(p.proof_required,0)<>1 OR p.selfie_status='approved'))";
      const update=db.prepare(emergency
        ?"UPDATE monitor_trips SET active=0,updated_at=? WHERE id=? AND active=1"
        :normalSql).bind(time,parts[3]);
      let result;
      if(emergency){
        const audit=db.prepare("INSERT INTO monitor_proof_audit (trip_id,proof_kind,action,actor,note,created_at) "+
          "SELECT ?,'trip','emergency_stop',?,?,? WHERE EXISTS (SELECT 1 FROM monitor_trips WHERE id=? AND active=1)")
          .bind(parts[3],clean(auth.session.usuario),reason,time,parts[3]);
        const changes=await db.batch([audit,update]);
        // O batch transacional impede encerrar sem registrar o motivo excepcional.
        result=changes[1];
      }else result=await update.run();
      if (!result.meta?.changes) return errorResponse("Viagem não encontrada ou já encerrada.", 404);
      const row = await db.prepare(
        "SELECT t.*, COALESCE(e.branch,'') AS branch,COALESCE(p.proof_required,0) AS proof_required,p.selfie_status,p.receipt_status,p.selfie_at,p.receipt_at FROM monitor_trips t LEFT JOIN monitor_trip_extras e ON e.trip_id=t.id LEFT JOIN monitor_trip_proofs p ON p.trip_id=t.id WHERE t.id=?"
      ).bind(parts[3]).first();
      return success({ trip: toTrip(row) });
    } catch (e) { return dbError(e, "trip-stop"); }
  }
  return errorResponse("Rota de monitoramento não encontrada.", 404);
}
