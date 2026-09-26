// Regression: QA-001 — Macron's generic melee/targeted super lost their custom visuals.
// Found by /qa on 2026-09-26. Report: .gstack/qa-reports/attack-qa.md
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../server/game.js';
import {characters,arena} from '../server/loader.js';
import {cast} from '../server/abilities.js';

function setup(t,id){
 let state;const game=new Game({emit:(name,data)=>{if(name==='state')state=data;}},{characters,arena,autoTick:false});t.after(()=>game.dispose());
 game.join({id:'a'},{team:'A',character:id});game.join({id:'b'},{team:'B',character:'trump'});game.start();game.countdown=0;
 const p=game.players.get('a'),q=game.players.get('b');Object.assign(p,{x:300,y:320,protectT:0,energy:100});Object.assign(q,{x:360,y:320,protectT:0});
 return {game,p,q,snapshot:()=>{game.broadcast();return state;}};
}
for(const [id,visual] of [['macron','baguette'],['obama','energy']])test(`${id}: hit, miss and block retain the attack visual in server snapshots`,t=>{
 const {game,p,q,snapshot}=setup(t,id);
 cast(game,p,'attack');assert(snapshot().effects.some(e=>e.kind==='strike'&&e.visual===visual));
 game.effects=[];p.cd.attack=0;q.x=600;cast(game,p,'attack');assert(snapshot().effects.some(e=>e.kind==='whiff'&&e.visual===visual));
 game.effects=[];p.cd.attack=0;q.x=360;q.shieldT=1;cast(game,p,'attack');assert(snapshot().effects.some(e=>e.kind==='whiff'&&e.visual===visual));
});
test('49.3 broadcasts the stamp at the real target with unchanged damage and warning timing',t=>{
 const {game,p,q,snapshot}=setup(t,'macron');q.x=600;const hp=q.hp;assert(cast(game,p,'super'));
 const z=snapshot().zones[0];assert.equal(z.kind,'strike');assert.equal(z.visual,'decree');assert.equal(z.x,q.x);assert.equal(z.y,q.y);assert.equal(z.r,p.char.super.radius);
 for(let t=0;t<p.char.super.delay-.051;t+=.05)game.tick(.05);assert.equal(q.hp,hp);game.tick(.1);assert.equal(q.hp,hp-p.char.super.damage);
 game.tick(.05);assert.equal(q.hp,hp-p.char.super.damage,'one impact only');
});
