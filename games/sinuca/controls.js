// Pointer and keyboard controls shared by practice and online play.
export function bindControls({canvas,keyboard,power,canPlay,needsPlacement,placeCue,aim,fire,changed,blocked}) {
 let locked=false;
 const notify=()=>changed(locked);
 const reset=()=>{locked=false;notify()};
 canvas.addEventListener('pointermove',event=>{
  if(canPlay()&&!locked&&!needsPlacement())aim(event);
 });
 canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||!canPlay())return;
  event.preventDefault();canvas.focus({preventScroll:true});
  if(needsPlacement()){placeCue(event);reset();return}
  if(locked){reset();return}
  aim(event);locked=true;notify();
 });
 const shoot=()=>{if(!canPlay()||!locked||needsPlacement()){blocked?.();return false}fire();return true};
 keyboard.addEventListener('keydown',event=>{
  // Typing a room code/password must never change the game or fire a shot.
  if(event.target?.closest?.('input:not([type="range"]), textarea, select, [contenteditable="true"]'))return;
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  const key=event.code==='Space'?' ':String(event.key||'').toLowerCase();
  if(!['a','d',' ','escape'].includes(key))return;
  event.preventDefault();
  if(key==='escape'){reset();return}
  if(key===' '){if(!event.repeat)shoot();return}
  if(!canPlay())return;
  const step=key==='a'?-2:2;
  power.value=String(Math.max(1,Math.min(100,Number(power.value)+step)));notify();
 });
 power.addEventListener('input',notify);
 return {get locked(){return locked},reset,shoot};
}
