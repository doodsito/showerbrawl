import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,startMatch,pauseMatch,strike,tick,inside,deployWall} from '../src/combat.js';
const setup=(direction=1)=>{const w=createMatch();startMatch(w);w.fighters[0].x=480-direction*25;w.fighters[1].x=480+direction*25;w.fighters[0].energy=100;return w;};
const advance=(w,n=60)=>{for(let i=0;i<n;i++)tick(w,1/60,{},false);};
test('You’re fired announces the super and animates a launch to either opposite fence',()=>{
  for(const direction of [1,-1]){
    const w=setup(direction),victim=w.fighters[1],initial=victim.x;
    assert.equal(strike(w,0,'super'),true);assert.equal(victim.x,initial,'launch must not teleport');
    assert.ok(w.effects.some(e=>e.fired&&e.label==='YOU’RE FIRED!'));
    advance(w,12);assert.ok((victim.x-initial)*direction>90);assert.ok(victim.launch);
    advance(w);assert.equal(victim.launch,null);assert.ok(inside(victim.x,victim.y));
    assert.equal(inside(victim.x+direction,victim.y),false,'lands at the far cage boundary');
    assert.equal(victim.hp,70);assert.equal(w.fighters[0].energy,0);
  }
});
test('launch freezes on pause and prevents actions in flight',()=>{
  const w=setup();strike(w,0,'super');advance(w,8);pauseMatch(w);
  const frozen=JSON.stringify(w);advance(w);assert.equal(JSON.stringify(w),frozen);
  startMatch(w);assert.equal(strike(w,1),false);assert.equal(deployWall(w,1),false);
  advance(w);assert.equal(w.fighters[1].launch,null);
});
test('guard reduces damage but the super still throws its target',()=>{
  const w=setup();w.fighters[1].guard=true;strike(w,0,'super');advance(w);
  assert.equal(w.fighters[1].hp,92);assert.ok(w.fighters[1].x>800);
});
test('a finishing super reaches the cage before announcing the winner',()=>{
  const w=setup();w.fighters[1].hp=20;strike(w,0,'super');assert.equal(w.phase,'playing');
  advance(w);assert.equal(w.phase,'finished');assert.equal(w.winner,0);assert.ok(w.fighters[1].x>800);
});
test('an intervening wall absorbs the super, while a launched body breaks a wall behind it',()=>{
  const w=setup();w.walls.push({owner:1,x:650,y:423,width:24,depth:70,slant:.45,hp:36,ttl:6,age:0,flash:0});
  strike(w,0,'super');advance(w);assert.equal(w.walls.length,0);assert.ok(w.fighters[1].x>800);
  const m=setup();m.walls.push({owner:1,x:480,y:423,width:12,depth:70,slant:0,hp:36,ttl:6,age:0,flash:0});
  strike(m,0,'super');assert.equal(m.walls.length,0);assert.equal(m.fighters[1].launch,null);assert.equal(m.fighters[1].hp,100);
});
test('an out of range super spends its charge without launching the opponent',()=>{
  const w=setup();w.fighters[1].x=750;strike(w,0,'super');advance(w);
  assert.equal(w.fighters[1].x,750);assert.equal(w.fighters[1].hp,100);assert.equal(w.fighters[0].energy,0);
});
