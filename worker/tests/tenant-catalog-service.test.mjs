import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createTenant,changeTenantStatus,changeTenantModule } from '../src/services/tenant-catalog.js';
globalThis.crypto ??= webcrypto;
function mockDb(){
 const batches=[];
 const db={
  prepare(sql){return {bind(...params){return {sql,params}}}},
  async batch(statements){batches.push(statements);return statements.map(()=>({success:true}))}
 };
 return {db,batches};
}
test('tenant creation writes entity and audit in one batch',async()=>{
 const {db,batches}=mockDb();
 const result=await createTenant({TENANTS_DB:db},'OWNER',{id:'empresa-teste',name:'Empresa Teste'});
 assert.equal(result.ok,true);
 assert.equal(result.value.active,false);
 assert.equal(batches.length,1);
 assert.equal(batches[0].length,2);
 assert.match(batches[0][1].sql,/portal_tenant_audit/);
});
test('invalid tenant does not write to DB',async()=>{
 const {db,batches}=mockDb();
 const result=await createTenant({TENANTS_DB:db},'OWNER',{id:'nova-frota',name:'Duplicada'});
 assert.equal(result.ok,false);
 assert.equal(batches.length,0);
});
test('legacy Nova Frota status cannot be changed',async()=>{
 const {db,batches}=mockDb();
 const result=await changeTenantStatus({TENANTS_DB:db},'OWNER','nova-frota',{active:false});
 assert.equal(result.ok,false);
 assert.equal(batches.length,0);
});
test('legacy Nova Frota modules cannot be changed',async()=>{
 const {db,batches}=mockDb();
 const result=await changeTenantModule({TENANTS_DB:db},'OWNER','nova-frota',{module:'fretes',enabled:false});
 assert.equal(result.ok,false);
 assert.equal(batches.length,0);
});
test('module update and audit share a batch',async()=>{
 const {db,batches}=mockDb();
 const result=await changeTenantModule({TENANTS_DB:db},'OWNER','empresa-teste',{module:'bi',enabled:true});
 assert.equal(result.ok,true);
 assert.equal(batches[0].length,2);
 assert.match(batches[0][0].sql,/portal_tenant_modules/);
 assert.match(batches[0][1].sql,/portal_tenant_audit/);
});
