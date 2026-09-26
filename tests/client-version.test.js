import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {createVersionCheck} from '../client/version.js';
const old = '1111111111111111', fresh = '2222222222222222';

test('an old tab waits for the lobby, then reloads once and preserves player selection first', async () => {
  let phase='playing', calls=[];
  const check=createVersionCheck({version:old,canReload:()=>phase==='lobby',fetchVersion:async()=>({version:fresh}),beforeReload:()=>calls.push('save'),reload:()=>calls.push('reload')});
  await check(); assert.deepEqual(calls,[]);
  phase='lobby'; await check(); await check(); assert.deepEqual(calls,['save','reload']);
});
test('current, unavailable and malformed releases do not trigger a reload', async () => {
  for(const response of [{version:old},{version:'dev'},{},{version:'bad'},new Error('offline')]) {
    let count=0;
    const check=createVersionCheck({version:old,canReload:()=>true,fetchVersion:async()=>{if(response instanceof Error)throw response;return response;},reload:()=>count++});
    await check(); assert.equal(count,0);
  }
});
test('version checks recover after an offline request and coalesce concurrent checks', async () => {
  let resolve,calls=0,reloads=0;
  const check=createVersionCheck({version:old,canReload:()=>true,fetchVersion:()=>{calls++;return new Promise(r=>resolve=r);},reload:()=>reloads++});
  const pending=check();await check();assert.equal(calls,1);resolve({version:fresh});await pending;assert.equal(reloads,1);
});
test('every portrait and ability icon ships; SVG and PNG URLs share the client release',async t=>{
  globalThis.__CLIENT_VERSION__=fresh;t.after(()=>delete globalThis.__CLIENT_VERSION__);
  const {assetUrl}=await import('../client/version.js?release-test');
  const characters=JSON.parse(readFileSync(new URL('../shared/characters.json',import.meta.url)));
  for(const c of Object.values(characters))for(const path of [c.sprite,c.attack?.icon,c.defense?.icon,c.super?.icon].filter(p=>p?.startsWith('sprites/'))) {
    assert(existsSync(new URL('../client/public/'+path,import.meta.url)),path);
    assert.equal(assetUrl(path),'/'+path+'?v='+fresh);
  }
  assert.equal(assetUrl('/sprites/musk.png'),'/sprites/musk.png?v='+fresh);
  assert.equal(assetUrl('sprites/musk.png?x=1'),'/sprites/musk.png?x=1&v='+fresh);
});
