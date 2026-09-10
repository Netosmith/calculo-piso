import {W,H,VIEW_W,VIEW_H} from './simulation.js';
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export class Camera {
 constructor(){this.x=0;this.y=0;this.zoom=1;}
 follow(player,overview=false){
  this.zoom=overview?VIEW_W/W:1;
  this.x=overview?0:clamp(player.x-VIEW_W/2,0,W-VIEW_W);
  this.y=overview?0:clamp(player.y-VIEW_H/2,0,H-VIEW_H);
 }
 toWorld(x,y){return{x:this.x+x/this.zoom,y:this.y+y/this.zoom};}
}
