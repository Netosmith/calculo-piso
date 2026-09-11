export const W=960,H=480,R=11,POCKETS=[[0,0],[480,0],[960,0],[0,480],[480,480],[960,480]];
export const group=id=>id===0?'branca':id===8?'oito':id<8?'lisas':'listradas';
export function rack(){const balls=[{id:0,x:240,y:240,vx:0,vy:0}];const ids=[1,9,2,10,8,3,4,11,5,12,13,6,14,7,15];let n=0;for(let row=0;row<5;row++)for(let col=0;col<=row;col++)balls.push({id:ids[n++],x:650+row*R*1.75,y:240+(col-row/2)*R*2.04,vx:0,vy:0});return balls}
export function newMatch(){return {balls:rack(),turn:0,groups:[null,null],winner:null,ballInHand:false,revision:0,message:'Mesa aberta. Acerte qualquer bola, exceto a 8.'}}
export function place(balls,x,y){return Number.isFinite(x)&&Number.isFinite(y)&&x>=R&&x<=W-R&&y>=R&&y<=H-R&&!POCKETS.some(p=>Math.hypot(x-p[0],y-p[1])<30)&&!balls.some(b=>b.id&&!b.pocketed&&Math.hypot(x-b.x,y-b.y)<2*R+1)}
export function simulate(input,angle,power){
 const balls=structuredClone(input),cue=balls.find(b=>b.id===0);cue.vx=Math.cos(angle)*(100+power*850);cue.vy=Math.sin(angle)*(100+power*850);
 const frames=[],potted=[];let first=null,rail=false,steps=0;
 for(;steps<3000;steps++){
  for(const b of balls){if(b.pocketed)continue;b.x+=b.vx/120;b.y+=b.vy/120;
   if(POCKETS.some(p=>Math.hypot(b.x-p[0],b.y-p[1])<25)){b.pocketed=true;b.vx=b.vy=0;potted.push(b.id);continue}
   if(b.x<R||b.x>W-R){b.x=Math.max(R,Math.min(W-R,b.x));b.vx*=-.82;if(first!==null)rail=true}
   if(b.y<R||b.y>H-R){b.y=Math.max(R,Math.min(H-R,b.y));b.vy*=-.82;if(first!==null)rail=true}
   const speed=Math.hypot(b.vx,b.vy),factor=speed>0?Math.max(0,speed-75/120)/speed:0;b.vx*=factor;b.vy*=factor;
  }
  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
   const a=balls[i],b=balls[j];if(a.pocketed||b.pocketed)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=2*R||d===0)continue;
   const nx=dx/d,ny=dy/d,over=(2*R-d)/2;a.x-=nx*over;a.y-=ny*over;b.x+=nx*over;b.y+=ny*over;
   const v=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(v<=0)continue;
   if(first===null&&(a.id===0||b.id===0))first=a.id||b.id;
   const impulse=v*.97;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;
  }
  if(steps%4===0)frames.push(balls.map(b=>[Math.round(b.x*10)/10,Math.round(b.y*10)/10,b.pocketed?1:0]));
  if(balls.every(b=>Math.hypot(b.vx,b.vy)<.1))break;
 }
 for(const b of balls)b.vx=b.vy=0;
 frames.push(balls.map(b=>[b.x,b.y,b.pocketed?1:0]));return {balls,frames,potted,first,rail};
}
export function adjudicate(state,result){
 const next=structuredClone(state),own=state.groups[state.turn],remaining=state.balls.filter(b=>!b.pocketed&&group(b.id)===own).length;
 const legalFirst=result.first!==null&&(own?(remaining?group(result.first)===own:result.first===8):result.first!==8);
 const foul=result.potted.includes(0)||!legalFirst||(!result.rail&&!result.potted.length);
 next.balls=result.balls;next.revision++;next.ballInHand=foul;
 if(result.potted.includes(8)){next.winner=!foul&&own&&remaining===0?state.turn:1-state.turn;next.message='Fim de partida.';return next}
 if(!foul&&!own){const id=result.potted.find(id=>id!==0&&id!==8);if(id){next.groups[state.turn]=group(id);next.groups[1-state.turn]=group(id)==='lisas'?'listradas':'lisas'}}
 const keeps=!foul&&result.potted.some(id=>group(id)===next.groups[state.turn]);if(!keeps)next.turn=1-state.turn;
 next.message=foul?'Falta. Posicione a bola branca antes de jogar.':keeps?'Boa! Você continua.':'Vez do outro jogador.';return next;
}
export function shoot(state,command){
 if(state.winner!==null)throw Error('A partida terminou.');
 if(!Number.isFinite(command.angle)||!Number.isFinite(command.power)||command.power<0||command.power>1)throw Error('Tacada inválida.');
 const prepared=structuredClone(state);
 if(state.ballInHand){if(!place(prepared.balls,command.x,command.y))throw Error('Escolha um espaço livre para a branca.');Object.assign(prepared.balls.find(b=>b.id===0),{x:command.x,y:command.y,pocketed:false})}
 const result=simulate(prepared.balls,command.angle,command.power);return {state:adjudicate(prepared,result),frames:result.frames};
}
