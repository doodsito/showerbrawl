import {createMatch,startMatch,pauseMatch,tick,strike,deployWall,defend,RULES} from './combat.js?v=obama-4';
import {createRenderer} from './renderer.js?v=obama-4';

const $=id=>document.getElementById(id),canvas=$('arena'),render=createRenderer(canvas);
let failedSprites=[];
render.assetsReady?.then(({failed})=>{failedSprites=failed;updateCharacter();});
function makeMatch(){const character=$('character').value==='obama'?'obama':'trump';return createMatch(character,character==='obama'?'trump':'obama');}
let match=makeMatch(),last=0,accumulator=0,previousPhase='';
function updateCharacter(){
  const obama=match.fighters[0].character==='obama';
  text('art-status',failedSprites.length?'Certains visuels n’ont pas chargé · rendu de secours actif':obama?'Obama contre Trump · kit à tester':'Trump contre Obama · kit à tester');
  text('attack-name',obama?'Énergie':'Attaque');text('attack-detail',obama?'Projectile à fort recul · 15 endurance':'Direct au corps · 15 endurance');
  text('defense-name',obama?'Esquive':'Mur MAGA');
  text('super-name',obama?'Mic Drop':'You’re fired!');text('super-detail',obama?'Zone annoncée puis onde de choc':'Projette à l’autre bout du ring');
  $('attack-art').src=obama?'assets/obama_attack.png':'assets/punch_fx.png';
  $('defense-art').src=obama?'assets/obama.png':'assets/maga_wall.png';
  $('super-art').hidden=!obama;$('super-symbol').hidden=obama;
}
const keys=new Map(),pointers=new Map(),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const aliases={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',q:'left',w:'up',z:'up',s:'down',d:'right',j:'attack','1':'attack',k:'wall','2':'wall',Shift:'guard',l:'super','3':'super'};
const held=action=>[...keys.values(),...pointers.values()].includes(action);
const allowedTarget=target=>!target.closest('input,select,textarea,button,a');
function activate(action){
  if(action==='attack'||action==='super')strike(match,0,action);
  if(action==='wall'&&match.phase==='playing'){
    const placed=defend(match,0,{x:Number(held('right'))-Number(held('left')),y:Number(held('down'))-Number(held('up'))}),p=match.fighters[0];
    $('status').textContent=p.character==='obama'?(placed?'Esquive ! Change de direction pour la prochaine.':'Esquive indisponible : vérifie la recharge et l’endurance.'):placed?'Mur posé : contourne-le ou détruis-le à coups de poing.':p.wallCooldown>0?'Le mur recharge.':'Pas assez de place devant Trump, ou action en cours. Décale-toi et réessaie.';
  }
}
function clearInput(){keys.clear();pointers.clear();document.querySelectorAll('.is-held').forEach(el=>el.classList.remove('is-held'));}
function begin(){startMatch(match);clearInput();canvas.focus({preventScroll:true});sync();}
function reset(){match=makeMatch();clearInput();previousPhase='';updateCharacter();sync();}
$('character').addEventListener('change',reset);
function togglePause(){if(match.phase==='playing'){pauseMatch(match);clearInput();}else if(match.phase==='paused'||match.phase==='ready')begin();sync();}
window.addEventListener('keydown',e=>{
  if(!allowedTarget(e.target))return;
  const key=e.key.length===1?e.key.toLowerCase():e.key;
  if(aliases[key]){e.preventDefault();const action=aliases[key];keys.set(e.code||key,action);if(!e.repeat)activate(action);}
  else if(e.code==='Space'){e.preventDefault();if(!e.repeat)togglePause();}
  else if(key==='r'&&!e.repeat){reset();begin();}
});
window.addEventListener('keyup',e=>{const key=e.key.length===1?e.key.toLowerCase():e.key;keys.delete(e.code||key);});
function bindHold(el,action){
  el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();el.setPointerCapture(e.pointerId);pointers.set(e.pointerId,action);el.classList.add('is-held');activate(action);canvas.focus({preventScroll:true});});
  const release=e=>{pointers.delete(e.pointerId);el.classList.remove('is-held');};
  el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);
  // Native keyboard activation also works for the three combat buttons.
  el.addEventListener('click',e=>{if(e.detail!==0)return;activate(action);});

}
document.querySelectorAll('[data-move]').forEach(el=>bindHold(el,el.dataset.move));
bindHold($('attack'),'attack');bindHold($('guard'),'wall');bindHold($('super'),'super');
$('start').addEventListener('click',()=>{if(match.phase==='finished')reset();begin();});
$('pause').addEventListener('click',togglePause);
$('reset').addEventListener('click',()=>{reset();begin();});
$('rematch').addEventListener('click',()=>{reset();begin();});
function autoPause(){clearInput();pauseMatch(match);sync();}
window.addEventListener('blur',autoPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});
$('fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game-session').requestFullscreen();}
  catch{$('status').textContent='Le plein écran n’est pas disponible dans ce navigateur.';}
});
if(!$('game-session').requestFullscreen)$('fullscreen').hidden=true;
document.addEventListener('fullscreenchange',()=>{
  const expanded=document.fullscreenElement===$('game-session');
  $('fullscreen').textContent=expanded?'Quitter ⛶':'⛶';
  $('fullscreen').setAttribute('aria-label',expanded?'Quitter le plein écran':'Afficher l’arène en plein écran');
});
function text(id,value){const element=$(id),next=String(value);if(element.textContent!==next)element.textContent=next;}
function percent(id,value){const element=$(id),next=`${Math.max(0,Math.min(100,value)).toFixed(1)}%`;if(element.style.width!==next)element.style.width=next;}
function sync(){
  for(const f of match.fighters){
    text('name'+f.id,`${failedSprites.includes(f.character)?(f.id?'ADVERSAIRE':'JOUEUR'):f.character.toUpperCase()}${f.id?' · IA':''}`);
    text('hp'+f.id,f.hp);percent('health'+f.id,f.hp);
    const meter=$('health'+f.id).parentElement;if(meter.getAttribute('aria-valuenow')!==String(f.hp))meter.setAttribute('aria-valuenow',f.hp);
    percent('stamina'+f.id,f.stamina);
  }
  const p=match.fighters[0],obama=p.character==='obama',defenseCooldown=obama?RULES.dashCooldown:RULES.wallCooldown,seconds=Math.ceil(match.remaining);
  text('timer',`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`);
  text('charge',Math.floor(p.energy)+'%');percent('super-ready',p.energy);$('super').classList.toggle('is-ready',p.energy>=100);
  percent('attack-ready',p.stamina>=15?Math.max(0,1-p.cooldown/.42)*100:0);percent('guard-ready',(1-p.wallCooldown/defenseCooldown)*100);
  const wall=match.walls.find(w=>w.owner===0);
  text('wall-detail',obama?(p.wallCooldown>0?`Recharge · ${Math.ceil(p.wallCooldown)} s`:'Longue esquive · direction + K'):wall?`Mur : ${wall.hp} PV · ${Math.ceil(wall.ttl)} s`:p.wallCooldown>0?`Recharge · ${Math.ceil(p.wallCooldown)} s`:'Poser un obstacle · 6 s');
  $('guard').classList.toggle('is-ready',p.wallCooldown===0);
  $('guard').setAttribute('aria-label',`${obama?'Esquive':'Mur MAGA'}. ${$('wall-detail').textContent}. Touche K ou 2.`);
  if(previousPhase!==match.phase){
    previousPhase=match.phase;
    $('pause').disabled=!['playing','paused'].includes(match.phase);$('pause').textContent=match.phase==='paused'?'▶ Reprendre':'Ⅱ Pause';
    $('pause').setAttribute('aria-label',match.phase==='paused'?'Reprendre le combat':'Mettre en pause');
    $('start').hidden=match.phase==='playing';$('start').innerHTML=match.phase==='paused'?'Reprendre <span>↗</span>':match.phase==='finished'?'Nouveau combat <span>↗</span>':'Lancer le combat <span>↗</span>';
    for(const id of ['attack','guard','super'])$(id).disabled=match.phase!=='playing';
    $('result').hidden=match.phase!=='finished';
    const messages={ready:'L’arène est prête. Entre dans le combat.',playing:'Éloigne-toi sans attaquer : recul rapide automatique. K : défense · Maj : garde.',paused:'Combat en pause. Reprends quand tu es prêt.',finished:'Combat terminé. Une revanche ?'};
    $('status').textContent=messages[match.phase];
    if(match.phase==='finished'){
      $('result-title').textContent=match.winner===null?'ÉGALITÉ':match.winner===0?'VICTOIRE':'DÉFAITE';
      $('result-detail').textContent=match.fighters.some(f=>f.hp===0)?'K.-O. · La pelouse a son champion.':'Temps écoulé · Décision aux points de vie.';
    }
  }
}
function frame(now){
  const elapsed=last?Math.min((now-last)/1000,.1):0;last=now;accumulator+=elapsed;
  while(accumulator>=1/60){
    tick(match,1/60,{x:Number(held('right'))-Number(held('left')),y:Number(held('down'))-Number(held('up')),guard:held('guard'),attack:held('attack'),super:held('super')},$('ai').checked);
    accumulator-=1/60;
  }
  render(match,reducedMotion.matches?0:now/1000,{enhanced:$('motion').checked,reducedMotion:reducedMotion.matches});sync();requestAnimationFrame(frame);
}
updateCharacter();sync();requestAnimationFrame(frame);
