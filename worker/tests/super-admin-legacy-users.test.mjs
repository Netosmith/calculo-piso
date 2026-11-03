import test from "node:test";
import assert from "node:assert/strict";
import { superAdminController } from "../src/controllers/super-admin.js";

const endpoint = "https://api.portalfrete.net.br/v1/super-admin/transportadoras/nova-frota/usuarios";
function envFor(session, enabled = "enabled") {
  return {
    SUPER_ADMIN_USER: "OWNER",
    SUPER_ADMIN_LEGACY_USERS_READ: enabled,
    PORTAL_KEY: "test-only-not-production",
    APPS_SCRIPT_URL: "https://example.invalid/apps-script",
    SESSIONS: { async get() { return session; } }
  };
}
function req(url = endpoint) {
  return new Request(url, {headers:{Cookie:"__Host-portal_session=test-legacy-session"}});
}
const owner = {usuario:"OWNER",nome:"Owner",perfil:"ADMINISTRADOR",transportadoraId:"nova-frota",estados:["GO"],estado:"GO"};

test("rejects unauthenticated and non-owner requests before contacting Apps Script", async () => {
  let calls=0;const old=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error("should not call");};
  try {
    assert.equal((await superAdminController(req(),envFor(null))).status,401);
    assert.equal((await superAdminController(req(),envFor({...owner,usuario:"OTHER"}))).status,403);
    assert.equal((await superAdminController(req(),envFor({...owner,transportadoraId:"other-company"}))).status,403);
    assert.equal(calls,0);
  } finally {globalThis.fetch=old;}
});

test("opt-in disabled never calls legacy Apps Script", async () => {
  let calls=0;const old=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error("should not call");};
  try {
    const response=await superAdminController(req(),envFor(owner,"disabled"));
    assert.equal(response.status,503);
    assert.equal(calls,0);
  } finally {globalThis.fetch=old;}
});

test("authorized owner receives allowlisted fields only", async () => {
  const old=globalThis.fetch;let captured;
  globalThis.fetch=async (_url,options)=>{
    captured=JSON.parse(options.body);
    return new Response(JSON.stringify({ok:true,data:[{
      Usuario:"maria",Nome:"Maria",Perfil:"GOADM",Estados:"GO",Ativo:"SIM",
      Senha:"private-password",token:"private-token"
    }]}),{headers:{"Content-Type":"application/json"}});
  };
  try {
    const response=await superAdminController(req(),envFor(owner));
    assert.equal(response.status,200);
    const body=await response.json();
    assert.deepEqual(body.usuarios,[{usuario:"MARIA",nome:"Maria",perfil:"GOADM",estados:"GO",ativo:true}]);
    assert.equal(JSON.stringify(body).includes("private-password"),false);
    assert.equal(captured.action,"portal_gateway");
    assert.equal(captured.params.module,"cadastros");
    assert.equal(captured.params.payload.resource,"usuarios");
    assert.equal(captured.params.action,"read");
  } finally {globalThis.fetch=old;}
});

test("does not use Nova Frota legacy source for another tenant", async () => {
  let calls=0;const old=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error("should not call");};
  try {
    const url=endpoint.replace("/nova-frota/","/other-company/");
    const response=await superAdminController(req(url),envFor(owner));
    assert.equal(response.status,503);
    assert.equal(calls,0);
  } finally {globalThis.fetch=old;}
});

test("rejects malformed upstream data rather than returning unfiltered records", async () => {
  const old=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,data:{users:[{Senha:"private"}]}}));
  try {
    const response=await superAdminController(req(),envFor(owner));
    assert.equal(response.status,502);
    assert.equal(JSON.stringify(await response.json()).includes("private"),false);
  } finally {globalThis.fetch=old;}
});

test("rejects invalid tenant path without upstream calls", async () => {
  let calls=0;const old=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error("unexpected");};
  try {
    const response=await superAdminController(req(endpoint.replace("/nova-frota/","/NOVA_FROTA/")),envFor(owner));
    assert.equal(response.status,400);
    assert.equal(calls,0);
  } finally {globalThis.fetch=old;}
});

test("rejects upstream records with unknown profile and never exposes sensitive data", async () => {
  const old=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,data:[{
    Usuario:"alice",Perfil:"UNKNOWN",Ativo:"SIM",Senha:"do-not-leak"
  }]}));
  try {
    const response=await superAdminController(req(),envFor(owner));
    assert.equal(response.status,502);
    assert.equal(JSON.stringify(await response.json()).includes("do-not-leak"),false);
  } finally {globalThis.fetch=old;}
});

test("accepts nested data.rows response from Apps Script without exposing credentials", async () => {
  const old=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,data:{data:{rows:[{
    Usuario:"ana",Nome:"Ana",Perfil:"PR",Estados:"PR",Ativo:"NÃO",Senha:"secret"
  }]}}}));
  try {
    const response=await superAdminController(req(),envFor(owner));
    assert.equal(response.status,200);
    const body=await response.json();
    assert.deepEqual(body.usuarios,[{usuario:"ANA",nome:"Ana",perfil:"PR",estados:"PR",ativo:false}]);
    assert.equal(JSON.stringify(body).includes("secret"),false);
  } finally {globalThis.fetch=old;}
});
