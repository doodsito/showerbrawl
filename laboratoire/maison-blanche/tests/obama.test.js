import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,startMatch,pauseMatch,tick,strike,defend,deployWall,inside,RULES} from '../src/combat.js';
const playing=()=>{const w=createMatch('obama','trump');startMatch(w);return w;};
const advance=(w,seconds,input={},ai=false)=>{for(let i=0;i<Math.round(seconds*60);i++)tick(w,1/60,input,ai);};
test('Obama fires a travelling projectile rather than applying instant melee damage',()=>{
  const w=playing();strike(w,0);assert.equal(w.projectiles.length,1);assert.equal(w.fighters[1].hp,100);
  advance(w,.6);assert.equal(w.projectiles.length,0);assert.equal(w.fighters[1].hp,90);assert.equal(w.fighters[0].energy,20);
});
test('a projectile can miss a moving target and expires at its maximum range',()=>{
  const w=createMatch('trump','obama');startMatch(w);strike(w,1);
  advance(w,.6,{y:1});assert.equal(w.fighters[0].hp,100);
  advance(w,.4);assert.equal(w.projectiles.length,0);
});
test('MAGA wall intercepts Obama projectiles before they damage Trump',()=>{
  const w=playing();assert.equal(deployWall(w,1),true);strike(w,0);advance(w,.5);
  assert.equal(w.fighters[1].hp,100);assert.equal(w.walls[0].hp,24);assert.equal(w.projectiles.length,0);
});
test('dash moves away by default, costs endurance and cannot cross a wall or fence',()=>{
  const w=playing(),f=w.fighters[0],initial=f.x;assert.equal(defend(w),true);
  assert.equal(f.stamina,75);assert.equal(defend(w),false);advance(w,RULES.dashDuration+.05);
  assert.ok(f.x<initial-190);assert.equal(f.dash,null);assert.equal(w.walls.length,0);
  const m=playing();m.fighters[1].x=500;deployWall(m,1);defend(m,0,{x:1});advance(m,RULES.dashDuration+.05);
  assert.ok(m.fighters[0].x<420);assert.ok(inside(m.fighters[0].x,m.fighters[0].y));
  const edge=playing();edge.fighters[0].x=145;defend(edge,0,{x:-1});advance(edge,RULES.dashDuration+.05);assert.ok(inside(edge.fighters[0].x,edge.fighters[0].y));
});
test('Mic Drop warns at a fixed location, hits once, and never damages its owner',()=>{
  const w=playing();w.fighters[0].energy=100;strike(w,0,'super');
  assert.equal(w.drops.length,1);assert.equal(w.fighters[0].energy,0);assert.equal(w.fighters[1].hp,100);
  advance(w,.4);assert.equal(w.fighters[1].hp,100);advance(w,RULES.dropDelay-.4+.05);assert.equal(w.fighters[1].hp,72);
  advance(w,RULES.dropAftermath+.1);assert.equal(w.fighters[1].hp,72);assert.equal(w.fighters[0].hp,100);assert.equal(w.drops.length,0);
});
test('leaving the Mic Drop circle before the microphone lands avoids damage',()=>{
  const w=createMatch('trump','obama');startMatch(w);w.fighters[1].energy=100;strike(w,1,'super');
  const origin=w.drops[0].x;advance(w,RULES.dropDelay+.05,{x:-1});assert.equal(w.drops[0].x,origin);assert.equal(w.fighters[0].hp,100);
});
test('Obama effects and cooldowns freeze in pause; resetting clears them',()=>{
  const w=playing();strike(w,0);advance(w,.1);pauseMatch(w);
  const before=JSON.stringify(w);advance(w,1);assert.equal(JSON.stringify(w),before);assert.equal(defend(w),false);
  assert.equal(createMatch('obama','trump').projectiles.length,0);
});
test('Obama AI attacks from range and can use its charged Mic Drop',()=>{
  const w=createMatch('trump','obama');startMatch(w);w.fighters[1].energy=100;advance(w,2,{},true);
  assert.equal(w.fighters[1].energy<100,true);assert.ok(w.fighters[0].hp<100);
});

test('energy hit pushes the target a long distance progressively',()=>{
  const w=playing();w.fighters[1].x=500;strike(w,0);
  for(let i=0;i<60&&!w.fighters[1].shove;i++)tick(w,1/60,{},false);
  const victim=w.fighters[1];assert.ok(victim.shove);const hitX=victim.x;
  advance(w,.1);assert.ok(victim.x>hitX+30);assert.ok(victim.shove);
  advance(w,.3);assert.equal(victim.shove,null);assert.ok(victim.x>=hitX+120);assert.ok(inside(victim.x,victim.y));
});
test('guard reduces projectile damage and knockback without cancelling its impact',()=>{
  const w=createMatch('trump','obama');startMatch(w);w.fighters[0].x=450;w.fighters[1].x=550;strike(w,1);
  advance(w,.7,{guard:true});assert.equal(w.fighters[0].hp,97);
  assert.ok(w.fighters[0].x>=404.9&&w.fighters[0].x<=405.1);
});
test('long dash stops before another fighter even with a large timestep',()=>{
  const w=playing();w.fighters[1].x=450;defend(w,0,{x:1});
  for(let i=0;i<7;i++)tick(w,.05,{},false);
  assert.ok(w.fighters[0].x<=w.fighters[1].x-29.9);
});
test('knockback freezes on pause and stops at the cage',()=>{
  const w=playing();w.fighters[0].x=700;w.fighters[1].x=775;strike(w,0);advance(w,.15);
  assert.ok(w.fighters[1].shove);pauseMatch(w);const snapshot=JSON.stringify(w);advance(w,1);assert.equal(JSON.stringify(w),snapshot);
  startMatch(w);advance(w,.5);assert.ok(inside(w.fighters[1].x,w.fighters[1].y));assert.equal(w.fighters[1].shove,null);
});
