// Pure simulation: canvas and input adapters live in separate modules.
export const OCTAGON = [[275,338],[685,338],[825,390],[853,438],[735,502],[225,502],[107,438],[135,390]];
export const RULES = Object.freeze({duration:180, radius:14, speed:135, attackRange:67, superRange:105});
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export function inside(x,y,margin=RULES.radius) {
  return OCTAGON.every(([ax,ay],i) => {
    const [bx,by]=OCTAGON[(i+1)%8], dx=bx-ax,dy=by-ay;
    return (dx*(y-ay)-dy*(x-ax))/Math.hypot(dx,dy)>=margin-1e-6;
  });
}
export function constrain(f) {
  for(let pass=0;pass<4;pass++) for(let i=0;i<8;i++) {
    const [ax,ay]=OCTAGON[i],[bx,by]=OCTAGON[(i+1)%8],dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);
    const distance=(dx*(f.y-ay)-dy*(f.x-ax))/len;
    if(distance<RULES.radius){f.x-=dy/len*(RULES.radius-distance);f.y+=dx/len*(RULES.radius-distance);}
  }
}
function fighter(id,x) {return {id,x,y:423,hp:100,stamina:100,energy:0,face:id===0?1:-1,cooldown:0,guard:false,stun:0,flash:0,pose:0,kind:'attack',walking:false};}
export function createMatch() {return {fighters:[fighter(0,368),fighter(1,592)],time:0,remaining:RULES.duration,phase:'ready',winner:null,effects:[],hits:0,aiClock:.7};}
export function startMatch(w) {if(w.phase==='ready'||w.phase==='paused')w.phase='playing';}
export function pauseMatch(w) {if(w.phase==='playing')w.phase='paused';}
function finish(w) {
  const [a,b]=w.fighters;
  w.phase='finished';w.winner=a.hp===b.hp?null:a.hp>b.hp?0:1;
  for(const f of w.fighters)f.guard=false;
}
export function strike(w,id,kind='attack') {
  const f=w.fighters[id],other=w.fighters[1-id],superMove=kind==='super';
  if(w.phase!=='playing'||f.hp<=0||f.stun>0||f.cooldown>0||f.guard||!['attack','super'].includes(kind))return false;
  if(superMove ? f.energy<100 : f.stamina<15)return false;
  if(superMove)f.energy=0;else f.stamina-=15;
  f.cooldown=superMove?1.1:.42;f.pose=superMove?.4:.2;f.kind=kind;f.face=other.x>=f.x?1:-1;
  const distance=Math.hypot(other.x-f.x,(other.y-f.y)*1.5);
  if(distance<=(superMove?RULES.superRange:RULES.attackRange)) {
    const blocked=other.guard&&other.stamina>=12;
    const damage=blocked?(superMove?8:2):(superMove?30:9);
    other.hp=Math.max(0,other.hp-damage);other.stamina=Math.max(0,other.stamina-(blocked?20:0));
    other.stun=blocked?.08:.19;other.flash=.18;other.guard=blocked&&other.stamina>0;
    f.energy=clamp(f.energy+(superMove?0:22),0,100);other.energy=clamp(other.energy+10,0,100);
    const dx=other.x-f.x,dy=other.y-f.y,len=Math.hypot(dx,dy)||1,push=blocked?3:superMove?30:11;
    other.x+=dx/len*push;other.y+=dy/len*push;constrain(other);
    w.effects.push({x:other.x,y:other.y-40,ttl:.6,label:blocked?'GARDE':`−${damage}`,blocked,superMove});w.hits++;
    if(other.hp===0)finish(w);
  }else w.effects.push({x:f.x+f.face*36,y:f.y-37,ttl:.25,label:'',blocked:false,superMove});
  return true;
}
function move(f,x,y,dt) {
  const length=Math.max(1,Math.hypot(x,y)),speed=RULES.speed*(f.guard?.4:1);
  f.walking=!!(x||y)&&f.stun<=0;
  if(f.stun>0)return;
  f.x+=x/length*speed*dt;f.y+=y/length*speed*.62*dt;constrain(f);
}
export function tick(w,dt,input={},ai=true) {
  if(w.phase!=='playing')return;
  dt=clamp(dt,0,.05);w.time+=dt;w.remaining=Math.max(0,w.remaining-dt);
  for(const f of w.fighters){
    f.cooldown=Math.max(0,f.cooldown-dt);f.stun=Math.max(0,f.stun-dt);f.flash=Math.max(0,f.flash-dt);f.pose=Math.max(0,f.pose-dt);
    f.stamina=clamp(f.stamina+dt*(f.guard?-17:22),0,100);
  }
  const [p,b]=w.fighters;
  p.guard=!!input.guard&&p.stamina>1&&p.pose===0&&p.stun===0;
  move(p,input.x||0,input.y||0,dt);
  if(ai){
    const dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy*1.5);
    b.guard=d<85&&Math.sin(w.time*2.4)>.7&&b.stamina>20&&b.pose===0&&b.stun===0;
    move(b,d>53?Math.sign(dx):0,Math.abs(dy)>9?Math.sign(dy):0,dt);
    w.aiClock-=dt;
    if(w.aiClock<=0){if(d<64)strike(w,1,b.energy>=100?'super':'attack');w.aiClock=.75;}
  }else{b.guard=false;b.walking=false;}
  // Separate bodies even at the fence; never allow one fighter to walk through another.
  for(let pass=0;pass<3;pass++){
    const dx=b.x-p.x,dy=b.y-p.y,len=Math.hypot(dx,dy),minimum=30;
    if(len<minimum){const nx=len?dx/len:1,ny=len?dy/len:0,push=(minimum-len)/2;p.x-=nx*push;p.y-=ny*push;b.x+=nx*push;b.y+=ny*push;constrain(p);constrain(b);}
  }
  p.face=b.x>=p.x?1:-1;b.face=-p.face;
  if(input.attack)strike(w,0);
  if(input.super)strike(w,0,'super');
  w.effects=w.effects.filter(e=>(e.ttl-=dt)>0);
  if(w.remaining===0)finish(w);
}
