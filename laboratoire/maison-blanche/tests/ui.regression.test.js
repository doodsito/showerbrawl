// Regression: QA-03/04 — fullscreen hid controls; fast taps could miss a frame.
// Found by /qa on 2026-09-26. Report: ../VERIFICATION.md
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as combat from '../src/combat.js';

// Execute the real input adapter against a small DOM double, with the real
// combat simulation. Renderer is omitted: its pixels are checked in-browser.
function harness(){
  const listeners=new Map(),elements=new Map();let nextFrame,now=0;
  class Element {
    constructor(id){this.id=id;this.style={};this.attributes={};this.events={};this.writes=0;this.value='';this.checked=true;this.classList={toggle(){},add(){},remove(){}};}
    get textContent(){return this.value;}
    get parentElement(){return get('parent-'+this.id);}
    set textContent(value){this.value=String(value);this.writes++;}
    set innerHTML(value){this.markup=value;this.writes++;}
    addEventListener(type,handler){(this.events[type]??=[]).push(handler);}
    async emit(type,extra={}){const event={target:this,preventDefault(){},...extra};for(const handler of this.events[type]||[])await handler(event);}
    setAttribute(key,value){this.attributes[key]=String(value);}
    getAttribute(key){return this.attributes[key]??null;}
    closest(){return null;}
    focus(){}
    setPointerCapture(){}
    async requestFullscreen(){document.fullscreenElement=this;}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
  const document={getElementById:get,querySelectorAll:()=>[],hidden:false,fullscreenElement:null,addEventListener(){},async exitFullscreen(){this.fullscreenElement=null;}};
  const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  vm.runInNewContext(source,{...combat,document,createRenderer:()=>()=>{},matchMedia:()=>({matches:true}),window:{addEventListener(type,handler){(listeners.get(type)||listeners.set(type,[]).get(type)).push(handler);}},requestAnimationFrame:callback=>{nextFrame=callback;}});
  const fire=(type,event)=>{for(const handler of listeners.get(type)||[])handler({target:get('arena'),preventDefault(){},repeat:false,...event});};
  const frame=()=>{now+=1000/60;nextFrame(now);};
  return {get,document,fire,frame,start:async()=>{get('ai').checked=false;await get('start').emit('click');frame();},advance(count){for(let i=0;i<count;i++)frame();}};
}

test('a keyboard tap between two animation frames still consumes attack stamina',async()=>{
  const h=harness();await h.start();
  h.fire('keydown',{key:'j',code:'KeyJ'});h.fire('keyup',{key:'j',code:'KeyJ'});h.frame();
  assert.ok(parseFloat(h.get('stamina0').style.width)<90,'short tap must fire even before the next frame');
});
test('releasing one guard binding keeps another held binding active',async()=>{
  const h=harness();await h.start();
  h.fire('keydown',{key:'k',code:'KeyK'});h.fire('keydown',{key:'2',code:'Digit2'});h.advance(2);
  h.fire('keyup',{key:'k',code:'KeyK'});h.advance(2);
  assert.equal(h.get('guard').getAttribute('aria-pressed'),'true');
  h.fire('keyup',{key:'2',code:'Digit2'});h.advance(2);
  assert.equal(h.get('guard').getAttribute('aria-pressed'),'false');
});
test('fullscreen includes the game session and can be exited with the same button',async()=>{
  const h=harness();await h.get('fullscreen').emit('click');assert.equal(h.document.fullscreenElement.id,'game-session');
  await h.get('fullscreen').emit('click');assert.equal(h.document.fullscreenElement,null);
});
test('idle frames preserve existing timer and start-button text nodes',()=>{
  const h=harness(),timerWrites=h.get('timer').writes,buttonWrites=h.get('start').writes;
  h.advance(120);assert.equal(h.get('timer').writes,timerWrites);assert.equal(h.get('start').writes,buttonWrites);
});
test('blur clears held keys and pauses the match until resumed',async()=>{
  const h=harness();await h.start();h.fire('keydown',{key:'k',code:'KeyK'});h.advance(2);
  h.fire('blur',{});h.advance(120);assert.match(h.get('status').textContent,/pause/);
  await h.get('start').emit('click');h.advance(2);assert.equal(h.get('guard').getAttribute('aria-pressed'),'false');
});
