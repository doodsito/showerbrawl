import { getImage } from './sprites.js';

// Only Musk's authoritative zones/projectiles use this renderer.
export function muskFX(g,project,kx,ky,quiet){
  const rect=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const poly=(points,fill,stroke)=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=1.5;g.stroke();}};
  return {
    flame(z){
      const img=getImage('sprites/musk_attack.png');
      const [x,y]=project(z.x,z.y),reach=Math.max(0,z.reach||0);
      if(reach<4)return;
      const angle=(z.halfAngle??24)*Math.PI/180;
      const envelope=Math.max(0,Math.min(1,z.age/.12,(z.duration-z.age)/.15));
      // Project the world cone, not a screen rectangle: vertical shots must keep
      // their width and every heading must agree with the server's hit area.
      g.save();g.translate(x,y-28);
      g.transform(z.ux*kx,z.uy*ky,-z.uy*kx,z.ux*ky,0,0);
      g.beginPath();g.moveTo(0,0);g.arc(0,0,reach,-angle,angle);g.closePath();g.clip();
      g.globalAlpha=.75+.25*envelope;
      const width=reach*(quiet?1:.97+Math.sin(z.age*65)*.03),height=2*reach*Math.sin(angle)*envelope;
      if(img)g.drawImage(img,0,-height/2,width,height);
      else poly([[0,-3],[width,-height/2],[width,height/2],[0,3]],'#ffaf38');
      if(!quiet)for(let i=0;i<18;i++){
        const t=(z.age*3+i/18)%1;
        rect(6+t*(reach-6),Math.sin(i*2.4+z.age*17)*t*height*.45,4,7,i%2?'#ffeaa0':'#ff8f26');
      }
      g.restore();
    },
    truck(z){
      const img=getImage('sprites/musk_super.png'),[x,y]=project(z.x,z.y),face=z.ux>=0?1:-1;
      g.save();g.translate(x,y);g.scale(face,1);
      g.rotate(Math.atan2(z.uy*ky,Math.max(.001,Math.abs(z.ux*kx)))*face);
      poly([[-46,3],[-29,-9],[52,-9],[72,3],[50,14],[-30,14]],'#14213566');
      if(!quiet)for(let i=0;i<9;i++){
        const t=(z.age*3+i/9)%1;
        rect(-45-t*58,Math.sin(i*2.4)*10,6+t*8,3+t*3,'#ddc39c88');
      }
      g.globalAlpha=Math.min(1,z.age/.22);
      if(img)g.drawImage(img,-108,-75,186,93);
      else poly([[-40,-32],[17,-50],[58,-17],[52,5],[-40,5]],'#a6b3c2','#e7eff2');
      g.restore();
    },
    projectile(p){
      const [x,y]=project(p.x,p.y),gold=p.visual==='muskDoge',r=gold?6:5;
      g.save();g.translate(x,y-12);
      poly(Array.from({length:12},(_,i)=>[Math.cos(i*Math.PI/6)*r,Math.sin(i*Math.PI/6)*r]),gold?'#d5a244':'#879eb2',gold?'#fff0a4':'#e5f3f5');
      if(gold){rect(-2,-3,3,6,'#ffed98');rect(1,-2,2,4,'#ffed98');}else rect(-3,-3,3,3,'#f4ffff');
      g.restore();
    },
    wreck(e){
      const [x,y]=project(e.x,e.y);g.save();g.globalAlpha=Math.max(0,1-e.age/e.duration);
      for(let i=0;i<20;i++){
        const a=i*2.399,r=quiet?24:e.age*(45+i%6*22);
        g.save();g.translate(x+Math.cos(a)*r,y+Math.sin(a)*r*.35-(quiet?0:Math.sin(e.age/e.duration*Math.PI)*32));
        g.rotate(a+(quiet?0:e.age*5));rect(-3,-2,8,4,i%3?'#9db0c2':'#ead295');g.restore();
      }
      g.restore();
    }
  };
}
