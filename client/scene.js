import { getSprite, getImage } from './sprites.js';
import { combatFX } from './combat-fx.js';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const poses = new Map();

const TEAM_COL = { A: '#3b82f6', B: '#ef4444' };
import { createDecor, DECOR_W, DECOR_H } from './decor.js';

let decor = null;
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
  const drop=(state?.zones||[]).find(z=>z.kind==='micDrop'&&z.age>=z.delay&&z.age-z.delay<.38);
  if(!reducedMotion.matches&&(impact||drop)){
    const age=drop?drop.age-drop.delay:impact.age,force=(1-age/.38)*(drop?9:6);
    ctx.translate(Math.sin(age*97)*force,Math.cos(age*79)*force*.55);
  }
  ctx.drawImage(decor.background, 0, 0);
  decor.animate(ctx, time);

  if (state) {
    for (const id of poses.keys()) if(!state.players.some(p=>p.id===id))poses.delete(id);
    for(const e of state.effects||[])fx.effect(e);
    for (const z of state.zones || []) {
      if(z.kind==='micDrop'){fx.micDrop(z);continue;}
      const [x, y] = worldToScreen(z.x, z.y, b);
      ctx.globalAlpha = 0.28; ctx.fillStyle = TEAM_COL[z.team] || '#fff';
      ctx.beginPath(); ctx.ellipse(x, y, z.r * kx, z.r * ky, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.8; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const items = [];
    for(const w of state.walls||[])items.push({k:'wall',o:w,s:project(w.x,w.y+Math.abs(w.ux)*w.depth/2)});
    for (const p of state.projectiles || []) items.push({ k: 'p', o: p, s: worldToScreen(p.x, p.y, b) });
    for (const p of state.players || []) items.push({ k: 'j', o: p, s: worldToScreen(p.x, p.y, b) });
    items.sort((a, c) => a.s[1] - c.s[1]);
    for (const it of items) {
      const [x, y] = it.s;
      if(it.k==='wall'){fx.wall(it.o);continue;}
      if (it.k === 'p') {
        const img=it.o.visual==='energy'&&getImage('sprites/obama_attack.png');
        if(img){ctx.save();ctx.translate(x,y-36);ctx.rotate(Math.atan2(it.o.vy*ky,it.o.vx*kx));ctx.drawImage(img,-28,-14,48,28);ctx.restore();continue;}
        ctx.fillStyle = TEAM_COL[it.o.team] || '#fff';
        ctx.beginPath(); ctx.arc(x, y - 14, Math.max(3, (it.o.r || 6) * 0.6), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      } else drawPlayer(ctx, { ...it.o, x, y }, characters, time);
    }
  }
  if(state)for(const z of state.zones||[])if(z.kind==='micDrop')fx.micDrop(z,true);
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

function drawPlayer(ctx, p, characters, time) {
  const R=15, col=TEAM_COL[p.team]||'#fff', quiet=reducedMotion.matches;
  const img=getImage(characters?.[p.character]?.sprite||p.character);
  const full=img&&(p.character==='trump'||p.character==='obama'), h=full?76:51;
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
  if(p.shield||p.protected){ctx.fillStyle=p.shield?'#facc1538':'#ffffff28';ctx.beginPath();ctx.ellipse(p.x,p.y-h/2,27,h/2+6,0,0,Math.PI*2);ctx.fill();}
  if(img){
    const w=h*(img.naturalWidth/img.naturalHeight);
    if(!quiet&&(p.dash||p.launch||p.shove)){
      const direction=p.dash?Math.sign(p.dash.x):(p.launch?.ux||p.shove?.ux||1);
      for(let i=1;i<5;i++){ctx.save();ctx.globalAlpha=.24/i;ctx.translate(p.x-direction*i*12,p.y-lift);ctx.scale(face,1);ctx.drawImage(img,-w/2,-h,w,h);ctx.restore();}
    }
    ctx.save();ctx.translate(p.x+offset,p.y-lift);ctx.rotate(angle);ctx.scale(face*sx,sy);if(p.flash)ctx.globalAlpha=.75;
    ctx.drawImage(img,-w/2,-h,w,h);ctx.restore();
  }else{const spr=getSprite(p.character);if(spr)ctx.drawImage(spr,p.x-R,p.y-R*2,R*2,R*2);}
  const hp=Math.max(0,Math.min(1,p.hp/p.maxHp));
  ctx.fillStyle='#000a';ctx.fillRect(p.x-20,top-9,40,4);ctx.fillStyle=hp>.5?'#22c55e':hp>.25?'#facc15':'#ef4444';ctx.fillRect(p.x-20,top-9,40*hp,4);
  if(characters?.[p.character]?.super?.charge){ctx.fillStyle='#26314c';ctx.fillRect(p.x-20,top-3,40,2);ctx.fillStyle='#edcb80';ctx.fillRect(p.x-20,top-3,40*(p.energy||0)/100,2);}
  ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle='#000';ctx.fillText(p.name||'',p.x+1,p.y+7);ctx.fillStyle='#fff';ctx.fillText(p.name||'',p.x,p.y+6);
  if(p.alive===false&&p.respawnIn>0){ctx.globalAlpha=1;ctx.font='bold 14px monospace';ctx.fillText(String(Math.ceil(p.respawnIn)),p.x,p.y-30);}
  ctx.restore();
}
