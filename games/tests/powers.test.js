import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,blocked,powerPoints,POWER_RULES,W,H,VIEW_W,VIEW_H} from '../js/simulation.js';
import {Camera} from '../js/camera.js';

test('larger world and all power stations are reachable',()=>{
 assert.equal(W*H/(1440*800),2.25);
 for(const p of powerPoints)assert.equal(blocked(p.x,p.y),false);
});

test('pickup activates on contact, has shared cooldown and cannot stack duration',()=>{
 const m=new Match(1),p=m.players[0],q=m.players[1],station=powerPoints[0];
 Object.assign(p,{x:station.x,y:station.y});m.tick(1/60);
 assert.equal(p.powers.speed,8);assert.equal(m.powerCooldowns[0],18);
 Object.assign(q,{x:station.x,y:station.y,bot:false});m.collectPower(q);
 assert.equal(q.powers.speed,0);
 m.tick(.05);assert.ok(p.powers.speed<8);
 assert.ok(m.powerCooldowns[0]<18);
 p.x=300;p.y=300;q.x=1850;q.y=300;
 for(let i=0;i<60*19;i++)m.tick(1/60);
 assert.equal(p.powers.speed,0);assert.equal(m.powerCooldowns[0],0);
 Object.assign(q,{x:station.x,y:station.y});m.collectPower(q);
 assert.equal(q.powers.speed,8);
});

test('speed boosts travel by 65 percent and coffee still slows boosted enemies',()=>{
 const a=new Match(1),b=new Match(1),c=new Match(1);
 for(const m of [a,b,c]){m.players.forEach(p=>p.bot=false);Object.assign(m.players[0],{x:600,y:600});}
 b.players[0].powers.speed=8;c.players[0].powers.speed=8;
 c.puddles.push({x:600,y:600,r:58,life:7,team:1});
 for(const m of [a,b,c])m.tick(.05,{right:true});
 const base=a.players[0].x-600,boost=b.players[0].x-600,slow=c.players[0].x-600;
 assert.ok(Math.abs(boost/base-1.65)<.001);
 assert.ok(Math.abs(slow/boost-.48)<.001);
});

test('double paper fires two parallel shots, deals two hits and expires',()=>{
 const m=new Match(1),[a,b]=m.players;
 for(const p of m.players)p.bot=false;
 Object.assign(a,{x:600,y:600,angle:0});Object.assign(b,{x:680,y:600,shield:0});
 a.powers.double=10;m.fire(a);
 assert.equal(m.bullets.length,2);
 assert.equal(m.bullets[0].vx,m.bullets[1].vx);
 assert.notEqual(m.bullets[0].y,m.bullets[1].y);
 for(let i=0;i<12;i++)m.tick(1/60);
 assert.equal(b.hp,50);
 a.powers.double=.01;m.tick(.02);a.cooldown=0;m.fire(a);
 assert.equal(m.bullets.length,1);
});

test('powers combine but are cleared on respawn and a fresh match',()=>{
 const m=new Match(1),p=m.players[0];
 for(const q of [powerPoints[0],powerPoints[2]]){Object.assign(p,{x:q.x,y:q.y});m.collectPower(p)}
 assert.equal(p.powers.speed,8);assert.equal(p.powers.double,10);
 p.dead=1;p.powers.speed=0;Object.assign(p,{x:powerPoints[1].x,y:powerPoints[1].y});m.collectPower(p);
 assert.equal(p.powers.speed,0);
 m.spawn(p);assert.deepEqual(p.powers,{speed:0,double:0});
 assert.deepEqual(new Match(1).powerCooldowns,[0,0,0,0]);
});

test('camera clamps to map edges and aim follows the world while pointer stays still',()=>{
 const c=new Camera();c.follow({x:50,y:50});assert.deepEqual(c.toWorld(100,100),{x:100,y:100});
 c.follow({x:W-50,y:H-50});assert.equal(c.x,W-VIEW_W);assert.equal(c.y,H-VIEW_H);
 assert.deepEqual(c.toWorld(100,100),{x:W-VIEW_W+100,y:H-VIEW_H+100});
 c.follow({x:50,y:50},true);assert.deepEqual(c.toWorld(VIEW_W,VIEW_H),{x:W,y:H});
});
