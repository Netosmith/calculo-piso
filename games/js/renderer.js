import{W,H,VIEW_W,VIEW_H,MAP_SCALE,coffeePoints,powerPoints,POWER_RULES,obstacles}from'./simulation.js';
import{Camera}from'./camera.js';
const colors=['#359bff','#68d877'];
export class Renderer{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.map=new Image();this.map.src=new URL('../assets/office.webp',import.meta.url).href;this.aim={x:720,y:400};this.camera=new Camera();}
 draw(match,active=false,overview=false){const c=this.c;this.camera.follow(match.players[0],overview);c.clearRect(0,0,VIEW_W,VIEW_H);c.save();c.scale(this.camera.zoom,this.camera.zoom);c.translate(-this.camera.x,-this.camera.y);if(this.map.complete&&this.map.naturalWidth)c.drawImage(this.map,0,0,W,H);else{c.fillStyle='#cbd0cc';c.fillRect(0,0,W,H)}
 // Team spawn markers are gameplay overlays, not part of the background art.
 for(let t=0;t<2;t++){const x=(t?1361:79)*MAP_SCALE;c.save();c.fillStyle=t?'#378b5140':'#1574be40';c.fillRect(x-14,510,28,180);c.translate(x,600);c.rotate(t?-Math.PI/2:Math.PI/2);c.fillStyle=t?'#267343':'#1d6095';c.font='bold 12px Segoe UI';c.textAlign='center';c.fillText(t?'EQUIPE VERDE':'EQUIPE AZUL',0,5);c.restore()}
 for(const q of match.puddles){c.save();c.globalAlpha=Math.min(1,q.life);c.fillStyle='#754527b5';c.beginPath();c.ellipse(q.x,q.y,q.r,q.r*.62,.15,0,Math.PI*2);c.fill();for(let i=0;i<6;i++){c.beginPath();c.ellipse(q.x+Math.cos(i*2.3)*q.r,q.y+Math.sin(i*2.3)*q.r*.7,6,4,0,0,7);c.fill()}c.restore()}
 coffeePoints.forEach((p,i)=>{c.save();c.translate(p.x,p.y);c.globalAlpha=match.stations[i]>0?.4:1;c.fillStyle='#0d2934dd';c.beginPath();c.roundRect(-23,-24,46,48,10);c.fill();c.strokeStyle='#edc88a';c.lineWidth=2;c.stroke();c.font='25px Segoe UI Emoji';c.textAlign='center';c.fillText('☕',0,8);c.font='bold 11px Segoe UI';c.fillStyle='#263845';c.fillText(match.stations[i]>0?`${Math.ceil(match.stations[i])}s`:'E · PEGAR',0,42);c.restore()});
 for(let i=0;i<powerPoints.length;i++){
 const q=powerPoints[i],rule=POWER_RULES[q.type],cooldown=match.powerCooldowns[i];
 c.save();c.translate(q.x,q.y);c.globalAlpha=cooldown>0?.48:1;
 c.fillStyle='#0e213ae8';c.strokeStyle=cooldown>0?'#798b99':rule.color;c.lineWidth=2.5;
 c.beginPath();c.arc(0,0,27+(cooldown?0:Math.sin(match.elapsed*3)*2),0,Math.PI*2);c.fill();c.stroke();
 c.fillStyle=rule.color;c.textAlign='center';c.font='bold 25px Segoe UI';c.fillText(rule.symbol,0,9);
 c.font='bold 12px Segoe UI';c.lineWidth=4;c.strokeStyle='#f1f3edf0';
 const label=cooldown>0?`VOLTA EM ${Math.ceil(cooldown)}s`:q.type==='speed'?'VELOCIDADE':'PAPEL DUPLO';
 c.strokeText(label,0,49);c.fillStyle='#153146';c.fillText(label,0,49);c.restore();
 }
 for(const p of [...match.players].sort((a,b)=>a.y-b.y))this.player(p,match.elapsed);
 for(const b of match.bullets){c.save();c.translate(b.x,b.y);c.rotate(Math.atan2(b.vy,b.vx));c.strokeStyle=b.double?'#ba8cffcc':'#ffffff9f';c.lineWidth=3;c.beginPath();c.moveTo(-22,0);c.lineTo(-8,0);c.stroke();c.fillStyle='#fafbf4';c.strokeStyle='#7f8a91';c.lineWidth=1.2;c.beginPath();c.moveTo(7,0);c.lineTo(4,6);c.lineTo(-3,7);c.lineTo(-7,1);c.lineTo(-4,-6);c.lineTo(3,-7);c.closePath();c.fill();c.stroke();c.beginPath();c.moveTo(-3,-3);c.lineTo(2,0);c.lineTo(-1,4);c.stroke();c.restore()}

 for(const b of match.fireballs){
  c.save();c.translate(b.x,b.y);c.rotate(Math.atan2(b.vy,b.vx));
  const trail=c.createLinearGradient(-64,0,15,0);trail.addColorStop(0,'#ef451000');trail.addColorStop(.7,'#ff762bd9');trail.addColorStop(1,'#fff2ac');
  c.fillStyle=trail;c.beginPath();c.moveTo(-65,0);c.quadraticCurveTo(-22,-24,12,-12);c.quadraticCurveTo(30,0,12,12);c.quadraticCurveTo(-22,24,-65,0);c.fill();
  const glow=c.createRadialGradient(0,0,3,0,0,26);glow.addColorStop(0,'#fff4b8');glow.addColorStop(.4,'#ffb93f');glow.addColorStop(1,'#ff3c0000');
  c.fillStyle=glow;c.beginPath();c.arc(0,0,26,0,7);c.fill();c.restore();
 }
 for(const e of match.effects){if(e.type==='explosion'){c.save();c.translate(e.x,e.y);const t=1-e.life/.5;c.globalAlpha=Math.max(0,1-t);c.strokeStyle='#ff8b32';c.lineWidth=8*(1-t)+1;c.beginPath();c.arc(0,0,20+70*t,0,7);c.stroke();c.fillStyle='#ffbe5270';c.fill();for(let i=0;i<12;i++){const a=i*Math.PI/6;c.fillStyle=i%2?'#ffe5a1':'#ff6031';c.beginPath();c.arc(Math.cos(a)*(20+t*70),Math.sin(a)*(20+t*70),5*(1-t)+1,0,7);c.fill()}c.restore();continue}c.save();c.translate(e.x,e.y);c.globalAlpha=e.life/.3;c.fillStyle=e.type==='hit'?'#ffe489':'#ffffff';c.beginPath();for(let i=0;i<12;i++){const a=i*Math.PI/6,r=i%2?12:32;c.lineTo(Math.cos(a)*r,Math.sin(a)*r)}c.closePath();c.fill();c.restore()}
 c.restore();if(active)this.minimap(match);
 if(active){const p=match.players[0];if(p.dead>0){c.save();c.fillStyle='#071b2aab';c.fillRect(0,0,VIEW_W,VIEW_H);c.textAlign='center';c.fillStyle='#fff';c.font='bold 36px Segoe UI';c.fillText(`De volta em ${Math.ceil(p.dead)}…`,VIEW_W/2,VIEW_H/2);c.font='18px Segoe UI';c.fillText('Respire. A revanche vem aí.',VIEW_W/2,VIEW_H/2+35);c.restore()}else{c.save();c.strokeStyle='#0a456a';c.lineWidth=2;c.beginPath();c.arc(this.aim.x,this.aim.y,10,0,7);c.moveTo(this.aim.x-15,this.aim.y);c.lineTo(this.aim.x-6,this.aim.y);c.moveTo(this.aim.x+6,this.aim.y);c.lineTo(this.aim.x+15,this.aim.y);c.moveTo(this.aim.x,this.aim.y-15);c.lineTo(this.aim.x,this.aim.y-6);c.moveTo(this.aim.x,this.aim.y+6);c.lineTo(this.aim.x,this.aim.y+15);c.stroke();c.restore()}}}
 minimap(match){
 const c=this.c,scale=.12,x=VIEW_W-W*scale-20,y=20;
 c.save();c.translate(x,y);c.fillStyle='#071b2bea';c.strokeStyle='#7796ad';c.lineWidth=1;
 c.beginPath();c.roundRect(-8,-8,W*scale+16,H*scale+34,8);c.fill();c.stroke();
 c.fillStyle='#a9b6b550';for(const o of obstacles)c.fillRect(o.x*scale,o.y*scale,o.w*scale,o.h*scale);
 powerPoints.forEach((p,i)=>{if(match.powerCooldowns[i]<=0){c.fillStyle=POWER_RULES[p.type].color;c.fillRect(p.x*scale-2,p.y*scale-2,4,4)}});
 for(const p of match.players){if(p.dead>0)continue;c.fillStyle=colors[p.team];c.beginPath();c.arc(p.x*scale,p.y*scale,p.local===true?5:3,0,7);c.fill();if(p.local===true){c.strokeStyle='#fff';c.stroke()}}
 c.strokeStyle='#b7d4eea0';c.strokeRect(this.camera.x*scale,this.camera.y*scale,VIEW_W*scale,VIEW_H*scale);
 c.fillStyle='#c1d4e2';c.font='10px Segoe UI';c.textAlign='left';c.fillText('CENTRAL AMPLIADA · VOCÊ ●',0,H*scale+18);c.restore();
 }
 player(p,time){const c=this.c;if(p.dead>0)return;const bob=Math.sin(p.walk)*2;c.save();c.translate(p.x,p.y);if(p.powers.speed>0||p.powers.double>0){c.strokeStyle=p.powers.speed>0?'#f5c946':'#a878f2';c.lineWidth=3;c.beginPath();c.arc(0,0,34,0,7);c.stroke();c.font='bold 16px Segoe UI';c.textAlign='center';c.fillStyle=c.strokeStyle;c.fillText((p.powers.speed>0?'ϟ ':'')+(p.powers.double>0?'×2':''),0,45)}c.fillStyle='#15202c35';c.beginPath();c.ellipse(0,15,25,12,0,0,7);c.fill();c.lineWidth=p.bot?3:4;c.strokeStyle=colors[p.team];c.fillStyle=p.team?'#66d77638':'#379cff38';c.beginPath();c.ellipse(0,9,25,19,0,0,7);c.fill();c.stroke();if(p.shield>0){c.setLineDash([5,4]);c.strokeStyle='#e8faff';c.beginPath();c.arc(0,0,31+Math.sin(time*5)*2,0,7);c.stroke();c.setLineDash([])}
 c.save();c.rotate(p.angle+Math.PI/2);c.fillStyle='#152134';c.beginPath();c.ellipse(-8,13+bob,7,10,0,0,7);c.ellipse(8,13-bob,7,10,0,0,7);c.fill();c.fillStyle=colors[p.team];c.strokeStyle='#16304a';c.lineWidth=2;c.beginPath();c.roundRect(-16,-9,32,30,12);c.fill();c.stroke();c.fillStyle='#f0bd93';c.beginPath();c.ellipse(19,-13,6,8,-.3,0,7);c.fill();c.stroke();c.fillStyle='#fff';c.beginPath();c.moveTo(-4,0);c.lineTo(0,12);c.lineTo(4,0);c.fill();c.fillStyle='#235180';c.fillRect(-1,3,3,9);c.fillStyle='#eabb96';c.beginPath();c.arc(0,-12,17,0,7);c.fill();c.stroke();c.fillStyle=['#30231e','#5b3526','#1b232b'][p.id%3];c.beginPath();c.arc(-1,-17,17,Math.PI*.75,Math.PI*2.35);c.quadraticCurveTo(9,-8,4,-9);c.quadraticCurveTo(-1,-4,-6,-11);c.closePath();c.fill();c.restore();
 c.textAlign='center';c.font=`${p.bot?'600':'800'} 13px Segoe UI`;c.lineWidth=4;c.strokeStyle='#f5f6eddb';const label=p.local===true?'VOCÊ':p.name;c.strokeText(label,0,-43);c.fillStyle=p.team?'#164728':'#073e78';c.fillText(label,0,-43);c.fillStyle='#15322b';c.fillRect(-21,-37,42,6);c.fillStyle=p.hp>25?'#8eef8c':'#ff846d';c.fillRect(-20,-36,40*p.hp/100,4);c.restore();}
}
