import test from "node:test";
import assert from "node:assert/strict";
import {cadastroCanReadTicket} from "../src/controllers/cadastro-solicitacoes.js";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");

test("Visão solicitante lista e abre somente chamados próprios",()=>{
 assert.equal(cadastroCanReadTicket("solicitante",false,true),true);
 assert.equal(cadastroCanReadTicket("solicitante",false,false),false);
 assert.equal(cadastroCanReadTicket("solicitante",true,false),false,"executor não vê outras solicitações na tela pessoal");
 assert.equal(cadastroCanReadTicket("solicitante",true,true),true);
});
test("Visão execução é negada a solicitante e liberada somente para executor",()=>{
 assert.equal(cadastroCanReadTicket("execucao",false,true),false);
 assert.equal(cadastroCanReadTicket("execucao",false,false),false);
 assert.equal(cadastroCanReadTicket("execucao",true,false),true);
 assert.equal(cadastroCanReadTicket("execucao",true,true),true);
});
test("API separa fila por empresa e visão mesmo para usuários administradores",()=>{
 const code=read("worker/src/controllers/cadastro-solicitacoes.js");
 assert.match(code,/if\(executionView&&\(!access\.executar\|\|!executor\)\)/);
 assert.match(code,/executionView\?\s*db\.prepare/);
 assert.match(code,/tenant_id=\? AND solicitante_id=\?/);
 assert.match(code,/tenant_id=\? AND status<>/);
 assert.match(code,/cadastroCanReadTicket\(view,executor,isOwner\)/);
 assert.match(code,/modulesForCadastros\(env,p\.tenantId\)/);
});
