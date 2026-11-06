import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext,runInContext} from 'node:vm';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const code=read('assets/js/super-admin-home.js');
function fixture(){
 class Element{
  constructor(){this.hidden=true;this.children=[];this.value='';this.dataset={};this.listeners={};}
  append(...items){this.children.push(...items);} prepend(...items){this.children.unshift(...items);}
  replaceChildren(...items){this.children=items;} setAttribute(k,v){this[k]=v;}
  addEventListener(k,fn){this.listeners[k]=fn;} focus(){this.focused=true;}
 }
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const context=createContext({document:{getElementById:get,createElement:()=>new Element(),querySelectorAll:()=>[]},location:{hash:''},addEventListener(){},companies:[{id:'nova-frota',name:'Nova Frota',active:true,modules:[]},{id:'gnova',name:'GNOVA',active:true,modules:['cadastros']},{id:'nova',name:'Nova Empresa',active:false,modules:[]}],publicHomeForTenant:company=>company.id==='nova-frota'?'/pages/home.html':company.id==='gnova'?'/pages/gnova/home.html':''});
 runInContext(code,context);return {context,get};
}
test('hub stays closed before server authorization, then supports all internal sections',()=>{
 const {context,get}=fixture();runInContext("showAdminView('cadastros')",context);assert.equal(get('cadastrosView').hidden,true);
 runInContext('initializeAdminHome()',context);assert.equal(get('adminHome').hidden,false);assert.equal(get('transportadorasView').hidden,true);
 for(const view of ['transportadoras','cadastros','manual']){runInContext(`showAdminView('${view}')`,context);assert.equal(get(view==='transportadoras'?'transportadorasView':view+'View').hidden,false);assert.equal(get('adminHome').hidden,true);}
 runInContext("showAdminView('unknown')",context);assert.equal(get('adminHome').hidden,false);
});
test('registry includes Nova Frota, scopes links to each tenant and handles search/unknown routes',()=>{
 const {context,get}=fixture();runInContext('initializeAdminHome();renderAdminRegistry()',context);
 const cards=get('registryCompanies').children;assert.equal(cards.length,3);
 assert.equal(cards[0].children.at(-1).children[0].href,'/pages/cadastros.html');
 assert.equal(cards[1].children.at(-1).children[0].href,'/pages/gnova/cadastros.html');
 assert.equal(cards[2].children.at(-1).children.length,1);
 get('registrySearch').value='gnova';runInContext('renderAdminRegistry()',context);assert.equal(get('registryCompanies').children.length,1);assert.equal(get('registryCompanies').children[0].children[0].textContent,'GNOVA');
 get('registrySearch').value='no-match';runInContext('renderAdminRegistry()',context);assert.match(get('registryCompanies').children[0].textContent,/Nenhuma/);
});
test('production markup retains owner gate and compiles all scripts',()=>{
 const html=read('pages/super-admin.html');assert.ok(html.indexOf('id="app" hidden')<html.indexOf('id="adminHome"'));
 assert.ok(html.indexOf("auth?.superAdmin!==true")<html.indexOf('initializeAdminHome();'));
 for(const label of ['Transportadoras','Games','Manual Códigos Retro','Cadastros Geral'])assert.ok(html.includes('<strong>'+label+'</strong>'));
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Script(match[1]);new Script(code);
});
