import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createSessionToken } from '../src/services/session.js';
import { superAdminController } from '../src/controllers/super-admin.js';

globalThis.crypto ??= webcrypto;
const envBase={PORTAL_KEY:'test-secret',SUPER_ADMIN_USER:'LUZIANO'};
async function authorizedRequest(){
 const token=await createSessionToken(envBase,{usuario:'LUZIANO',transportadoraId:'nova-frota',expiresAt:new Date(Date.now()+60000).toISOString()});
 return new Request('https://example.test/v1/super-admin/transportadoras',{headers:{Cookie:'__Host-portal_session='+token}});
}
test('catalog returns Nova Frota without dedicated DB',async()=>{
 const response=await superAdminController(await authorizedRequest(),envBase);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.transportadoras[0].id,'nova-frota');
 assert.equal(body.catalogo,'legado');
});
test('catalog lists tenants and enabled modules from dedicated DB',async()=>{
 const db={prepare(sql){
   if(sql.includes('FROM portal_tenants'))return {all:async()=>({results:[{id:'empresa-b',name:'Empresa B',status:'inactive'}]})};
   if(sql.includes('FROM portal_tenant_modules'))return {bind(id){assert.equal(id,'empresa-b');return {all:async()=>({results:[{module_key:'piso',enabled:1},{module_key:'fretes',enabled:0},{module_key:'unknown',enabled:1}]})}}};
   throw new Error('Unexpected query');
 }};
 const response=await superAdminController(await authorizedRequest(),{...envBase,TENANTS_DB:db});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.catalogo,'d1');
 assert.equal(body.transportadoras.length,2);
 assert.deepEqual(body.transportadoras.find(t=>t.id==='empresa-b'),{id:'empresa-b',name:'Empresa B',active:false,modules:['piso']});
});
test('catalog does not silently mask D1 failures',async()=>{
 const response=await superAdminController(await authorizedRequest(),{...envBase,TENANTS_DB:{prepare(){throw Error('offline')}}});
 assert.equal(response.status,503);
});

test('module catalog endpoint requires global authorization',async()=>{
 const token=await createSessionToken(envBase,{usuario:'OUTRO',transportadoraId:'nova-frota',expiresAt:new Date(Date.now()+60000).toISOString()});
 const response=await superAdminController(new Request('https://example.test/v1/super-admin/modules',{headers:{Cookie:'__Host-portal_session='+token}}),envBase);
 assert.equal(response.status,403);
});
test('module catalog endpoint exposes canonical modules',async()=>{
 const request=await authorizedRequest();
 const response=await superAdminController(new Request('https://example.test/v1/super-admin/modules',{headers:request.headers}),envBase);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.ok(data.modules.includes('piso'));
 assert.ok(data.modules.includes('monitoramento'));
 assert.equal(new Set(data.modules).size,data.modules.length);
});
