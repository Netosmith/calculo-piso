// Pure game rules. No DOM or rendering: reusable by a future authoritative room server.
export const VIEW_W=1440,VIEW_H=800,MAP_SCALE=1.5;
export const W=VIEW_W*MAP_SCALE,H=VIEW_H*MAP_SCALE,R=17;
export const obstacles=[{x:313,y:124,w:237,h:181},{x:888,y:124,w:238,h:181},{x:313,y:474,w:237,h:182},{x:888,y:474,w:238,h:182},{x:685,y:343,w:75,h:99}].map(o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,v*MAP_SCALE])));
export const coffeePoints=[{x:195,y:607.5},{x:1950,y:607.5}];
export const POWER_RULES={speed:{name:"Supervelocidade",duration:8,color:"#ffd76d",symbol:"ϟ"},double:{name:"Papel duplo",duration:10,color:"#bc9cff",symbol:"×2"}};
export const powerPoints=[{x:345,y:600,type:"speed"},{x:1815,y:600,type:"speed"},{x:1080,y:275,type:"double"},{x:1080,y:960,type:"double"}];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function blocked(x,y,r=R){return x<54*MAP_SCALE+r||x>W-54*MAP_SCALE-r||y<82*MAP_SCALE+r||y>H-82*MAP_SCALE-r||obstacles.some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h)}
function move(p,dx,dy){if(!blocked(p.x+dx,p.y))p.x+=dx;if(!blocked(p.x,p.y+dy))p.y+=dy;}
function clearLine(a,b){const d=distance(a,b);for(let k=0;k<d;k+=12){const t=k/d;if(blocked(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,4))return false}return true;}
// Small navigation grid lets bots route around desks instead of walking into them.
function path(a,b){const step=40,cols=Math.ceil(W/step),rows=Math.ceil(H/step);const start=[Math.floor(a.x/step),Math.floor(a.y/step)],end=[Math.floor(b.x/step),Math.floor(b.y/step)];const key=(x,y)=>y*cols+x;const queue=[start],seen=new Map([[key(...start),null]]);let found=null;
for(let i=0;i<queue.length;i++){const [x,y]=queue[i];if(x===end[0]&&y===end[1]){found=[x,y];break}for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(nx<0||nx>=cols||ny<0||ny>=rows||seen.has(k)||blocked(nx*step+20,ny*step+20,R+2))continue;seen.set(k,[x,y]);queue.push([nx,ny]);}}
if(!found)return [];const out=[];while(found&&(found[0]!==start[0]||found[1]!==start[1])){out.unshift({x:found[0]*step+20,y:found[1]*step+20});found=seen.get(key(...found))}return out;}
export class Match{
 constructor(size=3,name='Você',random=Math.random){this.random=random;this.size=clamp(size,1,3);this.time=180;this.elapsed=0;this.overtime=false;this.finished=false;this.score=[0,0];this.players=[];this.bullets=[];this.fireballs=[];this.puddles=[];this.effects=[];this.events=[];this.stations=[0,0];this.powerCooldowns=powerPoints.map(()=>0);this.sequence=0;const names=[name,'Marina','Lucas','Carla','Bruno','Rafael'];for(let team=0;team<2;team++)for(let i=0;i<this.size;i++){const p={id:team*3+i,name:names[team*3+i],team,x:0,y:0,angle:team?Math.PI:0,hp:100,kills:0,deaths:0,coffee:1,cooldown:0,dead:0,shield:1.5,bot:team!==0||i!==0,path:[],repath:0,walk:0};this.spawn(p,i);this.players.push(p)}}
 spawn(p,index=0){p.x=p.team?1875:285;p.y=390+index*210;p.powers={speed:0,double:0};p.fireCooldown=p.fireCooldown??0;p.hp=100;p.dead=0;p.shield=1.5;p.coffee=1;p.path=[];p.repath=0;}
 fire(p){
  if(p.dead>0||p.cooldown>0)return;
  p.cooldown=p.bot?.64:.34;
  // Parallel projectiles: both can hit one opponent when the aim is centered.
  for(const side of(p.powers.double>0?[-9,9]:[0])){
   const ca=Math.cos(p.angle),sa=Math.sin(p.angle);
   this.bullets.push({id:++this.sequence,x:p.x+ca*24-sa*side,y:p.y+sa*24+ca*side,vx:ca*610,vy:sa*610,team:p.team,owner:p.id,life:1.4,double:p.powers.double>0});
  }
  this.events.push({type:'throw',player:p.id});
 }
 castFireball(p){
  if(this.finished||p.dead>0||p.fireCooldown>0)return false;
  p.fireCooldown=12;
  this.fireballs.push({x:p.x,y:p.y,vx:Math.cos(p.angle)*470,vy:Math.sin(p.angle)*470,team:p.team,owner:p.id,life:1.8});
  this.events.push({type:'fireball',player:p.id});return true;
 }
 explode(b){
  this.effects.push({x:b.x,y:b.y,life:.5,type:'explosion'});
  this.events.push({type:'explosion',player:b.owner});
  for(const p of this.players){
   if(p.team===b.team||p.dead>0||p.shield>0||distance(p,b)>90||!clearLine(b,p))continue;
   p.hp=Math.max(0,p.hp-75);this.events.push({type:'hit',player:p.id});
   if(p.hp===0){p.dead=3;p.deaths++;this.score[b.team]++;const owner=this.players.find(q=>q.id===b.owner);if(owner)owner.kills++;
    this.events.push({type:'point',player:b.owner,target:p.id});if(this.overtime)this.finished=true;}
  }
 }

 collectPower(p){
  if(p.dead>0)return;
  powerPoints.forEach((point,i)=>{
   if(this.powerCooldowns[i]>0||distance(p,point)>34||p.powers[point.type]>0)return;
   p.powers[point.type]=POWER_RULES[point.type].duration;
   this.powerCooldowns[i]=18;
   this.events.push({type:'power',player:p.id,power:point.type});
  });
 }

 spill(p){if(p.dead>0||p.coffee<1)return;const x=p.x+Math.cos(p.angle)*42,y=p.y+Math.sin(p.angle)*42;if(blocked(x,y,4))return;p.coffee--;this.puddles.push({x,y,team:p.team,life:7,r:58});this.events.push({type:'coffee',player:p.id});}
 pickup(p){if(p.dead>0)return;coffeePoints.forEach((s,i)=>{if(distance(p,s)<65&&this.stations[i]<=0&&p.coffee<2){p.coffee++;this.stations[i]=12;this.events.push({type:'pickup',player:p.id})}})}
 tick(dt,input={}){if(this.finished)return;dt=clamp(dt,0,.05);this.events=[];this.elapsed+=dt;this.time-=dt;this.stations=this.stations.map(t=>Math.max(0,t-dt));this.powerCooldowns=this.powerCooldowns.map(t=>Math.max(0,t-dt));
 for(const p of this.players){p.cooldown=Math.max(0,p.cooldown-dt);p.fireCooldown=Math.max(0,p.fireCooldown-dt);p.shield=Math.max(0,p.shield-dt);for(const type of Object.keys(POWER_RULES))p.powers[type]=Math.max(0,p.powers[type]-dt);if(p.dead>0){p.dead-=dt;if(p.dead<=0)this.spawn(p,this.players.filter(a=>a.team===p.team).indexOf(p));continue}const command=input.players?.[p.id]||(p.id===0?input:{});let dx=0,dy=0;
 if(!p.bot){if(input.players||p.id===0){dx=Number(command.right||0)-Number(command.left||0);dy=Number(command.down||0)-Number(command.up||0);if(Number.isFinite(command.angle))p.angle=command.angle;if(command.fire)this.fire(p);if(command.super)this.castFireball(p);if(command.coffee)this.spill(p);if(command.pickup)this.pickup(p)}}else{const enemies=this.players.filter(e=>e.team!==p.team&&e.dead<=0).sort((a,b)=>distance(a,p)-distance(b,p));const opponent=enemies[0];const available=powerPoints.filter((q,i)=>this.powerCooldowns[i]<=0&&p.powers[q.type]<=0&&distance(p,q)<440).sort((a,b)=>distance(p,a)-distance(p,b))[0];const seeking=available&&(!opponent||distance(p,opponent)>300);const enemy=seeking?available:opponent;if(enemy){const d=distance(p,enemy),sight=clearLine(p,enemy);p.angle=Math.atan2(enemy.y-p.y,enemy.x-p.x);if(!seeking&&sight&&d<620){if(d<470&&p.fireCooldown<=0&&this.random()<dt*.35)this.castFireball(p);if(p.cooldown<=0){p.angle+=(this.random()-.5)*.32;this.fire(p)}if(d>235){dx=(enemy.x-p.x)/d;dy=(enemy.y-p.y)/d}else if(d<140){dx=(p.x-enemy.x)/d;dy=(p.y-enemy.y)/d}else{dx=Math.cos(p.angle+Math.PI/2)*Math.sin(this.elapsed+p.id);dy=Math.sin(p.angle+Math.PI/2)*Math.sin(this.elapsed+p.id)}if(d<155&&p.coffee&&this.random()<dt*.8)this.spill(p)}else{p.repath-=dt;if(p.repath<=0){p.path=path(p,enemy);p.repath=.7}while(p.path.length&&distance(p,p.path[0])<15)p.path.shift();const next=p.path[0];if(next){const nd=distance(p,next);dx=(next.x-p.x)/nd;dy=(next.y-p.y)/nd}}}this.pickup(p)}
 const length=Math.hypot(dx,dy);if(length>1){dx/=length;dy/=length}const slow=this.puddles.some(q=>q.team!==p.team&&distance(q,p)<q.r);const speed=(p.bot?175:225)*(slow?.48:1)*(p.powers.speed>0?1.65:1);const ox=p.x,oy=p.y;move(p,dx*speed*dt,dy*speed*dt);p.walk+=Math.hypot(p.x-ox,p.y-oy)*.15;this.collectPower(p);}
 for(const b of this.bullets){b.life-=dt;const steps=Math.max(1,Math.ceil(610*dt/7));for(let i=0;i<steps&&b.life>0;i++){b.x+=b.vx*dt/steps;b.y+=b.vy*dt/steps;if(blocked(b.x,b.y,3)){b.life=0;this.effects.push({x:b.x,y:b.y,life:.24,type:'wall'});break}const target=this.players.find(p=>p.team!==b.team&&p.dead<=0&&distance(p,b)<R+5);if(target){b.life=0;if(target.shield>0)break;target.hp=Math.max(0,target.hp-25);this.effects.push({x:target.x,y:target.y,life:.3,type:'hit'});this.events.push({type:'hit',player:target.id});if(!target.hp){target.dead=3;target.deaths++;this.score[b.team]++;const owner=this.players.find(p=>p.id===b.owner);if(owner)owner.kills++;this.events.push({type:'point',player:b.owner,target:target.id});if(this.overtime)this.finished=true}break}}}
 for(const b of this.fireballs){
  if(this.finished)break;
  b.life-=dt;let impact=b.life<=0;const steps=Math.max(1,Math.ceil(470*dt/6));
  for(let i=0;i<steps&&!impact;i++){
   const x=b.x+b.vx*dt/steps,y=b.y+b.vy*dt/steps;
   // Explode at the last open point, so furniture blocks blast damage behind it.
   if(blocked(x,y,12)){impact=true;break}
   b.x=x;b.y=y;
   impact=this.players.some(p=>p.team!==b.team&&p.dead<=0&&distance(p,b)<R+12);
  }
  if(impact){b.life=0;this.explode(b)}
 }
 this.fireballs=this.fireballs.filter(b=>b.life>0);

 this.bullets=this.bullets.filter(b=>b.life>0);this.puddles.forEach(p=>p.life-=dt);this.puddles=this.puddles.filter(p=>p.life>0);this.effects.forEach(e=>e.life-=dt);this.effects=this.effects.filter(e=>e.life>0);
 if(this.time<=0&&!this.finished){if(this.score[0]===this.score[1]&&!this.overtime){this.overtime=true;this.time=30;this.events.push({type:'overtime'})}else{this.time=0;this.finished=true}}}
}
