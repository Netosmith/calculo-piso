import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const get=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");

function makeHarness(){
 const elements=new Map();
 class Node {
  constructor(tag="div"){
   this.tagName=tag.toUpperCase();
   this._text="";this.children=[];this.style={};this.attributes={};
   this.hidden=false;this.title="";this.className="";
   const names=new Set();
   this.classList={
    add:(name)=>names.add(name),
    remove:(name)=>names.delete(name),
    contains:(name)=>names.has(name)
   };
  }
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(el=>typeof el==="string"?el:el.textContent).join("");}
  replaceChildren(...children){this._text="";this.children=children;}
  append(...children){this.children.push(...children);}
  appendChild(child){this.append(child);return child;}
  setAttribute(name,value){this.attributes[name]=value;}
  removeAttribute(name){delete this.attributes[name];}
 }
 const vehicle=new Node();
 const body=new Node("body");
 const document={
  body,
  getElementById(id){
   if(!elements.has(id))elements.set(id,new Node());
   return elements.get(id);
  },
  createElement(tag){return new Node(tag);},
  querySelector(selector){
   if(selector===".nf-veiculos-resumo")return vehicle;
   return null;
  },
  querySelectorAll(){return [];}
 };
 const listeners=new Map();
 const window={
  __PORTAL_TENANT_SESSION:{tenantMode:true},
  addEventListener(event,callback){listeners.set(event,callback);},
  PortalAPI:{call:async()=>({data:{solicitacoes:0,filiais:2}})}
 };
 const script=get("assets/js/tenant-workspace.js");
 assert.doesNotThrow(()=>new Script(script,{filename:"tenant-workspace.js"}));
 new Script(script).runInNewContext({window,document,Intl,Date,console});
 const tenantId="teste-01";
 listeners.get("portal:session")({detail:{
  tenantMode:true,transportadoraId:tenantId,
  transportadoraNome:"GNOVA",usuario:"USUARIO.TESTE",perfil:"ADMINISTRADOR"
 }});
 return{
  document,vehicle,elements,
  summary(data){listeners.get("portal:tenant-freights-summary")({detail:{
   tenantId,...data
  }});},
  text(id){return elements.get(id)?.textContent||"";}
 };
}

test("One-base transportadora uses clean numeric KPIs without pipes or bordered chips",()=>{
 const h=makeHarness();
 h.summary({bases:["FRETES"],failedBases:[],rows:[
  {id:"1",source:"FRETES",porta:4,transito:1},
  {id:"2",source:"FRETES",porta:6,transito:2},
  {id:"3",source:"FRETES",porta:1,transito:2}
 ]});
 assert.equal(h.text("homeFretesAtivos"),"3");
 assert.equal(h.text("homeFretesDetalhe"),"GERAL: 3");
 assert.equal(h.vehicle.children[0].textContent,"16");
 assert.equal(h.vehicle.children[0].className,"nf-stat-value pf-tenant-vehicle-total");
 assert.equal(h.vehicle.children[1].textContent,"GERAL: 16");
 const rows=h.vehicle.children[2].children;
 assert.equal(rows.length,1);
 assert.equal(rows[0].className,"nf-veiculos-linha");
 assert.equal(rows[0].children[0].textContent,"GERAL");
 assert.equal(rows[0].children[1].textContent,"Porta11");
 assert.equal(rows[0].children[2].textContent,"Trânsito5");
 assert.match(h.text("homeFretesAtualizacao"),/^Consultado às \d\d:\d\d$/);
 assert.equal(h.text("homeFretesAtualizacao"),h.text("homeVeiculosAtualizacao"));
 assert.equal(h.elements.get("homeFretesDetalhe").attributes.style,undefined);
});

test("Multi-base metrics preserve sums, provide compact summary and accessible all-base detail",()=>{
 const h=makeHarness();
 h.summary({
  bases:["FRETES","FRETES-GO","FRETES-MT","FRETES-SP"],failedBases:[],
  rows:[
   {id:"1",source:"FRETES",porta:1,transito:2},
   {id:"1",source:"FRETES-GO",porta:2,transito:1},
   {id:"2",source:"FRETES-MT",porta:4,transito:0},
   {id:"3",source:"FRETES-SP",porta:0,transito:1}
  ]
 });
 assert.equal(h.text("homeFretesAtivos"),"4");
 assert.equal(h.text("homeFretesDetalhe"),"GERAL: 1 • GO: 1 • +2 bases");
 assert.match(h.elements.get("homeFretesDetalhe").title,/SP: 1/);
 assert.equal(h.vehicle.children[0].textContent,"11");
 assert.equal(h.vehicle.children[1].textContent,"GERAL: 3 • GO: 3 • +2 bases");
 const rows=h.vehicle.children[2].children;
 assert.equal(rows.length,4);
 assert.deepEqual(rows.map(r=>r.children[0].textContent),["GERAL","GO","MT","SP"]);
 assert.ok(rows.every(row=>row.children.length===3));
 assert.match(h.vehicle.children[1].title,/SP: 1/);
});

test("Disconnected bases remain flagged without falsifying the consolidated totals",()=>{
 const h=makeHarness();
 h.summary({bases:["FRETES","FRETES-GO"],
  failedBases:["FRETES-GO"],
  rows:[{id:"1",source:"FRETES",porta:3,transito:2}]});
 assert.equal(h.text("homeFretesAtivos"),"1");
 assert.equal(h.vehicle.children[0].textContent,"5");
 assert.match(h.text("homeFretesAtualizacao"),/^1 base\(s\) indisponíveis/);
 assert.match(h.elements.get("homeFretesAtualizacao").title,/GO/);
});

test("Tenant styling is scoped and preserves Nova Frota's native KPI markup",()=>{
 const source=get("pages/home.html");
 assert.match(source,/body\.pf-tenant-mode \.pf-tenant-vehicle-total/);
 assert.match(source,/body\.pf-tenant-mode \.pf-tenant-vehicle-lines/);
 assert.match(source,/body\.pf-tenant-mode \.pf-tenant-freight-detail/);
 assert.match(source,/tenant-workspace[.]js[?]v=6/);
 assert.match(source,/id="homeVeiculosGOPorta"/);
 assert.match(source,/id="homeVeiculosMTPorta"/);
 assert.match(source,/id="homeFretesAtivos"/);
 assert.match(source,/body\.nf-profile-piso \.nf-stats/);
});
