import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../server/game.js';
import {characters,arena} from '../server/loader.js';
import {cast,standardAttack} from '../server/abilities.js';

test('Obama energy travels across the arena and hits a distant enemy after flight',t=>{
 const g=new Game({emit(){}},{characters,arena,autoTick:false});t.after(()=>g.dispose());
 g.join({id:'a'},{team:'A',character:'obama'});g.join({id:'b'},{team:'B',character:'trump'});g.start();g.countdown=0;
 const p=g.players.get('a'),q=g.players.get('b');
 Object.assign(p,{x:120,y:320,protectT:0,fx:1,fy:0});Object.assign(q,{x:620,y:320,protectT:0});
 const hp=q.hp;assert(cast(g,p,'attack'));assert.equal(g.projectiles.length,1);assert.equal(q.hp,hp);
 for(let i=0;i<9;i++)g.tick(.05);
 assert(g.projectiles[0].x>380,'still flying beyond the former short range');assert.equal(q.hp,hp);
 for(let i=0;i<10;i++)g.tick(.05);
 assert.equal(q.hp,hp-characters.obama.attack.damage);assert.equal(g.projectiles.length,0);assert(q.alive);
 assert.equal(standardAttack(characters.obama.attack).range,600,'cast must preserve configured range');
});
