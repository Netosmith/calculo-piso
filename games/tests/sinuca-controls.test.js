import test from 'node:test';
import assert from 'node:assert/strict';
import {bindControls} from '../sinuca/controls.js';
function fixture(){
 const canvas=new EventTarget(),keyboard=new EventTarget(),power=new EventTarget();power.value='55';canvas.focus=()=>{};
 const state={ready:true,placing:false,aim:0,shots:[],changes:0};
 const controls=bindControls({canvas,keyboard,power,canPlay:()=>state.ready,needsPlacement:()=>state.placing,placeCue:()=>{state.placing=false},aim:e=>{state.aim=e.clientX},fire:()=>{state.shots.push({aim:state.aim,power:Number(power.value)});controls.reset()},changed:()=>state.changes++});
 const emit=(node,type,props={})=>{const e=new Event(type,{cancelable:true});for(const [key,value] of Object.entries(props))Object.defineProperty(e,key,{value});node.dispatchEvent(e);return e};
 return {canvas,keyboard,power,state,controls,move:x=>emit(canvas,'pointermove',{clientX:x}),click:(x,button=0)=>emit(canvas,'pointerdown',{clientX:x,button}),key:(key,props={})=>emit(keyboard,'keydown',{key,...props})};
}
test('mouse aims, left click locks direction, A/D adjust force and space fires once',()=>{
 const f=fixture();f.move(120);f.key(' ');assert.equal(f.state.shots.length,0);
 f.click(140);f.move(300);assert.equal(f.controls.locked,true);assert.equal(f.state.aim,140);
 f.key('a');assert.equal(f.power.value,'53');f.key('D');f.key('d');assert.equal(f.power.value,'57');
 assert.equal(f.key(' ').defaultPrevented,true);assert.deepEqual(f.state.shots,[{aim:140,power:57}]);assert.equal(f.controls.locked,false);
 f.move(400);assert.equal(f.state.aim,400);f.key(' ',{repeat:true});assert.equal(f.state.shots.length,1);
});
test('unlock, placement, busy state and typing never accidentally fire or move aim',()=>{
 const f=fixture();f.click(100,2);assert.equal(f.controls.locked,false);
 f.click(100);f.click(200);assert.equal(f.controls.locked,false);f.move(250);assert.equal(f.state.aim,250);
 f.state.placing=true;f.click(300);assert.equal(f.controls.locked,false);assert.equal(f.state.placing,false);f.click(350);assert.equal(f.controls.locked,true);
 f.state.ready=false;f.key('d');f.key(' ');f.click(450);assert.equal(f.state.shots.length,0);assert.equal(f.power.value,'55');assert.equal(f.state.aim,350);
 f.state.ready=true;f.key('a',{target:{closest:()=>true}});f.key(' ',{target:{closest:()=>true}});assert.equal(f.power.value,'55');assert.equal(f.state.shots.length,0);
 f.key(' ',{repeat:true});assert.equal(f.state.shots.length,0);f.key('Escape');assert.equal(f.controls.locked,false);
});
test('power keys clamp to 1–100 and do not intercept browser shortcuts',()=>{
 const f=fixture();f.power.value='1';f.key('a');assert.equal(f.power.value,'1');f.power.value='100';f.key('d');assert.equal(f.power.value,'100');f.key('a',{ctrlKey:true});assert.equal(f.power.value,'100');
});
