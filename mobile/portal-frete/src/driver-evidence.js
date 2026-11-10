import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {File} from "expo-file-system";
import {fetch as expoFetch} from "expo/fetch";
import * as SecureStore from "expo-secure-store";
import {extractDriverToken} from "./driver-link";

const API="https://api.portalfrete.net.br";
const PROOF_TRIP_KEY="nf:driver:proof-trip:v1";
const MIMES=new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
const MAX={selfie:3*1024*1024,receipt:8*1024*1024};
const cleanToken=value=>{
  const token=extractDriverToken(value);
  if(!token)throw Error("Link de viagem inválido. Confira o link recebido da Nova Frota.");
  return token;
};
export async function rememberDriverJourney(value){
  const token=cleanToken(value);
  await SecureStore.setItemAsync(PROOF_TRIP_KEY,token);
  return token;
}
export async function restoreDriverJourney(){
  const token=await SecureStore.getItemAsync(PROOF_TRIP_KEY);
  return extractDriverToken(token)||null;
}
export async function forgetDriverJourney(){
  await SecureStore.deleteItemAsync(PROOF_TRIP_KEY);
}
export async function acceptDriverTripTerm(value){
  const token=cleanToken(value);
  const r=await fetch(API+"/v1/monitor/consent",{
    method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify({token,accepted:true,version:"gps-viagem-v1"})
  });
  const data=await r.json().catch(()=>null);
  if(!r.ok||!data?.ok)throw Error(data?.error||"Não foi possível registrar o aceite do termo.");
  return data;
}
export async function finishDriverJourneyStage(value){
  const token=cleanToken(value);
  const r=await fetch(API+"/v1/monitor/gps-event",{
    method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify({token,action:"finished"})
  });
  const data=await r.json().catch(()=>null);
  if(!r.ok||!data?.ok)throw Error(data?.error||"Não foi possível registrar a finalização.");
  return data;
}
const fromImage=result=>{
  if(result.canceled||!result.assets?.length)return null;
  const a=result.assets[0];
  return {uri:a.uri,name:a.fileName||"foto.jpg",mimeType:a.mimeType||"image/jpeg",size:a.fileSize||null,
    isImage:true};
};
async function camera(face){
  const permission=await ImagePicker.requestCameraPermissionsAsync();
  if(!permission.granted)throw Error("Autorize a câmera para tirar a foto.");
  return fromImage(await ImagePicker.launchCameraAsync({
    mediaTypes:["images"],cameraType:face,quality:.68,allowsEditing:false
  }));
}
export async function takeDriverSelfie(){
  return camera(ImagePicker.CameraType.front);
}
export async function takeDriverReceiptPhoto(){
  return camera(ImagePicker.CameraType.back);
}
export async function chooseDriverReceiptPhoto(){
  return fromImage(await ImagePicker.launchImageLibraryAsync({
    mediaTypes:["images"],quality:.68,allowsEditing:false
  }));
}
export async function chooseDriverReceiptDocument(){
  const result=await DocumentPicker.getDocumentAsync({
    type:["application/pdf","image/jpeg","image/png","image/webp"],
    multiple:false,copyToCacheDirectory:true
  });
  if(result.canceled||!result.assets?.length)return null;
  const a=result.assets[0];
  return {uri:a.uri,name:a.name||"comprovante.pdf",
    mimeType:a.mimeType||"",size:a.size||null,
    isImage:String(a.mimeType||"").startsWith("image/")};
}
export function validateDriverEvidence(kind,item,size){
  if(!["selfie","receipt"].includes(kind))throw Error("Documento inválido.");
  if(!item?.uri||!/^file:\/\//.test(item.uri))throw Error("Arquivo local indisponível. Selecione novamente.");
  const mime=String(item.mimeType||"").toLowerCase().split(";")[0];
  if(!MIMES.has(mime)||kind==="selfie"&&!mime.startsWith("image/"))
    throw Error("Arquivo não suportado. Envie JPG, PNG ou WEBP"+(kind==="receipt"?" ou PDF.":"."));
  if(!Number.isFinite(size)||size<=0||size>MAX[kind])
    throw Error("Arquivo inválido ou maior que "+(MAX[kind]/1048576)+" MB. Tente uma foto mais leve.");
  return mime;
}
export async function uploadDriverEvidence(value,kind,item){
  const token=cleanToken(value);
  const file=new File(item.uri);
  const mime=validateDriverEvidence(kind,item,file.size);
  // A API de monitoramento recebe bytes crus, não multipart/form-data.
  // Expo fetch envia o arquivo binário sem expor o token na URL.
  const response=await expoFetch(API+"/v1/monitor/"+kind,{
    method:"POST",
    headers:{"X-Monitor-Token":token,"Content-Type":mime,"Accept":"application/json"},
    body:file
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.ok)
    throw Error(data?.error||"Não foi possível enviar o documento. Confira a conexão.");
  return data;
}
