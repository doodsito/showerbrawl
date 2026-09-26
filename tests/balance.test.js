import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../shared/config.js';
import {Game} from '../server/game.js';
import {characters,arena} from '../server/loader.js';
import {cast} from '../server/abilities.js';
const FLAME=characters.musk.attack;
import {hitWall} from '../server/lab-combat.js';
import {makePhysics} from '../server/physics.js';

function duel(t,a='obama',b='trump'){
 const game=new Game({emit(){}},{characters,arena,autoTick:false});t.after(()=>game.dispose());
 game.join({id:'a'},{team:'A',character:a});game.join({id:'b'},{team:'B',character:b});game.start();game.countdown=0;
 const p=game.players.get('a'),q=game.players.get('b');
 Object.assign(p,{x:250,y:320,protectT:0});Object.assign(q,{x:650,y:320,protectT:0});
 return {game,p,q};
}
const advance=(g,s)=>{for(let n=s;n>1e-8;n-=.05)g.tick(Math.min(n,.05));};

for(const id of ['obama','harris'])test(`${id}: recovery slows movement briefly; cooldown alone never slows it`,t=>{
 const {game,p}=duel(t,id);cast(game,p,'attack');p.input={dx:1,dy:0};
 const x=p.x;advance(game,.05);assert(Math.abs(p.x-x-p.char.speed*.65*.05)<.01);
 p.cd.super=5;advance(game,CONFIG.BASE_ATTACK.recovery);
 const recovered=p.x;assert(p.cd.attack>0);advance(game,.05);
 assert(Math.abs(p.x-recovered-p.char.speed*.05)<.01);
 game.reset();assert.equal(p.recoveryT,0);
});

test('only super impulses may cross arena edges, including mixed overlapping impulses',()=>{
 const physics=makePhysics({cellSize:64,grid:['#####','#...#','#...#','#####']});
 const normal={x:210,y:96,r:18};physics.push(normal,110,96,1000);
 for(let i=0;i<10;i++)physics.applyKnockback(normal,.05);
 assert(normal.x<=238);assert.equal(physics.isFalling(normal),false);
 const superHit={x:210,y:96,r:18};physics.push(superHit,110,96,1000,true);physics.applyKnockback(superHit,.1);
 assert.equal(physics.isFalling(superHit),true);
 const mixed={x:210,y:96,r:18};physics.push(mixed,110,96,1000);physics.push(mixed,110,96,5,true);
 for(let i=0;i<10;i++)physics.applyKnockback(mixed,.05);
 assert.equal(physics.isFalling(mixed),false,'a tiny super does not promote normal knockback to a ring-out');
});

test('normal attacks stop at edges; a charged targeted super still causes a ring-out',t=>{
 const {game,p,q}=duel(t,'harris','biden');Object.assign(p,{x:620,y:320});Object.assign(q,{x:684,y:320});
 cast(game,p,'attack');advance(game,.5);assert(q.alive);assert(q.x<=686);
 p.energy=100;cast(game,p,'super');advance(game,p.char.super.delay+.5);
 assert.equal(q.alive,false);assert(game.events.some(e=>e.k==='kill'&&e.fell));
});

test('a shield blocks a super ring-out and respawn clears both impulse channels',t=>{
 const {game,p,q}=duel(t,'harris','biden');Object.assign(p,{x:620,y:320});Object.assign(q,{x:684,y:320,shieldT:3});
 p.energy=100;cast(game,p,'super');advance(game,1.2);assert(q.alive);assert.equal(q.hp,q.maxHp);
 game.physics.push(q,500,320,500,true);game.physics.push(q,500,320,500);game.spawn(q);
 for(const key of ['kbVx','kbVy','superKbVx','superKbVy'])assert.equal(q[key],0);
});

test('delayed super damage grants comeback energy only to the victim',t=>{
 const {game,p,q}=duel(t,'harris','biden');q.x=450;p.energy=100;cast(game,p,'super');advance(game,p.char.super.delay+.05);
 assert(q.hp<q.maxHp);assert.equal(p.energy,0);assert(q.energy>0);
});

test('Trump cannot recharge by punching own or allied walls; enemy walls grant charge',t=>{
 const {game,p,q}=duel(t,'trump','trump');
 const wall={id:99,x:350,y:320,hp:100,team:p.team};
 hitWall(game,wall,12,p.id);assert.equal(p.energy,0);
 wall.owner='ally';hitWall(game,wall,12,p.id);assert.equal(p.energy,0);
 wall.team=q.team;hitWall(game,wall,12,p.id);assert(p.energy>0);
});

test('flame cone rejects a target outside its angle and advertises its geometry',t=>{
 const {game,p,q}=duel(t,'musk','trump');q.x=350;cast(game,p,'attack');
 const angle=(FLAME.halfAngle+8)*Math.PI/180;
 Object.assign(q,{x:p.x+100*Math.cos(angle),y:p.y+100*Math.sin(angle)});advance(game,.1);
 assert.equal(q.hp,q.maxHp);
 let snapshot;game.io.emit=(name,data)=>{if(name==='state')snapshot=data;};game.broadcast();
 assert.equal(snapshot.zones[0].halfAngle,FLAME.halfAngle);
});
