import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync,spawnSync} from "node:child_process";
import {existsSync,readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const generator=resolve(root,"scripts/criar-transportadora-modelo.mjs");

test("model generator is dry-run safe and creates no private data",()=>{
 const slug="empresa-modelo-audit-9",tenantId="empresa-09";
 const path=resolve(root,"pages",slug);
 assert.equal(existsSync(path),false);
 const response=execFileSync(process.execPath,[generator,slug,tenantId,"--dry-run"],{
  cwd:root,encoding:"utf8"
 });
 assert.match(response,/Preparadas 49 páginas/);
 assert.equal(existsSync(path),false);
 const source=readFileSync(generator,"utf8");
 assert.ok(source.includes('data-tenant-id="__TENANT_ID__"'));
 assert.ok(source.includes("Nenhum dado operacional, segredo ou planilha foi copiado."));
 assert.ok(source.includes('const from=resolve(root,"pages","modelo01")'));
});
test("model generator rejects path traversal and existing test company",()=>{
 for(const slug of ["../bad","transportadora-teste","gnova","modelo01","A-INVALID","1empresa"]){
  const result=spawnSync(process.execPath,[generator,slug,"empresa-09","--dry-run"],{cwd:root});
  assert.equal(result.status,2,slug);
 }
});
