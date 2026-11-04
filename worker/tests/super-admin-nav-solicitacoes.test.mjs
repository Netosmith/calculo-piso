import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext,Script} from "node:vm";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

test("Super Admin uses the portal global navigation",()=>{
 const html=read("pages/super-admin.html");
 const nav=read("assets/js/auth.js");
 assert.match(html,/<script src="\.\.\/assets\/js\/auth\.js\?v=26"><\/script>/);
 assert.match(html,/portal-preferences[.]js[?]v=/);
 assert.match(nav,/function renderPortalGlobalNav\(/);
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new Script(script));
});

test("Solicitações: all signed Nova Frota profiles, any tenant profile only with enabled Administrativo",async()=>{
 const home=read("pages/home.html"),script=read("assets/js/home-solicitacoes-access.js");
 assert.match(home,/<div class="nf-solic-wrap" hidden>/);
 assert.match(home,/home-solicitacoes-access[.]js[?]v=3/);
 assert.doesNotThrow(()=>new Script(script));
 const roles=["ADMINISTRADOR","GOADM","OPERACIONAL","COMERCIAL","PISO","MT","PR","GO"];
 const cases=[
  ...roles.map(perfil=>[{usuario:"TESTE",perfil,tenantMode:false},perfil!=="PISO"]),
  ...roles.map(perfil=>[{usuario:"TESTE",perfil,tenantMode:true,transportadoraId:"teste-01",modules:["administrativo"]},perfil!=="PISO"]),
  ...roles.map(perfil=>[{usuario:"TESTE",perfil,tenantMode:true,transportadoraId:"teste-01",modules:["bi"]},false]),
  [{usuario:"TESTE",perfil:"PISO",tenantMode:true,transportadoraId:"teste-01",modules:[]},false],
  [null,false],[{usuario:"",perfil:"ADMINISTRADOR",tenantMode:false},false]
 ];
 for(const [session,expected] of cases){
  const listeners={};
  const wrap={hidden:true},button={disabled:true};const classes=new Set();
  const topbar={classList:{toggle(name,v){v?classes.add(name):classes.delete(name);}}};
  const elements={".nf-solic-wrap":wrap,".nf-topbar-inner":topbar};
  const context={document:{querySelector(k){return elements[k]||null;},getElementById(id){return id==="homeSolicCard"?button:null;}},window:{
    portalAuthReady:Promise.resolve(session),addEventListener(name,cb){listeners[name]=cb;}
  }};
  runInNewContext(script,context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(wrap.hidden,!expected,JSON.stringify(session));
  assert.equal(button.disabled,!expected,JSON.stringify(session));
  assert.equal(classes.has("has-admin-solicitations"),expected,JSON.stringify(session));
 }
});
test("Solicitação do usuário e painel Administrativo possuem autorizações separadas",()=>{
 const form=read("assets/js/home-solicitacoes.js");
 const workspace=read("assets/js/tenant-workspace.js");
 const admin=read("pages/administrativo.html");
 assert.match(form,/fillFiliais\(session\)/);
 assert.match(form,/field\.placeholder="Informe a filial da transportadora"/);
 assert.match(form,/api\.call\("administrativo", action/);
 assert.doesNotMatch(form,/Solicitações ainda não integradas para esta transportadora/);
 assert.doesNotMatch(workspace,/if\(solicit\)solicit\.disabled=true/);
 assert.match(admin,/requireFeatureAuth\("administrativo"\)/);
 assert.doesNotThrow(()=>new Script(form));
});
