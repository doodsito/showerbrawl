// Reproducible diagnostic duels using the real server, with no sockets or production traffic.
// Bots expose numerical outliers; their win rates are not predictions of human play.
import {readFileSync,writeFileSync} from 'node:fs';
import {Game} from '../server/game.js';
import {characters as defaults,arena,normalizeCharacters} from '../server/loader.js';
const args=process.argv.slice(2),value=(flag,fallback)=>args.includes(flag)?args[args.indexOf(flag)+1]:fallback;
const characters=value('--characters')?normalizeCharacters(JSON.parse(readFileSync(value('--characters'),'utf8'))):defaults;
const ids=value('--roster',Object.keys(characters).join(',')).split(','),seconds=Number(value('--seconds',40)),dt=.05;
const scenarios=['rush','spacing','evasive','edge'];
function reach(p){const a=p.char.attack;return a.behavior==='flamethrower'?a.range:(a.behavior?a.range:Math.min(a.range||a.radius||70,a.type==='burst'?220:110)+p.r*2);}
function steer(g,p,dx,dy){
 const angle=Math.atan2(dy,dx),len=Math.min(1,Math.hypot(dx,dy));let best=null;
 for(const offset of [0,.6,-.6,1.2,-1.2,2,-2,Math.PI]){
  const a=angle+offset,x=Math.cos(a),y=Math.sin(a);
  if(g.physics.collidesWithWall(p.x+x*28,p.y+y*28,p.r))continue;
  const score=Math.cos(offset);if(!best||score>best.score)best={x:x*len,y:y*len,score};
 }
 return best||{x:0,y:0};
}
function decide(g,p,q,mode,index){
 const dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d,r=reach(p);
 const defense=p.char.defense;
 const wantsEscape=(defense.away||defense.behavior==='hyperloop')&&p.cd.defense<=0&&d<reach(q)+20&&p.cd.attack>.15&&!g.zones.some(z=>z.owner===p.id&&z.kind==='flamethrower');
 let mx=ux,my=uy,escape=false;
 const hazard=g.zones.find(z=>z.team!==p.team&&z.delay&&z.age<z.delay&&Math.hypot(p.x-z.x,p.y-z.y)<z.r+15);
 if(mode!=='rush'&&hazard){mx=p.x-hazard.x;my=p.y-hazard.y;if(Math.hypot(mx,my)<1){mx=-uy;my=ux;}escape=true;}
 else if(wantsEscape){mx=-ux;my=-uy;escape=true;}
 else if(mode!=='rush'&&(q.shieldT>0||(mode==='evasive'&&p.cd.attack>.12&&d<reach(q)+35))){mx=-ux;my=-uy;escape=true;}
 else if(mode==='spacing'&&d<r*.78){mx=-ux;my=-uy;}
 else if(d<r*.85){mx=-uy*.25;my=ux*.25;}
 const length=Math.hypot(mx,my)||1,move=steer(g,p,mx/length,my/length);
 p.input={dx:move.x,dy:move.y,attack:false,defense:false,super:false};
 p.pending={};
 if(d<=r&&(q.shieldT<=0||mode==='rush')&&!escape)p.pending.attack=true;
 if(p.cd.defense<=0&&((escape&&(hazard||wantsEscape))||(d<reach(q)+15&&g.clock>.45))){
  if(defense.behavior==='wall'){if(q.char.attack.behavior==='flamethrower'||p.hp<p.maxHp*.5)p.pending.defense=true;}
  else if(defense.type==='shield'||escape||defense.damage)p.pending.defense=true;
 }
 const superMove=p.char.super,superReady=p.cd.super<=0&&(!superMove.charge||p.energy>=superMove.charge);
 if(superReady){
  const range=['micDrop','cybertruck'].includes(superMove.behavior)?550:(superMove.range||superMove.radius||100)+(superMove.behavior?0:p.r*2);
  if(d<=range&&q.shieldT<=0)p.pending.super=true;
 }
}
function duel(a,b,mode,mirror,order,opponentMode=mode){
 const g=new Game({emit(){}},{characters,arena,autoTick:false});
 const entries=[{id:'a',team:'A',character:a},{id:'b',team:'B',character:b}];
 for(const e of order?[...entries].reverse():entries)g.join({id:e.id},e);
 g.start();g.countdown=0;
 const p=g.players.get('a'),q=g.players.get('b');
 const positions=(mode==='edge'||opponentMode==='edge')?[[145,320],[375,320]]:[[265,280],[510,365]];
 for(const [i,f] of [p,q].entries())Object.assign(f,{x:positions[mirror?1-i:i][0],y:positions[mirror?1-i:i][1],protectT:0,fx:(i===0?1:-1)*(mirror?-1:1),fy:0});
 const firstSuper={},casts={a:0,b:0},damage={a:0,b:0};let t=0,ringOut=false;
 const baseDamage=g.damage;g.damage=(target,amount,source,...rest)=>{const before=target.hp,result=baseDamage(target,amount,source,...rest);if(result&&source in damage)damage[source]+=Math.max(0,before-target.hp);return result;};
 try{
  for(;t<seconds&&!p.deaths&&!q.deaths;t+=dt){
   if(Math.round(t/dt)%3===0){decide(g,p,q,mode,0);decide(g,q,p,opponentMode,1);}
   g.tick(dt);
   for(const e of g.events)if(e.k==='kill')ringOut=!!e.fell;
   for(const e of g.events)if(e.k==='cast'){casts[e.id]++;if(e.slot==='super'&&firstSuper[e.id]==null)firstSuper[e.id]=g.clock;}
   g.events=[];g.effects=[];
  }
  return {a,b,mode,opponentMode,mirror,order,winner:p.deaths&&!q.deaths?b:q.deaths&&!p.deaths?a:null,duration:+t.toFixed(2),hp:[+p.hp.toFixed(1),+q.hp.toFixed(1)],firstSuper,casts,damage,ringOut};
 }finally{g.dispose();}
}
const rows=[];const log=console.log;console.log=()=>{};
try{for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)for(const mode of scenarios)for(const opponentMode of args.includes('--cross-style')?scenarios:[mode])for(const mirror of [false,true])for(const order of [false,true])rows.push(duel(ids[i],ids[j],mode,mirror,order,opponentMode));}finally{console.log=log;}
const summary=ids.map(id=>{const games=rows.filter(r=>r.a===id||r.b===id),wins=games.filter(r=>r.winner===id).length,draws=games.filter(r=>!r.winner).length,first=games.map(r=>r.firstSuper[r.a===id?'a':'b']).filter(x=>x!=null);return {id,games:games.length,wins,draws,score:+((wins+draws*.5)/games.length*100).toFixed(1),meanFirstSuper:first.length?+(first.reduce((a,b)=>a+b,0)/first.length).toFixed(1):null};}).sort((a,b)=>b.score-a.score);
const result={method:'Real multiplayer server. First-KO duels, 4 scripted tactics, mirrored starts, both server iteration orders. Draws score half. These are bot diagnostics, not human win rates.',crossStyle:args.includes('--cross-style'),seconds,scenarios,roster:ids,characters,summary,duels:rows};
const {duels,...metadata}=result;
const output=JSON.stringify(metadata,null,2).slice(0,-2)+',\n  "duels": [\n'+duels.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ]\n}\n';
writeFileSync(value('--out','balance/duels.json'),output);console.table(summary);console.log('Duels:',rows.length,'Draws:',rows.filter(r=>!r.winner).length);
