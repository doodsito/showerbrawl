// Biden's lab kit. A sleeping player is anchored and cannot cast.
export function castBiden(ctx,p,a) {
  if(a.behavior!=='nap')return false;
  p.napT=a.duration;p.invulnT=Math.max(p.invulnT,a.duration);
  p.kbVx=p.kbVy=p.superKbVx=p.superKbVy=0;p.dashT=0;p.shove=null;
  p.dx=p.dy=0;p.poseT=0;
  return true;
}
