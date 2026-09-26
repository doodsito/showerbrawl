import { getSprite, getImage } from './sprites.js';
import { combatFX } from './combat-fx.js';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const poses = new Map();

const TEAM_COL = { A: '#3b82f6', B: '#ef4444' };
import { createDecor, DECOR_W, DECOR_H } from './decor.js';

let decor = null;
// Effets ponctuels venus du serveur (cast, hit, block), affiches avec le meme retard que l'interpolation.
const FX_DELAY = 100;
let fx = [];
const hitUntil = new Map();
const trails = new Map();
export function pushEvents(events) {
  const t0 = performance.now() + FX_DELAY;
  for (const e of events || []) if(!e.lab) fx.push({ ...e, t0 });
  if (fx.length > 200) fx = fx.slice(-200);
}
const SLOT_COL = { attack: '#fde047', defense: '#7dd3fc', super: '#f0abfc' };

let bounds = null, boundsKey = null;

// Boite englobante des cases jouables '.' de arena.json (coords monde).
function worldBounds(arena) {
  const key = arena.grid.join('|') + arena.cellSize;
  if (key === boundsKey) return bounds;
  const cs = arena.cellSize || 64;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  arena.grid.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== '.') return;
    x0 = Math.min(x0, c * cs); y0 = Math.min(y0, r * cs); x1 = Math.max(x1, (c + 1) * cs); y1 = Math.max(y1, (r + 1) * cs);
  }));
  if (!Number.isFinite(x0)) { x0 = 0; y0 = 0; x1 = arena.grid[0].length * cs; y1 = arena.grid.length * cs; }
  boundsKey = key;
  return (bounds = { x0, y0, x1, y1 });
}

// Zone de l'octogone d'Ilan ou tombent les joueurs, centree sur [480,422].
const OCT = { cx: 480, cy: 422, hw: 330, hh: 70 };

// Coords monde (arena.json) -> coords ecran du decor 960x540.
export function worldToScreen(x, y, b) {
  const nx = ((x - b.x0) / (b.x1 - b.x0)) * 2 - 1, ny = ((y - b.y0) / (b.y1 - b.y0)) * 2 - 1;
  return [OCT.cx + nx * OCT.hw, OCT.cy + ny * OCT.hh];
}

export function render(ctx, W, H, arena, state, characters) {
  ctx.fillStyle = '#0a0f24'; ctx.fillRect(0, 0, W, H);
  if (!arena || !arena.grid) return;
  if (!decor) decor = createDecor();
  const b = worldBounds(arena);
  const kx = (OCT.hw * 2) / (b.x1 - b.x0), ky = (OCT.hh * 2) / (b.y1 - b.y0);
  const time = performance.now() / 1000;

  const scale = Math.min(W / DECOR_W, H / DECOR_H);
  ctx.save();
  ctx.translate((W - DECOR_W * scale) / 2, (H - DECOR_H * scale) / 2);
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;
  const project=(x,y)=>worldToScreen(x,y,b);
  const fx=combatFX(ctx,project,kx,ky,reducedMotion.matches);
  const impact=(state?.effects||[]).find(e=>e.kind==='impact'&&e.age<.38);
  const drop=(state?.zones||[]).find(z=>(z.kind==='micDrop'||z.kind==='decree')&&z.age>=z.delay&&z.age-z.delay<.38);
  if(!reducedMotion.matches&&(impact||drop)){
    const age=drop?drop.age-drop.delay:impact.age,force=(1-age/.38)*(drop?9:6);
    ctx.translate(Math.sin(age*97)*force,Math.cos(age*79)*force*.55);
  }
  ctx.drawImage(decor.background, 0, 0);
  decor.animate(ctx, time);

  if (state) {
    const now=performance.now();
    for (const id of poses.keys()) if(!state.players.some(p=>p.id===id))poses.delete(id);
    for(const e of state.effects||[])fx.effect(e);
    for (const z of state.zones || []) {
      if(z.kind==='micDrop'){fx.micDrop(z);continue;}
      if(z.kind==='decree'){fx.decree(z);continue;}
      const [x, y] = worldToScreen(z.x, z.y, b);
      const rx = z.r * kx, ry = z.r * ky, pulse = 0.5 + 0.5 * Math.sin(now / 90);
      const col = TEAM_COL[z.team] || '#fff';
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.14 * pulse; ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([10, 6]); ctx.lineDashOffset = -now / 25;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 0.6 * pulse; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y, rx * (0.4 + 0.5 * ((now / 600) % 1)), ry * (0.4 + 0.5 * ((now / 600) % 1)), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    const items = [];
    for(const w of state.walls||[])items.push({k:'wall',o:w,s:project(w.x,w.y+Math.abs(w.ux)*w.depth/2)});
    // Combat corps a corps: plus aucun projectile volant a dessiner.
    for (const p of state.players || []) items.push({ k: 'j', o: p, s: worldToScreen(p.x, p.y, b) });
    items.sort((a, c) => a.s[1] - c.s[1]);
    for (const it of items) {
      const [x, y] = it.s;
      if(it.k==='wall'){fx.wall(it.o);continue;}
      if (it.k === 'p') {
        if(fx.projectile(it.o))continue;
        const img=it.o.visual==='energy'&&getImage('sprites/obama_attack.png');
        if(img){ctx.save();ctx.translate(x,y-36);ctx.rotate(Math.atan2(it.o.vy*ky,it.o.vx*kx));ctx.drawImage(img,-28,-14,48,28);ctx.restore();continue;}
        drawProjectile(ctx,it.o,x,y-18,kx,ky);
      } else drawPlayer(ctx, { ...it.o, x, y }, characters, time);
    }
  }
  if(state)for(const z of state.zones||[])if(z.kind==='micDrop')fx.micDrop(z,true);
  if(state)for(const z of state.zones||[])if(z.kind==='decree')fx.decree(z,true);
  if(state)drawFx(ctx,state,b);
  decor.foreground(ctx);
  if(state)for(const e of state.effects||[])fx.effect(e,true);
  ctx.restore();
  // HUD
  if (state) {
    const s = state.score || { A: 0, B: 0 };
    const tl = Math.max(0, Math.ceil(state.timeLeft || 0));
    const mm = String(Math.floor(tl / 60)).padStart(2, '0'), ss = String(tl % 60).padStart(2, '0');
    ctx.font = 'bold 36px system-ui'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0008'; ctx.fillRect(W / 2 - 260, 8, 520, 46);
    ctx.textAlign = 'right'; ctx.fillStyle = TEAM_COL.A; ctx.fillText(`Bleus ${s.A}`, W / 2 - 90, 31);
    ctx.textAlign = 'left'; ctx.fillStyle = TEAM_COL.B; ctx.fillText(`${s.B} Rouges`, W / 2 + 90, 31);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(`${mm}:${ss}`, W / 2, 31);
  }
}

function drawProjectile(ctx, o, x, y, kx, ky) {
  const col = TEAM_COL[o.team] || '#fff';
  const r = Math.max(4, (o.r || 8) * 0.7);
  const tx = -(o.vx || 0) * kx * 0.06, ty = -(o.vy || 0) * ky * 0.06;
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x + tx, y + ty);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = g; ctx.lineWidth = r * 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + tx, y + ty); ctx.stroke();
  ctx.shadowColor = col; ctx.shadowBlur = 12;
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFx(ctx, state, b) {
  const now = performance.now();
  const pos = new Map((state.players || []).map((p) => [p.id, p]));
  fx = fx.filter((e) => now - e.t0 < 900);
  for (const e of fx) {
    const age = now - e.t0; if (age < 0) continue;
    const pl = pos.get(e.id);
    const [x, y] = worldToScreen(pl ? pl.x : e.x, pl ? pl.y : e.y, b);
    const k = age / 900;
    ctx.save();
    if (e.k === 'hit') {
      if (age < 30) hitUntil.set(e.id, now + 140);
      // etincelles + degats flottants
      if (age < 300) { ctx.fillStyle = '#fff5c0'; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, d = 8 + age * 0.08; ctx.fillRect(x + Math.cos(a) * d - 2, y - 26 + Math.sin(a) * d * 0.6 - 2, 4, 4); } }
      ctx.globalAlpha = 1 - k; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText('-' + Math.max(1, Math.round(e.amount)), x + 1, y - 58 - age * 0.04 + 1);
      ctx.fillStyle = '#ff5555'; ctx.fillText('-' + Math.max(1, Math.round(e.amount)), x, y - 58 - age * 0.04);
    } else if (e.k === 'block') {
      ctx.globalAlpha = 1 - k; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#7dd3fc'; ctx.fillText('BLOQUE', x, y - 60 - age * 0.03);
    } else if (e.k === 'cast') {
      // nom du pouvoir au-dessus du lanceur
      ctx.globalAlpha = Math.min(1, 2 - 2 * k); ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#000c'; const w = ctx.measureText(e.label).width + 10; ctx.fillRect(x - w / 2, y - 104 - age * 0.02, w, 16);
      ctx.fillStyle = SLOT_COL[e.slot] || '#fff'; ctx.fillText(e.label, x, y - 92 - age * 0.02);
      // onde de choc pour burst et zone
      if ((e.type === 'burst' || e.type === 'zone') && age < 500) {
        ctx.globalAlpha = 1 - age / 500; ctx.strokeStyle = TEAM_COL[e.team] || '#fff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(x, y, 10 + age * 0.25, (10 + age * 0.25) * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (e.type === 'dash' && age < 250) {
        ctx.globalAlpha = 1 - age / 250; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x - 30, y - 20 + i * 6); ctx.lineTo(x - 10, y - 20 + i * 6); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
}

function drawPlayer(ctx, p, characters, time) {
  const R=15, col=TEAM_COL[p.team]||'#fff', quiet=reducedMotion.matches;
  const img=getImage(characters?.[p.character]?.sprite||p.character,p.character);
  const full=img&&(p.character==='trump'||p.character==='obama'||p.character==='macron'), h=full?76:51;
  let pose=poses.get(p.id);
  if(!pose){pose={x:p.x,y:p.y,t:time,phase:0,walk:0};poses.set(p.id,pose);}
  const dt=Math.min(.1,Math.max(0,time-pose.t)),distance=Math.hypot(p.x-pose.x,(p.y-pose.y)*3);
  const walking=p.moving&&!p.launch&&!p.shove&&!p.dash&&p.alive;
  pose.walk+=(Number(walking&&distance>.01)-pose.walk)*(1-Math.exp(-22*dt));
  if(walking)pose.phase+=Math.min(20,distance)/64*Math.PI*2;
  Object.assign(pose,{x:p.x,y:p.y,t:time});
  const face=p.fx>=0?1:-1, attack=(p.pose||0)/(p.action==='super'?.4:.2);
  let lift=quiet?0:Math.abs(Math.sin(pose.phase))*pose.walk*2.4,angle=quiet?0:Math.sin(pose.phase)*pose.walk*.035+face*attack*.11;
  let sx=1, sy=quiet?1:1+Math.sin(time*3)*.007*(1-pose.walk),offset=quiet?0:face*attack*8;
  if(!quiet&&p.launch){lift+=Math.sin(p.launch.progress*Math.PI)*35;angle=-p.launch.ux*.38;}
  if(!quiet&&p.shove){lift+=Math.sin(p.shove.progress*Math.PI)*8;angle=-p.shove.ux*.27;}
  if(!quiet&&p.dash){lift+=Math.sin(Math.min(1,1-p.dash.remaining/.28)*Math.PI)*14;angle=Math.sign(p.dash.x)*.22;}
  if(!quiet&&p.recoil>0){const t=1-p.recoil/.42,bounce=Math.sin(t*Math.PI);offset-=face*bounce*14;lift+=bounce*9;sx=1-Math.max(0,1-t/.22)*.3;sy=1+Math.max(0,1-t/.22)*.13;}
  const top=p.y-(img?h:30)-lift;
  ctx.save();ctx.globalAlpha=p.alive===false?.3:1;
  ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(p.x,p.y,18,5,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,20,6,0,0,Math.PI*2);ctx.stroke();
  if(p.shield||p.protected){
    const pulse=quiet?1:1+.06*Math.sin(time*12.5);
    ctx.save();ctx.fillStyle=p.shield?(p.character==='macron'?'#75cfff22':'#facc1548'):'#ffffff28';ctx.strokeStyle=p.shield?(p.character==='macron'?'#8edbff':'#facc15'):'#ffffff66';ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(p.x,p.y-h/2,29*pulse,(h/2+7)*pulse,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
  }
  if(img){
    const w=h*(img.naturalWidth/img.naturalHeight);
    if(!quiet&&(p.dash||p.launch||p.shove)){
      const direction=p.dash?Math.sign(p.dash.x):(p.launch?.ux||p.shove?.ux||1);
      for(let i=1;i<5;i++){ctx.save();ctx.globalAlpha=.24/i;ctx.translate(p.x-direction*i*12,p.y-lift);ctx.scale(face,1);ctx.drawImage(img,-w/2,-h,w,h);ctx.restore();}
    }
    ctx.save();ctx.translate(p.x+offset,p.y-lift);ctx.rotate(angle);ctx.scale(face*sx,sy);if(p.flash)ctx.globalAlpha=.75;
    ctx.drawImage(img,-w/2,-h,w,h);
    if(p.character==='macron'&&p.shield){
      ctx.fillStyle='#091321';ctx.fillRect(-10,-h+11,9,6);ctx.fillRect(2,-h+11,9,6);
      ctx.fillStyle='#d4b579';ctx.fillRect(-2,-h+12,5,2);
      ctx.fillStyle='#b4d9eb';ctx.fillRect(-8,-h+12,4,1);ctx.fillRect(4,-h+12,4,1);
    }
    ctx.restore();
  }else{const spr=getSprite(p.character);if(spr)ctx.drawImage(spr,p.x-R,p.y-R*2,R*2,R*2);}
  const hp=Math.max(0,Math.min(1,p.hp/p.maxHp));
  ctx.fillStyle='#000a';ctx.fillRect(p.x-20,top-9,40,4);ctx.fillStyle=hp>.5?'#22c55e':hp>.25?'#facc15':'#ef4444';ctx.fillRect(p.x-20,top-9,40*hp,4);
  if(characters?.[p.character]?.super?.charge){ctx.fillStyle='#26314c';ctx.fillRect(p.x-20,top-3,40,2);ctx.fillStyle='#edcb80';ctx.fillRect(p.x-20,top-3,40*(p.energy||0)/100,2);}
  // Nom une seule fois, au-dessus de la barre de vie (plus sous les pieds, ou il semblait detache du perso).
  ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillStyle='#000';ctx.fillText(p.name||'',p.x+1,top-11);ctx.fillStyle='#fff';ctx.fillText(p.name||'',p.x,top-12);ctx.textBaseline='top';
  if(p.alive===false&&p.respawnIn>0){ctx.globalAlpha=1;ctx.font='bold 14px monospace';ctx.fillText(String(Math.ceil(p.respawnIn)),p.x,p.y-30);}
  ctx.restore();
}
