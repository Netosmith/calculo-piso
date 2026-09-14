import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as engine from '../sinuca/engine.js';
import {bindControls} from '../sinuca/controls.js';
async function app(){
 const nodes=new Map(),frames=[];
 class Element extends EventTarget{
  constructor(id){super();this.id=id;this.value=id==='power'?'55':'';this.disabled=false;this.classList={toggle(){},remove(){}}}
  focus(){} closest(){return null}
  click(){if(!this.disabled){this.onclick?.({preventDefault(){}});this.dispatchEvent(new Event('click'))}}
  getBoundingClientRect(){return {left:0,top:0,width:1080,height:600}}
  getContext(){return new Proxy({},{get:(_,key)=>key==='createLinearGradient'||key==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}})}
 }
 const document=new Element('document');document.getElementById=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id)};
 const ctx=vm.createContext({...engine,bindControls,document,authorize:async()=>({unlocked:true}),api:async()=>{throw Error('No network in practice test')},structuredClone,Date,performance,URLSearchParams,URL,location:{search:''},requestAnimationFrame:fn=>frames.push(fn),setInterval:()=>{},console});
 const source=(await readFile(new URL('../sinuca/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 await vm.runInContext(`(async()=>{${source}\nglobalThis.inspect=()=>({state,animation,locked:controls.locked,display});})()`,ctx);
 function event(id,type,props){const e=new Event(type,{cancelable:true});for(const [key,value]of Object.entries(props))Object.defineProperty(e,key,{value});(id==='document'?document:document.getElementById(id)).dispatchEvent(e)}
 return {nodes,event,inspect:()=>ctx.inspect(),frame:time=>frames.shift()?.(time)};
}
test('full practice app moves cue ball after mouse lock and space, then permits the next shot',async()=>{
 const a=await app();a.event('table','pointerdown',{button:0,clientX:700,clientY:300});assert.equal(a.inspect().locked,true);
 a.event('document','keydown',{key:' ',code:'Space',repeat:false});
 assert.ok(a.inspect().animation,'space must start the real simulation, not just a click callback');assert.equal(a.inspect().locked,false);
 const start=a.inspect().animation.start;a.frame(start-1);a.frame(start+150);assert.notEqual(a.inspect().display[0].x,240,'cue must move on animation frames');
 a.frame(start+30000);assert.equal(a.inspect().animation,null);a.event('table','pointerdown',{button:0,clientX:500,clientY:330});assert.equal(a.inspect().locked,true);
 a.nodes.get('shoot').click();assert.ok(a.inspect().animation,'visible fire button must also shoot');
});
test('cancel button and Escape release aim without shooting; Space code fires directly',async()=>{
 const a=await app();a.event('table','pointerdown',{button:0,clientX:700,clientY:300});
 assert.equal(a.nodes.get('cancelAim').disabled,false);a.nodes.get('cancelAim').click();assert.equal(a.inspect().locked,false);assert.equal(a.inspect().animation,null);
 a.nodes.get('shoot').click();assert.match(a.nodes.get('error').textContent,/fixar/);assert.equal(a.inspect().animation,null);
 a.event('table','pointerdown',{button:0,clientX:700,clientY:300});a.event('document','keydown',{key:'Escape'});assert.equal(a.inspect().locked,false);
 a.event('table','pointerdown',{button:0,clientX:700,clientY:300});
 // A keyboard shot must not depend on the DOM button's click implementation.
 a.nodes.get('shoot').click=()=>{throw Error('Keyboard must call the shot directly')};
 a.event('document','keydown',{key:'Spacebar',code:'Space',repeat:false});assert.ok(a.inspect().animation);
});
test('ten consecutive shots survive queued frame timestamps preceding each shot',async()=>{
 const a=await app();
 for(let shot=0;shot<10;shot++){
  if(a.inspect().state.ballInHand){
   let free;for(let x=100;x<900&&!free;x+=60)for(let y=100;y<400;y+=60)if(engine.place(a.inspect().state.balls,x,y)){free={x,y};break}
   assert.ok(free);a.event('table','pointerdown',{button:0,clientX:free.x+60,clientY:free.y+60});
  }
  a.event('table','pointerdown',{button:0,clientX:700,clientY:180+shot*20});
  a.event('document','keydown',{key:' ',code:'Space',repeat:false});
  assert.ok(a.inspect().animation,`shot ${shot+1} must start`);
  const start=a.inspect().animation.start;a.frame(start-5);a.frame(start+160);a.frame(start+30000);
  assert.equal(a.inspect().animation,null);assert.equal(a.inspect().locked,false);
 }
});
test('scratch allows white-ball placement and a new animated shot',async()=>{
 const a=await app();Object.assign(a.inspect().state.balls[0],{x:40,y:40});a.nodes.get('power').value='15';
 a.event('table','pointerdown',{button:0,clientX:60,clientY:60});a.event('document','keydown',{key:' ',code:'Space'});
 assert.equal(a.inspect().state.ballInHand,true);a.frame(a.inspect().animation.start+30000);
 a.event('table','pointerdown',{button:0,clientX:300,clientY:300});assert.equal(a.inspect().state.balls[0].pocketed,false);
 a.event('table','pointerdown',{button:0,clientX:700,clientY:300});a.event('document','keydown',{key:' ',code:'Space'});
 assert.ok(a.inspect().animation);const start=a.inspect().animation.start;a.frame(start-1);a.frame(start+30000);assert.equal(a.inspect().animation,null);
});
