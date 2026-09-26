import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,startMatch,pauseMatch,tick,strike,inside,constrain} from '../src/combat.js';

function playing(){const w=createMatch();startMatch(w);return w;}
function close(w){w.fighters[0].x=440;w.fighters[1].x=490;}

test('ready and paused states freeze all combat; resume preserves the match',()=>{
  const w=createMatch();tick(w,.05,{x:1,attack:true});assert.equal(w.time,0);assert.equal(strike(w,0),false);
  startMatch(w);tick(w,.05,{x:1},false);const x=w.fighters[0].x;pauseMatch(w);
  tick(w,.05,{x:1},false);assert.equal(w.fighters[0].x,x);assert.equal(w.time,.05);
  startMatch(w);tick(w,.05,{},false);assert.equal(w.time,.1);
});
test('fighters stay inside every octagon edge even after sustained diagonal movement',()=>{
  for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
    const w=playing();for(let i=0;i<1600;i++)tick(w,1/60,{x,y},false);
    assert.ok(inside(w.fighters[0].x,w.fighters[0].y),`outside for ${x},${y}`);
  }
  const f={x:-1000,y:-1000};constrain(f);assert.ok(inside(f.x,f.y));
});
test('attack respects range, stamina and cooldown; a hit charges super',()=>{
  const w=playing();assert.equal(strike(w,0),true);assert.equal(w.fighters[1].hp,100);
  assert.equal(strike(w,0),false);assert.equal(w.fighters[0].stamina,85);
  for(let i=0;i<30;i++)tick(w,1/60,{},false);close(w);strike(w,0);
  assert.equal(w.fighters[1].hp,91);assert.equal(w.fighters[0].energy,22);
  w.fighters[0].cooldown=0;w.fighters[0].stamina=14;assert.equal(strike(w,0),false);
});
test('guard reduces damage and costs stamina; a depleted guard cannot block',()=>{
  const w=playing();close(w);w.fighters[1].guard=true;
  strike(w,0);assert.equal(w.fighters[1].hp,98);assert.equal(w.fighters[1].stamina,80);
  w.fighters[0].cooldown=0;w.fighters[1].stamina=0;strike(w,0);assert.equal(w.fighters[1].hp,89);
});
test('super requires a full charge, deals damage and spends it once',()=>{
  const w=playing();close(w);assert.equal(strike(w,0,'super'),false);
  w.fighters[0].energy=100;assert.equal(strike(w,0,'super'),true);
  assert.equal(w.fighters[1].hp,70);assert.equal(w.fighters[0].energy,0);assert.equal(strike(w,0,'super'),false);
});
test('knockback at the cage and body collision keep both fighters inside',()=>{
  const w=playing();w.fighters[0].x=480;w.fighters[0].y=467;w.fighters[1].x=480;w.fighters[1].y=488;
  w.fighters[0].energy=100;strike(w,0,'super');
  for(let i=0;i<500;i++)tick(w,1/60,{y:1},false);
  for(const f of w.fighters)assert.ok(inside(f.x,f.y));
  assert.ok(Math.hypot(w.fighters[0].x-w.fighters[1].x,w.fighters[0].y-w.fighters[1].y)>29);
});
test('KO ends the round and prevents further attacks or timer changes',()=>{
  const w=playing();close(w);w.fighters[1].hp=9;strike(w,0);
  assert.equal(w.phase,'finished');assert.equal(w.winner,0);assert.equal(w.fighters[1].hp,0);
  assert.equal(strike(w,1),false);tick(w,.05,{},true);assert.equal(w.remaining,180);
});
test('timer decision and tied rounds resolve deterministically',()=>{
  for(const hp of [100,80]){const w=playing();w.remaining=.01;w.fighters[1].hp=hp;tick(w,.02,{},false);assert.equal(w.phase,'finished');assert.equal(w.winner,hp===100?null:0);assert.equal(w.remaining,0);}
});
test('opponent closes the distance and attacks; practice mode stays passive',()=>{
  const active=playing(),passive=playing();
  for(let i=0;i<600;i++){tick(active,1/60,{},true);tick(passive,1/60,{},false);}
  assert.ok(active.fighters[0].hp<100);assert.equal(passive.fighters[0].hp,100);assert.equal(passive.fighters[1].x,592);
});
