import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,startMatch,pauseMatch,tick,strike,deployWall,RULES,inside} from '../src/combat.js';
const playing=()=>{const w=createMatch();startMatch(w);return w;};
const advance=(w,seconds,input={},ai=false)=>{for(let i=0;i<Math.round(seconds*60);i++)tick(w,1/60,input,ai);};

test('wall placement is fixed in world space and only succeeds in valid free space',()=>{
  const w=playing();assert.equal(deployWall(w),true);const wall=w.walls[0],origin={x:wall.x,y:wall.y};
  assert.equal(deployWall(w),false);advance(w,1,{x:-1,y:1});assert.equal(wall.x,origin.x);assert.equal(wall.y,origin.y);
  for(const [dx,dy] of [[-1,-1],[1,-1],[1,1],[-1,1]])assert.ok(inside(wall.x+dx*wall.width/2+dy*wall.depth/2*wall.slant,wall.y+dy*wall.depth/2,3));
  for(const placement of ['cage','fighter','wall']){
    const m=playing();if(placement==='cage')m.fighters[0].x=770;
    if(placement==='fighter')m.fighters[1].x=450;
    if(placement==='wall'){deployWall(m);m.fighters[0].wallCooldown=0;}
    assert.equal(deployWall(m),false,placement);assert.equal(m.fighters[0].wallCooldown,0);
  }
});
test('wall blocks both fighters, but the player can walk around its ends',()=>{
  const w=playing();deployWall(w);const wall=w.walls[0];
  advance(w,.8,{x:1},true);
  const offset=f=>f.x-wall.x-wall.slant*(f.y-wall.y),clearance=wall.width/2+RULES.radius*Math.hypot(1,wall.slant);
  assert.ok(offset(w.fighters[0])<=-clearance+.001);
  assert.ok(offset(w.fighters[1])>=clearance-.001);
  const m=playing();deployWall(m);advance(m,.8,{y:1});advance(m,1.2,{x:1});
  assert.ok(m.fighters[0].x>m.walls[0].x+m.walls[0].width/2);
});
test('punches damage the wall even when the opponent is beyond punch range',()=>{
  const w=playing();deployWall(w);
  for(let i=0;i<3;i++){w.fighters[0].cooldown=0;assert.equal(strike(w,0),true);assert.equal(w.fighters[1].hp,100);}
  assert.equal(w.walls.length,0);assert.ok(w.effects.some(e=>e.rubble));
  advance(w,.7,{x:1});assert.ok(w.fighters[0].x>418);
});
test('super destroys an intervening wall without damaging the protected opponent',()=>{
  const w=playing();deployWall(w);w.fighters[0].x=404;w.fighters[1].x=496;w.fighters[0].energy=100;
  assert.equal(strike(w,0,'super'),true);assert.equal(w.walls.length,0);assert.equal(w.fighters[1].hp,100);assert.equal(w.fighters[0].energy,0);
});
test('a wall outside the attack path does not absorb a hit; knockback stops at masonry',()=>{
  const w=playing();w.fighters[0].x=350;deployWall(w);
  w.fighters[0].x=330;w.fighters[1].x=378;w.fighters[0].energy=100;
  strike(w,0,'super');assert.equal(w.fighters[1].hp,70);
  const wall=w.walls[0],f=w.fighters[1];
  assert.ok(f.x-wall.x-wall.slant*(f.y-wall.y)<=-wall.width/2-RULES.radius*Math.hypot(1,wall.slant)+.001);
  assert.equal(w.walls[0].hp,36);
});
test('expiry removes collision; pause freezes wall lifetime and recharge; reset clears walls',()=>{
  const w=playing();deployWall(w);advance(w,1);pauseMatch(w);
  const remaining=w.walls[0].ttl,cooldown=w.fighters[0].wallCooldown;
  advance(w,3);assert.equal(w.walls[0].ttl,remaining);assert.equal(w.fighters[0].wallCooldown,cooldown);assert.equal(deployWall(w,1),false);
  startMatch(w);advance(w,5.1);assert.equal(w.walls.length,0);assert.equal(deployWall(w),false);
  advance(w,3);assert.equal(deployWall(w),true);assert.equal(createMatch().walls.length,0);
});
test('AI attacks and breaks a wall blocking its approach',()=>{
  const w=playing();deployWall(w);advance(w,4,{},true);
  assert.equal(w.walls.length,0,'AI should destroy the wall before its six second expiry');
});

test('attacks and placement respect the slanted ends rather than an axis-aligned box',()=>{
  const w=playing();deployWall(w);const wall=w.walls[0];
  w.fighters[0].x=390;w.fighters[0].y=wall.y-25;
  w.fighters[1].x=490;w.fighters[1].y=wall.y-25;
  strike(w,0);assert.equal(wall.hp,24,'a hit intersects the receding end of the wall');
  w.fighters[0].cooldown=0;w.fighters[0].y=wall.y-wall.depth/2-1;w.fighters[1].y=w.fighters[0].y;
  strike(w,0);assert.equal(wall.hp,24,'a hit outside the far end passes by');
});
