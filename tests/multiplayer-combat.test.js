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
  game.join({id:'a'},{team:'A',character:a});game.join({id:'b'},{team:'B',character:b});game.start();game.countdown=0; // tests de combat: on saute le 3-2-1
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
test('melee strike: misses at range, hits and pushes at contact, never spawns a projectile',t=>{
 const {game,p,q}=setup(t,'obama','trump');cast(game,p,'attack');assert.equal(game.projectiles.length,0);advance(game,.4);assert.equal(q.hp,100);
 Object.assign(q,{x:340});p.cd.attack=0;cast(game,p,'attack');assert.equal(q.hp,89);assert.equal(game.projectiles.length,0);
 const atHit=q.x;advance(game,.3);assert.ok(q.x-atHit>20,'knockback pousse la cible');
 assert.ok(game.effects.some(e=>e.kind==='strike'&&e.visual==='energy'),'effet énergie au point d\'impact');
});
test('friendly players take no projectile or Mic Drop damage',t=>{
 const {game,p,q}=setup(t,'obama','trump');q.team='A';q.x=370;p.fx=1;p.fy=0;
 cast(game,p,'attack');advance(game,.5);assert.equal(q.hp,100);
 p.energy=100;assert.equal(cast(game,p,'super'),false);assert.equal(game.zones.length,0);assert.equal(p.energy,100);advance(game,1);assert.equal(q.hp,100);
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
test('Mic Drop targets the nearest living enemy across the arena, warns and hits once',t=>{
 const {game,p,q}=setup(t,'obama','trump');q.x=680;q.y=340;p.energy=100;
 game.join({id:'ally'},{team:'A',character:'trump'});const ally=game.players.get('ally');Object.assign(ally,{x:320,y:320,protectT:0});
 game.join({id:'far'},{team:'B',character:'macron'});const far=game.players.get('far');Object.assign(far,{x:760,y:450,protectT:0});
 assert.equal(cast(game,p,'super'),true);assert.equal(p.energy,0);
 const drop=game.zones[0];assert.equal(drop.x,q.x);assert.equal(drop.y,q.y);
 advance(game,.8);assert.equal(q.hp,100);advance(game,.06);assert.equal(q.hp,72);
 assert.equal(ally.hp,100);assert.equal(p.hp,100);advance(game,1.3);assert.equal(q.hp,72);assert.equal(game.zones.length,0);
});
test('the Mic Drop target stays fixed so the enemy can escape before impact',t=>{
 const {game,p,q}=setup(t,'obama','trump');p.energy=100;cast(game,p,'super');
 const drop=game.zones[0],x=drop.x,y=drop.y;q.x+=160;
 advance(game,.9);assert.equal(drop.x,x);assert.equal(drop.y,y);assert.equal(q.hp,100);
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
 const s=events.at(-1).data;assert.equal(s.players[0].energy,42);assert.equal(s.walls.length,1);assert.equal(s.projectiles.length,0);assert.ok(s.players[1].dash);
 game.reset();game.start();game.countdown=0;game.broadcast();const fresh=events.at(-1).data;assert.equal(fresh.walls.length,0);assert.equal(fresh.projectiles.length,0);
});
test('generic bricks are all melee: strike, ground shockwave, centred zone, charge, shield',t=>{
 const {game,p,q}=setup(t,'biden','maduro');cast(game,p,'attack');assert.equal(game.projectiles.length,0);assert.equal(q.hp,120,'trop loin');
 cast(game,p,'defense');assert.ok(p.invulnT>0);assert.ok(p.dashHit);
 cast(game,p,'super');assert.equal(game.projectiles.length,0);assert.ok(game.effects.some(e=>e.kind==='shockwave'));
 cast(game,q,'defense');assert.ok(q.shieldT>0);cast(game,q,'super');assert.equal(game.zones.length,1);assert.equal(game.zones[0].x,q.x);
});
test('charge (dash) hits and pushes the enemy on its path',t=>{
 const {game,p,q}=setup(t,'schwarzenegger','biden');q.x=p.x+120;const hp=q.hp,x0=q.x;
 cast(game,p,'defense');advance(game,.3);assert.equal(q.hp,hp-12);assert.ok(q.x-x0>30,'pousse devant');
});
test('super shockwave damages and knocks back every nearby enemy, not the far ones',t=>{
 const {game,p,q}=setup(t,'sanders','biden');game.join({id:'c'},{team:'B',character:'musk',name:'far'});
 const far=game.players.get('c');Object.assign(far,{x:p.x+400,y:p.y,protectT:0});q.x=p.x+80;const x0=q.x;
 cast(game,p,'super');assert.equal(q.hp,110-18);assert.equal(far.hp,far.maxHp);advance(game,.3);assert.ok(q.x-x0>40);
});

test('countdown 3-2-1: players frozen, inputs ignored and match timer stopped until FIGHT', () => {
  const events=[];
  const game=new Game({emit:(name,data)=>events.push({name,data})},{characters,arena,autoTick:false});
  try {
    game.join({id:'a'},{team:'A',character:'biden'});game.join({id:'b'},{team:'B',character:'musk'});game.start();
    const p=game.players.get('a'),x0=p.x,t0=game.timeLeft;
    assert.equal(game.countdown,3);
    game.input('a',{dx:1,dy:0,attack:true});
    for(let i=0;i<20;i++)game.tick(.1); // 2 s
    assert.equal(p.x,x0,'immobile pendant le compte a rebours');
    assert.equal(game.projectiles.length,0,'aucune attaque pendant le compte a rebours');
    assert.equal(game.timeLeft,t0,'timer arrete');
    game.broadcast();assert.ok(events.filter(e=>e.name==='state').at(-1).data.countdown>0);
    for(let i=0;i<12;i++)game.tick(.1); // FIGHT!
    assert.equal(game.countdown,0);
    for(let i=0;i<5;i++)game.tick(.1);
    assert.ok(p.x>x0,'bouge apres FIGHT');
    assert.ok(game.timeLeft<t0,'timer demarre apres FIGHT');
  } finally { game.dispose(); }
});
