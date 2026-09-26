import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,tick,startMatch} from '../src/combat.js';
import {createMotion,sampleMotion} from '../src/motion.js';

test('walk cycle follows travelled distance and settles when blocked by the cage',()=>{
  const w=createMatch();startMatch(w);const f=w.fighters[0],s=createMotion(f);
  const phase=s.phase;
  for(let i=0;i<15;i++){tick(w,1/60,{x:-1},false);sampleMotion(f,w.time,s);}
  assert.ok(s.phase>phase);assert.ok(s.walk>.9);assert.ok(s.lean<0);
  for(let i=0;i<300;i++){tick(w,1/60,{x:-1},false);sampleMotion(f,w.time,s);}
  const atWall=s.phase;
  for(let i=0;i<60;i++){tick(w,1/60,{x:-1},false);sampleMotion(f,w.time,s);}
  assert.ok(Math.abs(s.phase-atWall)<1e-8);assert.ok(s.walk<.01);
});
test('presentation never changes a fighter or combat coordinates',()=>{
  const f=createMatch().fighters[0];f.walking=true;f.pose=.2;
  const s=createMotion(f),before=structuredClone(f);
  sampleMotion(f,.1,s);assert.deepEqual(f,before);
});
test('paused renders preserve the exact pose instead of advancing the animation',()=>{
  const f=createMatch().fighters[0],s=createMotion(f);f.walking=true;f.x+=2;
  const first=sampleMotion(f,1/60,s);
  for(let i=0;i<60;i++)assert.deepEqual(sampleMotion(f,1/60,s),first);
});
test('attack snaps toward the target then recovers without permanent displacement',()=>{
  const f=createMatch().fighters[0],s=createMotion(f);
  f.pose=.2;const impact=sampleMotion(f,.01,s);
  f.pose=.1;const recovery=sampleMotion(f,.11,s);
  f.pose=0;const rest=sampleMotion(f,.21,s);
  assert.ok(impact.x>recovery.x&&recovery.x>0);assert.equal(rest.x,0);
  f.face=-1;f.pose=.2;assert.ok(sampleMotion(f,.22,s).x<0);
});
test('knockback does not advance the walk cycle; reduced motion removes transforms',()=>{
  const f=createMatch().fighters[0],s=createMotion(f),phase=s.phase;
  f.x+=30;f.stun=.18;f.flash=.18;f.walking=true;
  const hit=sampleMotion(f,.05,s);assert.equal(s.phase,phase);assert.ok(hit.x<0);
  const quiet=sampleMotion(f,.1,s,{reducedMotion:true});
  assert.equal(quiet.x,0);assert.equal(quiet.y,0);assert.equal(quiet.angle,0);assert.equal(quiet.sx,1);assert.equal(quiet.sy,1);assert.equal(quiet.step,0);
});
test('guard stance eases in and returns to rest after releasing the button',()=>{
  const f=createMatch().fighters[0],s=createMotion(f);f.guard=true;
  const first=sampleMotion(f,.016,s);assert.ok(first.guard>0&&first.guard<1);
  for(let i=2;i<=30;i++)sampleMotion(f,i*.016,s);
  f.guard=false;let released;
  for(let i=31;i<=90;i++)released=sampleMotion(f,i*.016,s);
  assert.ok(released.guard<.001);assert.ok(Math.abs(released.x)<.01);
});
