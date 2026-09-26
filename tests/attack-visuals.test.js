// Regression: QA-001 — Macron's generic melee/targeted super lost their custom visuals.
// Found by /qa on 2026-09-26. Report: .gstack/qa-reports/attack-qa.md
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../server/game.js';
import {characters,arena} from '../server/loader.js';
import {cast} from '../server/abilities.js';
import {CONFIG} from '../shared/config.js';

function setup(t,id){
 let state;const game=new Game({emit:(name,data)=>{if(name==='state')state=data;}},{characters,arena,autoTick:false});t.after(()=>game.dispose());
 game.join({id:'a'},{team:'A',character:id});game.join({id:'b'},{team:'B',character:'trump'});game.start();game.countdown=0;
 const p=game.players.get('a'),q=game.players.get('b');Object.assign(p,{x:300,y:320,protectT:0,energy:100});Object.assign(q,{x:360,y:320,protectT:0});
 return {game,p,q,snapshot:()=>{game.broadcast();return state;}};
}
for(const [id,visual,count] of [['macron','baguette',3],['obama','energy',1]]) {
 test(`${id}: attaque de base standard (equite), visuel ${visual} conserve, rien ne vole`,t=>{
  const {game,p,q,snapshot}=setup(t,id);const hp=q.hp;
  assert(cast(game,p,'attack'));assert.equal(hp-q.hp,CONFIG.BASE_ATTACK.damage,'degats standard au contact');
  assert.equal(snapshot().projectiles.length,0,'aucun projectile');
  assert(game.effects.some(e=>e.kind==='strike'&&e.visual===visual),'visuel du perso a l impact');
 });
 test(`${id}: misses expire, shields block and arena edges stop normal knockback`,t=>{
  const {game,p,q}=setup(t,id);q.x=660;assert(cast(game,p,'attack'));
  for(let i=0;i<20;i++)game.tick(.05);assert.equal(q.hp,q.maxHp);assert.equal(game.projectiles.length,0);
  p.cd.attack=0;q.x=420;q.shieldT=2;cast(game,p,'attack');for(let i=0;i<15;i++)game.tick(.05);assert.equal(q.hp,q.maxHp);
  Object.assign(p,{x:570,fx:1,fy:0});Object.assign(q,{x:680,shieldT:0});p.cd.attack=0;cast(game,p,'attack');
  for(let i=0;i<20;i++)game.tick(.05);assert(q.hp<q.maxHp);assert(q.alive);assert(q.x<=686);assert.equal(q.superKbVx||0,0);
 });
 test(`${id}: enemy walls stop every projectile`,t=>{
  const {game,p,q}=setup(t,id);q.x=480;
  game.walls.push({id:900,team:'B',x:380,y:320,ux:1,uy:0,width:20,depth:150,slant:0,hp:100,maxHp:100,age:1,ttl:5});
  cast(game,p,'attack');for(let i=0;i<20;i++)game.tick(.05);
  assert.equal(q.hp,q.maxHp);assert.equal(game.projectiles.length,0);assert(game.walls[0].hp<100);
 });
}
test('phone VIEW preserves zero age and vertical directions for every effect',t=>{
 const {game,p}=setup(t,'macron');const packets=[];
 game.io.to=room=>({emit:(name,data)=>packets.push({room,name,data})});
 p.fx=0;p.fy=1;game.effects.push({id:999,kind:'whiff',visual:'energy',x:p.x,y:p.y,ux:0,uy:1,age:0,duration:.4});
 game.zones.push({id:998,kind:'strike',x:p.x,y:p.y,r:65,age:0,delay:.6,duration:1,ux:0,uy:1});game.broadcast();
 const view=packets.find(x=>x.room==='a'&&x.name==='view').data;
 assert.equal(view.effects[0].age,0);assert.equal(view.effects[0].ux,0);assert.equal(view.zones[0].age,0);assert.equal(view.players[0].fx,0);
});
test('49.3 broadcasts the stamp at the real target with unchanged damage and warning timing',t=>{
 const {game,p,q,snapshot}=setup(t,'macron');q.x=600;const hp=q.hp;assert(cast(game,p,'super'));
 const z=snapshot().zones[0];assert.equal(z.kind,'decree','code decree d\'Ilan (tampon)');assert.equal(z.x,q.x);assert.equal(z.y,q.y);assert.equal(z.r,p.char.super.radius);
 for(let t=0;t<p.char.super.delay-.051;t+=.05)game.tick(.05);assert.equal(q.hp,hp);game.tick(.1);assert.equal(q.hp,hp-p.char.super.damage);
 game.tick(.05);assert.equal(q.hp,hp-p.char.super.damage,'one impact only');
});
test('49.3: onde de choc au sol autour du tampon (plus de projectiles), touche l anneau, epargne au-dela',t=>{
 const {game,p,q}=setup(t,'macron');q.x=600;
 game.join({id:'c'},{team:'B',character:'biden',name:'ring'});game.join({id:'d'},{team:'B',character:'musk',name:'far'});
 const ring=game.players.get('c'),far=game.players.get('d');
 Object.assign(ring,{x:600,y:320+p.char.super.radius+40,protectT:0});Object.assign(far,{x:600,y:320-190,protectT:0}); // plus loin de Macron que la cible (ciblage), hors onde
 assert(cast(game,p,'super'));for(let i=0;i<24;i++)game.tick(.05);
 assert.equal(game.projectiles.length,0,'rien ne vole');
 assert.equal(q.hp,q.maxHp-p.char.super.damage,'coeur du tampon');
 assert.equal(ring.hp,ring.maxHp-10,'onde de choc');assert.equal(far.hp,far.maxHp,'hors onde');
});
