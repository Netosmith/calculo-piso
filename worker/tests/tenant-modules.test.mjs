import test from 'node:test';
import assert from 'node:assert/strict';
import { TENANT_MODULES, validTenantModule, enabledModulesForTenant } from '../src/config/tenant-modules.js';

test('module registry has no duplicates',()=>{
 assert.equal(new Set(TENANT_MODULES).size,TENANT_MODULES.length);
});
test('only registered modules are accepted',()=>{
 assert.equal(validTenantModule('fretes'),true);
 assert.equal(validTenantModule('unknown'),false);
 assert.equal(validTenantModule('__proto__'),false);
});
test('module selector defaults to deny',()=>{
 assert.deepEqual(enabledModulesForTenant(undefined),[]);
 assert.deepEqual(enabledModulesForTenant([{module_key:'fretes',enabled:0}]),[]);
 assert.deepEqual(enabledModulesForTenant([{module_key:'fretes',enabled:1},{module_key:'unknown',enabled:1}]),['fretes']);
});
