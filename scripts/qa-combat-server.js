// Local-only visual QA using real multiplayer casts and serialized server snapshots.
import express from 'express';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Game} from '../server/game.js';
import {arena,normalizeCharacters} from '../server/loader.js';
import {cast} from '../server/abilities.js';
const root=fileURLToPath(new URL('../',import.meta.url)),app=express();
app.use(express.static(root+'client/public'));
app.use('/client',express.static(root+'client'));
app.use('/shared',express.static(root+'shared'));
app.get('/',(_,res)=>res.sendFile(root+'scripts/qa-combat.html'));
app.get('/fixtures',(_,res)=>{
 const characters=normalizeCharacters(JSON.parse(readFileSync(root+'shared/characters.json','utf8'))),cases=[];
 const oldLog=console.log;console.log=()=>{};
 try{
 for(const [id,c] of Object.entries(characters))for(const slot of ['attack','defense','super']){
  const frames=[],views=[],g=new Game({emit(){},to:room=>({emit:(name,data)=>{if(name==='state')frames.push(structuredClone(data));if(name==='view'&&room==='a')views.push(structuredClone(data));}})},{characters,arena,autoTick:false});
  g.join({id:'a'},{character:id,team:'A',name:c.name});g.join({id:'b'},{character:id==='trump'?'obama':'trump',team:'B',name:'Cible'});
  g.start();g.countdown=0;const p=g.players.get('a'),q=g.players.get('b');
  Object.assign(p,{x:300,y:320,protectT:0,energy:100,fx:1,fy:0});Object.assign(q,{x:slot==='defense'||c[slot].travel?480:370,y:320,protectT:0});
  const ok=cast(g,p,slot);g.broadcast();
  for(let i=0;i<90;i++){g.tick(1/30);g.broadcast();}
  cases.push({id:id+'-'+slot,character:id,slot,label:c[slot].label,ok,frames,views});g.dispose();
 }
 }finally{console.log=oldLog;}
 res.json({characters,arena,cases});
});
app.listen(Number(process.env.QA_PORT||3011),'127.0.0.1',()=>console.log('Animation QA: http://127.0.0.1:3011'));
