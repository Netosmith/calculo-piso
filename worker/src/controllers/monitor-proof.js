import { errorResponse, success } from "../utils/response.js";

const FILE_TYPES = new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
const IMAGE_TYPES = new Set(["image/jpeg","image/png","image/webp"]);
const MAX_BYTES = { selfie: 3 * 1024 * 1024, receipt: 8 * 1024 * 1024 };
const validToken = v => /^[a-f0-9]{64}$/.test(String(v || ""));
const validId = v => /^[a-f0-9-]{36}$/.test(String(v || ""));
const time = () => new Date().toISOString();
const short = (v, n=250) => String(v??"").trim().slice(0,n);

async function digest(bytes) {
  const d=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(d),n=>n.toString(16).padStart(2,"0")).join("");
}
function signature(mime, arrayBuffer){
  const b=new Uint8Array(arrayBuffer);
  if(mime==="image/jpeg")return b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255;
  if(mime==="image/png")return b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v);
  if(mime==="image/webp")return b.length>=12&&
    [82,73,70,70].every((v,i)=>b[i]===v)&&[87,69,66,80].every((v,i)=>b[i+8]===v);
  if(mime==="application/pdf")return b.length>=5&&[37,80,68,70,45].every((v,i)=>b[i]===v);
  return false;
}
function failDB(e,at){
  console.error("[MONITOR-PROOF]",at,String(e?.message||e));
  return errorResponse("Falha no registro de comprovantes.",503,{stage:at});
}
async function tokenTrip(db,token){
  if(!validToken(token))return null;
  const hash=await digest(new TextEncoder().encode(token));
  return db.prepare(
    "SELECT t.id,t.active,t.token_expires_at,COALESCE(p.proof_required,0) AS proof_required,p.selfie_status,p.selfie_key,p.receipt_status,p.receipt_key "+
    "FROM monitor_trips t LEFT JOIN monitor_trip_proofs p ON p.trip_id=t.id WHERE t.token_hash=? AND t.token_expires_at>?"
  ).bind(hash,time()).first();
}

/** Motorista com link válido pode enviar apenas seus próprios documentos. */
export async function monitorDriverUpload(request,env,kind){
  if(!["selfie","receipt"].includes(kind))return errorResponse("Tipo de arquivo inválido.",400);
  if(!env.FLEET_DB||!env.FLEET_FILES)return errorResponse("Arquivos do monitoramento indisponíveis.",503);
  const token=request.headers.get("X-Monitor-Token");
  let trip;
  try{trip=await tokenTrip(env.FLEET_DB,token);}catch(e){return failDB(e,"token-read");}
  if(!trip)return errorResponse("Link de viagem inválido ou expirado.",404);
  if(trip.active!==1)return errorResponse("Viagem encerrada.",409);
  if(kind==="receipt"&&trip.proof_required===1&&!trip.selfie_key)
    return errorResponse("Envie a selfie de abertura antes do comprovante.",409);
  if(trip[kind+"_status"]==="approved")
    return errorResponse("Documento já aprovado. Procure a Nova Frota se precisar corrigir.",409);
  const mime=short(request.headers.get("Content-Type"),100).split(";")[0].toLowerCase();
  if(!FILE_TYPES.has(mime)||(kind==="selfie"&&!IMAGE_TYPES.has(mime)))
    return errorResponse(kind==="selfie"?"Envie uma foto JPG, PNG ou WEBP.":"Envie PDF, JPG, PNG ou WEBP.",415);
  const limit=MAX_BYTES[kind];
  const announced=Number(request.headers.get("Content-Length")||0);
  if(announced>limit)return errorResponse("Arquivo acima do limite de "+(limit/1048576)+" MB.",413);
  let bytes;
  try{bytes=await request.arrayBuffer();}catch{return errorResponse("Não foi possível ler o arquivo.",400);}
  if(!bytes.byteLength||bytes.byteLength>limit)
    return errorResponse("Arquivo vazio ou acima do limite de "+(limit/1048576)+" MB.",413);
  if(!signature(mime,bytes))return errorResponse("Assinatura do arquivo não corresponde ao formato informado.",415);
  const hash=await digest(bytes),key="monitor/nova-frota/"+trip.id+"/"+kind+"/"+crypto.randomUUID();
  const oldKey=trip[kind+"_key"];
  const sql=kind==="selfie"?
    "INSERT INTO monitor_trip_proofs (trip_id,proof_required,selfie_key,selfie_sha256,selfie_mime,selfie_at,selfie_status) VALUES (?,?,?,?,?,?,'pending') "+
    "ON CONFLICT(trip_id) DO UPDATE SET selfie_key=excluded.selfie_key,selfie_sha256=excluded.selfie_sha256,selfie_mime=excluded.selfie_mime,selfie_at=excluded.selfie_at,selfie_status='pending',selfie_reviewed_by=NULL,selfie_reviewed_at=NULL,selfie_review_note=NULL":
    "INSERT INTO monitor_trip_proofs (trip_id,proof_required,receipt_key,receipt_sha256,receipt_mime,receipt_at,receipt_status) VALUES (?,?,?,?,?,?,'pending') "+
    "ON CONFLICT(trip_id) DO UPDATE SET receipt_key=excluded.receipt_key,receipt_sha256=excluded.receipt_sha256,receipt_mime=excluded.receipt_mime,receipt_at=excluded.receipt_at,receipt_status='pending',receipt_reviewed_by=NULL,receipt_reviewed_at=NULL,receipt_review_note=NULL";
  try{
    await env.FLEET_FILES.put(key,bytes,{
      httpMetadata:{contentType:mime,cacheControl:"private, no-store"},
      customMetadata:{type:kind,trip:trip.id,sha256:hash,receivedAt:time()}
    });
    await env.FLEET_DB.batch([
      env.FLEET_DB.prepare(sql).bind(trip.id,Number(trip.proof_required||0),key,hash,mime,time()),
      env.FLEET_DB.prepare("INSERT INTO monitor_proof_audit (trip_id,proof_kind,action,actor,created_at) VALUES (?,?,?,'MOTORISTA',?)")
        .bind(trip.id,kind,"submitted",time())
    ]);
    if(oldKey&&oldKey!==key)await env.FLEET_FILES.delete(oldKey).catch(()=>{});
    return success({kind,status:"pending",sha256:hash,
      message:kind==="selfie"?"Selfie enviada para conferência da Nova Frota.":"Comprovante enviado e aguardando análise da Nova Frota."});
  }catch(e){
    await env.FLEET_FILES.delete(key).catch(()=>{});
    return failDB(e,"upload-write");
  }
}

const proofFields={
  selfie:{key:"selfie_key",mime:"selfie_mime",status:"selfie_status"},
  receipt:{key:"receipt_key",mime:"receipt_mime",status:"receipt_status"}
};
/** Chamado somente depois de validar sessão Nova Frota no monitorController. */
export async function monitorManagerProof(request,env,tripId,kind,action,session){
  if(!validId(tripId)||!proofFields[kind])return errorResponse("Documento inválido.",400);
  const role=short(session?.perfil,35).toUpperCase();
  if(role!=="ADMINISTRADOR"&&role!=="OPERACIONAL")
    return errorResponse("A conferência exige perfil ADMINISTRADOR ou OPERACIONAL.",403);
  if(!env.FLEET_DB)return errorResponse("Banco do monitoramento indisponível.",503);
  const f=proofFields[kind],db=env.FLEET_DB;
  try{
    const p=await db.prepare("SELECT * FROM monitor_trip_proofs WHERE trip_id=?").bind(tripId).first();
    if(!p||!p[f.key])return errorResponse("Arquivo ainda não enviado.",404);
    if(action==="download"&&request.method==="GET"){
      if(!env.FLEET_FILES)return errorResponse("Armazenamento indisponível.",503);
      const obj=await env.FLEET_FILES.get(p[f.key]);
      if(!obj||!obj.body)return errorResponse("Arquivo não encontrado.",404);
      const mime=p[f.mime]||"application/octet-stream";
      const ext={ "image/jpeg":".jpg","image/png":".png","image/webp":".webp","application/pdf":".pdf"}[mime]||".bin";
      return new Response(obj.body,{status:200,headers:{
        "Content-Type":mime,"Content-Disposition":'attachment; filename="'+kind+"-"+tripId+ext+'"',
        "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
        "Content-Security-Policy":"sandbox","Referrer-Policy":"no-referrer"
      }});
    }
    if(action==="review"&&request.method==="POST"){
      const body=await request.json().catch(()=>null);
      const decision=short(body?.decision,20);
      if(!["approved","rejected"].includes(decision))return errorResponse("Escolha aprovado ou rejeitado.",400);
      const note=short(body?.note,500);
      if(decision==="rejected"&&note.length<5)
        return errorResponse("Informe o motivo da rejeição, com pelo menos cinco caracteres.",400);
      const actor=short(session.usuario,100), reviewedAt=time();
      const prefix=kind==="selfie"?"selfie":"receipt";
      const sql="UPDATE monitor_trip_proofs SET "+prefix+"_status=?, "+prefix+
        "_reviewed_by=?, "+prefix+"_reviewed_at=?, "+prefix+"_review_note=? WHERE trip_id=?";
      await db.batch([
        db.prepare(sql).bind(decision,actor,reviewedAt,note,tripId),
        db.prepare("INSERT INTO monitor_proof_audit (trip_id,proof_kind,action,actor,note,created_at) VALUES (?,?,?,?,?,?)")
          .bind(tripId,kind,decision,actor,note,reviewedAt)
      ]);
      return success({kind,status:decision,reviewedAt,reviewedBy:actor});
    }
    return errorResponse("Operação não permitida.",405);
  }catch(e){return failDB(e,"manager-"+action);}
}
