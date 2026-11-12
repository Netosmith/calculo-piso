import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

test("Cálculo de Piso 1 espera concessão global antes da validação por perfil",()=>{
 const s=read("assets/js/calculo-piso.js");
 const start=s.indexOf("async function init(){");
 assert.ok(start>=0);
 const ready=s.indexOf("await window.portalAuthReady",start);
 const check=s.indexOf("acessoLiberado=requirePisoAuth()",start);
 assert.ok(ready>start && check>ready);
});

test("Piso ANTT e segundo modelo não avaliam permissões durante carregamento da sessão",()=>{
 for(const path of ["pages/calculo-antt.html","pages/calculo-antt2.html"]){
  const s=read(path);
  const ready=s.lastIndexOf("await window.portalAuthReady");
  const check=s.lastIndexOf("enforcePisoAuth()")>=0?
   s.lastIndexOf("enforcePisoAuth()"):s.lastIndexOf("enforcePiso2Auth()");
  assert.ok(ready>=0 && check>ready,path);
 }
});

test("Módulos legados aguardam sessão real antes de exibir alertas de acesso",()=>{
 const checks={
  "pages/divulgacao.html":"divulgacao",
  "pages/embarques.html":"embarques",
  "pages/relatorio.html":"relatorio",
  "pages/administrativo.html":"administrativo",
  "pages/custo-frota-pesada.html":"custo-frota",
  "pages/estadias.html":"estadias"
 };
 for(const [path,module] of Object.entries(checks)){
  const s=read(path);
  assert.ok(s.includes('await awaitPortalFeatureAuth("'+module+'"'),path);
 }
 const mercado=read("assets/js/fretes-mercado.js");
 assert.match(mercado,/window\.portalAuthReady\s*\?\s*await window\.portalAuthReady/);
 const custo=read("pages/custo-filial.html");
 assert.ok(custo.indexOf("await window.portalAuthReady")<custo.indexOf('requireFeatureAuth("custo-filial"'));
 const estadias=read("assets/js/estadias.js");
 assert.ok(estadias.indexOf("await window.portalAuthReady")<estadias.indexOf("requireEstadiasAuth()"));
});

test("Super Admin segue sendo o filtro, sem conceder módulos ao PISO ou perfis não autorizados",()=>{
 const auth=read("assets/js/auth.js");
 assert.match(auth,/async function awaitPortalFeatureAuth\(/);
 assert.match(auth,/if\(!novaFrotaModuleGranted\(feature\)\)return false/);
 assert.match(auth,/if\(profile==="PISO"\)return isAuthedHome\(\) && feature==="piso2"/);
 assert.match(auth,/O Worker já reduziu session.modules/);
 assert.match(auth,/if\(!modules.includes\(feature\)\)return false/);
 assert.match(auth,/if\(feature==="execucao-pedidos"\)return modules.includes\(feature\)&&/);
});

test("Páginas principais usam versão nova do script de autenticação",()=>{
 for(const name of ["home","calculo-piso","calculo-antt","calculo-antt2",
  "divulgacao","embarques","relatorio","administrativo","estadias",
  "custo-frota-pesada","custo-filial","fretes","fretes2","super-admin"]){
   const s=read("pages/"+name+".html");
   assert.match(s,/auth[.]js[?]v=/,name);
 }
});

test("Cadastro aguarda confirmação da matriz antes de validar ADMINISTRADOR ou Super Admin",()=>{
 const script=read("assets/js/cadastros.js");
 const page=read("pages/cadastros.html");
 const modules=read("worker/src/controllers/nova-frota-modules.js");
 const start=script.indexOf("async function init(){");
 const wait=script.indexOf("session=await window.portalAuthReady",start);
 const guard=script.indexOf('!canAccessFeature("cadastros")',start);
 assert.ok(start>=0 && wait>start && guard>wait,
  "Validação de Cadastro não pode acontecer antes das permissões do servidor");
 assert.ok(page.includes("const session=window.portalAuthReady?await window.portalAuthReady:null"));
 assert.ok(page.includes("cadastros.js?v=20261112-cadastros-owner-3"));
 assert.match(modules,/modulesForProfile\(env,LEGACY_NOVA_FROTA\.id,session\.perfil,state\.modules,isOwner\)/);
 assert.match(modules,/env\.SUPER_ADMIN_USER/);
});
