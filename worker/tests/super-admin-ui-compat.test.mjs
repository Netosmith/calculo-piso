import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {corsHeaders,handlePreflight} from "../src/middleware/cors.js";

test("Super Admin inline browser JavaScript parses",()=>{
 const html=readFileSync(new URL("../../pages/super-admin.html",import.meta.url),"utf8");
 const match=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match,"Expected one inline script");
 assert.doesNotThrow(()=>new Script(match[1],{filename:"super-admin.html"}));
 assert.match(html,/id="verifyIdentity"/);
 assert.match(html,/id="saveModules"/);
 assert.match(html,/id="addMembership"/);
 assert.match(html,/id="uploadLogo"/);
 assert.match(html,/id="tenantLogo"/);
 assert.match(html,/canEditMembership/);
 assert.match(html,/canEditBrand/);
});

test("trusted origin can preflight authorization header for OIDC",()=>{
 const req=new Request("https://api.portalfrete.net.br/v1/super-admin/authorize",{
  method:"OPTIONS",headers:{Origin:"https://portalfrete.net.br",
   "Access-Control-Request-Method":"POST",
   "Access-Control-Request-Headers":"authorization,content-type"}
 });
 assert.match(corsHeaders(req)["Access-Control-Allow-Headers"],/Authorization/);
 assert.equal(handlePreflight(req).status,204);
});

test("untrusted origin cannot preflight super admin writes",()=>{
 const req=new Request("https://api.portalfrete.net.br/v1/super-admin/authorize",{
  method:"OPTIONS",headers:{Origin:"https://evil.example",
   "Access-Control-Request-Method":"POST",
   "Access-Control-Request-Headers":"authorization"}
 });
 assert.equal(handlePreflight(req).status,403);
});
