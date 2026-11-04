import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync,existsSync,rmSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const at=(...parts)=>resolve(root,...parts);
const htmlFiles=dir=>readdirSync(at("pages",dir)).filter(x=>x.endsWith(".html")).sort();
const read=(folder,file)=>readFileSync(at("pages",folder,file),"utf8");

test("GNOVA official directory preserves original tenant ID and all 50 previous entrypoints",()=>{
 const old=htmlFiles("transportadora-teste"),now=htmlFiles("gnova");
 assert.equal(now.length,50);
 assert.deepEqual(now,old);
 for(const file of now){
  const content=read("gnova",file);
  assert.match(content,/data-tenant-id="teste-01"/,file);
  const redirect=read("transportadora-teste",file);
  assert.match(redirect,/location[.]replace/);
  assert.ok(redirect.includes('"/pages/gnova/'+file+'"'));
  assert.ok(redirect.includes("location.search+location.hash"),file);
  assert.doesNotMatch(redirect,/data-tenant-id=/,"legacy alias must not run tenant scripts");
 }
 assert.ok(read("gnova","login.html").includes("tenant-login.js"));
 assert.ok(read("gnova","ordem.html").includes('NOME_TRANSPORTADORA = "GNOVA TRANSPORTES"'));
});

test("modelo01 includes 49 inert generic pages, preserves state base aliases and has no GNOVA account",()=>{
 const model=htmlFiles("modelo01");
 assert.equal(model.length,49);
 assert.equal(model.includes("fretes2.html"),false);
 for(const file of model){
  const html=read("modelo01",file);
  assert.match(html,/data-tenant-id="__TENANT_ID__"/,file);
  assert.doesNotMatch(html,/GNOVA|teste-01|transportadora-teste/i,file);
  assert.doesNotMatch(html,/https:\/\/script[.]google[.]com\/macros\//,file);
  assert.doesNotMatch(html,/\b\d{2}[.]\d{3}[.]\d{3}\/\d{4}-\d{2}\b/,file);
  if(/^fretes-[A-Z]{2}[.]html$/.test(file)){
    const uf=file.match(/^fretes-([A-Z]{2})[.]html$/)?.[1];
    assert.ok(uf);
    assert.ok(html.includes('data-shared-page="fretes.html"'),file);
    assert.ok(html.includes('data-freight-base="'+uf+'"'),file);
  }else if(file!=="login.html"){
    assert.ok(html.includes('data-shared-page="'+file+'"'),file);
  }
 }
 const order=read("modelo01","ordem.html");
 assert.ok(order.includes('NOME_TRANSPORTADORA=""'));
 assert.doesNotMatch(order,/cnpj:"\d+|ie:"\d+/);
});

test("generator produces isolated 49 pages from modelo01 and refuses protected names",()=>{
 const generator=at("scripts","criar-transportadora-modelo.mjs");
 const slug="modelo-integracao-20261104",tenant="empresa-88",folder=at("pages",slug);
 assert.equal(existsSync(folder),false);
 const preview=spawnSync(process.execPath,[generator,slug,tenant,"--dry-run"],{cwd:root,encoding:"utf8"});
 assert.equal(preview.status,0,preview.stderr);
 assert.match(preview.stdout,/Preparadas 49 páginas/);
 assert.equal(existsSync(folder),false);
 try{
  const create=spawnSync(process.execPath,[generator,slug,tenant],{cwd:root,encoding:"utf8"});
  assert.equal(create.status,0,create.stderr);
  const built=readdirSync(folder).filter(x=>x.endsWith(".html"));
  assert.equal(built.length,49);
  for(const file of built){
   const s=readFileSync(resolve(folder,file),"utf8");
   assert.match(s,/data-tenant-id="empresa-88"/);
   assert.doesNotMatch(s,/__TENANT_ID__|GNOVA|teste-01|transportadora-teste/);
  }
  assert.equal(existsSync(at("pages","gnova","login.html")),true);
 }finally{if(existsSync(folder))rmSync(folder,{recursive:true,force:true});}
 for(const reserved of ["gnova","modelo01","transportadora-teste","nova-frota","teste-01"]){
  const reject=spawnSync(process.execPath,[generator,reserved,tenant,"--dry-run"],{cwd:root});
  assert.equal(reject.status,2,reserved);
 }
 for(const reserved of ["gnova","modelo01","transportadora-teste","nova-frota","teste-01"]){
  const reject=spawnSync(process.execPath,[generator,slug,reserved,"--dry-run"],{cwd:root});
  assert.equal(reject.status,2,reserved);
 }
});
