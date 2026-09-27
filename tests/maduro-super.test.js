import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../server/game.js';
import {characters,arena} from '../server/loader.js';
import {cast} from '../server/abilities.js';
const step=(g,s)=>{for(let t=0;t<s-1e-8;t+=.025)g.tick(Math.min(.025,s-t));};
function setup(t,distance=200,target='trump'){
 const packets=[],g=new Game({emit(){},to:room=>({emit:(name,data)=>packets.push({room,name,data})})},{characters,arena,autoTick:false,fixedTeams:true});t.after(()=>g.dispose());
 g.join({id:'a'},{character:'maduro',team:'A'});g.join({id:'b'},{character:target,team:'B'});g.start();g.countdown=0;
 const p=g.players.get('a'),q=g.players.get('b');Object.assign(p,{x:200,y:320,fx:1,fy:0,energy:100,protectT:0});Object.assign(q,{x:200+distance,y:320,protectT:0});return {g,p,q,packets};
}
test('Super Mustache consumes full charge, locks movement during windup and reaches one enemy',t=>{
 const {g,p,q}=setup(t);p.energy=99;assert(!cast(g,p,'super'));p.energy=100;assert(cast(g,p,'super'));assert.equal(p.energy,0);
 g.input('a',{dx:0,dy:1,attack:true,defense:true,super:true});step(g,.5);assert.equal(p.x,200);assert.equal(p.y,320);assert.equal(q.hp,105);assert.equal(g.projectiles.length,0);assert(!p.exfil);
 step(g,.3);assert.equal(q.hp,71);assert.equal(p.mustache.phase,'hit');assert(q.uppercutT>0);assert(q.superKbVx>0);
 g.input('a',{});step(g,.6);assert.equal(q.hp,71);assert(!p.mustache);assert.equal(p.energy,0);
});
test('the announced heading stays fixed; a dodge causes a vulnerable faceplant',t=>{
 const {g,p,q}=setup(t);cast(g,p,'super');q.y=470;step(g,1.1);assert.equal(q.hp,105);assert.equal(p.mustache.phase,'miss');assert(Math.abs(p.x-580)<.001);assert.equal(p.y,320);
 const x=p.x;g.input('a',{dx:-1,dy:0});step(g,.3);assert.equal(p.x,x);assert(!cast(g,p,'attack'));assert.equal(p.invulnT,0);assert(g.damage(p,10,'b',q.x,q.y));
 step(g,.6);assert(!p.mustache);assert(p.x<x);
});
test('only the first enemy is struck; allies are unharmed',t=>{
 const {g,p,q}=setup(t,180);g.join({id:'c'},{character:'obama',team:'B'});const r=g.players.get('c');Object.assign(r,{x:450,y:320,protectT:0});
 g.join({id:'d'},{character:'biden',team:'A'});const ally=g.players.get('d');Object.assign(ally,{x:280,y:320,protectT:0});
 cast(g,p,'super');step(g,1);assert.equal(q.hp,71);assert.equal(r.hp,105);assert.equal(ally.hp,105);
});
test('walls and arena edges stop Maduro safely and trigger the miss recovery',t=>{
 for(const obstacle of ['wall','edge']){const {g,p,q}=setup(t,400);if(obstacle==='wall')g.walls.push({id:900,team:'B',x:300,y:320,ux:1,uy:0,width:20,depth:150,slant:0,hp:100,age:1,ttl:5});else{p.x=660;q.y=450;q.team='A';}
 cast(g,p,'super');step(g,.75);assert.equal(p.mustache.phase,'miss');assert(p.alive);assert(!g.physics.isFalling(p));assert.equal(q.hp,105);if(obstacle==='wall'){assert(p.x<300);assert.equal(g.walls[0].hp,64);}}
});
test('shield, spawn protection and nap block the uppercut without stun or ring-out',t=>{
 for(const mode of ['shield','protect','nap']){const {g,p,q}=setup(t,150,'biden');if(mode==='shield')q.shieldT=3;if(mode==='protect')q.protectT=3;if(mode==='nap')cast(g,q,'defense');
 const x=q.x;cast(g,p,'super');step(g,.9);assert.equal(q.hp,105);assert(!q.uppercutT);assert.equal(q.superKbVx,0);assert.equal(p.mustache.phase,'miss');if(mode==='nap')assert.equal(q.x,x);}
});
test('uppercut can ring out an enemy near the edge; Maduro stays inside',t=>{
 const {g,p,q}=setup(t);p.x=550;q.x=680;cast(g,p,'super');step(g,1);assert(!q.alive);assert(p.alive);assert(!g.physics.isFalling(p));assert(g.events.some(e=>e.k==='kill'&&e.fell));
});
test('interruptions and death cancel the charge; respawn clears animation fields',t=>{
 for(const interruption of ['speaking','impulse','death']){const {g,p,q}=setup(t,90,'harris');cast(g,p,'super');
 if(interruption==='speaking')cast(g,q,'defense');else if(interruption==='impulse')g.damage(p,12,'b',q.x,q.y,100);else g.kill(p,'b');
 step(g,.8);assert(!p.mustache);assert.equal(q.hp,105);g.spawn(p);assert.equal(p.mustache,null);assert.equal(p.uppercutT,0);}
});
test('host and phone receive each phase and fixed direction, including zero components',t=>{
 const {g,p,q,packets}=setup(t);cast(g,p,'super');
 for(const [time,phase] of [[0,'windup'],[.6,'flight'],[.2,'hit']]){step(g,time);g.broadcast();for(const name of ['state','view']){const s=packets.findLast(x=>x.name===name&&(name==='state'||x.room==='a')).data;const m=s.players.find(x=>x.id==='a').mustache;assert.equal(m.phase,phase);assert.equal(m.uy,0);assert.equal(m.ux,1);if(phase==='hit')assert(s.players.find(x=>x.id==='b').uppercut>0);}}
 g.reset();assert.equal(p.mustache,null);assert.equal(q.uppercutT,0);
});
test('vertical flight follows the announced direction and English config replaces Hyperinflation',t=>{
 const {g,p,q}=setup(t);p.y=180;q.x=200;q.y=350;cast(g,p,'super');step(g,.8);assert.equal(q.hp,71);assert.equal(p.x,200);assert.equal(p.char.super.label,'Super Mustache');assert(!p.char.hint.includes('Hyperinflation'));
});

test('cannot spend charge while already being knocked back',t=>{
 const {g,p}=setup(t);p.kbVx=100;assert(!cast(g,p,'super'));assert.equal(p.energy,100);assert.equal(p.cd.super,0);assert(!p.mustache);
});
