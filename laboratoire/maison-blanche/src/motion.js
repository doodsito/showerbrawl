import {RULES} from './combat.js?v=obama-4';
// Presentation only: transforms never change combat positions or collision bounds.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=(current,target,rate,dt)=>current+(target-current)*(1-Math.exp(-rate*dt));
export function createMotion(f,time=0){
  return {x:f.x,y:f.y,time,phase:f.id*Math.PI,walk:0,lean:0,guard:0};
}
export function sampleMotion(f,time,state,{reducedMotion=false}={}){
  const dt=clamp(time-state.time,0,.1);
  const dx=f.x-state.x,dy=f.y-state.y;
  // Ignore displacement from knockback: it must not look like a walking step.
  const moving=f.walking&&f.stun===0&&f.hp>0;
  const distance=moving?Math.hypot(dx,dy/RULES.verticalSpeed):0;
  const speed=dt>0?Math.min(1,distance/dt/RULES.speed):state.walk;
  state.walk=ease(state.walk,moving?speed:0,22,dt);
  state.lean=ease(state.lean,moving&&dt>0?clamp(dx/dt/RULES.speed,-1,1):0,18,dt);
  state.guard=ease(state.guard,f.guard?1:0,24,dt);
  state.phase+=Math.min(distance,20)/64*Math.PI*2;
  state.x=f.x;state.y=f.y;state.time=time;
  const duration=f.kind==='super'?.4:.2;
  const recovery=clamp(f.pose/duration,0,1);
  const attack=recovery*recovery;
  const hit=clamp(f.flash/.18,0,1);
  if(reducedMotion)return {x:0,y:0,angle:0,sx:1,sy:1,guard:f.guard?1:0,step:0,shadow:1,attack};
  const foot=Math.sin(state.phase),bounce=Math.abs(foot)*state.walk;
  const breathing=Math.sin(time*3+f.id*1.7)*.007*(1-state.walk);
  const dead=f.hp<=0;
  return {
    x:f.face*((f.kind==='super'?13:9)*attack-3*state.guard-5*hit),
    y:-bounce*2.4,
    angle:dead?f.face*.28:state.lean*.065+foot*state.walk*.018+f.face*(.11*attack-.08*hit-.025*state.guard),
    sx:1+state.walk*.012*Math.cos(state.phase*2)+state.guard*.025,
    sy:dead?.8:1+breathing-state.walk*.02*Math.cos(state.phase*2)-state.guard*.055-hit*.025,
    guard:state.guard,step:bounce,shadow:1-bounce*.1,attack,
  };
}
