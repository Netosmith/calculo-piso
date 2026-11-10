/* Localização nativa da viagem, inclusive com tela bloqueada.
   TaskManager deve ser registrado no escopo global (App.js importa este módulo).
   Captura somente após selfie + termo aceitos no servidor e autorização do celular.
   A fila local de coordenadas é cifrada com AES-256; a chave fica em SecureStore. */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import {Platform} from "react-native";
import {extractDriverToken} from "./driver-link";
export {extractDriverToken};

export const LOCATION_TASK="portalfrete-native-driver-trip-v2";
const TOKEN_KEY="pf_driver_trip_access_v2";
const CRYPTO_KEY="pf_driver_queue_aes_v2";
const API="https://api.portalfrete.net.br";
const SECURE_OPTIONS={keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY};
let databasePromise=null,keyPromise=null,operation=Promise.resolve();
const safeToken=value=>/^[a-f0-9]{64}$/i.test(String(value||""));
const serial=job=>{
  const next=operation.then(job);
  operation=next.catch(()=>{});
  return next;
};
async function database(){
  if(!databasePromise){
    databasePromise=SQLite.openDatabaseAsync("pf-native-positions-v2.db").then(async db=>{
      await db.execAsync("PRAGMA journal_mode = WAL; "+
        "CREATE TABLE IF NOT EXISTS fixes ("+
        "id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL, sealed BLOB NOT NULL, created_at TEXT NOT NULL); "+
        "CREATE INDEX IF NOT EXISTS idx_pf_fixes_trip ON fixes(trip_id,created_at);");
      return db;
    }).catch(e=>{databasePromise=null;throw e;});
  }
  return databasePromise;
}
async function aesKey(){
  if(!keyPromise){
    keyPromise=(async()=>{
      const encoded=await SecureStore.getItemAsync(CRYPTO_KEY);
      if(encoded)return Crypto.AESEncryptionKey.import(encoded,"hex");
      const db=await database();
      const existing=await db.getFirstAsync("SELECT COUNT(*) AS c FROM fixes");
      if(existing?.c>0)throw Error("Chave da fila indisponível. Dados de localização preservados; assistência necessária.");
      const newKey=await Crypto.AESEncryptionKey.generate();
      await SecureStore.setItemAsync(CRYPTO_KEY,await newKey.encoded("hex"),SECURE_OPTIONS);
      return newKey;
    })().catch(e=>{keyPromise=null;throw e;});
  }
  return keyPromise;
}
async function enqueue(fix){
  const db=await database(),key=await aesKey();
  const sealed=await Crypto.aesEncryptAsync(new TextEncoder().encode(JSON.stringify(fix)),key);
  const bytes=await sealed.combined();
  await db.runAsync("INSERT OR IGNORE INTO fixes (id,trip_id,sealed,created_at) VALUES (?,?,?,?)",
    fix.fixId,fix.tripId,bytes,fix.capturedAt);
}
async function decrypt(bytes){
  const key=await aesKey();
  const raw=await Crypto.aesDecryptAsync(Crypto.AESSealedData.fromCombined(bytes),key);
  return JSON.parse(new TextDecoder().decode(raw));
}
async function post(path,body){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),15000);
  try{
    const response=await fetch(API+path,{
      method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify(body),signal:ctrl.signal
    });
    const result=await response.json().catch(()=>({ok:false,error:"Resposta inválida."}));
    if(!response.ok||result.ok!==true){
      const error=new Error(result.error||"Falha no envio da localização.");
      error.status=response.status;
      throw error;
    }
    return result;
  }finally{clearTimeout(timer);}
}
async function currentToken(){return SecureStore.getItemAsync(TOKEN_KEY);}
async function stopNative({clearCredentials=false}={}){
  if(await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)){
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  if(clearCredentials){
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    // Ao revogar ou encerrar, não conservar coordenadas privadas inutilizáveis.
    const db=await database();
    await db.runAsync("DELETE FROM fixes");
    await SecureStore.deleteItemAsync(CRYPTO_KEY);
    keyPromise=null;
  }
}
export async function getDriverTrip(token){
  if(!safeToken(token))throw Error("Link da viagem inválido.");
  const data=await post("/v1/monitor/driver",{token});
  return data.trip;
}
function eligible(trip){
  return !!(trip?.active&&trip?.gpsConsentAt&&!trip?.gpsFinishedAt&&
    (!trip.selfieRequired||["pending","approved"].includes(trip.selfieStatus)));
}
export function isDriverTripReady(trip){return eligible(trip);}
export async function pendingFixCount(){
  const db=await database();
  return (await db.getFirstAsync("SELECT COUNT(*) AS c FROM fixes"))?.c||0;
}
async function flushInternal(){
  const token=await currentToken();
  if(!safeToken(token))return {sent:0};
  const db=await database();
  // Corrige backlog fora da janela aceita pelo Worker; evita travar a fila.
  await db.runAsync("DELETE FROM fixes WHERE created_at<?",
    new Date(Date.now()-72*3600000).toISOString());
  let sent=0;
  for(let n=0;n<100;n++){
    const row=await db.getFirstAsync("SELECT id,sealed FROM fixes ORDER BY created_at,id LIMIT 1");
    if(!row)break;
    const fix=await decrypt(row.sealed);
    try{
      await post("/v1/monitor/mobile/position",{
        token,fixId:fix.fixId,platform:fix.platform,
        latitude:fix.latitude,longitude:fix.longitude,
        accuracy:fix.accuracy,capturedAt:fix.capturedAt
      });
      await db.runAsync("DELETE FROM fixes WHERE id=?",row.id);
      sent++;
    }catch(e){
      if(e.status===404||e.status===409){
        // Nunca continua a transmitir após viagem encerrada/revogada.
        await stopNative({clearCredentials:true});
      }
      // A fila permanece cifrada quando não foi confirmada pela API.
      return {sent,error:e.message,status:e.status||0};
    }
  }
  return {sent};
}
export const flushPendingFixes=()=>serial(flushInternal);
async function collectFixes(locations){
  const token=await currentToken();
  if(!safeToken(token))return;
  const trip=await getDriverTrip(token).catch(()=>null);
  // Não transmitir sem consentimento: falha de rede mantém a coleta já autorizada,
  // mas não autoriza uma viagem nova.
  if(trip&&!eligible(trip)){
    await stopNative({clearCredentials:true});
    return;
  }
  for(const pos of locations||[]){
    const c=pos?.coords,at=Number(pos?.timestamp);
    if(!c||![c.latitude,c.longitude,c.accuracy].every(Number.isFinite)||!Number.isFinite(at))continue;
    if(c.latitude < -90||c.latitude>90||c.longitude < -180||c.longitude>180||
       c.accuracy<0||c.accuracy>10000||Date.now()-at>72*3600000)continue;
    await enqueue({
      fixId:Crypto.randomUUID(),tripId:trip?.id||"offline",
      platform:Platform.OS==="ios"?"ios":"android",
      latitude:c.latitude,longitude:c.longitude,accuracy:c.accuracy,
      capturedAt:new Date(at).toISOString()
    });
  }
  await flushInternal();
}
TaskManager.defineTask(LOCATION_TASK,async({data,error})=>{
  if(error)return;
  return serial(()=>collectFixes(data?.locations||[]));
});
export async function startDriverTracking(token){
  if(!safeToken(token))throw Error("Link da viagem inválido.");
  const trip=await getDriverTrip(token);
  if(!eligible(trip))throw Error("Antes de ativar, envie a selfie e aceite o termo na página da viagem.");
  const active=await currentToken();
  if(active&&active!==token)throw Error("Já existe outra viagem neste dispositivo. Finalize ou desvincule a anterior.");
  if(!await Location.hasServicesEnabledAsync())throw Error("Ative a localização nas configurações do celular.");
  const foreground=await Location.requestForegroundPermissionsAsync();
  if(foreground.status!=="granted")throw Error("Autorize o GPS para acompanhar a viagem.");
  const background=await Location.requestBackgroundPermissionsAsync();
  if(background.status!=="granted")throw Error("Selecione a opção de localização em segundo plano nas configurações.");
  await aesKey();
  await SecureStore.setItemAsync(TOKEN_KEY,token,SECURE_OPTIONS);
  try{
    if(!await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)){
      await Location.startLocationUpdatesAsync(LOCATION_TASK,{
        accuracy:Location.Accuracy.High,
        distanceInterval:40,
        timeInterval:25000,
        deferredUpdatesInterval:25000,
        pausesUpdatesAutomatically:false,
        showsBackgroundLocationIndicator:true,
        foregroundService:{
          killServiceOnDestroy:false,
          notificationTitle:"Portal Frete • Viagem em monitoramento",
          notificationBody:"Sua posição está sendo compartilhada durante a viagem autorizada.",
          notificationColor:"#0b3c5d"
        }
      });
    }
    const first=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High})
      .catch(()=>null);
    if(first)await serial(()=>collectFixes([first]));
    return trip;
  }catch(e){
    if(!await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    throw e;
  }
}
// Quando o aplicativo volta ao primeiro plano, recupera a sessão consentida
// sem pedir novamente o início; nunca recria uma permissão revogada.
export async function restoreApprovedTracking(){
  const token=await currentToken();
  if(!safeToken(token))return {token:null,restored:false};
  const trip=await getDriverTrip(token);
  if(!eligible(trip)){
    await stopNative({clearCredentials:true});
    return {token:null,restored:false};
  }
  let restored=false;
  if(!await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)){
    const fg=await Location.getForegroundPermissionsAsync();
    const bg=await Location.getBackgroundPermissionsAsync();
    if(fg.status==="granted"&&bg.status==="granted"){
      await startDriverTracking(token);
      restored=true;
    }
  }
  return {token,trip,restored};
}
export async function driverTrackingStatus(){
  const token=await currentToken();
  const running=await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  const queued=await pendingFixCount();
  if(!token||!running)return {running:false,queued,trip:null};
  const trip=await getDriverTrip(token).catch(()=>null);
  if(trip&&!eligible(trip)){
    await stopNative({clearCredentials:true});
    return {running:false,queued,trip};
  }
  return {running:true,queued,trip};
}
// Finalização documental NÃO é revogação voluntária de GPS.
export async function stopAfterApprovedDriverStage(token){
  if(!safeToken(token))return;
  if((await currentToken())===token)
    await stopNative({clearCredentials:true});
}
export async function revokeDriverTracking(){
  const token=await currentToken();
  await stopNative({clearCredentials:true});
  if(token){
    try{await post("/v1/monitor/gps-event",{token,action:"stopped"});}
    catch{/* Central marcará perda de sinal se a revogação ocorrer offline. */}
  }
}
