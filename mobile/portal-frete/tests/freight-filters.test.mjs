import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  locationUF,destinationCity,availableOriginStates,
  availableDestinationCities,filterFreightOffers
} from "../src/freight-filters.js";

const offers=[
  {source:"fretes",origem:"CRISTALINA-GO",destino:"UBERABA-MG",produto:"SOJA",
    coleta:"ARMAZÉM BOA VISTA",descarga:"INDÚSTRIA"},
  {source:"fretes",origem:"RIO VERDE - GO",destino:"SANTOS-SP",produto:"MILHO"},
  {source:"fretes2",origem:"RONDONÓPOLIS/MT",destino:"UBERABA - MG",produto:"FARELO"},
  {source:"fretes",origem:"ANÁPOLIS-GO",destino:"Uberaba / MG",produto:"SOJA"},
  {source:"fretes",origem:"Cidade não informada",destino:"PALMAS-TO",produto:"SORGO"}
];
test("interpreta UF sem confundir com nome da cidade",()=>{
  assert.equal(locationUF("Cristalina-GO"),"GO");
  assert.equal(locationUF("Rio Verde - GO"),"GO");
  assert.equal(locationUF("RONDONÓPOLIS/MT"),"MT");
  assert.equal(locationUF("São Paulo, SP"),"SP");
  assert.equal(locationUF("SÃO SIMÃO"),"");
  assert.equal(locationUF("GOIÂNIA-ZZ"),"");
  assert.equal(destinationCity("Uberaba-MG"),"Uberaba");
  assert.equal(destinationCity("SANTOS-SP"),"SANTOS");
  assert.equal(destinationCity("Rondonópolis / MT"),"Rondonópolis");
  assert.equal(destinationCity("São Paulo, SP"),"São Paulo");
});
test("opções de estado e destino surgem só das ofertas divulgadas",()=>{
  assert.deepEqual(availableOriginStates(offers),["GO","MT"]);
  assert.deepEqual(availableDestinationCities(offers,"GO"),["SANTOS","UBERABA"]);
  assert.deepEqual(availableDestinationCities(offers,"MT"),["UBERABA"]);
  assert.deepEqual(availableDestinationCities(offers),["PALMAS","SANTOS","UBERABA"]);
  assert.deepEqual(availableOriginStates([]),[]);
});
test("combina estado origem + cidade destino + busca, sem mudar os dados",()=>{
  const go=filterFreightOffers(offers,{originUF:"GO"});
  assert.equal(go.length,3);
  const uberaba=filterFreightOffers(offers,{destination:"Uberaba"});
  assert.equal(uberaba.length,3);
  const precise=filterFreightOffers(offers,{originUF:"GO",destination:"UBERABA",search:"soja"});
  assert.equal(precise.length,2);
  assert.equal(precise[0].origem,"CRISTALINA-GO");
  assert.equal(filterFreightOffers(offers,{originUF:"MT",destination:"SANTOS"}).length,0);
  assert.equal(filterFreightOffers(offers,{search:"armazem boa vista"}).length,1);
  assert.equal(filterFreightOffers(offers).length,5);
  assert.equal(offers.length,5);
});
test("a tela oferece filtros dinâmicos e mantém proteção do catálogo público",()=>{
  const ui=readFileSync(new URL("../src/DriverArea.js",import.meta.url),"utf8");
  assert.match(ui,/availableOriginStates\(freightOffers\)/);
  assert.match(ui,/availableDestinationCities\(freightOffers,freightOriginUF\)/);
  assert.match(ui,/filterFreightOffers\(freightOffers/);
  assert.match(ui,/Estado de origem/);
  assert.match(ui,/Cidade de destino/);
  assert.match(ui,/setFreightDestination\(""\)/);
  assert.match(ui,/Limpar filtros/);
  assert.match(ui,/visibleFreights\.map/);
  assert.match(ui,/\/v1\/driver-freights/);
  assert.doesNotMatch(ui,/\/v1\/fretes\b/);
});
