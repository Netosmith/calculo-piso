// Independent identity system for the isolated tenant Worker.
// No Nova Frota legacy session, Apps Script, KV or PORTAL_KEY is used.
const COOKIE="__Host-tenant_session";
const SESSION_SECONDS=6*60*60;
const ITERATIONS=210000;
const MAX_ATTEMPTS=8;
const WINDOW_SECONDS=15*60;
const encoder=new TextEncoder();
const userPattern=/^[A-Z0-9][A-Z0-9._-]{1,79}$/;
const tenantPattern=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const fakeSalt=new Uint8Array(16);

function bytesToB64(bytes){
 let value="";for(const b of bytes)value+=String.fromCharCode(b);
 return btoa(value).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function b64ToBytes(value){
 if(typeof value!=="string"||!value||!/^[A-Za-z0-9_-]+$/.test(value))throw Error("invalid base64");
 const s=value.replace(/-/g,"+").replace(/_/g,"/");
 return Uint8Array.from(atob(s.padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));
}
function randomBytes(count){const b=new Uint8Array(count);crypto.getRandomValues(b);return b;}
function hex(bytes){return [...bytes].map(v=>v.toString(16).padStart(2,"0")).join("");}
async function digest(value){
 return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(String(value)))));
}
async function derive(password,salt,iterations){
 const key=await crypto.subtle.importKey("raw",encoder.encode(password),{name:"PBKDF2"},false,["deriveBits"]);
 return new Uint8Array(await crypto.subtle.deriveBits({
  name:"PBKDF2",salt,iterations,hash:"SHA-256"
 },key,256));
}
function equalBytes(a,b){
 if(a.length!==b.length)return false;
 let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];
 return mismatch===0;
}
export function validTenantId(value){
 return typeof value==="string" && value.length>=3 && value.length<=48 &&
  value!=="nova-frota" && tenantPattern.test(value);
}
export function normalizeTenantUser(value){
 if(typeof value!=="string")return null;
 const normalized=value.trim().toUpperCase();
 return userPattern.test(normalized)?normalized:null;
}
export function validTenantPassword(value){
 return typeof value==="string" && value.length>=12 && value.length<=128 &&
  !/[\u0000-\u001f\u007f]/.test(value);
}
export async function makePasswordRecord(password){
 if(!validTenantPassword(password))throw new TypeError("invalid password");
 const salt=randomBytes(16);
 return {password_salt:bytesToB64(salt),password_hash:bytesToB64(await derive(password,salt,ITERATIONS)),
  iterations:ITERATIONS,version:crypto.randomUUID()};
}
export async function passwordMatches(password,record){
 try{
  if(typeof password!=="string"||password.length>128)return false;
  const salt=record?b64ToBytes(record.password_salt):fakeSalt;
  const hash=await derive(password,salt,record?.iterations||ITERATIONS);
  return record?equalBytes(hash,b64ToBytes(record.password_hash)):false;
 }catch{return false;}
}
export function hasTenantSessionCookie(req){
  return (req.headers.get("Cookie")||"").split(";").some(part=>part.trim().startsWith(COOKIE+"="));
}
function sessionToken(req){
 const all=req.headers.get("Cookie")||"";
 for(const item of all.split(";")){
  const [name,...parts]=item.trim().split("=");
  if(name===COOKIE)return parts.join("=").trim();
 }
 return "";
}
export function tenantSessionCookie(token){
 return COOKIE+"="+token+"; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age="+SESSION_SECONDS;
}
export function clearTenantSessionCookie(){
 return COOKIE+"=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0";
}
export async function createTenantSession(db,tenantId,userId,version){
 const token=bytesToB64(randomBytes(32));
 const hash=await digest(token);
 const expires=Math.floor(Date.now()/1000)+SESSION_SECONDS;
 await db.prepare("INSERT INTO portal_tenant_sessions(token_hash,tenant_id,user_id,credential_version,expires_at) VALUES (?,?,?,?,?)")
  .bind(hash,tenantId,userId,version,expires).run();
 return {token,expiresAt:expires};
}
export async function tenantSession(db,request){
 const token=sessionToken(request);
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
 const hash=await digest(token);
 const now=Math.floor(Date.now()/1000);
 const row=await db.prepare(`SELECT s.tenant_id,s.user_id,u.role,t.name AS tenant_name
  FROM portal_tenant_sessions s
  JOIN portal_tenant_users u ON u.tenant_id=s.tenant_id AND u.user_id=s.user_id
  JOIN portal_tenants t ON t.id=s.tenant_id
  JOIN portal_tenant_credentials c ON c.tenant_id=s.tenant_id AND c.user_id=s.user_id
  WHERE s.token_hash=? AND s.expires_at>? AND
    s.credential_version=c.version AND u.active=1 AND t.status='active'
  LIMIT 1`).bind(hash,now).first();
 return row||null;
}
export async function revokeTenantSession(db,request){
 const token=sessionToken(request);
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))return;
 await db.prepare("DELETE FROM portal_tenant_sessions WHERE token_hash=?")
  .bind(await digest(token)).run();
}
async function consumeAttempt(db,tenantId,userId){
 const now=Math.floor(Date.now()/1000);
 const key=await digest(tenantId+"|"+userId);
 const cutoff=now-WINDOW_SECONDS;
 await db.prepare(`INSERT INTO portal_tenant_login_attempts(attempt_key,attempts,window_start)
   VALUES (?,1,?)
   ON CONFLICT(attempt_key) DO UPDATE SET
    attempts=CASE WHEN window_start <= ? THEN 1 ELSE attempts+1 END,
    window_start=CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END`)
  .bind(key,now,cutoff,cutoff).run();
 const current=await db.prepare("SELECT attempts FROM portal_tenant_login_attempts WHERE attempt_key=?").bind(key).first();
 return {allowed:Number(current?.attempts)<=MAX_ATTEMPTS,key};
}
export async function authenticateTenant(db,tenantId,userId,password){
 if(!validTenantId(tenantId)||!normalizeTenantUser(userId)||normalizeTenantUser(userId)!==userId ||
    typeof password!=="string" || password.length>128)return {ok:false,status:401};
 const rate=await consumeAttempt(db,tenantId,userId);
 if(!rate.allowed)return {ok:false,status:429};
 const row=await db.prepare(`SELECT c.password_salt,c.password_hash,c.iterations,c.version
  FROM portal_tenant_credentials c
  JOIN portal_tenant_users u ON u.tenant_id=c.tenant_id AND u.user_id=c.user_id
  JOIN portal_tenants t ON t.id=c.tenant_id
  WHERE c.tenant_id=? AND c.user_id=? AND u.active=1 AND t.status='active'
  LIMIT 1`).bind(tenantId,userId).first();
 const matched=await passwordMatches(password,row);
 if(!matched)return {ok:false,status:401};
 const session=await createTenantSession(db,tenantId,userId,row.version);
 await db.prepare("DELETE FROM portal_tenant_login_attempts WHERE attempt_key=?").bind(rate.key).run();
 return {ok:true,session};
}
