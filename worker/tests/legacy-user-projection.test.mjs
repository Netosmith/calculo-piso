import test from "node:test";
import assert from "node:assert/strict";
import { projectLegacyUsers } from "../src/services/legacy-user-projection.js";

test("returns only approved fields, never password or token", () => {
  const [user] = projectLegacyUsers([{Usuario:"  maria ",Nome:"Maria",Perfil:"GOADM",Estados:"GO,MT",Ativo:"SIM",Senha:"secret",token:"private"}]);
  assert.deepEqual(user,{usuario:"MARIA",nome:"Maria",perfil:"GOADM",estados:"GO,MT",ativo:true});
  assert.equal(JSON.stringify(user).includes("secret"),false);
});
test("preserves additional legacy roles and inactive status", () => {
  for (const role of ["MT","PR","PISO","COMERCIAL","OPERACIONAL","ADMINISTRADOR"]) {
    assert.equal(projectLegacyUsers([{Usuario:"u",Perfil:role,Ativo:"NÃO"}])[0].ativo,false);
  }
});
test("rejects malformed, unknown and oversized records", () => {
  assert.throws(()=>projectLegacyUsers(null),TypeError);
  assert.throws(()=>projectLegacyUsers([{Usuario:"u",Perfil:"ROOT",Ativo:"SIM"}]),TypeError);
  assert.throws(()=>projectLegacyUsers(Array(501).fill({Usuario:"u",Perfil:"PISO",Ativo:"SIM"})),RangeError);
});
