import { getSession, readSessionId } from "../services/session.js";
import { errorResponse, success } from "../utils/response.js";

const TYPES=new Set(['freight','expense','fuel','maintenance','commission']);
const DOCS=new Set(['cnh','cavalo','carreta','antt','endereco','fotoCaminhao','fotoMotorista','fotoMotoristaCNH','fotoMotoristaIndividual']);
const MAX_FILE=15*1024*1024;
const plate=x=>String(x||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7);
const profile=x=>String(x||'').toUpperCase().trim();
async function auth(request,env,write){
 const session=await getSession(env,readSessionId(request));
 if(!session)return {error:errorResponse('Sessão expirada ou inválida.',401)};
 const p=profile(session.perfil);
 if(!['ADMINISTRADOR','COMERCIAL'].includes(p))return {error:errorResponse('Perfil sem autorização para Gestão de Frota.',403)};
 if(write&&p!=='ADMINISTRADOR'&&p!=='COMERCIAL')return {error:errorResponse('Sem permissão de escrita.',403)};
 return {session};
}
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))&&!Number.isNaN(Date.parse(d+'T12:00:00Z'));
const uuid=x=>/^[a-zA-Z0-9_-]{6,100}$/.test(String(x||''));
function verifyFile(m,b){
 const x=new Uint8Array(b);
 if(m==='application/pdf')return x.length>=5&&String.fromCharCode(...x.slice(0,5))==='%PDF-';
 if(m==='image/jpeg')return x[0]===255&&x[1]===216&&x[2]===255;
 if(m==='image/png')return x[0]===137&&x[1]===80&&x[2]===78&&x[3]===71;
 if(m==='image/webp')return x.length>12&&String.fromCharCode(...x.slice(0,4))==='RIFF'&&String.fromCharCode(...x.slice(8,12))==='WEBP';
 return false;
}
const json=async request=>{const x=await request.json();if(!x||typeof x!=='object'||Array.isArray(x))throw Error('JSON inválido');return x};
export async function fleetController(request,env){
 const url=new URL(request.url),part=url.pathname.split('/').filter(Boolean).slice(2);
 const section=part[0],id=part[1],method=request.method;
 const authorization=await auth(request,env,method!=='GET');
 if(authorization.error)return authorization.error;
 if(!env.FLEET_DB)return errorResponse('Banco D1 da frota ainda não configurado.',503);
 if(!['records','sets','documents'].includes(section))return errorResponse('Recurso inexistente.',404);
 const db=env.FLEET_DB,actor=String(authorization.session.usuario||'').slice(0,100);
 try{
 if(section==='records'){
  if(method==='GET'&&!id){const res=await db.prepare('SELECT id,kind,plate,driver,date,data_json,created_at,updated_at FROM fleet_records ORDER BY date DESC,created_at DESC LIMIT 5000').all();return success({records:res.results.map(r=>({...JSON.parse(r.data_json),id:r.id,type:r.kind,plate:r.plate,driver:r.driver,date:r.date}))})}
  if(method==='POST'&&!id){const data=await json(request);if(!TYPES.has(data.type)||!validDate(data.date)||plate(data.plate).length!==7)return errorResponse('Tipo, placa ou data inválidos.',400);
   if(JSON.stringify(data).length>20000)return errorResponse('Registro muito grande.',413);
   const key=crypto.randomUUID();
   await db.prepare('INSERT INTO fleet_records(id,kind,plate,driver,date,data_json,created_by) VALUES(?,?,?,?,?,?,?)').bind(key,data.type,plate(data.plate),String(data.driver||'').slice(0,160),data.date,JSON.stringify({...data,id:key}),actor).run();return success({id:key},201)}
  if(method==='PUT'&&id){const data=await json(request);if(!TYPES.has(data.type)||!validDate(data.date)||plate(data.plate).length!==7)return errorResponse('Registro inválido.',400);
   if(JSON.stringify(data).length>20000)return errorResponse('Registro muito grande.',413);
   const result=await db.prepare('UPDATE fleet_records SET kind=?,plate=?,driver=?,date=?,data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(data.type,plate(data.plate),String(data.driver||'').slice(0,160),data.date,JSON.stringify({...data,id}),id).run();return result.meta.changes?success({id}):errorResponse('Registro não encontrado.',404)}
  if(method==='DELETE'&&id){const result=await db.prepare('DELETE FROM fleet_records WHERE id=?').bind(id).run();return result.meta.changes?success({deleted:true}):errorResponse('Registro não encontrado.',404)}
 }
 if(section==='sets'){
  if(method==='GET'&&!id){const res=await db.prepare('SELECT id,driver,phone,tractor,trailer,created_at,updated_at FROM fleet_sets ORDER BY driver').all();return success({sets:res.results})}
  if((method==='POST'&&!id)||(method==='PUT'&&id)){const v=await json(request);if(!String(v.driver||'').trim()||plate(v.tractor).length!==7||plate(v.trailer).length!==7)return errorResponse('Motorista ou placas inválidos.',400);
   if(method==='POST'){const key=crypto.randomUUID();await db.prepare('INSERT INTO fleet_sets(id,driver,phone,tractor,trailer,created_by) VALUES(?,?,?,?,?,?)').bind(key,String(v.driver).trim().slice(0,160),String(v.phone||'').slice(0,30),plate(v.tractor),plate(v.trailer),actor).run();return success({id:key},201)}
   const result=await db.prepare('UPDATE fleet_sets SET driver=?,phone=?,tractor=?,trailer=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(String(v.driver).trim().slice(0,160),String(v.phone||'').slice(0,30),plate(v.tractor),plate(v.trailer),id).run();return result.meta.changes?success({id}):errorResponse('Cadastro não encontrado.',404)}
  if(method==='DELETE'&&id){const docs=await db.prepare('SELECT object_key FROM fleet_documents WHERE set_id=?').bind(id).all();if(docs.results.length&&!env.FLEET_FILES)return errorResponse('Bucket privado não configurado.',503);
   for(const doc of docs.results)await env.FLEET_FILES.delete(doc.object_key);
   await db.prepare('DELETE FROM fleet_documents WHERE set_id=?').bind(id).run();
   const result=await db.prepare('DELETE FROM fleet_sets WHERE id=?').bind(id).run();return result.meta.changes?success({deleted:true}):errorResponse('Cadastro não encontrado.',404)}
 }
 if(section==='documents'){
  if(!env.FLEET_FILES)return errorResponse('Bucket R2 privado não configurado.',503);
  if(method==='GET'&&!id){const setId=url.searchParams.get('set_id');if(!uuid(setId))return errorResponse('Conjunto obrigatório.',400);const data=await db.prepare('SELECT id,set_id,doc_type,mime,filename,size,uploaded_at FROM fleet_documents WHERE set_id=?').bind(setId).all();return success({documents:data.results})}
  if(method==='GET'&&id){const doc=await db.prepare('SELECT * FROM fleet_documents WHERE id=?').bind(id).first();if(!doc)return errorResponse('Arquivo inexistente.',404);const obj=await env.FLEET_FILES.get(doc.object_key);if(!obj)return errorResponse('Arquivo não encontrado no bucket.',404);return new Response(obj.body,{headers:{'Content-Type':doc.mime,'Content-Disposition':'attachment; filename="documento-'+doc.doc_type+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
  if(method==='POST'&&!id){const setId=url.searchParams.get('set_id'),kind=url.searchParams.get('type');if(!uuid(setId)||!DOCS.has(kind))return errorResponse('Conjunto ou documento inválido.',400);const owner=await db.prepare('SELECT id FROM fleet_sets WHERE id=?').bind(setId).first();if(!owner)return errorResponse('Conjunto não encontrado.',404);
   const mime=String(request.headers.get('Content-Type')||'').split(';')[0].toLowerCase();if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(mime)||(kind.startsWith('foto')&&mime==='application/pdf'))return errorResponse('Formato não permitido.',415);
   if(Number(request.headers.get('Content-Length')||0)>MAX_FILE)return errorResponse('Arquivo excede 15 MB.',413);
   const buf=await request.arrayBuffer();if(buf.byteLength===0||buf.byteLength>MAX_FILE)return errorResponse('Tamanho inválido.',413);if(!verifyFile(mime,buf))return errorResponse('Assinatura do arquivo inválida.',415);
   const key='frota/'+setId+'/'+crypto.randomUUID(),docId=crypto.randomUUID();
   await env.FLEET_FILES.put(key,buf,{httpMetadata:{contentType:mime}});
   try{const old=await db.prepare('SELECT object_key FROM fleet_documents WHERE set_id=? AND doc_type=?').bind(setId,kind).first();
    await db.prepare('INSERT INTO fleet_documents(id,set_id,doc_type,object_key,mime,filename,size,uploaded_by) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(set_id,doc_type) DO UPDATE SET id=excluded.id,object_key=excluded.object_key,mime=excluded.mime,filename=excluded.filename,size=excluded.size,uploaded_by=excluded.uploaded_by,uploaded_at=CURRENT_TIMESTAMP').bind(docId,setId,kind,key,mime,kind,buf.byteLength,actor).run();
    if(old)await env.FLEET_FILES.delete(old.object_key);
   }catch(e){await env.FLEET_FILES.delete(key);throw e}
   return success({id:docId,type:kind,size:buf.byteLength},201)}
  if(method==='DELETE'&&id){const doc=await db.prepare('SELECT object_key FROM fleet_documents WHERE id=?').bind(id).first();if(!doc)return errorResponse('Arquivo não encontrado.',404);await env.FLEET_FILES.delete(doc.object_key);await db.prepare('DELETE FROM fleet_documents WHERE id=?').bind(id).run();return success({deleted:true})}
 }
 return errorResponse('Método não permitido.',405);
 }catch(e){console.error('fleet-api',String(e));return errorResponse('Falha ao processar dados da frota.',500)}
}