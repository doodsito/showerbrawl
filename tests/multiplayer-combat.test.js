import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../server/game.js';
import { characters, arena } from '../server/loader.js';
import { cast } from '../server/abilities.js';
import { wallContact } from '../shared/wall-geometry.js';

function setup(t, a='trump', b='obama') {
  const events=[];
  const game=new Game({emit:(name,data)=>events.push({name,data})},{characters,arena,autoTick:false});
  t.after(()=>game.dispose());
  game.join({id:'a'},{team:'A',character:a});game.join({id:'b'},{team:'B',character:b});game.start();
  const p=game.players.get('a'),q=game.players.get('b');
  Object.assign(p,{x:300,y:320,protectT:0});Object.assign(q,{x:470,y:320,protectT:0});
  return {game,p,q,events};
}
const advance=(g,seconds)=>{for(let left=seconds;left>1e-8;left-=.01)g.tick(Math.min(.01,left));};

test('Trump has a melee punch; misses do not damage or create a projectile',t=>{
 const {game,p,q}=setup(t);assert.equal(cast(game,p,'attack'),true);assert.equal(q.hp,100);assert.equal(game.projectiles.length,0);
 advance(game,.5);q.x=370;cast(game,p,'attack');assert.equal(q.hp,91);assert.ok(p.energy>0);advance(game,.2);assert.ok(q.x>=380);
});
test('summoned wall blocks both teams and absorbs three punches, then frees the passage',t=>{
 const {game,p,q}=setup(t);assert.ok(cast(game,p,'defense'));const wall=game.walls[0];
 game.physics.moveWithWalls(p,200,0,p.r);game.physics.moveWithWalls(q,-200,0,q.r);
 assert.ok(p.x<wall.x&&q.x>wall.x);assert.equal(wallContact(p,wall,p.r),null);
 for(let i=0;i<3;i++){p.cd.attack=0;cast(game,p,'attack');}
 assert.equal(game.walls.length,0);assert.equal(q.hp,100);assert.ok(p.energy>0);
 game.physics.moveWithWalls(p,150,0,p.r);assert.ok(p.x>wall.x);
});
test('invalid wall placement has no cooldown; a placed wall expires and reset clears all effects',t=>{
 const {game,p,q}=setup(t);q.x=376;assert.equal(cast(game,p,'defense'),false);assert.equal(p.cd.defense,0);
 q.x=470;assert.ok(cast(game,p,'defense'));advance(game,6.1);assert.equal(game.walls.length,0);
 game.reset();assert.equal(game.effects.length,0);assert.equal(game.zones.length,0);assert.equal(p.energy,0);
});
test('energy projectile travels, pushes progressively and respects the wall',t=>{
 const {game,p,q}=setup(t,'obama','trump');cast(game,p,'attack');assert.equal(q.hp,100);advance(game,.4);
 assert.equal(q.hp,90);const atHit=q.x;advance(game,.4);assert.ok(q.x-atHit>50);assert.ok(q.x>=590&&q.x<=600);
 Object.assign(p,{x:470,fx:-1,cd:{attack:0,defense:0,super:0}});Object.assign(q,{x:300,fx:1});cast(game,q,'defense');
 cast(game,p,'attack');advance(game,.5);assert.equal(q.hp,90);assert.equal(game.walls[0].hp,24);
});
test('friendly players take no projectile or Mic Drop damage',t=>{
 const {game,p,q}=setup(t,'obama','trump');q.team='A';q.x=370;p.fx=1;p.fy=0;
 cast(game,p,'attack');advance(game,.5);assert.equal(q.hp,100);
 p.energy=100;cast(game,p,'super');game.zones[0].x=q.x;advance(game,1);assert.equal(q.hp,100);
});
test('Obama dash defaults away, travels 238 units, and has no invulnerability',t=>{
 const {game,p,q}=setup(t,'obama','trump');p.x=400;q.x=500;
 cast(game,p,'defense');assert.equal(p.invulnT,0);advance(game,.28);assert.ok(Math.abs(p.x-162)<1);
 assert.equal(cast(game,p,'defense'),false);assert.ok(p.cd.defense>3);
});
test('dash cannot tunnel through a wall or another player even on a slow frame',t=>{
 const {game,p,q}=setup(t,'obama','trump');p.x=480;q.x=300;cast(game,q,'defense');p.dx=-1;
 cast(game,p,'defense');game.tick(.1);game.tick(.1);game.tick(.1);assert.ok(p.x>game.walls[0].x);
 game.walls=[];p.cd.defense=0;p.x=480;q.x=400;p.dx=-1;cast(game,p,'defense');advance(game,.3);assert.ok(p.x-q.x>=35.9);
});
test('Mic Drop warns at a fixed position, can be escaped and only hits once',t=>{
 const {game,p,q}=setup(t,'obama','trump');p.energy=100;cast(game,p,'super');assert.equal(p.energy,0);
 const drop=game.zones[0];advance(game,.8);assert.equal(q.hp,100);assert.equal(drop.x,470);
 advance(game,.06);assert.equal(q.hp,72);advance(game,1.3);assert.equal(q.hp,72);assert.equal(game.zones.length,0);
 p.cd.super=0;p.energy=100;q.x=470;cast(game,p,'super');q.y=470;advance(game,.9);assert.equal(q.hp,72);
});
test('Mic Drop destroys walls, spares allies, respects spawn protection and shields',t=>{
 const {game,p,q}=setup(t,'obama','trump');q.x=400;q.fx=-1;cast(game,q,'defense');p.energy=100;cast(game,p,'super');
 q.protectT=2;advance(game,.9);assert.equal(q.hp,100);assert.equal(game.walls.length,0);
 q.protectT=0;q.shieldT=2;p.energy=100;p.cd.super=0;cast(game,p,'super');advance(game,.9);assert.equal(q.hp,100);
});
test('You’re fired requires charge, launches to the far edge and waits for landing before KO',t=>{
 const {game,p,q}=setup(t);q.x=380;assert.equal(cast(game,p,'super'),false);p.energy=100;q.hp=20;
 cast(game,p,'super');assert.equal(p.energy,0);assert.ok(q.launch);assert.equal(q.alive,true);assert.equal(game.score.A,0);
 advance(game,.25);assert.ok(q.x>450);assert.equal(q.alive,true);advance(game,.35);
 assert.equal(q.alive,false);assert.equal(game.score.A,1);assert.ok(q.x>650);assert.ok(game.effects.some(e=>e.kind==='impact'));
 advance(game,3.1);assert.equal(q.alive,true);assert.equal(q.hp,100);assert.equal(q.launch,null);
});
test('a wall intercepts the super; a launched target destroys a wall further behind',t=>{
 const {game,p,q}=setup(t);q.x=425;cast(game,p,'defense');p.energy=100;cast(game,p,'super');assert.equal(game.walls.length,0);assert.equal(q.hp,100);
 p.cd.super=0;p.cd.defense=0;p.energy=100;p.x=300;q.x=380;
 game.walls.push({id:99,owner:q.id,team:'B',x:550,y:320,ux:1,uy:0,width:24,depth:150,slant:.2,hp:36,ttl:6,age:0});
 cast(game,p,'super');advance(game,.6);assert.equal(game.walls.length,0);assert.equal(q.hp,70);
});
test('short mobile taps survive between server ticks, defense does not recast while held',t=>{
 const {game,p}=setup(t);game.input(p.id,{defense:true});game.input(p.id,{defense:false});game.tick(.05);assert.equal(game.walls.length,1);
 p.cd.defense=0;game.walls=[];game.input(p.id,{defense:true});game.tick(.05);assert.equal(game.walls.length,1);
 p.cd.defense=0;game.walls=[];game.tick(.05);assert.equal(game.walls.length,0);
});
test('snapshots carry authoritative wall, charge, dash and attack visual state',t=>{
 const {game,p,q,events}=setup(t);cast(game,p,'defense');p.energy=42;cast(game,q,'attack');cast(game,q,'defense');game.broadcast();
 const s=events.at(-1).data;assert.equal(s.players[0].energy,42);assert.equal(s.walls.length,1);assert.equal(s.projectiles[0].visual,'energy');assert.ok(s.players[1].dash);
 game.reset();game.start();game.broadcast();const fresh=events.at(-1).data;assert.equal(fresh.walls.length,0);assert.equal(fresh.projectiles.length,0);
});
test('existing characters still cast all five generic bricks',t=>{
 const {game,p,q}=setup(t,'biden','maduro');cast(game,p,'attack');assert.equal(game.projectiles.length,1);cast(game,p,'defense');assert.ok(p.invulnT>0);
 cast(game,p,'super');assert.equal(game.projectiles.length,9);cast(game,q,'defense');assert.ok(q.shieldT>0);cast(game,q,'super');assert.equal(game.zones.length,1);
});
