import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../server/game.js';
import {characters,arena} from '../server/loader.js';

function setup(t,character,distance=260){
 const packets=[],io={emit(){},to:room=>({emit:(name,data)=>packets.push({room,name,data})})};
 const g=new Game(io,{characters,arena,autoTick:false, fixedTeams: true});t.after(()=>g.dispose());
 g.join({id:'a'},{team:'A',character});g.join({id:'b'},{team:'B',character:'trump'});g.start();g.countdown=0;
 const p=g.players.get('a'),q=g.players.get('b');Object.assign(p,{x:200,y:320,fx:1,fy:0,protectT:0});Object.assign(q,{x:200+distance,y:320,protectT:0});
 return {g,p,q,packets};
}
const tick=(g,seconds)=>{for(let left=seconds;left>1e-8;left-=.05)g.tick(Math.min(.05,left));};
function attack(g){g.input('a',{dx:0,dy:0,attack:true});g.tick(.05);g.input('a',{dx:0,dy:0,attack:false});}

test('Musk input creates a sustained wide flame and reaches an enemy 200 units away',t=>{
 const {g,p,q,packets}=setup(t,'musk',200);const hp=q.hp;attack(g);
 const z=g.zones.find(z=>z.kind==='flamethrower');assert(z,'real flame zone through multiplayer input');
 assert.equal(z.r,240);assert.equal(z.halfAngle,22);tick(g,.25);assert(q.hp<hp);assert(g.zones.includes(z));
 g.broadcast();for(const kind of ['state','view']){const s=packets.findLast(p=>p.name===kind).data;assert.equal(s.zones[0].reach,z.reach);assert.equal(s.zones[0].halfAngle,z.halfAngle);}
 q.x=600;const farHp=q.hp;q.muskBurn=null;tick(g,.2);assert.equal(q.hp,farHp,'beyond cone range');
 tick(g,1);assert.equal(g.zones.length,0);assert(p.cd.attack>=0);
});
for(const [id,visual,count,distance] of [['macron','baguette',3,320],['obama','energy',1,430]])test(`${id}: player input emits shots that survive beyond melee reach`,t=>{
 const {g,q,packets}=setup(t,id,distance);const hp=q.hp;attack(g);assert.equal(g.projectiles.length,count);assert.equal(q.hp,hp);
 tick(g,.2);assert(g.projectiles.length>0);assert(g.projectiles.every(p=>p.visual===visual&&p.x>300));
 g.broadcast();for(const kind of ['state','view'])assert(packets.findLast(p=>p.name===kind).data.projectiles.some(p=>p.visual===visual));
 tick(g,.6);assert(q.hp<hp);assert(q.alive);
});
for(const [id,c] of Object.entries(characters).filter(([,c])=>c.super.target==='enemy'||['micDrop','decree'].includes(c.super.behavior)))test(`${id}: targeted super reaches a distant enemy through multiplayer input`,t=>{
 const {g,p,q}=setup(t,id,400);const hp=q.hp;p.energy=100;
 g.input('a',{dx:0,dy:0,super:true});g.tick(.05);g.input('a',{dx:0,dy:0,super:false});
 assert.equal(p.energy,0);assert(g.zones.length);assert(g.zones.some(z=>Math.abs(z.x-q.x)<1),'warning on enemy');
 assert.equal(q.hp,hp);tick(g,(c.super.delay||.85)+.05);assert(q.hp<hp);
});
test('Cybertruck crosses the arena to a distant target through multiplayer input',t=>{
 const {g,p,q}=setup(t,'musk',380);const hp=q.hp;p.energy=100;
 g.input('a',{dx:0,dy:0,super:true});g.tick(.05);g.input('a',{dx:0,dy:0,super:false});
 tick(g,.5);assert.equal(q.hp,hp);assert(g.zones.some(z=>z.kind==='cybertruck'));
 tick(g,.6);assert(q.hp<hp);
});
