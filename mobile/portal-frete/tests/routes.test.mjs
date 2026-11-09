import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {portalPage,slugFromInvite,normalizeTenantSlug,trustedNavigation} from "../src/routes.js";

test("abre portal legado Nova Frota no domínio oficial HTTPS",()=>{
  assert.equal(portalPage("login"),"https://portalfrete.net.br/pages/login.html");
  assert.equal(portalPage("monitoramento"),"https://portalfrete.net.br/pages/monitoramento.html");
  assert.equal(portalPage("home","nova-frota"),"https://portalfrete.net.br/pages/home.html");
});
test("outra transportadora usa apenas o seu slug, sem seletor nem acesso cruzado",()=>{
  assert.equal(portalPage("login","gnova"),"https://portalfrete.net.br/pages/gnova/login.html");
  assert.equal(portalPage("home","transvale"),"https://portalfrete.net.br/pages/transvale/home.html");
  assert.equal(normalizeTenantSlug("../gnova"),null);
  assert.equal(normalizeTenantSlug("gnova/x"),null);
  assert.equal(normalizeTenantSlug("gnova--teste"),null);
  assert.throws(()=>portalPage("monitoramento","gnova"),/exclusivo/i);
  assert.throws(()=>portalPage("funcionarios","transvale"),/exclusivo/i);
  assert.throws(()=>portalPage("super-admin","gnova"),/exclusivo/i);
  assert.throws(()=>portalPage("documentos-secretos"),/indisponível/i);
});
test("só abre páginas HTTPS do domínio portalfrete.net.br na WebView",()=>{
  assert.equal(trustedNavigation("about:blank"),true);
  assert.equal(trustedNavigation("https://portalfrete.net.br/pages/home.html"),true);
  for(const url of [
    "javascript:alert(1)",
    "http://portalfrete.net.br/pages/home.html",
    "https://portalfrete.net.br.evil.example/pages/home.html",
    "https://api.portalfrete.net.br/v1/session",
    "file:///etc/passwd",
    "https://evil.example"
  ])assert.equal(trustedNavigation(url),false,url);
});
test("permite abrir transportadora por convite específico sem listar outras empresas",()=>{
  assert.equal(slugFromInvite("portalfrete://acesso/gnova"),"gnova");
  assert.equal(slugFromInvite("https://portalfrete.net.br/pages/gnova/login.html"),"gnova");
  assert.equal(slugFromInvite("https://portalfrete.net.br/pages/login.html"),"");
  assert.equal(slugFromInvite("https://evil.example/pages/gnova/login.html"),null);
  assert.equal(slugFromInvite("portalfrete://acesso/../../super-admin"),null);
});
test("shell não promete localização em background sem recurso nativo",()=>{
  const app=readFileSync(new URL("../App.js",import.meta.url),"utf8");
  const config=JSON.parse(readFileSync(new URL("../app.json",import.meta.url),"utf8"));
  assert.match(app,/sharedCookiesEnabled/);
  assert.match(app,/onShouldStartLoadWithRequest=\{mayNavigate\}/);
  assert.match(app,/Portal Frete/);
  assert.ok(!config.expo.ios.infoPlist.UIBackgroundModes);
  assert.ok(!config.expo.android.permissions.includes("ACCESS_BACKGROUND_LOCATION"));
});
