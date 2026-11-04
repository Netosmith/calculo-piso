import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext,Script} from "node:vm";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

test("Super Admin loads the same signed-session global navbar as the other modules",()=>{
 const html=read("pages/super-admin.html");
 const nav=read("assets/js/auth.js");
 assert.match(html,/<script src="\.\.\/assets\/js\/auth\.js\?v=26"><\/script>/);
 assert.match(html,/portal-preferences[.]js[?]v=/);
 assert.match(html,/portal-preferences-advanced[.]js[?]v=/);
 assert.match(html,/body>header:not\(\.nf-global-nav-standalone\)/);
 assert.match(nav,/function renderPortalGlobalNav\(/);
 assert.match(nav,/function createPortalGlobalShell\(/);
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new Script(script));
});

test("Home Solicitações stays hidden until the signed role and feature agree",async()=>{
 const html=read("pages/home.html");
 const script=read("assets/js/home-solicitacoes-access.js");
 assert.match(html,/<div class="nf-solic-wrap" hidden>/);
 assert.match(html,/\.nf-solic-wrap\[hidden\]\{ display:none !important; \}/);
 assert.match(html,/home-solicitacoes-access[.]js[?]v=1/);
 assert.doesNotThrow(()=>new Script(script));
 const cases=[
  [{perfil:"ADMINISTRADOR",tenantMode:false},true,true],
  [{perfil:"GOADM",tenantMode:false},true,true],
  [{perfil:"COMERCIAL",tenantMode:false},true,false],
  [{perfil:"OPERACIONAL",tenantMode:false},true,false],
  [{perfil:"ADMINISTRADOR",tenantMode:true,modules:["administrativo"]},true,true],
  [{perfil:"GOADM",tenantMode:true,modules:["administrativo"]},true,true],
  [{perfil:"ADMINISTRADOR",tenantMode:true,modules:["bi"]},true,false],
  [{perfil:"GOADM",tenantMode:true,modules:[]},true,false],
  [{perfil:"ADMINISTRADOR",tenantMode:false},false,false],
  [null,true,false]
 ];
 for(const [session,feature,expected] of cases){
  const listeners={};
  const wrap={hidden:true},button={disabled:true};
  const classes=new Set();
  const topbar={classList:{toggle(name,value){value?classes.add(name):classes.delete(name);}}};
  const elements={".nf-solic-wrap":wrap,".nf-topbar-inner":topbar};
  const window={portalAuthReady:Promise.resolve(session),addEventListener(name,cb){listeners[name]=cb;}};
  const context={document:{querySelector(key){return elements[key]||null;},getElementById(id){return id==="homeSolicCard"?button:null;}},window,
   canAccessFeature(key){assert.equal(key,"administrativo");return feature;}};
  runInNewContext(script,context);
  await Promise.resolve();await Promise.resolve();
  assert.equal(wrap.hidden,!expected,JSON.stringify(session));
  assert.equal(classes.has("has-admin-solicitations"),expected,JSON.stringify(session));
  assert.equal(button.disabled,!expected||session?.tenantMode===true,JSON.stringify(session));
 }
});
