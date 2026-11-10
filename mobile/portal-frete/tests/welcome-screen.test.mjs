import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("tela inicial premium usa logo real Nova Frota e marca Portal Frete no rodapé",()=>{
  const ui=read("src/WelcomeScreen.js");
  assert.match(ui,/https:\/\/portalfrete\.net\.br\/assets\/img\/logo-novafrota\.png/);
  assert.match(ui,/accessibilityLabel="Logo oficial Nova Frota"/);
  assert.match(ui,/NOVA.*FROTA/);
  assert.match(ui,/PORTAL FRETE/);
  assert.match(ui,/LOGÍSTICA & TRANSPORTES/);
  assert.match(ui,/footerDivider/);
  assert.match(ui,/#082c55/);
  assert.match(ui,/#1eac62/);
  assert.match(ui,/#1672b6/);
});
test("os dois cards continuam abrindo as mesmas áreas sem alterar autenticação",()=>{
  const app=read("App.js"),ui=read("src/WelcomeScreen.js");
  assert.match(ui,/title="SOU MOTORISTA"/);
  assert.match(ui,/title="SOU FUNCIONÁRIO"/);
  assert.match(ui,/onPress=\{onDriver\}/);
  assert.match(ui,/onPress=\{onEmployee\}/);
  assert.match(app,/screen==="escolha"&&\s*<WelcomeScreen onDriver=\{\(\)=>setScreen\("driver"\)\}/);
  assert.match(app,/onEmployee=\{\(\)=>\{setEmployee\(null\);setScreen\("inicio"\);\}\}/);
  assert.match(app,/screen==="driver"&&\s*<View style=\{styles\.topbar\}>/);
  assert.match(app,/portalPage\("login"/);
  assert.match(app,/parseEmployeeSessionMessage/);
});
test("permissão de localização não é pedida na escolha de perfil",()=>{
  const ui=read("src/WelcomeScreen.js");
  assert.match(ui,/após vincular uma viagem e aceitar o termo/);
  assert.doesNotMatch(ui,/requestForegroundPermissionsAsync|requestBackgroundPermissionsAsync/);
  const app=JSON.parse(read("app.json")).expo;
  assert.equal(app.version,"0.3.9");
  assert.equal(app.android.versionCode,13);
});
