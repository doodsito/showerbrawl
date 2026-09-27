import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../server/game.js';
import {characters,arena} from '../server/loader.js';
import {cast} from '../server/abilities.js';

const step=(g,s)=>{for(let t=0;t<s-1e-8;t+=.025)g.tick(Math.min(.025,s-t));};
function setup(t,target='obama',distance=150){
  const packets=[],g=new Game({emit(){},to:room=>({emit:(name,data)=>packets.push({room,name,data})})},{characters,arena,autoTick:false,fixedTeams:true});
  t.after(()=>g.dispose());g.join({id:'a'},{character:'harris',team:'A'});g.join({id:'b'},{character:target,team:'B'});g.start();g.countdown=0;
  const p=g.players.get('a'),q=g.players.get('b');Object.assign(p,{x:250,y:320,fx:1,fy:0,protectT:0});Object.assign(q,{x:250+distance,y:320,protectT:0});
  return {g,p,q,packets};
}
const wall=g=>g.walls.push({id:900,team:'B',x:310,y:320,ux:1,uy:0,width:20,depth:150,slant:0,hp:100,maxHp:100,age:1,ttl:5});
test('Sonic Laugh emits three waves, deals 15 damage and charges 30 without stun',t=>{
 const {g,p,q,packets}=setup(t);assert(cast(g,p,'attack'));assert(!cast(g,p,'attack'));step(g,.25);
 assert.equal(g.projectiles.length,3);g.broadcast();
 for(const name of ['state','view'])assert.equal(packets.findLast(x=>x.name===name).data.projectiles.filter(x=>x.visual==='sonicLaugh').length,3);
 step(g,.6);assert.equal(q.hp,90);assert.equal(p.energy,30);assert(!q.shove);assert.equal(q.stunT,0);assert(q.x>400);
});
test('Sonic Laugh respects range, walls, shields and teams',t=>{
 for(const mode of ['range','wall','shield','ally']){
  const {g,p,q}=setup(t);if(mode==='range')q.x=600;if(mode==='wall')wall(g);if(mode==='shield')q.shieldT=2;if(mode==='ally')q.team='A';
  cast(g,p,'attack');step(g,1);assert.equal(q.hp,105,mode);assert.equal(p.energy,0,mode);assert.equal(g.projectiles.length,0);
  if(mode==='wall')assert.equal(g.walls[0].hp,88);
 }
});
test('interrupting or killing the caster cancels queued laughs',t=>{
 for(const status of ['stunT','alive']){const {g,p}=setup(t);cast(g,p,'attack');if(status==='alive')g.kill(p,'b');else p.stunT=1;step(g,.25);assert.equal(g.zones.length,0);assert(g.projectiles.length<=1);}
});
test("I'm Speaking cancels a nearby pending super and pushes with no damage or shield",t=>{
 const {g,p,q,packets}=setup(t,'obama',90);q.energy=100;cast(g,q,'super');assert.equal(g.zones.length,1);
 assert(cast(g,p,'defense'));assert.equal(g.zones.length,0);assert(q.shove);assert.equal(q.hp,105);assert.equal(p.shieldT,0);assert.equal(p.invulnT,0);
 assert(!cast(g,q,'attack'));assert(!cast(g,p,'defense'));g.broadcast();for(const name of ['state','view'])assert(packets.findLast(x=>x.name===name).data.effects.some(e=>e.kind==='speaking'));
 step(g,.25);assert(q.x>340);assert(Math.abs(p.cd.defense-6.75)<1e-8);
});
test("I'm Speaking clears nearby enemy shots but preserves allied shots and distant casters",t=>{
 const {g,p,q}=setup(t,'obama',350);q.energy=100;assert(cast(g,q,'super'));
 g.projectiles.push({id:901,owner:'b',team:'B',x:280,y:320},{id:902,owner:'a',team:'A',x:280,y:320},{id:903,owner:'b',team:'B',x:600,y:320});
 cast(g,p,'defense');assert.deepEqual(g.projectiles.map(x=>x.id),[902,903]);assert.equal(g.zones.length,1);assert(!q.shove);
});
test("I'm Speaking cannot interrupt through walls, allies, shields, nap or spawn protection",t=>{
 for(const mode of ['wall','ally','shield','nap','protect']){
  const {g,p,q}=setup(t,'biden',90);if(mode==='wall')wall(g);if(mode==='ally')q.team='A';if(mode==='shield')q.shieldT=2;if(mode==='nap')cast(g,q,'defense');if(mode==='protect')q.protectT=2;
  cast(g,p,'defense');assert(!q.shove,mode);assert.equal(q.hp,105);
 }
});
test("I'm Speaking stops flame channels and vehicle wind-up, preserves launched vehicles",t=>{
 for(const [character,slot,launched] of [['musk','attack',false],['musk','super',false],['biden','super',false],['musk','super',true]]){
  const {g,p,q}=setup(t,character,90);q.energy=100;cast(g,q,slot);if(launched)g.zones[0].age=g.zones[0].delay+.1;
  cast(g,p,'defense');assert.equal(g.zones.length,launched?1:0);assert.equal(q.cycleT,0);
 }
});
test("Step on 'em needs charge, telegraphs a fixed target, can be dodged and hits only once",t=>{
 for(const dodge of [true,false]){
  const {g,p,q,packets}=setup(t);assert(!cast(g,p,'super'));p.energy=100;assert(cast(g,p,'super'));assert.equal(p.energy,0);
  const x=q.x;g.broadcast();for(const name of ['state','view']){const z=packets.findLast(x=>x.name===name).data.zones[0];assert.equal(z.visual,'kamalaStep');assert.equal(z.owner,'a');assert.equal(z.x,x);assert.equal(z.delay,1.05);}
  if(dodge)q.y+=160;step(g,1);assert.equal(q.hp,105);step(g,.1);assert.equal(q.hp,dodge?105:75);step(g,.3);assert.equal(q.hp,dodge?105:75);assert.equal(p.energy,0);
 }
});
test('Kamala exposes the approved English names and consistent full-body art',()=>{
 const k=characters.harris;assert.equal(k.name,'Kamala');assert(k.fullBody);assert.deepEqual(['attack','defense','super'].map(s=>k[s].label),['Sonic Laugh',"I'm Speaking","Step on 'em"]);
 for(const slot of ['attack','defense','super'])assert(k.hint.includes(k[slot].label));assert.equal(k.super.anim.impact,6);
});
