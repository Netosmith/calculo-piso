import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const optional=["cadastro-solicitacoes","execucao-cadastros",
 "solicitacao-troca-notas","execucao-troca-notas",
 "solicitacao-pedidos","execucao-pedidos"];

test("Os módulos da Home incluem todas as ferramentas fixas, inclusive Ordem",()=>{
 const home=read("pages/home.html");
 const admin=read("pages/super-admin.html");
 const auth=read("assets/js/auth.js");
 assert.ok(home.includes('data-feature="ordem" href="./ordem.html"'));
 assert.ok(admin.includes("['ordem','Ordem de Carregamento']"));
 assert.ok(auth.includes('key:"ordem"'));
 assert.ok(home.includes('window.addEventListener("portal:modules-confirmed"'));
 const scripts=[...home.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(x=>x[1]).filter(Boolean);
 for(const script of scripts)assert.doesNotThrow(()=>new Script(script));
});

test("Concessão do perfil não fica presa à confirmação que ela mesma aguarda",()=>{
 const auth=read("assets/js/auth.js");
 assert.ok(auth.includes('const PORTAL_OPTIONAL_FLAGS='));
 assert.match(auth,/if\(PORTAL_OPTIONAL_FLAGS\[feature\]\)\{[\s\S]*?context!=="navigation"\|\|optionalModuleConfirmed\(feature\)/);
 assert.ok(auth.includes('void refreshOptionalNavGrants(session)'));
 assert.ok(auth.includes('window.addEventListener("portal:modules-confirmed"'));
 for(const module of optional)assert.ok(auth.includes('"'+module+'"'),module);
 assert.doesNotThrow(()=>new Script(auth));
});

test("Execução aguarda confirmação separada da API, sem liberar só pela marcação",()=>{
 const home=read("pages/home.html");
 assert.ok(home.includes('window[config]?.[feature]===true'));
 const workspace=read("assets/js/tenant-workspace.js");
 assert.ok(workspace.includes('if(["cadastro-solicitacoes","execucao-cadastros"'));
 for(const [file,check] of [
  ["assets/js/cadastro-exec-home.js","result.executor===true"],
  ["assets/js/troca-home.js","data.executor===true"],
  ["assets/js/pedidos-home.js","data.executor===true"]
 ]){
  const src=read(file);
  assert.ok(src.includes(check),file);
  assert.ok(src.includes('portal:modules-confirmed'),file);
  assert.doesNotThrow(()=>new Script(src));
 }
});

test("O Super Admin autenticado mantém acesso de suporte sem desbloquear os demais usuários",()=>{
 for(const file of ["cadastro-solicitacoes","troca-notas","abertura-pedidos"]){
  const c=read("worker/src/controllers/"+file+".js");
  assert.ok(c.includes("ownerSupport===true"),file);
  assert.ok(c.includes("env.SUPER_ADMIN_USER"),file);
 }
 const profile=read("worker/src/services/profile-access.js");
 assert.match(profile,/if\(ownerSupport===true\)return enabled/);
});
