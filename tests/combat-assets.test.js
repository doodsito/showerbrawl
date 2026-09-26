// Regression: QA-002 — short first casts loaded their art too late; failed loads never retried.
// Found by /qa on 2026-09-26. Report: .gstack/qa-reports/attack-qa.md
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {getImage} from '../client/sprites.js';
import {preloadCombatArt,COMBAT_ART} from '../client/combat-assets.js';

test('all critical combat art ships and is requested before the first cast',t=>{
 const previous=globalThis.Image,loaded=[];
 globalThis.Image=class {set src(url){loaded.push(url);} };
 t.after(()=>{globalThis.Image=previous;});
 preloadCombatArt({musk:{sprite:'sprites/musk.png'}});
 for(const path of COMBAT_ART){assert(existsSync(new URL('../client/public/'+path,import.meta.url)),path+' missing');assert(loaded.includes('/'+path),path+' not preloaded');}
 assert(loaded.includes('/sprites/musk.png'));
});
test('temporary image failure retries after a delay, keeps fallback meanwhile and caps retries',t=>{
 const previous=globalThis.Image,now=Date.now,images=[];let clock=10000;
 Date.now=()=>clock;globalThis.Image=class {constructor(){images.push(this);}set src(url){this.url=url;}};
 t.after(()=>{globalThis.Image=previous;Date.now=now;});
 assert.equal(getImage('sprites/test-retry.png'),null);images[0].onerror();
 assert.equal(getImage('sprites/test-retry.png'),null);assert.equal(images.length,1);
 clock+=3000;getImage('sprites/test-retry.png');assert.equal(images.length,2);
 Object.assign(images[1],{complete:true,naturalWidth:100,naturalHeight:100});images[1].onload();
 assert.equal(getImage('sprites/test-retry.png'),images[1]);
 getImage('sprites/test-missing.png');images.at(-1).onerror();
 for(let i=0;i<5;i++){clock+=3000;getImage('sprites/test-missing.png');images.at(-1).onerror();}
 assert.equal(images.filter(i=>i.url==='/sprites/test-missing.png').length,3);
});
