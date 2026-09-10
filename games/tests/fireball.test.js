import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,obstacles} from '../js/simulation.js';
function setup(){const m=new Match(2);m.players.forEach(p=>{p.bot=false;p.shield=0});Object.assign(m.players[0],{x:600,y:600,angle:0});Object.assign(m.players[1],{x:690,y:620});Object.assign(m.players[2],{x:700,y:600});Object.assign(m.players[3],{x:730,y:640});return m}
test('Q launches only one fireball even with double paper and enforces cooldown',()=>{
 const m=setup(),p=m.players[0];p.powers.double=10;m.tick(1/60,{super:true,angle:0});
 assert.equal(m.fireballs.length,1);assert.equal(p.fireCooldown,12);assert.equal(m.castFireball(p),false);
 m.spawn(p);assert.equal(p.fireCooldown,12);
 p.dead=1;p.fireCooldown=0;assert.equal(m.castFireball(p),false);
 p.dead=0;p.fireCooldown=.01;m.tick(.02);assert.equal(m.castFireball(p),true);
});
test('explosion hurts nearby enemies but not allies, then disappears',()=>{
 const m=setup();m.castFireball(m.players[0]);for(let i=0;i<20;i++)m.tick(1/60);
 assert.equal(m.players[0].hp,100);assert.equal(m.players[1].hp,100);
 assert.equal(m.players[2].hp,25);assert.equal(m.players[3].hp,25);
 assert.equal(m.fireballs.length,0);
});
test('blast honors shields and awards a single point per defeated enemy',()=>{
 const m=setup();m.players[2].hp=75;m.players[3].shield=2;
 m.castFireball(m.players[0]);for(let i=0;i<25;i++)m.tick(1/60);
 assert.equal(m.players[2].hp,0);assert.equal(m.players[3].hp,100);
 assert.equal(m.score[0],1);assert.equal(m.players[0].kills,1);
});
test('copier blocks fireball and blast from reaching the opposite side',()=>{
 const m=setup(),o=obstacles[4];Object.assign(m.players[0],{x:o.x-60,y:o.y+40,angle:0});
 Object.assign(m.players[2],{x:o.x+o.w+20,y:o.y+40});m.players[3].x=1900;
 m.castFireball(m.players[0]);for(let i=0;i<35;i++)m.tick(1/60);
 assert.equal(m.fireballs.length,0);assert.equal(m.players[2].hp,100);
 // Direct blast beside the copier cannot damage through its corner either.
 Object.assign(m.players[2],{x:o.x+30,y:o.y+o.h+20});
 m.explode({x:o.x-15,y:o.y+o.h-35,team:0,owner:0});assert.equal(m.players[2].hp,100);
});
