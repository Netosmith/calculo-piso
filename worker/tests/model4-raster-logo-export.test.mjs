import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

for(const module of ["fretes","fretes2"]){
 test(module+": Modelo 4 exports an exact visible raster instead of rerendering the raw logo",async()=>{
  const code=readFileSync(new URL("../../assets/js/"+module+".js",import.meta.url),"utf8");
  const start=code.indexOf("async function prepareMultiLogoRasterExport(source){");
  const end=code.indexOf("async function canvasFromPreview(row)",start);
  assert.ok(start>=0&&end>start);
  assert.match(code,/await prepareMultiLogoRasterExport\(source\)/);
  assert.doesNotMatch(code,/prepareLogoCanvasExport\(source,true\)/);
  let drawn=null,replacement=null,liveAttributes={},cloneStyle={};
  const hero={
   offsetWidth:1080,offsetHeight:300,
   getBoundingClientRect:()=>({left:280,top:0,width:240,height:66.66666666667})
  };
  const logo={
   complete:true,hidden:false,naturalWidth:800,naturalHeight:240,
   getBoundingClientRect:()=>({left:320,top:20,width:100,height:28}),
   closest:()=>hero
  };
  const canvas={
   width:0,height:0,
   getContext:()=>({globalAlpha:1,drawImage(...args){drawn=args}}),
   toDataURL:()=>"data:image/png;base64,bG9nbw=="
  };
  const document={
   createElement:tag=>tag==="canvas"?canvas:{
    style:{setProperty(prop,value){cloneStyle[prop]=value}},
    set src(value){this.imageSource=value}
   }
  };
  const getComputedStyle=()=>({display:"block",objectPosition:"center top",opacity:"1"});
  const Image=class{set src(value){this.imageSource=value}async decode(){}};
  const source={
   querySelector:()=>logo,
   setAttribute:(key,value)=>{liveAttributes[key]=value},
   removeAttribute:key=>{delete liveAttributes[key]}
  };
  const fn=new Function("document","getComputedStyle","Image",
    "return ("+code.slice(start,end).trim()+")"
  )(document,getComputedStyle,Image);
  const exportLogo=await fn(source);
  assert.deepEqual({width:canvas.width,height:canvas.height},{width:1080,height:300});
  assert.ok(drawn);
  assert.ok(Math.abs(drawn[1]-195)<0.1,"Raster X must use preview geometry");
  assert.ok(Math.abs(drawn[2]-90)<0.1,"Raster Y must use preview geometry");
  assert.ok(Math.abs(drawn[3]-420)<0.1,"Original aspect ratio must remain intact");
  assert.ok(Math.abs(drawn[4]-126)<0.1);
  exportLogo.onclone({
   querySelector:()=>({replaceWith(node){replacement=node}}),
   createElement:document.createElement
  });
  assert.ok(replacement);
  assert.equal(replacement.imageSource,"data:image/png;base64,bG9nbw==");
  assert.equal(cloneStyle.width,"1080px");
  assert.equal(cloneStyle.height,"300px");
  assert.equal(cloneStyle["object-fit"],"fill");
  exportLogo.finish();
  assert.deepEqual(liveAttributes,{});
 });
}
