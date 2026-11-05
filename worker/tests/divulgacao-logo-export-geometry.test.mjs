import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const root=new URL("../../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");

test("All art renderers load new scripts and parse",()=>{
 for(const [page,version] of [["divulgacao",20],["fretes",40],["fretes2",35]]){
  const html=read("pages/"+page+".html");
  const code=read("assets/js/"+page+".js");
  assert.match(html,new RegExp("assets/js/"+page+"\\.js\\?v="+version));
  assert.doesNotThrow(()=>new Script(code));
 }
});
test("Logo stays visible in html2canvas clone and uses the displayed dimensions",()=>{
 for(const [script,method] of [["divulgacao","prepareArtLogoExport"],["fretes","prepareLogoCanvasExport"],["fretes2","prepareLogoCanvasExport"]]){
  const code=read("assets/js/"+script+".js");
  assert.match(code,new RegExp("function "+method+"\\(source\\)"));
  assert.match(code,/getBoundingClientRect\(\)/);
  if(script!=="divulgacao"){
    assert.match(code,/left:rect\.left-parent\.left,top:rect\.top-parent\.top/);
    assert.match(code,/width:rect\.width,height:rect\.height/);
    assert.doesNotMatch(code,/hero\.offsetWidth\/parent\.width/);
    assert.doesNotMatch(code,/hero\.offsetHeight\/parent\.height/);
  }
  if(script==="divulgacao"){
    assert.match(code,/hero\.offsetWidth\/parent\.width/);
    assert.match(code,/hero\.offsetHeight\/parent\.height/);
  }
  assert.match(code,/visibility:"visible"/);
  assert.match(code,/display:"block"/);
  assert.match(code,/style\.setProperty\(/);
  assert.doesNotMatch(code,/visibility","hidden","important"/);
  assert.doesNotMatch(code,/logoExport\.draw\(canvas\)/);
  assert.equal((code.match(/onclone:logoExport\.onclone/g)||[]).length,2);
  assert.equal((code.match(/logoExport\.finish\(\)/g)||[]).length,2);
 }
});
