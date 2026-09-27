import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../server/game.js';
import {characters,arena} from '../server/loader.js';
import {isExtracted,EXFIL} from '../shared/exfiltration.js';
const step=(g,s)=>{for(let t=0;t<s-1e-8;t+=.025)g.tick(Math.min(.025,s-t));};
function setup(t,id='maduro',target='trump',distance=350){
 const packets=[],g=new Game({emit(){},to:room=>({emit:(name,data)=>packets.push({room,name,data})})},{characters,arena,autoTick:false, fixedTeams: true});t.after(()=>g.dispose());
 g.join({id:'a'},{character:id,team:'A'});g.join({id:'b'},{character:target,team:'B'});g.start();g.countdown=0;
 const p=g.players.get('a'),q=g.players.get('b');Object.assign(p,{x:150,y:320,fx:1,fy:0,protectT:0,energy:100});Object.assign(q,{x:150+distance,y:320,protectT:0});return {g,p,q,packets};
}
function input(g,id,slot){g.input(id,{dx:0,dy:0,[slot]:true});g.tick(.025);g.input(id,{dx:0,dy:0,[slot]:false});}
function packetsFor(g,packets){g.broadcast();return ['state','view'].map(name=>packets.findLast(p=>p.name===name&& (name==='state'||p.room==='a')).data);}
for(const id of ['maduro','xi']){
 test(`${id} projectile travels to 350 units and is serialized for host and phone`,t=>{
  const {g,p,q,packets}=setup(t,id);p.energy=0;input(g,'a','attack');assert.equal(q.hp,105);step(g,.25);
  for(const state of packetsFor(g,packets))assert(state.projectiles.some(pr=>pr.visual===p.char.attack.visual&&pr.x>220));
  step(g,.9);assert.equal(q.hp,105-p.char.attack.damage);assert(p.energy>=24.9);assert(!g.physics.isFalling(q));
 });
 test(`${id} projectile expires at its configured range`,t=>{const {g,q}=setup(t,id,'trump',510);input(g,'a','attack');step(g,1.3);assert.equal(q.hp,105);assert.equal(g.projectiles.length,0);});
 test(`${id} super targets the enemy once with a dodgeable warning and synchronized art`,t=>{
  const {g,p,q,packets}=setup(t,id);input(g,'a','super');assert.equal(p.energy,0);const z=g.zones[0];assert.equal(z.x,q.x);assert.equal(z.y,q.y);
  for(const state of packetsFor(g,packets))assert.equal(state.zones[0].visual,p.char.super.visual);
  step(g,.7);assert.equal(q.hp,105);step(g,.12);assert.equal(q.hp,77);step(g,.8);assert.equal(q.hp,77);step(g,.4);assert.equal(g.zones.length,0);
 });
 test(`${id} super can miss`,t=>{const {g,q}=setup(t,id);input(g,'a','super');q.x=650;step(g,.85);assert.equal(q.hp,105);});
}
for(const id of ['trump','obama','macron','biden','musk','xi'])for(const slot of ['attack','super'])test(`Exfiltration avoids ${id} ${slot} without moving its return point`,t=>{
 const {g,p,q}=setup(t,'maduro',id,60);input(g,'a','defense');step(g,.4);assert(isExtracted(p));q.energy=100;input(g,'b',slot);g.input('a',{dx:1,dy:0,attack:true,super:true});step(g,1.2);
 assert.equal(p.hp,105);assert.equal(p.x,150);assert.equal(p.y,320);assert.equal(p.energy,100);assert(!p.carriedBy);assert(!p.shove);assert(!p.launch);
});
test('Exfiltration is sent to both views, vulnerable at approach/landing, clears on reset',t=>{
 const {g,p,q,packets}=setup(t,'maduro','trump',60);input(g,'a','defense');assert.equal(p.cd.defense,8);
 assert(g.damage(p,1,'b',q.x,q.y));assert.equal(p.exfil,null);p.cd.defense=0;input(g,'a','defense');step(g,.4);
 for(const state of packetsFor(g,packets)){const me=state.players.find(p=>p.id==='a');assert(me.exfil.age>=EXFIL.lift);assert.equal(!!me.moving,false);}
 step(g,2.8);assert(p.exfil);assert(!isExtracted(p));assert(g.damage(p,1,'b',q.x,q.y));assert.equal(p.exfil,null);
 p.cd.defense=0;input(g,'a','defense');g.reset();assert.equal(p.exfil,null);
});
test('Projectiles and bodies cross under Maduro in flight; landing keeps his original anchor',t=>{
 const {g,p,q}=setup(t,'maduro','obama',60);input(g,'a','defense');step(g,.4);input(g,'b','attack');step(g,.15);assert.equal(p.hp,105);assert.equal(g.projectiles.length,1);
 g.input('b',{dx:-1,dy:0});step(g,.5);assert(q.x<p.x);g.input('b',{dx:0,dy:0});q.x=p.x;q.y=p.y;
 step(g,2.2);assert(!isExtracted(p));assert.equal(p.x,150);assert(Math.hypot(q.x-p.x,q.y-p.y)>=p.r+q.r-.1);
});
test('Xi shield blocks hits, expires, and does not replace the generated super',t=>{const {g,p,q}=setup(t,'xi','trump',60);input(g,'a','defense');assert(p.shieldT>0);assert(!g.damage(p,12,'b',q.x,q.y));step(g,1.7);assert(g.damage(p,12,'b',q.x,q.y));input(g,'a','super');assert.equal(g.zones[0].visual,'xiHammer');});

test('Wide phone framing keeps distant players visible during extraction only',t=>{
 const {g,p,q,packets}=setup(t,'maduro','trump',550);p.x=90;q.x=680;
 assert(!packetsFor(g,packets)[1].players.some(p=>p.id==='b'));
 input(g,'a','defense');assert(packetsFor(g,packets)[1].players.some(p=>p.id==='b'));
 step(g,3.6);assert(!packetsFor(g,packets)[1].players.some(p=>p.id==='b'));
});
