import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../server/game.js';
import { characters, arena } from '../server/loader.js';
import { cast } from '../server/abilities.js';

function setup(t){
  const events=[],game=new Game({emit:(name,data)=>events.push({name,data})},{characters,arena,autoTick:false});
  t.after(()=>game.dispose());
  for(const [id,team,character,x] of [['m','A','musk',300],['e','B','trump',400],['friend','A','obama',425]]){
    game.join({id},{team,character});
  }
  game.start();game.countdown=0;
  const p=game.players.get('m'),q=game.players.get('e'),friend=game.players.get('friend');
  for(const [player,x,y] of [[p,300,320],[q,400,320],[friend,425,345]])Object.assign(player,{x,y,protectT:0});
  return {game,p,q,friend,events};
}
const advance=(g,s)=>{for(let n=s;n>1e-8;n-=.05)g.tick(Math.min(.05,n));};

test('flame pulses push without stun, burn outside the cone, charge only on hits, and spare allies',t=>{
  const {game,p,q,friend}=setup(t);cast(game,p,'attack');advance(game,.5);
  assert(q.hp<q.maxHp);assert(q.x>400);assert.equal(q.stunT,0);assert.equal(friend.hp,friend.maxHp);assert.equal(p.energy,5*p.char.attack.chargeHit);
  const hp=q.hp;q.x=610;advance(game,.3);assert(q.hp<hp);assert.equal(p.energy,5*p.char.attack.chargeHit);
  advance(game,1);assert.equal(q.muskBurn,null);assert.equal(game.zones.length,0);
});
test('flame respects shields, spawn protection and walls; exiting or interrupting the jet stops direct damage',t=>{
  const {game,p,q}=setup(t);q.shieldT=2;cast(game,p,'attack');advance(game,1);assert.equal(q.hp,q.maxHp);assert.equal(p.energy,0);
  q.shieldT=0;q.protectT=2;p.cd.attack=0;cast(game,p,'attack');advance(game,1);assert.equal(q.hp,q.maxHp);
  q.protectT=0;p.cd.attack=0;game.walls.push({id:99,owner:q.id,team:q.team,x:350,y:320,ux:1,uy:0,width:20,depth:90,slant:.2,hp:100,ttl:6,age:0});
  cast(game,p,'attack');advance(game,.4);assert.equal(q.hp,q.maxHp);assert(game.walls[0].hp<100);
  p.stunT=.5;advance(game,.1);assert.equal(game.zones.length,0);
});
test('Hyperloop is an escape, does not damage bodies, and stops at obstacles',t=>{
  const {game,p,q,friend}=setup(t);friend.x=650;friend.y=400;p.x=430;q.x=540;cast(game,p,'defense');assert.equal(p.invulnT,0);assert.equal(p.dashHit,null);
  advance(game,.2);assert(Math.abs(p.x-170)<1);assert.equal(q.hp,q.maxHp);
  p.cd.defense=0;p.x=430;q.x=340;p.dx=-1;cast(game,p,'defense');advance(game,.2);assert(p.x-q.x>=35.9);assert.equal(q.hp,q.maxHp);
});
test('truck uses charge, carries a foe, spares allies and broadcasts its path and physical debris',t=>{
  const {game,p,q,friend,events}=setup(t);q.x=450;assert.equal(cast(game,p,'super'),false);p.energy=100;cast(game,p,'super');assert.equal(p.energy,0);
  advance(game,.55);assert.equal(q.hp,q.maxHp);game.broadcast();let state=events.filter(e=>e.name==='state').at(-1).data;
  assert.equal(state.zones[0].kind,'cybertruck');assert.equal(state.zones[0].ux,1);assert.equal(state.zones[0].owner,p.id);
  advance(game,.3);assert.equal(q.hp,q.maxHp-p.char.super.damage);assert(q.carriedBy);assert(q.x>500);assert.equal(friend.hp,friend.maxHp);
  assert.equal(cast(game,q,'attack'),false);
  advance(game,.4);assert.equal(q.carriedBy,null);assert(q.x>600);assert.equal(friend.hp,friend.maxHp);assert.equal(p.energy,0);
  game.broadcast();state=events.filter(e=>e.name==='state').at(-1).data;assert(state.projectiles.some(o=>o.visual==='muskDoge'));assert(state.effects.some(e=>e.kind==='truckWreck'));
  advance(game,1);assert.equal(game.projectiles.length,0);
});
test('shield stops a truck, lethal carrying resolves once, reset and respawn clear transient state',t=>{
  const {game,p,q}=setup(t);q.shieldT=3;p.energy=100;cast(game,p,'super');advance(game,1.4);assert.equal(q.hp,q.maxHp);assert.equal(q.carriedBy,null);
  q.shieldT=0;p.cd.super=0;p.energy=100;q.hp=20;q.x=450;cast(game,p,'super');advance(game,.85);assert.equal(q.hp,0);assert(q.alive);assert.equal(game.score.A,0);
  advance(game,.5);assert.equal(q.alive,false);assert.equal(game.score.A,1);advance(game,3.1);assert(q.alive);assert.equal(q.carriedBy,null);
  q.muskBurn={owner:p.id,remaining:.9,dps:8};game.reset();assert.equal(q.muskBurn,null);assert.equal(game.zones.length,0);assert.equal(game.projectiles.length,0);
});
test('disconnecting the vehicle owner releases passengers and credits a pending KO only once',t=>{
  const {game,p,q}=setup(t);q.x=450;q.hp=20;p.energy=100;cast(game,p,'super');advance(game,.85);assert(q.carriedBy);
  game.leave(p.id);advance(game,.05);assert.equal(q.carriedBy,null);assert.equal(q.alive,false);assert.equal(game.zones.length,0);const score=game.score.A;advance(game,.2);assert.equal(game.score.A,score);
});
