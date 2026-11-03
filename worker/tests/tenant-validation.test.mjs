import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNewTenant, validateTenantStatus, validateTenantModuleChange } from '../src/config/tenant-validation.js';

test('new tenants are inactive by default',()=>{
 assert.deepEqual(validateNewTenant({id:'transportadora-teste',name:'Transportadora Teste'}),{ok:true,value:{id:'transportadora-teste',name:'Transportadora Teste',status:'inactive'}});
});
test('reserved and malformed tenant identifiers are denied',()=>{
 for(const id of ['nova-frota','admin','A B','a--b','x','x-','../outro']){
   assert.equal(validateNewTenant({id,name:'Transportadora Teste'}).ok,false,id);
 }
});
test('invalid tenant names are denied',()=>{
 for(const name of ['X','<script>','a'.repeat(121)]){
   assert.equal(validateNewTenant({id:'transportadora-teste',name}).ok,false,name);
 }
});
test('tenant status requires explicit boolean',()=>{
 assert.equal(validateTenantStatus({active:true}).value.status,'active');
 assert.equal(validateTenantStatus({active:'true'}).ok,false);
});
test('module changes only accept known modules and boolean state',()=>{
 assert.deepEqual(validateTenantModuleChange({module:'bi',enabled:false}),{ok:true,value:{module:'bi',enabled:false}});
 assert.equal(validateTenantModuleChange({module:'desconhecido',enabled:true}).ok,false);
 assert.equal(validateTenantModuleChange({module:'bi',enabled:'true'}).ok,false);
});
