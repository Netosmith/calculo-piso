import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 readNovaFrotaModules,saveNovaFrotaModules,
 NOVA_FROTA_LEGACY_DEFAULTS,NOVA_FROTA_NEW_MODULES
} from "../src/services/nova-frota-modules.js";
const load=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
function fakeEnv(seed={}){
 const data=new Map(Object.entries(seed));
 return {TENANT_BRANDS:{
  get:async key=>data.has(key)?{json:async()=>JSON.parse(data.get(key))}:null,
  put:async(key,value)=>{data.set(key,value);}
 },data};
}
const v1="tenant/nova-frota/private/optional-modules-v1.json";
const v2="tenant/nova-frota/private/modules-v2.json";
test("Padrão: módulos usados antes seguem ativos; 4 módulos novos ficam desligados",async()=>{
 const state=await readNovaFrotaModules(fakeEnv());
 assert.equal(state.configured,false);
 for(const m of NOVA_FROTA_LEGACY_DEFAULTS)assert.ok(state.modules.includes(m),m);
 for(const m of NOVA_FROTA_NEW_MODULES)assert.ok(!state.modules.includes(m),m);
});
test("As liberações já salvas da Troca de Notas e Pedidos são preservadas",async()=>{
 const env=fakeEnv({[v1]:JSON.stringify({modules:["solicitacao-troca-notas","solicitacao-pedidos"]})});
 const state=await readNovaFrotaModules(env);
 assert.ok(state.modules.includes("solicitacao-troca-notas"));
 assert.ok(state.modules.includes("solicitacao-pedidos"));
 assert.ok(!state.modules.includes("execucao-troca-notas"));
 assert.ok(!state.modules.includes("execucao-pedidos"));
});
test("Depois do primeiro salvamento, o Super Admin é autoridade sobre módulos antigos e novos",async()=>{
 const env=fakeEnv({[v1]:JSON.stringify({modules:["solicitacao-troca-notas"]})});
 const allowed=["piso2","cadastro-solicitacoes","solicitacao-pedidos"];
 const saved=await saveNovaFrotaModules(env,allowed,"SUPER-ADMIN");
 assert.deepEqual(saved,allowed);
 const reloaded=await readNovaFrotaModules(env);
 assert.equal(reloaded.configured,true);
 assert.deepEqual(reloaded.modules,allowed);
 assert.ok(!reloaded.modules.includes("bi"));
 assert.ok(!reloaded.modules.includes("execucao-cadastros"));
 assert.ok(!reloaded.modules.includes("solicitacao-troca-notas"));
 assert.deepEqual(JSON.parse(env.data.get(v2)).modules,allowed);
});
test("A liberação não aceita módulos por estado da Nova Frota, duplicações ou outros tenants",async()=>{
 const env=fakeEnv();
 await assert.rejects(saveNovaFrotaModules(env,["fretes-go"],"SUPER-ADMIN"));
 await assert.rejects(saveNovaFrotaModules(env,["piso","piso"],"SUPER-ADMIN"));
 await assert.rejects(saveNovaFrotaModules(env,["execucao-pedidos","admin-root"],"SUPER-ADMIN"));
 assert.equal(env.data.has(v2),false);
});
test("Frontend cruza liberação da transportadora com regras históricas de perfis",()=>{
 const auth=load("assets/js/auth.js");
 const home=load("pages/home.html");
 const superAdmin=load("pages/super-admin.html");
 assert.match(auth,/function novaFrotaModuleGranted\(/);
 assert.match(auth,/if\(!novaFrotaModuleGranted\(feature\)\)return false/);
 assert.match(auth,/if\(profile==="PISO"\)return isAuthedHome\(\) && feature==="piso2" && novaFrotaModuleGranted\(feature\)/);
 assert.match(auth,/if\(role==="ADMINISTRADOR"\)return true/);
 assert.match(home,/if \(canAccessFeature\(feature\)\)/);
 assert.match(superAdmin,/check\.checked=Boolean\(selected\?\.modules\?\.includes\(id\)\)/);
 assert.match(superAdmin,/check\.disabled=isNovaFrota\?!legacyManageable\.has\(id\)\|\|!canEditModules\(\):!canEdit\(\)/);
});
test("API de dados, cadastros e novos módulos consultam o mesmo armazenamento",()=>{
 const gateway=load("worker/src/controllers/portal-gateway.js");
 const cad=load("worker/src/controllers/cadastro-solicitacoes.js");
 const notas=load("worker/src/controllers/troca-notas.js");
 const pedidos=load("worker/src/controllers/abertura-pedidos.js");
 const router=load("worker/src/router.js");
 assert.match(gateway,/isNovaFrotaModuleEnabled\(env,moduleName\)/);
 for(const source of [cad,notas,pedidos])assert.match(source,/readNovaFrotaModules\(env\)/);
 assert.match(router,/\/v1\/nova-frota\/modules/);
 assert.match(router,/hasTenantSessionCookie/);
});
