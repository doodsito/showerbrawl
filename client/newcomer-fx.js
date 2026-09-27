import {getImage} from './sprites.js';
import {EXFIL} from '../shared/exfiltration.js';
// Lab animations drawn from authoritative ages and locations, on host and phone.
export function newcomerFX(g,project,kx,ky,reducedMotion){
  const motionOptions={reducedMotion};
  // Lu a chaque acces: l'objet d'effets est cree une fois par contexte, les images peuvent arriver apres.
  const art={get maduro(){return getImage('sprites/maduro.png');},get maduro_plane(){return getImage('sprites/maduro_plane_v1.png');},get xi_hammer(){return getImage('sprites/xi_hammer_v2.png');}};
  const rect=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const poly=(points,color,stroke)=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(Math.round(x),Math.round(y)):g.moveTo(Math.round(x),Math.round(y)));g.closePath();g.fillStyle=color;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke();}};
  const line=(x,y,x2,y2,c,width=1)=>{g.strokeStyle=c;g.lineWidth=width;g.beginPath();g.moveTo(Math.round(x),Math.round(y));g.lineTo(Math.round(x2),Math.round(y2));g.stroke();};
  // Source rectangles and contact anchors are measured from the generated sheet.
  // The wider impact ring uses its full region, rather than leaking into the next pose.
  const hammerFrames=[
    [0,0,512,512,354,470], [512,0,512,512,328,500],
    [1024,0,512,512,300,493], [0,512,586,512,294,423],
    [590,512,434,512,221,433], [1024,512,512,512,265,435],
  ];
  function redHammer(z){
    const after=z.age-z.delay,waiting=after<0;
    const descent=Math.max(0,Math.min(1,(z.age/z.delay-.68)/.32));
    const frame=waiting?(descent>0?1:0):after<.12?2:after<.3?3:after<.5?4:5;
    const [sx,sy,sw,sh,ax,ay]=hammerFrames[frame],size=.39;
    const lift=waiting&&!motionOptions.reducedMotion?60*(1-descent*descent):0;
    g.save();g.translate(z.x,z.y);
    if(waiting){
      g.strokeStyle='#ed4849';g.lineWidth=2;g.globalAlpha=.65;
      g.beginPath();g.ellipse(0,0,z.radius,z.radius*ky/kx,0,0,Math.PI*2);g.stroke();
      g.fillStyle='#ed4849';g.globalAlpha=.1+.1*z.age/z.delay;g.fill();
      g.fillStyle='#111728';g.globalAlpha=.3;g.beginPath();g.ellipse(0,0,30+descent*12,10+descent*5,0,0,Math.PI*2);g.fill();
    }
    g.globalAlpha=waiting?Math.min(1,z.age/.12):Math.min(1,(1.1-after)/.4);
    const k=art.xi_hammer.naturalWidth/1536; // coords de la planche d'origine 1536x1024
    g.drawImage(art.xi_hammer,sx*k,sy*k,sw*k,sh*k,-ax*size,-ay*size-lift,sw*size,sh*size);
    g.restore();
  }
  function summon(z){
    if(z.kind==='xi'&&art.xi_hammer){redHammer(z);return;}
    const waiting=z.age<z.delay,t=waiting?z.age/z.delay:(z.age-z.delay)/1.1;
    g.save();g.translate(z.x,z.y);g.globalAlpha=waiting?.35:1-t;
    const c=z.kind==='xi'?'#ed4849':'#99bd63';g.strokeStyle=c;g.lineWidth=3;
    g.beginPath();g.ellipse(0,0,waiting?z.radius:z.radius*(1+t),waiting?z.radius*ky/kx:z.radius*(1+t)*ky/kx,0,0,Math.PI*2);g.stroke();
    if(waiting){g.fillStyle=c;g.globalAlpha=.15;g.beginPath();g.ellipse(0,0,z.radius*t,z.radius*t*ky/kx,0,0,Math.PI*2);g.fill();}
    else if(z.kind==='xi'){
      // Keep a visible fallback if the image cannot load.
      rect(-5,-85,10,80,'#d2a047');rect(-32,-92,64,42,'#ab2036');rect(-30,-90,60,6,'#ff7775');rect(-33,-55,66,6,'#efc952');
    }else{
      for(let i=0;i<48;i++){const h=i/48,a=i*2.399+(motionOptions.reducedMotion?0:z.age*10),r=10+h*50;g.save();g.translate(Math.cos(a)*r,-h*100+Math.sin(a)*r*.25);g.rotate(a);rect(-6,-3,12,6,i%3?'#8ab276':'#ebc36a');rect(-2,-1,4,2,'#d7e6aa');g.restore();}
    }g.restore();
  }
  function extraction(f){
    const e=f.exfil;if(!e)return;
    const age=e.age,quiet=motionOptions.reducedMotion;
    const lerp=(a,b,t)=>a+(b-a)*Math.max(0,Math.min(1,t));
    const person=(x,y,tilt=0,squash=1)=>{
      if(!art.maduro)return;
      g.save();g.translate(x,y);g.scale(e.face,squash);g.rotate(tilt);
      const width=76*art.maduro.naturalWidth/art.maduro.naturalHeight;
      g.drawImage(art.maduro,-width/2,-76,width,76);g.restore();
    };
    const plane=(x,y)=>{
      g.save();g.translate(x,y);
      if(art.maduro_plane){const k=art.maduro_plane.naturalWidth/1536;g.drawImage(art.maduro_plane,20*k,130*k,1500*k,640*k,-150,-64,300,128);}
      else{poly([[-130,0],[100,-12],[150,0],[90,18],[-110,12]],'#eee0b3','#152439');poly([[-40,5],[0,-55],[40,5]],'#889caf');}
      // Propeller arcs sit over the two engine hubs in the supplied airplane sprite.
      if(!quiet)for(const [x,y] of [[-1,-1],[117,6]]){
        g.strokeStyle='#e8e5c780';g.lineWidth=3;
        const a=age*70;g.beginPath();g.moveTo(x-Math.cos(a)*16,y-Math.sin(a)*25);g.lineTo(x+Math.cos(a)*16,y+Math.sin(a)*25);g.stroke();
      }
      g.restore();
    };
    g.save();
    // Ground marker shows where he will return, even while the body is off-screen.
    if(age>=EXFIL.lift){
      const landing=age>=EXFIL.return;
      g.globalAlpha=landing?.3:.12;g.fillStyle='#102033';g.beginPath();g.ellipse(e.x,e.y,landing?30:18,landing?10:6,0,0,Math.PI*2);g.fill();g.globalAlpha=1;
    }
    if(age<EXFIL.away){
      const lifting=age>=EXFIL.lift,q=Math.max(0,(age-EXFIL.lift)/(EXFIL.away-EXFIL.lift));
      const x=lifting?lerp(e.x-22,1180,q*q):lerp(-230,e.x-22,age/EXFIL.lift);
      const y=e.y-175-q*200,bodyX=lifting?x+22:e.x,bodyY=e.y-q*200;
      if(lifting||age>EXFIL.lift*.8){
        line(x+22,y+44,bodyX,bodyY-55,'#102033',4);line(x+22,y+44,bodyX,bodyY-55,'#d9cba3',2);
        if(lifting){person(bodyX,bodyY,quiet?0:Math.sin(q*18)*.11);g.strokeStyle='#d1b761';g.lineWidth=3;g.strokeRect(bodyX-10,bodyY-60,20,12);}
      }
      plane(x,y);
    }else if(age>=EXFIL.return-.35&&age<EXFIL.return+.45){
      const x=age<EXFIL.return?lerp(-230,e.x-22,(age-(EXFIL.return-.35))/.35):lerp(e.x-22,1180,(age-EXFIL.return)/.45);
      plane(x,e.y-210);
    }
    if(age>=EXFIL.return&&age<EXFIL.land){
      const t=(age-EXFIL.return)/(EXFIL.land-EXFIL.return),y=e.y-155*Math.pow(1-t,1.35),sway=quiet?0:Math.sin(t*Math.PI*2)*8*(1-t);
      const x=e.x+sway,canopyY=y-144;
      for(const dx of [-48,-24,24,48])line(x+dx,canopyY+15,x+dx*.2,y-53,'#e9e0c4',1);
      poly([[-50,16],[-44,-3],[-27,-17],[0,-23],[27,-17],[44,-3],[50,16],[27,10],[0,16],[-27,10]].map(([a,b])=>[x+a,canopyY+b]),'#bd3e4e','#192638');
      poly([[x-15,canopyY-20],[x,canopyY-23],[x+15,canopyY-20],[x+22,canopyY+12],[x,canopyY+16],[x-22,canopyY+12]],'#f0cf75');
      person(x,y,quiet?0:sway*.005);
    }
    if(age>=EXFIL.land){
      const t=(age-EXFIL.land)/(EXFIL.end-EXFIL.land);
      person(e.x,e.y,0,.62+.38*t);
      if(!quiet)for(let i=0;i<10;i++){const a=i*2.399,r=12+t*40;g.globalAlpha=(1-t)*.6;rect(e.x+Math.cos(a)*r,e.y+Math.sin(a)*r*.25,5,3,'#d7d3c2');}g.globalAlpha=1;
    }
    g.restore();
  }
  return {
    summon(z){const [x,y]=project(z.x,z.y);summon({...z,x,y,kind:z.visual==='xiHammer'?'xi':'maduro',radius:z.r*kx});},
    extraction(p){const [x,y]=project(p.x,p.y);extraction({...p,x,y,exfil:{...p.exfil,x,y}});}
  };
}
