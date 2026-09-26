import {wallCorners} from '../shared/wall-geometry.js';

// Effects ported from the lab; every location and warning radius comes from the server.
const OCTAGON = [[275,338],[685,338],[825,390],[853,438],[735,502],[225,502],[107,438],[135,390]];
export function combatFX(g, project, kx, ky, reducedMotion) {
  const motionOptions={reducedMotion};
  const rect=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const poly=(points,color,stroke)=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(Math.round(x),Math.round(y)):g.moveTo(Math.round(x),Math.round(y)));g.closePath();g.fillStyle=color;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke();}};
  const line=(x,y,x2,y2,c,width=1)=>{g.strokeStyle=c;g.lineWidth=width;g.beginPath();g.moveTo(Math.round(x),Math.round(y));g.lineTo(Math.round(x2),Math.round(y2));g.stroke();};
  const label=(text,x,y,size,color,align='center')=>{g.fillStyle=color;g.font=`900 ${size}px monospace`;g.textAlign=align;g.fillText(text,Math.round(x),Math.round(y));};
  function wall(obstacle) {
    const floor=wallCorners(obstacle).map(p=>project(p.x,p.y));
    const h=52*(reducedMotion?1:Math.min(1,obstacle.age/.24)), top=floor.map(([x,y])=>[x,y-h]);
    g.save();g.globalAlpha=obstacle.ttl<1?.65+obstacle.ttl*.35:1;
    poly(floor.map(([x,y])=>[x+10,y+4]),'#10203155');
    for(let i=0;i<4;i++){
      const j=(i+1)%4,a=floor[i],b=floor[j];
      if(b[0]>=a[0])continue;
      const face=[top[i],top[j],b,a];poly(face,'#657489','#29384c');
      g.save();g.beginPath();face.forEach(([x,y],n)=>n?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();
      g.transform((b[0]-a[0])/80,(b[1]-a[1])/80,0,1,a[0],a[1]-h);
      for(let row=0;row<6;row++)for(let col=-1;col<5;col++)rect(col*20+(row%2?10:0)+1,row*10+1,18,8,['#788697','#67768a','#8793a1'][(row+col+6)%3]);
      if(i%2===1 && obstacle.age>.18){g.save();g.translate(80,0);g.scale(-1,1);label('MAGA',40,32,16,'#ea7467');g.restore();}
      if(obstacle.hp<36){line(48,0,38,20,'#273245',2);line(38,20,47,38,'#273245',2);}
      if(obstacle.hp<=12)line(15,20,27,50,'#273245',3);
      g.restore();
    }
    poly(top,'#abb4bf','#465569');
    const [x]=project(obstacle.x,obstacle.y), y=Math.min(...top.map(p=>p[1]))-8;
    rect(x-20,y,40,4,'#172331');rect(x-19,y+1,38*obstacle.hp/36,2,obstacle.team==='A'?'#70a6ed':'#fa6970');g.restore();
  }
  function impact(e,foreground=false){
    const age=e.age,quiet=motionOptions.reducedMotion;
    const fade=Math.min(1,(e.duration-e.age)/.4),x=e.x,y=e.y;
    g.save();g.globalAlpha=fade;
    if(!foreground){
      // A flattened shockwave and radial cracks anchor the blow to the floor.
      const radius=quiet?76:25+Math.min(1,age/.48)*145;
      const ring=Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return [x+Math.cos(a)*radius,y+Math.sin(a)*radius*.32];});
      poly(ring,'#f4cc7822','#e9ce91');
      for(let i=0;i<9;i++){
        const a=i*Math.PI/4.5,len=35+(i%3)*14,dx=Math.cos(a),dy=Math.sin(a)*.38;
        line(x+dx*12,y+dy*12,x+dx*len,y+dy*len,'#394356',3);
        line(x+dx*len,y+dy*len,x+dx*(len+13)-dy*12,y+dy*(len+13)+dx*3,'#394356',2);
      }
    }else{
      // A brief, narrow contact flare follows the body hitting the fence.
      if(!quiet&&age<.14){
        g.globalAlpha=(1-age/.14)*.8;
        poly([[x-9,y-75],[x+7,y-63],[x+12,y-24],[x+5,y+2],[x-8,y-13]],'#fff0cb');
      }
      // Tension ripples spread along the wire mesh and decay after the collision.
      if(!quiet&&age<.42){
        const power=(1-age/.42)*7;
        g.globalAlpha=(1-age/.42)*.6;
        for(let j=0;j<5;j++){
          const yy=y-55+j*12,offset=Math.sin(age*65+j)*power;
          line(x-24,yy-8,x+offset,yy,'#d2dbe0',1);
          line(x+offset,yy,x+25,yy+8,'#d2dbe0',1);
        }
      }
      // Dust rolls back into the arena, followed by chunks of masonry.
      g.globalAlpha=fade*.65;
      for(let i=0;i<11;i++){
        const travel=quiet?20:age*(35+i*9),xx=x-(e.ux || 1)*(10+travel),yy=y-8+Math.sin(i*2.3)*13;
        const size=12+(i%4)*5+(quiet?0:age*8);
        const lift=quiet?0:Math.sin(Math.min(1,age)*Math.PI)*8;
        poly([[xx-size*.5,yy-lift],[xx-size*.5,yy-size*.28-lift],[xx-size*.25,yy-size*.28-lift],[xx-size*.25,yy-size*.5-lift],[xx+size*.25,yy-size*.5-lift],[xx+size*.25,yy-size*.28-lift],[xx+size*.5,yy-size*.28-lift],[xx+size*.5,yy-lift]],['#c2b9a5','#ead7b0','#8e99a4'][i%3]);
      }
      g.globalAlpha=fade;
      if(!quiet)for(let i=0;i<22;i++){
        const a=i*2.399,speed=35+i%6*20,xx=x+Math.cos(a)*speed*age-(e.ux || 1)*age*24;
        const yy=y-30+Math.sin(a)*speed*age*.7-90*age+110*age*age;
        if(i%3===0&&age<.3)line(xx,yy,xx-Math.cos(a)*12,yy-Math.sin(a)*8,'#ffe4a6',2);
        g.save();g.translate(xx,yy);g.rotate(age*(i%2?8:-6));rect(-2,-2,3+i%4,3+i%3,['#ffdfa0','#d08a55','#758595'][i%3]);g.restore();
      }

    }
    g.restore();
  }
  function micDrop(drop,foreground=false){
    const falling=drop.age<drop.delay,t=Math.min(1,drop.age/drop.delay),x=drop.x,y=drop.y;
    const age=Math.max(0,drop.age-drop.delay),quiet=motionOptions.reducedMotion;
    const radius=drop.r*kx,fade=falling?1:Math.max(0,1-age/(drop.duration-drop.delay));
    g.save();
    if(!foreground){
      // Keep the warning radius honest; the shockwaves are cosmetic after contact.
      g.beginPath();OCTAGON.forEach(([xx,yy],i)=>i?g.lineTo(xx,yy):g.moveTo(xx,yy));g.closePath();g.clip();
      const ring=(r,color,fill='#00000000')=>poly(Array.from({length:32},(_,i)=>[x+Math.cos(i*Math.PI/16)*r,y+Math.sin(i*Math.PI/16)*r*ky/kx]),fill,color);
      if(falling){
        g.globalAlpha=.6;ring(radius,'#eac780','#f7bd6815');
        if(!quiet){g.globalAlpha=.25+.4*t;ring(radius*(1-t),'#8ddcff');}
        line(x-12,y,x+12,y,'#e8d3a5',2);line(x,y-7,x,y+7,'#e8d3a5',2);
      }else{
        g.globalAlpha=fade;
        poly([[x-26,y-8],[x-12,y-15],[x+24,y-12],[x+34,y+3],[x+12,y+13],[x-23,y+10]],'#293d5366','#708594');
        for(let i=0;i<12;i++){
          const a=i*Math.PI/6,len=45+i%3*17,dx=Math.cos(a),dy=Math.sin(a)/1.5;
          line(x+dx*17,y+dy*17,x+dx*len,y+dy*len,'#354958',3);
          line(x+dx*len,y+dy*len,x+dx*(len+16)-dy*10,y+dy*(len+16),'#607783',2);
        }
        for(let i=0;i<3;i++){
          const phase=quiet?.6:Math.max(0,age-i*.12)/.48;
          if(phase<=0||phase>1.3)continue;
          g.globalAlpha=fade*Math.max(0,1-phase/1.3);
          ring(radius*Math.min(1.65,phase*1.65),i%2?'#f1d7a0':'#9ee6ff');
          ring(radius*Math.min(1.65,phase*1.65)+5,'#a5c2db55');
        }
      }
    }else{
      if(!falling){
        const kick=quiet?0:Math.max(0,1-age/.2);
        if(kick){g.globalAlpha=kick*.65;poly([[x-17,y-14],[x-30,y-70],[x-9,y-50],[x,y-102],[x+12,y-46],[x+34,y-66],[x+18,y-7]],'#b8eeff');}
        g.globalAlpha=fade*.7;
        for(let i=0;i<16;i++){
          const a=i*2.399,travel=quiet?34:20+age*(55+i%4*28),xx=x+Math.cos(a)*travel,yy=y+Math.sin(a)*travel*.4;
          const size=12+i%4*5+(quiet?0:age*9);
          poly([[xx-size,yy],[xx-size,yy-size*.4],[xx-size*.5,yy-size*.4],[xx-size*.5,yy-size*.7],[xx+size*.4,yy-size*.7],[xx+size*.4,yy-size*.4],[xx+size,yy-size*.4],[xx+size,yy]],i%2?'#a5b9c6':'#d1d1bb');
        }
        if(!quiet)for(let i=0;i<32;i++){
          const a=i*2.399,speed=70+i%5*27,xx=x+Math.cos(a)*speed*age,yy=y+Math.sin(a)*speed*age*.5-135*age+140*age*age;
          g.globalAlpha=fade;g.save();g.translate(xx,yy);g.rotate(age*(i%2?8:-6));rect(-2,-2,4+i%4,3+i%3,i%3?'#90adbe':'#e6d6a9');g.restore();
        }
      }
      g.globalAlpha=fade;
      const plunge=Math.max(0,(t-.3)/.7);
      const lift=quiet?(falling?50:0):falling?215*(1-plunge**3):Math.sin(Math.min(1,age/.36)*Math.PI)*30;
      // The enlarged microphone hangs briefly, then accelerates into the floor.
      if(falling&&!quiet&&t>.5){
        g.save();g.globalAlpha=(t-.5)*.7;
        for(let i=0;i<6;i++)rect(x-12+i*5,y-lift-44-i%2*15,2,28+i*6,i%2?'#f1c6aa':'#8bd9ff');
        g.restore();
      }
      g.translate(x,y-14-lift);g.rotate(quiet?.2:falling?-.35+t*.5:Math.sin(Math.min(1,age/.36)*Math.PI)*.8+Math.min(1,age/.45)*1.25);
      g.scale(2.15,2.15);
      rect(-3,-2,6,22,'#142339');rect(-1,-1,2,18,'#8ba4b9');rect(-2,15,4,3,'#b4d9e6');
      poly([[-7,-12],[7,-12],[9,-8],[9,-2],[5,2],[-5,2],[-9,-2],[-9,-8]],'#d3e5ec','#425970');
      for(let i=0;i<3;i++)line(-6,-9+i*3,6,-9+i*3,'#526e86');
      line(-4,-11,-4,-3,'#f1fbff',2);
    }
    g.restore();
  }
  function decree(drop,foreground=false){
    const quiet=motionOptions.reducedMotion,falling=drop.age<drop.delay;
    const t=Math.min(1,drop.age/drop.delay),age=Math.max(0,drop.age-drop.delay),fade=falling?1:Math.max(0,1-age/1.1),x=drop.x,y=drop.y;
    g.save();g.globalAlpha=fade;
    if(!foreground){
      g.beginPath();OCTAGON.forEach(([xx,yy],i)=>i?g.lineTo(xx,yy):g.moveTo(xx,yy));g.closePath();g.clip();
      const radius=falling?(drop.r*kx):(drop.r*kx)+(quiet?55:age*220);
      for(let k=0;k<3;k++){
        const r=falling?radius-k*3:radius+k*8;
        poly(Array.from({length:24},(_,i)=>[x+Math.cos(i*Math.PI/12)*r,y+Math.sin(i*Math.PI/12)*r*ky/kx]),falling?'#e4c27408':'#e4c27412',['#589afa','#f3ead4','#f16b70'][k]);
      }
      if(!falling){
        for(let i=0;i<10;i++){const a=i*Math.PI/5;line(x+Math.cos(a)*20,y+Math.sin(a)*8,x+Math.cos(a)*75,y+Math.sin(a)*27,'#3b4353',2);}
      }
    }else{
      if(!falling&&!quiet)for(let i=0;i<30;i++){
        const a=i*2.399,xx=x+Math.cos(a)*age*(65+i%5*30),yy=y+Math.sin(a)*age*45-100*age+100*age*age;
        g.save();g.translate(xx,yy);g.rotate(a+age*5);rect(-3,-2,7,4,['#6497e4','#ede6ce','#d96363','#d6b569'][i%4]);g.restore();
      }
      const plunge=Math.max(0,(t-.25)/.75),lift=quiet?(falling?50:0):falling?155*(1-plunge**3):Math.sin(Math.min(1,age/.3)*Math.PI)*15;
      g.translate(x,y-lift);g.rotate(quiet?0:falling?-.18*(1-t):Math.sin(age*13)*.06*fade);
      // A real stamp falls and rebounds. Lettering stays in the ability card.
      poly([[-39,-12],[30,-12],[42,-3],[34,9],[-35,9],[-43,-1]],'#96703a','#423425');
      rect(-36,-12,72,13,'#d5ad61');rect(-32,-10,64,3,'#f8dc92');rect(-25,-18,50,7,'#9f7437');
      rect(-11,-55,22,37,'#263d67');rect(-7,-54,6,33,'#5876a0');rect(-15,-59,30,10,'#d1a252');
      poly([[-18,-76],[-10,-84],[11,-84],[19,-76],[16,-61],[-16,-61]],'#b28442','#473520');rect(-10,-80,9,16,'#e2bd74');
      rect(-24,-5,16,8,'#477ac4');rect(-8,-5,16,8,'#eee5cc');rect(8,-5,16,8,'#c85157');
    }
    g.restore();
  }
  function baguette(shot){
    const a=Math.atan2(shot.dy,shot.dx),x=shot.x,y=shot.y-38;
    g.save();g.translate(x,y);g.rotate(a);
    if(!motionOptions.reducedMotion){line(-34,-3,-19,-3,'#f7d69688',2);line(-40,3,-22,3,'#f7d69655',2);}
    poly([[-22,-3],[-18,-7],[17,-7],[24,-2],[24,3],[18,7],[-17,7],[-22,3]],'#d89a4d','#774523');
    rect(-16,-5,31,3,'#f3cc80');for(let i=0;i<4;i++)line(-12+i*8,-3,-7+i*8,3,'#ffe9af',2);
    g.restore();
  }
  return {wall,
    decree(drop,front=false){const [x,y]=project(drop.x,drop.y);decree({...drop,x,y},front);},
    projectile(shot){
      if(shot.visual!=='baguette'&&shot.visual!=='decree')return false;
      const [x,y]=project(shot.x,shot.y);
      if(shot.visual==='baguette'){baguette({...shot,x,y,dx:shot.vx*kx,dy:shot.vy*ky});return true;}
      g.save();g.translate(x,y-20);g.rotate(Math.atan2(shot.vy*ky,shot.vx*kx));
      line(-30,0,-8,0,'#d9b97788',5);poly([[-9,-9],[7,-9],[13,0],[7,9],[-9,9],[-14,0]],'#e5bd73','#744d29');
      rect(-7,-5,5,10,'#4781d4');rect(-2,-5,5,10,'#f5e9c8');rect(3,-5,5,10,'#d15c62');g.restore();return true;
    },
    micDrop(drop,front=false){const [x,y]=project(drop.x,drop.y);micDrop({...drop,x,y},front);},
    effect(e,front=false){const [x,y]=project(e.x,e.y);
      if(e.kind==='impact'){impact({...e,x,y},front);return;}
      if(!front)return;
      g.save();g.globalAlpha=Math.max(0,1-e.age/e.duration);
      if(e.kind==='fired') {label('YOU’RE FIRED!',x,y-92,10,'#f1e4c8');}
      else for(let i=0;i<(e.kind==='rubble'?18:8);i++){
        const angle=i*2.399,spread=8+e.age*70;
        rect(x+Math.cos(angle)*spread,y+(e.kind==='spark'?-32:0)+Math.sin(angle)*spread*.4-Math.sin(e.age/e.duration*Math.PI)*18,3+i%3,3,i%2?'#e6d6ae':'#93b0c4');
      }
      g.restore();
    }
  };
}
