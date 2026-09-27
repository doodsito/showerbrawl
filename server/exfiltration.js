import {EXFIL} from '../shared/exfiltration.js';
export function castExfiltration(ctx,p){
  p.exfil={age:0,face:p.fx>=0?1:-1};
  p.kbVx=0;p.kbVy=0;p.superKbVx=0;p.superKbVy=0;p.dashT=0;
  p.dx=0;p.dy=0;
  return true;
}
export function advanceExfiltration(p,dt){
  if(p.exfil){p.exfil.age+=dt;if(p.exfil.age>=EXFIL.end)p.exfil=null;}
}
