import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {extractDriverToken} from "../src/driver-link.js";
const token="a".repeat(64);
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("vincula somente viagem oficial, não aceita link de outro domínio",()=>{
  assert.equal(extractDriverToken(token),token);
  assert.equal(extractDriverToken("https://portalfrete.net.br/pages/monitorar-motorista.html#"+token),token);
  assert.equal(extractDriverToken("portalfrete://viagem/"+token),token);
  assert.equal(extractDriverToken("https://evil.test/pages/monitorar-motorista.html#"+token),null);
  assert.equal(extractDriverToken("javascript:alert(1)"),null);
  assert.equal(extractDriverToken("https://portalfrete.net.br/pages/monitoramento.html#"+token),null);
});
test("tarefa é registrada no nível global e não transmite sem aceite prévio",()=>{
  const src=read("src/tracking.js");
  assert.ok(src.includes("TaskManager.defineTask(LOCATION_TASK"));
  assert.ok(src.includes("Location.startLocationUpdatesAsync(LOCATION_TASK"));
  assert.ok(src.includes("Location.requestBackgroundPermissionsAsync"));
  assert.ok(src.includes("Location.requestForegroundPermissionsAsync"));
  assert.ok(src.includes("!trip?.gpsFinishedAt"));
  assert.ok(src.includes("gpsConsentAt"));
  assert.ok(src.includes('"/v1/monitor/mobile/position"'));
  assert.ok(src.includes("aesEncryptAsync")&&src.includes("aesDecryptAsync"));
  assert.ok(src.includes("SecureStore.setItemAsync"));
  assert.ok(src.includes("foregroundService"));
  assert.ok(src.includes("killServiceOnDestroy:false"));
  assert.ok(src.includes("restoreApprovedTracking"));
  assert.ok(src.includes("stopLocationUpdatesAsync"));
});
test("APK exige permissões nativas e distingue motorista de funcionário",()=>{
  const app=JSON.parse(read("app.json")).expo;
  const shell=read("App.js");
  assert.equal(app.version,"0.3.5");
  assert.equal(app.android.versionCode,9);
  assert.ok(app.android.permissions.includes("RECEIVE_BOOT_COMPLETED"));
  assert.ok(app.android.permissions.includes("FOREGROUND_SERVICE_LOCATION"));
  assert.ok(app.plugins.some(x=>Array.isArray(x)&&x[0]==="expo-location"&&
    x[1].isIosBackgroundLocationEnabled&&x[1].isAndroidBackgroundLocationEnabled));
  assert.ok(shell.includes("SOU MOTORISTA"));
  assert.ok(shell.includes("SOU FUNCIONÁRIO"));
  assert.ok(shell.includes('screen==="driver"'));
  assert.ok(!shell.includes("ACCESS_BACKGROUND_LOCATION"));
});
test("motorista só ativa GPS depois de selfie e termo; fretes internos não são mostrados",()=>{
  const ui=read("src/DriverArea.js");
  assert.ok(ui.includes("isDriverTripReady"));
  assert.ok(ui.includes("startDriverTracking(token)"));
  assert.ok(ui.includes("revokeDriverTracking"));
  assert.match(ui,/Os dados operacionais internos não são exibidos/i);
});

test("documento de descarga aparece com estado de análise sem concluir a viagem",()=>{
  const area=read("src/DriverArea.js");
  assert.match(area,/Comprovante de descarga/);
  assert.match(area,/Aguardando conferência|aguardando conferência/);
  assert.match(area,/Atualizar status da conferência/);
  assert.match(area,/trip.receiptStatus==="approved"/);
  assert.match(area,/trip.receiptStatus==="rejected"/);
  assert.match(area,/Interromper somente o GPS/);
  assert.match(area,/NÃO finaliza a viagem/);
  assert.match(area,/revokeDriverTracking\(\)/);
});
test("versão 0.3.3 exibe locais, valor e etiquetas S/N dos eixos",()=>{
  const app=JSON.parse(read("app.json")).expo;
  assert.equal(app.version,"0.3.5");
  assert.equal(app.android.versionCode,9);
  const area=read("src/DriverArea.js");
  assert.match(area,/\/v1\/driver-freights/);
  assert.match(area,/Buscar origem, destino ou produto/);
  assert.match(area,/Falar com o embarcador no WhatsApp/);
  assert.match(area,/offer\.coleta/);
  assert.match(area,/offer\.descarga/);
  assert.match(area,/offerAmount:\{color:"#082957"/);
  assert.match(area,/formatDriverFreight\(offer\.valorMotorista\)/);
  assert.match(area,/currency:"BRL"/);
  assert.match(area,/Local não informado/);
  assert.match(area,/Veículos aceitos:/);
  assert.match(area,/AXLE_TYPES\.map/);
  assert.match(area,/status==="S"\?styles\.offerAxleYes/);
  assert.match(area,/status==="N"\?styles\.offerAxleNo/);
  assert.match(area,/offerAxleUnknown/);
  assert.match(area,/Linking.openURL\(url\)/);
  assert.match(area,/whatsappForOffer\(offer\)/);
  assert.doesNotMatch(area,/Share.share/);
  assert.match(area,/Nenhum frete divulgado neste momento/);
  assert.doesNotMatch(area,/portalPage\("fretes"/);
});
