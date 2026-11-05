import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {routeRequest} from "../src/router.js";

const root=new URL("../../",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");

const affectedPages=[
 "home","fretes","fretes2","bi","fretes-mercado","chamados","controle",
 "divulgacao","estadias","embarques","cadastros","share-clientes",
 "relatorio","custo-filial","calculo-piso","administrativo","custo-frota-pesada"
];

test("Retired Nova Frota IA assets and worker controller do not exist",()=>{
 for(const path of [
  "assets/js/nova-frota-ia.js","assets/css/nova-frota-ia.css",
  "worker/src/controllers/ia.js","docs/nova-frota-ia.md"
 ])assert.equal(existsSync(new URL(path,root)),false,path);
});

test("All 17 portal pages are free from the retired assistant scripts and stylesheet",()=>{
 for(const page of affectedPages){
  const html=read("pages/"+page+".html");
  assert.doesNotMatch(html,/nova-frota-ia(?:\.js|\.css)?/i,page);
  assert.doesNotMatch(html,/(?:nfaiPanel|nfaiFab|nfaiTop)/,page);
 }
});

test("IA API no longer exists while the shared Home freight map remains available",async()=>{
 const router=read("worker/src/router.js");
 assert.doesNotMatch(router,/iaController|controllers\/ia\.js/);
 assert.doesNotMatch(router,/["']\/v1\/ia\/(?:status|chat)["']/);
 assert.match(read("worker/src/controllers/portal-gateway.js"),/export async function requestGlobalHomeMapFreights/);
 for(const [method,path] of [["GET","status"],["POST","chat"]]){
  const response=await routeRequest(new Request("https://api.portalfrete.net.br/v1/ia/"+path,{method}),{});
  assert.equal(response.status,404,path);
 }
});
