import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const root=new URL("../../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");

test("All art export pages include the proportional raster before their scripts",()=>{
  for(const [page,version] of [["divulgacao",21],["fretes",43],["fretes2",38]]){
    const html=read("pages/"+page+".html");
    const code=read("assets/js/"+page+".js");
    const raster=html.indexOf("../assets/js/art-logo-raster.js?v=20261107-fix-1");
    const app=html.indexOf("../assets/js/"+page+".js?v="+version);
    assert.ok(raster>=0&&app>raster,"Helper must load before "+page);
    assert.doesNotThrow(()=>new Script(code));
    assert.match(code, /await prepare(?:ArtLogoExport|LogoCanvasExport)\((?:preview|source)\)/);
    assert.match(code,/onclone:logoExport\.onclone/);
    assert.match(code,/logoExport\.finish\(\)/);
    assert.doesNotMatch(code,/logoExport\.draw\(canvas\)/);
  }
});

test("Fretes keeps the proven model 4 raster and uses the exact preview raster in model 3",()=>{
  for(const name of ["fretes","fretes2"]){
    const code=read("assets/js/"+name+".js");
    assert.match(code,/async function prepareLogoCanvasExport\(source,visualSnapshot=false\)/);
    assert.match(code,/PortalArtLogoRaster\.prepare\(source,\{/);
    assert.match(code,/logoSelector:"\.nfM3Logo",heroSelector:"\.nfM3Hero"/);
    assert.equal((code.match(/await prepareLogoCanvasExport\(source\)/g)||[]).length,1);
    assert.equal((code.match(/await prepareMultiLogoRasterExport\(source\)/g)||[]).length,1);
    assert.match(code,/clone\.replaceWith\(replacement\)/);
  }
});

test("Divulgação uses one proportional raster for both model 3 and manual multi artworks",()=>{
  const code=read("assets/js/divulgacao.js");
  assert.match(code,/async function prepareArtLogoExport\(source\)/);
  assert.match(code,/logoSelector:model3\?"\.m3Logo":"\.multiArtLogo"/);
  assert.match(code,/heroSelector:model3\?"\.m3Hero":"\.multiArtHero"/);
  assert.equal((code.match(/await prepareArtLogoExport\(preview\)/g)||[]).length,2);
});

test("Raster keeps natural logo proportions and preview position through CSS scaling",async()=>{
  const source=read("assets/js/art-logo-raster.js");
  assert.doesNotThrow(()=>new Script(source));
  for(const [selector,heroSelector,scale,height] of [
    [".m3Logo",".m3Hero",.375,455],
    [".nfM3Logo",".nfM3Hero",2/9,455],
    [".multiArtLogo",".multiArtHero",.375,300]
  ]){
    let draw=null,replacement=null,done=false;
    const styles={};
    const hero={
      offsetWidth:1080,offsetHeight:height,
      getBoundingClientRect:()=>({left:90,top:100,width:1080*scale,height:height*scale})
    };
    const logo={
      hidden:false,complete:true,naturalWidth:800,naturalHeight:200,
      getBoundingClientRect:()=>({
        left:90+360*scale,top:100+12*scale,width:320*scale,height:128*scale
      }),
      closest:query=>query===heroSelector?hero:null
    };
    const canvas={
      width:0,height:0,
      getContext:()=>({globalAlpha:1,drawImage(...args){draw=args}}),
      toDataURL:()=>"data:image/png;base64,TE9HTw=="
    };
    const mockDocument={
      createElement:name=>name==="canvas"?canvas:{
        style:{setProperty(key,value){styles[key]=value}},
        setAttribute(){},set src(value){this.srcValue=value}
      }
    };
    const window={};
    new Function("window","document","Image","getComputedStyle",source)(
      window,mockDocument,
      class {set src(_value){} async decode(){}},
      ()=>({display:"block",visibility:"visible",opacity:"1",
        objectPosition:"center top",zIndex:"4"})
    );
    const attrs={};
    const preview={
      querySelector:query=>query===selector?logo:null,
      setAttribute:(k,v)=>{attrs[k]=v},
      removeAttribute:k=>{delete attrs[k];done=true}
    };
    const frozen=await window.PortalArtLogoRaster.prepare(preview,{logoSelector:selector,heroSelector});
    assert.deepEqual([canvas.width,canvas.height],[1080,height]);
    assert.ok(draw);
    assert.ok(Math.abs(draw[1]-360)<.001);
    assert.ok(Math.abs(draw[2]-12)<.001);
    assert.ok(Math.abs(draw[3]/draw[4]-4)<1e-9,"Must keep original 800:200 aspect ratio");
    assert.equal(draw[3],320);
    frozen.onclone({
      querySelector:()=>({replaceWith:node=>{replacement=node}}),
      createElement:mockDocument.createElement
    });
    assert.ok(replacement,"Cloned logo must be substituted with a frozen hero raster");
    assert.equal(replacement.srcValue,"data:image/png;base64,TE9HTw==");
    assert.equal(styles.width,"1080px");
    assert.equal(styles.height,height+"px");
    assert.equal(styles["object-fit"],"fill"); // Full hero raster matches hero size.
    frozen.finish();
    assert.equal(done,true);
    assert.deepEqual(attrs,{});
  }
});
