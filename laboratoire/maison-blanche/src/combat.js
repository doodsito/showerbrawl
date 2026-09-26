import {wallCorners,wallContact,wallSegmentEntry,wallsOverlap} from './wall.js';
// Pure simulation: canvas and input adapters live in separate modules.
export const OCTAGON = [[275,338],[685,338],[825,390],[853,438],[735,502],[225,502],[107,438],[135,390]];
export const RULES = Object.freeze({duration:180, radius:14, speed:180, retreatSpeed:300, retreatRange:160, projectileSpeed:440, projectileRange:340, dashCooldown:3.5, dashDuration:.28, dashSpeed:850, projectilePush:125, dropDelay:.85, dropRadius:110, dropAftermath:1.25, verticalSpeed:.72, attackMoveScale:.45, hitStun:.1, attackRange:67, superRange:105, launchDuration:.56, wallWidth:24, wallDepth:70, wallSlant:.45, wallHealth:36, wallLifetime:6, wallCooldown:9});
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
function fighter(id,x,character='trump') {return {id,character,dash:null,shove:null,x,y:423,hp:100,stamina:100,energy:0,face:id===0?1:-1,cooldown:0,wallCooldown:0,guard:false,stun:0,flash:0,pose:0,kind:'attack',walking:false,recoil:0,recoilDirection:1,launch:null};}
export function createMatch(character='trump',opponent=character) {return {fighters:[fighter(0,368,character),fighter(1,592,opponent)],time:0,remaining:RULES.duration,phase:'ready',winner:null,effects:[],walls:[],projectiles:[],drops:[],hits:0,aiClock:.7};}
export function startMatch(w) {if(w.phase==='ready'||w.phase==='paused')w.phase='playing';}
export function pauseMatch(w) {if(w.phase==='playing')w.phase='paused';}
function finish(w) {
  const [a,b]=w.fighters;
  w.phase='finished';w.winner=a.hp===b.hp?null:a.hp>b.hp?0:1;
  for(const f of w.fighters)f.guard=false;
}
// The rendered wall and all collisions use the same oblique footprint.
function overlapsWall(f,wall,margin=RULES.radius) {
  return !!wallContact(f,wall,margin);
}
export function deployWall(w,id=0) {
  const f=w.fighters[id];
  if(w.phase!=='playing'||f.hp<=0||f.stun>0||f.pose>0||f.wallCooldown>0)return false;
  const wall={owner:id,x:f.x+f.face*76,y:f.y,width:RULES.wallWidth,depth:RULES.wallDepth,slant:RULES.wallSlant,
    hp:RULES.wallHealth,ttl:RULES.wallLifetime,age:0,flash:0};
  if(!wallCorners(wall).every(({x,y})=>inside(x,y,3))||
    w.fighters.some(body=>overlapsWall(body,wall,RULES.radius+4))||
    w.walls.some(other=>wallsOverlap(wall,other)))return false;
  w.walls.push(wall);f.wallCooldown=RULES.wallCooldown;f.guard=false;
  return true;
}
export function defend(w,id=0,direction={}) {
  const f=w.fighters[id],other=w.fighters[1-id];
  if(f.character!=='obama')return deployWall(w,id);
  if(w.phase!=='playing'||f.hp<=0||f.stun>0||f.cooldown>0||f.wallCooldown>0||f.stamina<25||f.dash)return false;
  let dx=direction.x||0,dy=direction.y||0;
  if(!dx&&!dy){dx=f.x-other.x;dy=(f.y-other.y)/RULES.verticalSpeed;}
  const len=Math.hypot(dx,dy)||1;
  f.dash={dx:dx/len,dy:dy/len,remaining:RULES.dashDuration};f.wallCooldown=RULES.dashCooldown;f.stamina-=25;f.guard=false;
  return true;
}
function resolveWalls(w,f) {
  for(const wall of w.walls){
    const contact=wallContact(f,wall,RULES.radius);
    if(contact){f.x=contact.x;f.y=contact.y;}
  }
}

function displace(w,f,dx,dy,stopAtBodies=false) {
  // Small steps keep knockback and fast movement from crossing a thin obstacle.
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/4));
  for(let i=0;i<steps;i++){
    const previous={x:f.x,y:f.y};f.x+=dx/steps;f.y+=dy/steps;
    if(stopAtBodies&&w.walls.some(wall=>overlapsWall(f,wall))){f.x=previous.x;f.y=previous.y;break;}
    constrain(f);resolveWalls(w,f);constrain(f);
    if(stopAtBodies&&w.fighters.some(other=>other!==f&&!other.launch&&Math.hypot(other.x-f.x,other.y-f.y)<30)){
      f.x=previous.x;f.y=previous.y;break;
    }
  }
}
function wallOnSegment(w,f,dx,dy) {
  let nearest=null,best=Infinity;
  for(const wall of w.walls){
    const entry=wallSegmentEntry(wall,f,dx,dy);
    if(entry!==null&&entry<best){best=entry;nearest=wall;}
  }
  return nearest;
}
function breakWall(w,wall) {
  w.walls=w.walls.filter(item=>item!==wall);
  w.effects.push({x:wall.x,y:wall.y,ttl:.6,label:'',rubble:true});
}
function launchAcross(w,attacker,target) {
  const direction=target.x>=attacker.x?1:-1;
  let low=0,high=960;
  for(let i=0;i<24;i++){const distance=(low+high)/2;if(inside(target.x+direction*distance,target.y))low=distance;else high=distance;}
  target.launch={fromX:target.x,toX:target.x+direction*low,y:target.y,elapsed:0,duration:RULES.launchDuration,direction};
  target.stun=RULES.launchDuration+.42;target.guard=false;target.walking=false;
}
function advanceLaunch(w,f,dt) {
  const launch=f.launch;launch.elapsed=Math.min(launch.duration,launch.elapsed+dt);
  const t=launch.elapsed/launch.duration,nextX=launch.fromX+(launch.toX-launch.fromX)*(t+.12*Math.sin(Math.PI*t));
  const steps=Math.max(1,Math.ceil(Math.abs(nextX-f.x)/4)),dx=(nextX-f.x)/steps;
  for(let i=0;i<steps;i++){
    f.x+=dx;
    for(const wall of [...w.walls])if(overlapsWall(f,wall))breakWall(w,wall);
  }
  constrain(f);
  if(t===1){f.launch=null;f.recoil=.42;f.recoilDirection=launch.direction;w.effects.push({x:f.x,y:f.y,ttl:1.15,duration:1.15,impact:true,direction:launch.direction});}
}
export function strike(w,id,kind='attack') {
  const f=w.fighters[id],other=w.fighters[1-id],superMove=kind==='super';
  if(w.phase!=='playing'||f.hp<=0||f.stun>0||f.cooldown>0||f.guard||f.launch||f.dash||other.launch||!['attack','super'].includes(kind))return false;
  if(superMove ? f.energy<100 : f.stamina<15)return false;
  if(superMove)f.energy=0;else f.stamina-=15;
  f.cooldown=superMove?1.1:.42;f.pose=superMove?.4:.2;f.kind=kind;f.face=other.x>=f.x?1:-1;
  if(f.character==='obama'){
    const dx=other.x-f.x,dy=other.y-f.y,len=Math.hypot(dx,dy*1.5)||1;
    if(superMove){const reach=Math.min(1,300/len);w.drops.push({owner:id,x:f.x+dx*reach,y:f.y+dy*reach,age:0,hit:false});}
    else w.projectiles.push({owner:id,x:f.x,y:f.y,dx:dx/len,dy:dy/len,travelled:0});
    return true;
  }
  if(superMove)w.effects.push({x:f.x,y:f.y-95,ttl:.65,label:"YOU’RE FIRED!",fired:true});
  const distance=Math.hypot(other.x-f.x,(other.y-f.y)*1.5);
  const range=superMove?RULES.superRange:RULES.attackRange;
  const reach=Math.min(1,range/(distance||1));
  const wall=wallOnSegment(w,f,(other.x-f.x)*reach,(other.y-f.y)*reach);
  if(wall){
    const damage=superMove?36:12;wall.hp=Math.max(0,wall.hp-damage);wall.flash=.18;
    f.energy=clamp(f.energy+(superMove?0:12),0,100);
    w.effects.push({x:wall.x,y:wall.y-40,ttl:.6,label:`−${damage}`,blocked:true,superMove});
    if(wall.hp===0)breakWall(w,wall);
    return true;
  }
  if(distance<=range) {
    const blocked=other.guard&&other.stamina>=12;
    const damage=blocked?(superMove?8:2):(superMove?30:9);
    other.hp=Math.max(0,other.hp-damage);other.stamina=Math.max(0,other.stamina-(blocked?20:0));
    other.stun=blocked?.06:RULES.hitStun;other.flash=.18;other.guard=blocked&&other.stamina>0;
    f.energy=clamp(f.energy+(superMove?0:22),0,100);other.energy=clamp(other.energy+10,0,100);
    const dx=other.x-f.x,dy=other.y-f.y,len=Math.hypot(dx,dy)||1,push=blocked?3:superMove?30:11;
    if(superMove)launchAcross(w,f,other);else displace(w,other,dx/len*push,dy/len*push);
    w.effects.push({x:other.x,y:other.y-40,ttl:.6,label:blocked?'GARDE':`−${damage}`,blocked,superMove});w.hits++;
    if(other.hp===0&&!other.launch)finish(w);
  }else w.effects.push({x:f.x+f.face*36,y:f.y-37,ttl:.25,label:'',blocked:false,superMove});
  return true;
}
function pushFighter(f,dx,dy,distance,duration=.26){
  const len=Math.hypot(dx,dy)||1;
  f.shove={dx:dx/len,dy:dy/len,distance,duration,remaining:duration};
  f.stun=Math.max(f.stun,duration+.08);f.dash=null;f.walking=false;
}
function projectileHit(w,shot,target) {
  const attacker=w.fighters[shot.owner],blocked=target.guard&&target.stamina>=12;
  target.hp=Math.max(0,target.hp-(blocked?3:10));target.flash=.18;target.stun=blocked?.06:RULES.hitStun;
  if(blocked)target.stamina=Math.max(0,target.stamina-20);
  attacker.energy=clamp(attacker.energy+20,0,100);target.energy=clamp(target.energy+10,0,100);w.hits++;
  pushFighter(target,shot.dx,shot.dy,blocked?45:RULES.projectilePush);
  w.effects.push({x:target.x,y:target.y-40,ttl:.6,label:'',blocked});
}
function advanceProjectiles(w,dt) {
  w.projectiles=w.projectiles.filter(shot=>{
    const distance=Math.min(RULES.projectileSpeed*dt,RULES.projectileRange-shot.travelled),steps=Math.max(1,Math.ceil(distance/4));
    for(let i=0;i<steps;i++){
      const dx=shot.dx*distance/steps,dy=shot.dy*distance/steps;
      const wall=wallOnSegment(w,shot,dx,dy);
      if(wall){wall.hp=Math.max(0,wall.hp-12);wall.flash=.18;if(!wall.hp)breakWall(w,wall);return false;}
      shot.x+=dx;shot.y+=dy;shot.travelled+=distance/steps;
      if(!inside(shot.x,shot.y,0))return false;
      const target=w.fighters[1-shot.owner];
      if(!target.launch&&Math.hypot(target.x-shot.x,(target.y-shot.y)*1.5)<RULES.radius+7){projectileHit(w,shot,target);return false;}
    }
    return shot.travelled<RULES.projectileRange-1e-6;
  });
}
function advanceDrops(w,dt) {
  w.drops=w.drops.filter(drop=>{
    drop.age+=dt;
    if(!drop.hit&&drop.age>=RULES.dropDelay){
      drop.hit=true;
      for(const wall of [...w.walls])if(Math.hypot(wall.x-drop.x,(wall.y-drop.y)*1.5)<RULES.dropRadius)breakWall(w,wall);
      const target=w.fighters[1-drop.owner],dx=target.x-drop.x,dy=target.y-drop.y;
      if(!target.launch&&Math.hypot(dx,dy*1.5)<=RULES.dropRadius){
        target.hp=Math.max(0,target.hp-28);target.flash=.22;target.stun=.3;target.guard=false;target.energy=clamp(target.energy+10,0,100);w.hits++;
        pushFighter(target,Math.hypot(dx,dy)>1e-6?dx:w.fighters[drop.owner].face,dy,100,.32);
      }
    }
    return drop.age<RULES.dropDelay+RULES.dropAftermath;
  });
}
function move(w,f,x,y,dt) {
  const length=Math.max(1,Math.hypot(x,y));
  // Committing to a strike gives the other fighter a chance to disengage.
  const recovery=f.cooldown>0?RULES.attackMoveScale:1;
  const other=w.fighters[1-f.id],awayX=f.x-other.x,awayY=(f.y-other.y)/RULES.verticalSpeed;
  const distance=Math.hypot(awayX,awayY);
  const retreat=distance<RULES.retreatRange&&distance>0&&
    (x*awayX+y*awayY)/length>distance*.35&&f.cooldown===0&&!f.guard;
  // Running away from a nearby opponent must create space, even at equal base speed.
  const speed=(retreat?RULES.retreatSpeed:RULES.speed)*(f.guard?.4:recovery);
  f.walking=!!(x||y)&&f.stun<=0;
  if(f.stun>0||f.dash)return;
  displace(w,f,x/length*speed*dt,y/length*speed*RULES.verticalSpeed*dt);
}
export function tick(w,dt,input={},ai=true) {
  if(w.phase!=='playing')return;
  dt=clamp(dt,0,.05);w.time+=dt;w.remaining=Math.max(0,w.remaining-dt);
  for(const wall of [...w.walls]){wall.ttl-=dt;wall.age+=dt;wall.flash=Math.max(0,wall.flash-dt);if(wall.ttl<=0)breakWall(w,wall);}
  for(const f of w.fighters){
    f.recoil=Math.max(0,f.recoil-dt);
    f.wallCooldown=Math.max(0,f.wallCooldown-dt);
    f.cooldown=Math.max(0,f.cooldown-dt);f.stun=Math.max(0,f.stun-dt);f.flash=Math.max(0,f.flash-dt);f.pose=Math.max(0,f.pose-dt);
    f.stamina=clamp(f.stamina+dt*(f.guard?-17:22),0,100);
    if(f.launch){f.shove=null;advanceLaunch(w,f,dt);}
    if(f.shove){
      const push=f.shove,duration=Math.min(dt,push.remaining);
      displace(w,f,push.dx*push.distance*duration/push.duration,push.dy*push.distance*duration/push.duration);
      push.remaining-=duration;if(push.remaining<=1e-6)f.shove=null;
    }
    if(f.dash){
      if(f.stun>0||f.launch)f.dash=null;
      else {const duration=Math.min(dt,f.dash.remaining);displace(w,f,f.dash.dx*RULES.dashSpeed*duration,f.dash.dy*RULES.dashSpeed*RULES.verticalSpeed*duration,true);f.dash.remaining-=duration;if(f.dash.remaining<=0)f.dash=null;}
    }
  }
  const [p,b]=w.fighters;
  p.guard=!!input.guard&&p.stamina>1&&p.pose===0&&p.stun===0&&!p.dash;
  move(w,p,input.x||0,input.y||0,dt);
  if(ai){
    const dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy*1.5);
    b.guard=d<85&&Math.sin(w.time*2.4)>.7&&b.stamina>20&&b.pose===0&&b.stun===0&&!b.dash;
    if(b.character==='obama'&&d<75)defend(w,1);
    move(w,b,d>(b.character==='obama'?190:53)?Math.sign(dx):0,Math.abs(dy)>9?Math.sign(dy):0,dt);
    w.aiClock-=dt;
    if(w.aiClock<=0){if(d<(b.character==='obama'?300:64)||wallOnSegment(w,b,dx*Math.min(1,RULES.attackRange/(d||1)),dy*Math.min(1,RULES.attackRange/(d||1))))strike(w,1,b.energy>=100?'super':'attack');w.aiClock=.75;}
  }else{b.guard=false;b.walking=false;}
  // Separate bodies even at the fence; never allow one fighter to walk through another.
  for(let pass=0;pass<3;pass++){
    const dx=b.x-p.x,dy=b.y-p.y,len=Math.hypot(dx,dy),minimum=30;
    if(len<minimum&&!p.launch&&!b.launch){const nx=len?dx/len:1,ny=len?dy/len:0,push=(minimum-len)/2;displace(w,p,-nx*push,-ny*push);displace(w,b,nx*push,ny*push);}
  }
  p.face=b.x>=p.x?1:-1;b.face=-p.face;
  if(input.attack)strike(w,0);
  if(input.super)strike(w,0,'super');
  advanceProjectiles(w,dt);advanceDrops(w,dt);
  w.effects=w.effects.filter(e=>(e.ttl-=dt)>0);
  if(!w.fighters.some(f=>f.launch||f.shove)&&(w.remaining===0||w.fighters.some(f=>f.hp===0)))finish(w);
}
