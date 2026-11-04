import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const file=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

test("Super Admin card points to GitHub-hosted portal page and uses owner API",()=>{
  const home=file("pages/home.html");
  assert.match(home,/id="superAdminHomeCard" href="\.\/super-admin\.html"/);
  assert.doesNotMatch(home,/portalfrete-super-admin-staging\.luziano-transportes\.workers\.dev/);
  assert.match(home,/fetch\("https:\/\/api\.portalfrete\.net\.br\/v1\/super-admin\/me"/);
  assert.match(home,/identity\?\.superAdmin===true/);
  assert.match(home,/session\.transportadoraId!=="nova-frota"/);
  assert.doesNotMatch(home,/session\?\.perfil==="ADMINISTRADOR"/);
  const scripts=[...home.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
  for (const [index,script] of scripts.entries())assert.doesNotThrow(()=>new Script(script,{filename:"home-inline-"+index}));
});

test("Production deploy configures owner as a Worker secret; no browser-side shortcut",()=>{
  const workflow=file(".github/workflows/deploy-portal-hotfix.yml");
  const panel=file("pages/super-admin.html");
  const controller=file("worker/src/controllers/super-admin.js");
  // The owner identity is a pre-provisioned Cloudflare secret.
  // Redeploying it every time can race a newly staged Worker version.
  assert.doesNotMatch(workflow,/wrangler secret put SUPER_ADMIN_USER/);
  assert.match(workflow,/SUPER_ADMIN_USER already exists as a Worker secret/);
  assert.match(controller,/String\(env\.SUPER_ADMIN_USER \|\| ""\)/);
  assert.match(controller,/tenantIdForLegacySession\(session\) === LEGACY_NOVA_FROTA\.id/);
  assert.match(panel,/auth\?\.superAdmin!==true/);
});
