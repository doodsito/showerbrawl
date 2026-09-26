import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,startMatch,tick,strike,RULES} from '../src/combat.js';
const playing=()=>{const w=createMatch();startMatch(w);return w;};
const advance=(w,frames,input,ai=false)=>{for(let i=0;i<frames;i++)tick(w,1/60,input,ai);};

test('releasing attacks and retreating breaks contact after one hit in either direction',()=>{
  // Include AI phases without guard: guard slowdown must not be what enables escape.
  for(const time of [0,2,4])for(const direction of [-1,1]){
    const w=playing();w.time=time;w.aiClock=0;
    w.fighters[0].x=480;w.fighters[1].x=480-direction*50;
    advance(w,60,{x:direction},true);
    assert.ok(Math.abs(w.fighters[0].x-w.fighters[1].x)>145);
    assert.equal(w.fighters[0].hp,91,'retreat prevents a second chained hit');
  }
});
test('attacking while chasing slows movement, and speed returns after recovery',()=>{
  const runner=playing(),attacker=playing(),start=runner.fighters[0].x;
  strike(attacker,0);advance(runner,18,{x:-1});advance(attacker,18,{x:-1});
  assert.ok(start-attacker.fighters[0].x<(start-runner.fighters[0].x)*.6);
  advance(attacker,12,{});const recovered=attacker.fighters[0].x;
  advance(attacker,6,{x:1});assert.ok(Math.abs(attacker.fighters[0].x-recovered-RULES.speed*.1)<.001);
});
test('low stamina does not prevent escape and diagonal movement does not add speed',()=>{
  for(const input of [{x:1,y:0},{x:0,y:-1},{x:1,y:-1}]){
    const w=playing(),f=w.fighters[0];f.stamina=0;const x=f.x,y=f.y;
    advance(w,12,input);
    assert.ok(Math.abs(Math.hypot(f.x-x,(f.y-y)/RULES.verticalSpeed)-RULES.speed*.2)<.001);
  }
});

test('retreat after an exchange creates a clear gap without taking another hit',()=>{
  const w=playing();w.time=2;w.aiClock=0;w.fighters[0].x=480;w.fighters[1].x=530;
  advance(w,60,{attack:true},true);
  const hp=w.fighters[0].hp;
  advance(w,60,{x:-1},true);
  assert.ok(w.fighters[1].x-w.fighters[0].x>130);
  assert.equal(w.fighters[0].hp,hp);
});
test('the retreat boost cannot be used to charge an opponent at the same speed',()=>{
  const flee=playing(),chase=playing();
  for(const w of [flee,chase]){w.fighters[0].x=480;w.fighters[1].x=550;}
  advance(flee,12,{x:-1});advance(chase,12,{x:1});
  assert.ok((480-flee.fighters[0].x)>(chase.fighters[0].x-480)*1.5);
});
