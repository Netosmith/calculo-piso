import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url));
const expo=JSON.parse(read("app.json").toString("utf8")).expo;
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);

function checkPng(path,{width,height,rgba,sha256}){
  const file=read(path);
  assert.deepEqual(file.subarray(0,8),pngSignature,path+" precisa ser PNG");
  assert.equal(file.subarray(12,16).toString(),"IHDR");
  assert.equal(file.readUInt32BE(16),width);
  assert.equal(file.readUInt32BE(20),height);
  assert.equal(file[25],rgba?6:2,"tipo de cor PNG");
  assert.equal(createHash("sha256").update(file).digest("hex"),sha256,
    "preservar a logo original fornecida");
}

test("Android aponta para os PNGs oficiais da Nova Frota, sem alterar a configuração iOS",()=>{
  assert.equal(expo.version,"0.3.10");
  assert.equal(expo.android.versionCode,14);
  assert.equal(expo.android.package,"br.com.portalfrete.mobile");
  assert.equal(expo.android.icon,"./assets/icon.png");
  assert.equal(expo.android.adaptiveIcon.foregroundImage,"./assets/adaptive-icon.png");
  assert.equal(expo.android.adaptiveIcon.backgroundColor,"#FFFFFF");
  assert.equal(expo.ios.bundleIdentifier,"br.com.portalfrete.mobile");
  assert.equal(expo.ios.icon,undefined);
});

test("ícones são PNG reais, mantendo exatamente os arquivos enviados",()=>{
  checkPng("assets/icon.png",{
    width:1024,height:1024,rgba:false,
    sha256:"8eb0edfb88da190ccdf2a6c73822dd367905823fbcb09ee8151f9cdbb1835524"
  });
  checkPng("assets/adaptive-icon.png",{
    width:432,height:432,rgba:true,
    sha256:"c197db437ca0f5647dba884a12702a9dec26a44facd5a41f4bfe0482aaabd602"
  });
});
