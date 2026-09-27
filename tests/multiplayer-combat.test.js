import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../shared/config.js';
import { Game } from '../server/game.js';
import { characters, arena } from '../server/loader.js';
import { cast } from '../server/abilities.js';
import { wallContact } from '../shared/wall-geometry.js';

function setup(t, a='trump', b='obama') {
  const events=[];
  const game=new Game({emit:(name,data)=>events.push({name,data})},{characters,arena,autoTick:false, fixedTeams: true});
  t.after(()=>game.dispose());
  game.join({id:'a'},{team:'A',character:a});game.join({id:'b'},{team:'B',character:b});game.start();game.countdown=0; // tests de combat: on saute le 3-2-1
  const p=game.players.get('a'),q=game.players.get('b');
  Object.assign(p,{x:300,y:320,protectT:0});Object.assign(q,{x:470,y:320,protectT:0});
  return {game,p,q,events};
}
const advance=(g,seconds)=>{for(let left=seconds;left>1e-8;left-=.01)g.tick(Math.min(.01,left));};

test('Trump has a melee punch; misses do not damage or create a projectile',t=>{
 const {game,p,q}=setup(t);assert.equal(cast(game,p,'attack'),true);assert.equal(q.hp,q.maxHp);assert.equal(game.projectiles.length,0);
 advance(game,.6);q.x=370;cast(game,p,'attack');assert.equal(q.hp,q.maxHp-CONFIG.BASE_ATTACK.damage);assert.ok(p.energy>0);advance(game,.2);assert.ok(q.x>=380);
});
test('summoned wall blocks both teams and absorbs three punches, then frees the passage',t=>{
 const {game,p,q}=setup(t);assert.ok(cast(game,p,'defense'));const wall=game.walls[0];
 game.physics.moveWithWalls(p,200,0,p.r);game.physics.moveWithWalls(q,-200,0,q.r);
 assert.ok(p.x<wall.x&&q.x>wall.x);assert.equal(wallContact(p,wall,p.r),null);
 for(let i=0;i<3;i++){p.cd.attack=0;cast(game,p,'attack');}
 assert.equal(game.walls.length,0);assert.equal(q.hp,q.maxHp);assert.equal(p.energy,0);
 game.physics.moveWithWalls(p,150,0,p.r);assert.ok(p.x>wall.x);
});
test('invalid wall placement has no cooldown; a placed wall expires and reset clears all effects',t=>{
 const {game,p,q}=setup(t);q.x=376;assert.equal(cast(game,p,'defense'),false);assert.equal(p.cd.defense,0);
 q.x=470;assert.ok(cast(game,p,'defense'));advance(game,6.1);assert.equal(game.walls.length,0);
 game.reset();assert.equal(game.effects.length,0);assert.equal(game.zones.length,0);assert.equal(p.energy,0);
});
test('melee strike: misses at range, hits and pushes at contact, never spawns a projectile',t=>{
 const {game,p,q}=setup(t,'harris','trump');cast(game,p,'attack');assert.equal(game.projectiles.length,0);advance(game,.4);assert.equal(q.hp,q.maxHp);
 Object.assign(q,{x:340});p.cd.attack=0;cast(game,p,'attack');assert.equal(q.hp,q.maxHp-CONFIG.BASE_ATTACK.damage);assert.equal(game.projectiles.length,0);
 const atHit=q.x;advance(game,.3);assert.ok(q.x-atHit>20,'knockback pousse la cible');
 assert.ok(game.effects.some(e=>e.kind==='strike'),'effet au point d\'impact');
});
test('friendly players take no projectile or Mic Drop damage',t=>{
 const {game,p,q}=setup(t,'obama','trump');q.team='A';q.x=370;p.fx=1;p.fy=0;
 cast(game,p,'attack');advance(game,.5);assert.equal(q.hp,q.maxHp);
 p.energy=100;assert.equal(cast(game,p,'super'),false);assert.equal(game.zones.length,0);assert.equal(p.energy,100);advance(game,1);assert.equal(q.hp,q.maxHp);
});
test('Obama dash defaults away, travels 238 units, and has no invulnerability',t=>{
 const {game,p,q}=setup(t,'obama','trump');p.x=400;q.x=500;
 cast(game,p,'defense');assert.equal(p.invulnT,0);advance(game,.28);assert.ok(Math.abs(p.x-162)<1);
 assert.equal(cast(game,p,'defense'),false);assert.ok(p.cd.defense>3);
});
test('dash cannot tunnel through a wall or another player even on a slow frame',t=>{
 const {game,p,q}=setup(t,'obama','trump');p.x=480;q.x=300;cast(game,q,'defense');p.dx=-1;
 cast(game,p,'defense');game.tick(.1);game.tick(.1);game.tick(.1);assert.ok(p.x>game.walls[0].x);
 game.walls=[];p.cd.defense=0;p.x=480;q.x=400;p.dx=-1;cast(game,p,'defense');advance(game,.3);assert.ok(p.x-q.x>=35.9);
});
test('Mic Drop targets the nearest living enemy across the arena, warns and hits once',t=>{
 const {game,p,q}=setup(t,'obama','trump');q.x=680;q.y=340;p.energy=100;
 game.join({id:'ally'},{team:'A',character:'trump'});const ally=game.players.get('ally');Object.assign(ally,{x:320,y:320,protectT:0});
 game.join({id:'far'},{team:'B',character:'macron'});const far=game.players.get('far');Object.assign(far,{x:760,y:450,protectT:0});
 assert.equal(cast(game,p,'super'),true);assert.equal(p.energy,0);
 const drop=game.zones[0];assert.equal(drop.x,q.x);assert.equal(drop.y,q.y);
 advance(game,.8);assert.equal(q.hp,q.maxHp);advance(game,.06);assert.equal(q.hp,q.maxHp-p.char.super.damage);
 assert.equal(ally.hp,ally.maxHp);assert.equal(p.hp,p.maxHp);advance(game,1.3);assert.equal(q.hp,q.maxHp-p.char.super.damage);assert.equal(game.zones.length,0);
});
test('the Mic Drop target stays fixed so the enemy can escape before impact',t=>{
 const {game,p,q}=setup(t,'obama','trump');p.energy=100;cast(game,p,'super');
 const drop=game.zones[0],x=drop.x,y=drop.y;q.x+=160;
 advance(game,.9);assert.equal(drop.x,x);assert.equal(drop.y,y);assert.equal(q.hp,q.maxHp);
});
test('Mic Drop destroys walls, spares allies, respects spawn protection and shields',t=>{
 const {game,p,q}=setup(t,'obama','trump');q.x=400;q.fx=-1;cast(game,q,'defense');p.energy=100;cast(game,p,'super');
 q.protectT=2;advance(game,.9);assert.equal(q.hp,q.maxHp);assert.equal(game.walls.length,0);
 q.protectT=0;q.shieldT=2;p.energy=100;p.cd.super=0;cast(game,p,'super');advance(game,.9);assert.equal(q.hp,q.maxHp);
});
test('You’re fired requires charge, launches to the far edge and waits for landing before KO',t=>{
 const {game,p,q}=setup(t);q.x=380;assert.equal(cast(game,p,'super'),false);p.energy=100;q.hp=20;
 cast(game,p,'super');assert.equal(p.energy,0);assert.ok(q.launch);assert.equal(q.alive,true);assert.equal(game.score.A,0);
 advance(game,.25);assert.ok(q.x>450);assert.equal(q.alive,true);advance(game,.35);
 assert.equal(q.alive,false);assert.equal(game.score.A,1);assert.ok(q.x>650);assert.ok(game.effects.some(e=>e.kind==='impact'));
 advance(game,3.1);assert.equal(q.alive,true);assert.equal(q.hp,q.maxHp);assert.equal(q.launch,null);
});
test('a wall intercepts the super; a launched target destroys a wall further behind',t=>{
 const {game,p,q}=setup(t);q.x=425;cast(game,p,'defense');p.energy=100;cast(game,p,'super');assert.equal(game.walls.length,0);assert.equal(q.hp,q.maxHp);
 p.cd.super=0;p.cd.defense=0;p.energy=100;p.x=300;q.x=380;
 game.walls.push({id:99,owner:q.id,team:'B',x:550,y:320,ux:1,uy:0,width:24,depth:150,slant:.2,hp:36,ttl:6,age:0});
 cast(game,p,'super');advance(game,.6);assert.equal(game.walls.length,0);assert.equal(q.hp,q.maxHp-30);
});
test('short mobile taps survive between server ticks, defense does not recast while held',t=>{
 const {game,p}=setup(t);game.input(p.id,{defense:true});game.input(p.id,{defense:false});game.tick(.05);assert.equal(game.walls.length,1);
 p.cd.defense=0;game.walls=[];game.input(p.id,{defense:true});game.tick(.05);assert.equal(game.walls.length,1);
 p.cd.defense=0;game.walls=[];game.tick(.05);assert.equal(game.walls.length,0);
});
test('snapshots carry authoritative wall, charge, dash and attack visual state',t=>{
 const {game,p,q,events}=setup(t);cast(game,p,'defense');p.energy=42;cast(game,q,'attack');cast(game,q,'defense');game.broadcast();
 const s=events.at(-1).data;assert.equal(s.players[0].energy,42);assert.equal(s.walls.length,1);assert.equal(s.projectiles.length,1);assert.equal(s.projectiles[0].visual,'energy');assert.ok(s.players[1].dash);
 game.reset();game.start();game.countdown=0;game.broadcast();const fresh=events.at(-1).data;assert.equal(fresh.walls.length,0);assert.equal(fresh.projectiles.length,0);
});
test('generic bricks: melee strike, ground shockwave, centred zone, charge, shield',t=>{
 const {game,p,q}=setup(t,'schwarzenegger','harris');cast(game,p,'attack');assert.equal(game.projectiles.length,0);assert.equal(q.hp,q.maxHp,'trop loin');
 cast(game,p,'defense');assert.equal(p.invulnT,0);assert.ok(p.dashHit);
 q.char={...q.char,super:{type:'burst',radius:90,damage:9,knockback:300,cooldown:1}};cast(game,q,'super');assert.equal(game.projectiles.length,0);assert.ok(game.effects.some(e=>e.kind==='shockwave'),'burst = onde au sol');
 cast(game,q,'defense');assert.ok(q.shieldT>0);
 q.cd.super=0;q.char={...q.char,super:{type:'zone',radius:100,damage:10,duration:1,cooldown:1}};cast(game,q,'super');
 assert.equal(game.zones.length,1);assert.equal(game.zones[0].x,q.x,'zone sans target: centree sur le lanceur');
});
test('charge (dash) hits and pushes the enemy on its path',t=>{
 const {game,p,q}=setup(t,'schwarzenegger','biden');q.x=p.x+120;const hp=q.hp,x0=q.x;
 cast(game,p,'defense');advance(game,.3);assert.equal(q.hp,hp-p.char.defense.damage);assert.ok(q.x-x0>30,'pousse devant');
});
test('burst shockwave damages and knocks back every nearby enemy, not the far ones',t=>{
 const {game,p,q}=setup(t,'maduro','biden');game.join({id:'c'},{team:'B',character:'musk',name:'far'});
 const far=game.players.get('c');Object.assign(far,{x:p.x+400,y:p.y,protectT:0});q.x=p.x+70;const x0=q.x;
 p.char={...p.char,super:{type:'burst',radius:90,damage:9,knockback:300,cooldown:1}};cast(game,p,'super');assert.equal(q.hp,q.maxHp-9);assert.equal(far.hp,far.maxHp);advance(game,.3);assert.ok(q.x-x0>20);
});

test('countdown 3-2-1: players frozen, inputs ignored and match timer stopped until FIGHT', () => {
  const events=[];
  const game=new Game({emit:(name,data)=>events.push({name,data})},{characters,arena,autoTick:false, fixedTeams: true});
  try {
    game.join({id:'a'},{team:'A',character:'biden'});game.join({id:'b'},{team:'B',character:'musk'});game.start();
    const p=game.players.get('a'),x0=p.x,t0=game.timeLeft;
    assert.equal(game.countdown,3);
    game.input('a',{dx:1,dy:0,attack:true});
    for(let i=0;i<20;i++)game.tick(.1); // 2 s
    assert.equal(p.x,x0,'immobile pendant le compte a rebours');
    assert.equal(game.projectiles.length,0,'aucune attaque pendant le compte a rebours');
    assert.equal(game.timeLeft,t0,'timer arrete');
    game.broadcast();assert.ok(events.filter(e=>e.name==='state').at(-1).data.countdown>0);
    for(let i=0;i<12;i++)game.tick(.1); // FIGHT!
    assert.equal(game.countdown,0);
    for(let i=0;i<5;i++)game.tick(.1);
    assert.ok(p.x>x0,'bouge apres FIGHT');
    assert.ok(game.timeLeft<t0,'timer demarre apres FIGHT');
  } finally { game.dispose(); }
});

test('kill: soin au tueur plafonne a maxHp, evenement kill avec le nom du tueur', t => {
 const {game,p,q}=setup(t,'biden','musk');
 p.hp=50;q.hp=0;game.kill(q,p.id);
 assert.equal(p.hp,50+25);assert.equal(p.kills,1);
 const ev=game.events.find(e=>e.k==='kill');assert.equal(ev.killerName,p.name);assert.equal(ev.name,q.name);assert.equal(ev.fell,false);
 p.hp=p.maxHp-5;game.spawn(q);game.kill(q,p.id);assert.equal(p.hp,p.maxHp,'plafonne');
});
test('regeneration passive: 1 PV/s seulement apres 3 s hors combat', t => {
 const {game,p,q}=setup(t,'biden','musk');Object.assign(q,{x:700});
 p.hp=50;p.combatAt=game.clock;
 for(let i=0;i<20;i++)game.tick(.1);assert.equal(p.hp,50,'pas de regen avant 3 s');
 for(let i=0;i<20;i++)game.tick(.1);assert.ok(p.hp>50.5&&p.hp<52,'~1 PV/s ensuite');
 game.damage(p,5,q.id,q.x,q.y);const hp=p.hp;for(let i=0;i<10;i++)game.tick(.1);assert.equal(p.hp,hp,'coup recu: regen coupee');
});
test('chute hors du toit: evenement kill marque fell', t => {
 const {game,q}=setup(t,'biden','musk');q.x=-50;game.tick(.05);
 const ev=game.events.find(e=>e.k==='kill');assert.ok(ev);assert.equal(ev.fell,true);
});

// Regle de design: attack/defense au corps a corps, super cible a distance avec alerte au sol (esquivable).
const escapeRadius=s=>(s.radius||90)+(s.behavior==='decree'?70:0); // decree: onde de choc au sol autour du tampon
const RANGED_SUPERS=Object.keys(characters).filter(id=>characters[id].super.target==='enemy'||['micDrop','decree'].includes(characters[id].super.behavior));
function duel(t,a){
  const {game,p,q}=setup(t,a,a==='biden'?'musk':'biden');
  Object.assign(p,{x:200,y:320,fx:1,fy:0});Object.assign(q,{x:400,y:320});return {game,p,q};
}
for(const id of Object.keys(characters).filter(id=>!characters[id].attack.travel&&!characters[id].attack.behavior)){
  test(`${id}: l'attaque de base ne touche pas a 200 unites`,t=>{
    const {game,p,q}=duel(t,id);const hp=q.hp;cast(game,p,'attack');advance(game,.6);
    assert.equal(q.hp,hp);assert.equal(game.projectiles.length,0);
  });
}
for(const id of RANGED_SUPERS){
  test(`${id}: le super touche une cible a 400 unites apres son delai`,t=>{
    const {game,p,q}=duel(t,id);q.x=600;const hp=q.hp;p.energy=100;
    assert.ok(cast(game,p,'super'),'super lance');assert.equal(p.energy,0,'charge consommee');
    const s=characters[id].super,delay=s.delay??.7;
    advance(game,Math.max(0,delay-.12));assert.equal(q.hp,hp,'rien avant la fin de l\'alerte');
    advance(game,.12+(s.hits?(s.hits-1)*(s.gap??.18):0)+.05);assert.ok(q.hp<hp,'touche apres le delai');
    assert.equal(game.projectiles.length,0,'rien ne vole');
  });
  test(`${id}: sortir du cercle d'alerte avant l'impact evite le super`,t=>{
    const {game,p,q}=duel(t,id);q.x=600;const hp=q.hp;p.energy=100;cast(game,p,'super');
    q.x=600-(escapeRadius(characters[id].super)+q.r+30); // sort du cercle en reculant vers le lanceur, reste sur le toit
    assert.ok(q.alive);
    advance(game,2);assert.equal(q.hp,hp);
  });
}
test('super cible sans ennemi a portee: frappe devant le lanceur a mi-portee',t=>{
  const {game,p,q}=duel(t,'harris');q.x=p.x+2000;p.energy=100;cast(game,p,'super');
  const z=game.zones.find(z=>z.kind==='strike');assert.ok(z);assert.ok(Math.abs(z.x-(p.x+characters.harris.super.range/2))<1);
});
test('super cible: sans charge d\'energie, pas de super',t=>{
  const {game,p}=duel(t,'schwarzenegger');p.energy=40;assert.equal(cast(game,p,'super'),false);
});
test('super a impacts multiples (pouvoir de test): 3 impacts decales',t=>{
  const {game,p}=duel(t,'harris');p.energy=100;
  p.char={...p.char,super:{type:'zone',target:'enemy',range:600,radius:70,delay:.65,damage:13,knockback:200,hits:3,spread:70,gap:.2,cooldown:6,charge:100,label:'Test Barrage'}};
  cast(game,p,'super');
  const zs=game.zones.filter(z=>z.kind==='strike');assert.equal(zs.length,3);assert.ok(new Set(zs.map(z=>Math.round(z.y))).size===3);
  const q2=game.players.get('b');Object.assign(q2,{x:zs[0].x,y:zs[0].y});const hp=q2.hp;advance(game,1.2);assert.ok(q2.hp<hp,'les impacts touchent');
});
test('chaque super cible laisse le temps d\'esquiver au perso le plus lent (rayon + corps <= vitesse min x delai)', () => {
  const minSpeed=Math.min(...Object.values(characters).map(c=>c.speed));
  for(const [id,c] of Object.entries(characters)){
    const s=c.super;if(!(s.target==='enemy'||s.behavior==='micDrop'||s.behavior==='decree'))continue;
    assert.ok(escapeRadius(s)+18<=minSpeed*s.delay,`${id}: rayon ${s.radius} trop grand pour un delai de ${s.delay}s`);
  }
});

test('VIEW: chaque joueur recoit le combat filtre autour de lui, compact (< 1 Ko), ME inchange', () => {
  const sent=[];const to=(room)=>({emit:(name,data)=>sent.push({room,name,data})});
  const game=new Game({emit:()=>{},to},{characters,arena,autoTick:false, fixedTeams: true});
  try{
    const ids=['a','b','c','d','e','f'];
    ids.forEach((id,i)=>game.join({id},{team:i%2?'B':'A',character:Object.keys(characters)[i],name:'P'+id}));
    game.start();game.countdown=0;
    const P=id=>game.players.get(id);
    Object.assign(P('a'),{x:150,y:320});Object.assign(P('b'),{x:250,y:300});Object.assign(P('c'),{x:700,y:320});
    Object.assign(P('d'),{x:180,y:400});Object.assign(P('e'),{x:650,y:250});Object.assign(P('f'),{x:600,y:380});
    P('d').alive=false;P('d').hp=0;
    game.broadcast();
    const view=sent.find(m=>m.room==='a'&&m.name==='view').data;
    assert.equal(view.me,'a');
    assert.deepEqual(view.players.map(p=>p.id).sort(),['a','b','d','e','f'],'seulement les joueurs a +-540 (c a 550 exclu)');
    const dead=view.players.find(p=>p.id==='d');assert.equal(dead.alive,false);assert.equal(dead.hp,0);
    for(const k of ['score','timeLeft','countdown'])assert.ok(k in view);
    assert.ok(JSON.stringify(view).length<1100,// pire cas 5 joueurs visibles a +-540: ~1.06 Ko accepte
     `VIEW ${JSON.stringify(view).length} octets`);
    assert.ok(sent.some(m=>m.room==='a'&&m.name==='me'),'ME toujours envoye');
    assert.ok(sent.some(m=>m.room==='hosts'&&m.name==='state'),'STATE toujours aux hotes');
  }finally{game.dispose();}
});

test('perso retire du jeu: le joueur est renvoye au choix de perso, sans crash',t=>{
  const chars={...characters};const game=new Game({emit(){}},{characters:chars,arena,autoTick:false, fixedTeams: true});t.after(()=>game.dispose());
  game.join({id:'a'},{team:'A',character:'trump'});game.join({id:'b'},{team:'B',character:'obama'});game.start();game.countdown=0;
  delete chars.obama;assert.deepEqual(game.dropMissingCharacters(),['b']);assert.ok(!game.players.has('b'));
  advance(game,.5);assert.ok(game.players.has('a'));
  const res=game.join({id:'c'},{team:'B',character:'obama'});assert.equal(res.ok,false);assert.equal(res.repick,true);
});
