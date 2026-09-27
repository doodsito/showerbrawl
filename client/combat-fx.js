import {getImage} from './sprites.js';
import {wallCorners} from '../shared/wall-geometry.js';

// Effects ported from the lab; every location and warning radius comes from the server.
const OCTAGON = [[275,338],[685,338],[825,390],[853,438],[735,502],[225,502],[107,438],[135,390]];
export function combatFX(g, project, kx, ky, reducedMotion) {
  const motionOptions={reducedMotion};
  for(const name of ['mic_object_v1','stamp_object_v1','trump_defense','obama_attack'])getImage(`sprites/${name}.png`);
  const rect=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const poly=(points,color,stroke)=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(Math.round(x),Math.round(y)):g.moveTo(Math.round(x),Math.round(y)));g.closePath();g.fillStyle=color;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke();}};
  const line=(x,y,x2,y2,c,width=1)=>{g.strokeStyle=c;g.lineWidth=width;g.beginPath();g.moveTo(Math.round(x),Math.round(y));g.lineTo(Math.round(x2),Math.round(y2));g.stroke();};
  const label=(text,x,y,size,color,align='center')=>{g.fillStyle=color;g.font=`900 ${size}px monospace`;g.textAlign=align;g.fillText(text,Math.round(x),Math.round(y));};
  // Couleurs du mur selon l'equipe du lanceur (plus de dalle grise neutre).
  const WALL_COLORS={A:{face:'#2c5a9e',edge:'#10233f',top:'#7fb0f0',bricks:['#3a6fbf','#2f62ad','#4a80d0']},
    B:{face:'#9e2f2c',edge:'#3f1010',top:'#f09a8f',bricks:['#bf423a','#ad342f','#d05a4f']}};
  function wall(obstacle) {
    const WC=WALL_COLORS[obstacle.team]||WALL_COLORS.A;
    const floor=wallCorners(obstacle).map(p=>project(p.x,p.y));
    const h=30*(reducedMotion?1:Math.min(1,obstacle.age/.24)), top=floor.map(([x,y])=>[x,y-h]);
    g.save();g.globalAlpha=obstacle.ttl<1?.65+obstacle.ttl*.35:1;
    poly(floor.map(([x,y])=>[x+10,y+4]),'#10203155');
    for(let i=0;i<4;i++){
      const j=(i+1)%4,a=floor[i],b=floor[j];
      if(b[0]>=a[0])continue;
      const face=[top[i],top[j],b,a];poly(face,WC.face,WC.edge);
      g.save();g.beginPath();face.forEach(([x,y],n)=>n?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();
      g.transform((b[0]-a[0])/80,(b[1]-a[1])/80,0,1,a[0],a[1]-h);
      for(let row=0;row<6;row++)for(let col=-1;col<5;col++)rect(col*20+(row%2?10:0)+1,row*10+1,18,8,WC.bricks[(row+col+6)%3]);
      if(i%2===1){
        const texture=getImage('sprites/trump_defense.png');
        g.save();g.translate(80,0);g.scale(-1,1);
        if(texture){
          const sx=texture.naturalWidth/1536,sy=texture.naturalHeight/1024;
          g.drawImage(texture,340*sx,290*sy,985*sx,460*sy,0,0,80,30);
          g.fillStyle=WC.face+'55';g.fillRect(0,0,80,30);
        }else if(obstacle.age>.18)label('MAGA',40,20,12,'#fff4d8');
        g.restore();
      }
      if(obstacle.hp<36){line(48,0,38,20,'#273245',2);line(38,20,47,38,'#273245',2);}
      if(obstacle.hp<=12)line(15,20,27,50,'#273245',3);
      g.restore();
    }
    poly(top,WC.top,WC.edge);
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
    const radius=(drop.r*kx),fade=falling?1:Math.max(0,1-age/(drop.duration-drop.delay));
    const objectArt=getImage('sprites/mic_object_v1.png');
    g.save();
    if(!foreground){
      // Keep the warning radius honest; the shockwaves are cosmetic after contact.
      g.beginPath();OCTAGON.forEach(([xx,yy],i)=>i?g.lineTo(xx,yy):g.moveTo(xx,yy));g.closePath();g.clip();
      const ring=(r,color,fill='#00000000')=>poly(Array.from({length:32},(_,i)=>[x+Math.cos(i*Math.PI/16)*r,y+Math.sin(i*Math.PI/16)*r*ky/kx]),fill,color);
      if(falling){
        g.globalAlpha=.6;ring(radius,'#eac780','#f7bd6815');
        if(!quiet){g.globalAlpha=.25+.4*t;ring(radius*(1-t),'#8ddcff');}
        line(x-12,y,x+12,y,'#e8d3a5',2);line(x,y-7,x,y+7,'#e8d3a5',2);
        const shadow=10+24*t*t;g.globalAlpha=.15+.3*t;
        poly(Array.from({length:12},(_,i)=>[x+Math.cos(i*Math.PI/6)*shadow,y+Math.sin(i*Math.PI/6)*shadow*.35]),'#172534');
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
      // Head-first contact, then a physical bounce onto its side. The lowest point stays on the floor.
      const tilt=quiet?(falling?-Math.PI:-1.45):falling?-2.2-t*.9416:-Math.PI+Math.min(1,age/.42)*1.69;
      const support=Math.abs(Math.cos(tilt))*48+Math.abs(Math.sin(tilt))*20;
      g.translate(x,y-lift-support);g.rotate(tilt);
      if(objectArt){
        g.drawImage(objectArt,-20,-48,40,96); // image deja recadree (220x528, 2x la taille max affichee)
      }else{
        rect(-7,-4,14,50,'#142339');rect(-3,-1,4,42,'#8ba4b9');
        poly([[-14,-43],[14,-43],[19,-31],[19,-12],[10,-3],[-10,-3],[-19,-12],[-19,-31]],'#d3e5ec','#425970');
        for(let i=0;i<6;i++)line(-12,-37+i*5,12,-37+i*5,'#526e86');
      }
    }
    g.restore();
  }
  function decree(drop,foreground=false){
    const quiet=motionOptions.reducedMotion,falling=drop.age<drop.delay;
    const t=Math.min(1,drop.age/drop.delay),age=Math.max(0,drop.age-drop.delay),fade=falling?1:Math.max(0,1-age/Math.max(.01,drop.duration-drop.delay)),x=drop.x,y=drop.y;
    const objectArt=getImage('sprites/stamp_object_v1.png');
    g.save();g.globalAlpha=fade;
    if(!foreground){
      g.beginPath();OCTAGON.forEach(([xx,yy],i)=>i?g.lineTo(xx,yy):g.moveTo(xx,yy));g.closePath();g.clip();
      const radius=falling?(drop.r*kx):(drop.r*kx)+(quiet?55:age*220);
      for(let k=0;k<3;k++){
        const r=falling?radius-k*3:radius+k*8;
        poly(Array.from({length:24},(_,i)=>[x+Math.cos(i*Math.PI/12)*r,y+Math.sin(i*Math.PI/12)*r*ky/kx]),falling?'#e4c27408':'#e4c27412',['#589afa','#f3ead4','#f16b70'][k]);
      }
      if(falling){
        const shadow=16+24*t*t;g.globalAlpha=.15+.3*t;
        poly(Array.from({length:12},(_,i)=>[x+Math.cos(i*Math.PI/6)*shadow,y+Math.sin(i*Math.PI/6)*shadow*.4]),'#172534');
      }else{
        // A seal is left in the floor, with no floating text or title card.
        g.globalAlpha=fade*.65;
        poly([[x-36,y-9],[x,y-17],[x+36,y-9],[x+36,y+8],[x,y+15],[x-36,y+8]],'#67432944','#d7b264');
        for(let k=0;k<3;k++)poly([[x-21+k*14,y-5],[x-7+k*14,y-5],[x-7+k*14,y+5],[x-21+k*14,y+5]],['#5c8dc5','#e2d9ba','#c36563'][k]);
        for(let i=0;i<10;i++){const a=i*Math.PI/5;line(x+Math.cos(a)*20,y+Math.sin(a)*8,x+Math.cos(a)*75,y+Math.sin(a)*27,'#3b4353',2);}
      }
    }else{
      if(!falling&&!quiet)for(let i=0;i<30;i++){
        const a=i*2.399,xx=x+Math.cos(a)*age*(65+i%5*30),yy=y+Math.sin(a)*age*45-100*age+100*age*age;
        g.save();g.translate(xx,yy);g.rotate(a+age*(i%2?5:-4));
        if(i%3===0){
          // Papers from the team's illustration fan out as separate pieces.
          g.scale(Math.max(.25,Math.abs(Math.cos(age*8+i))),1);
          rect(-5,-7,10,14,'#534838');rect(-4,-6,8,12,'#f4e7c5');
          rect(-3,-5,2,3,'#527fc3');rect(1,-5,2,3,'#c85b5a');
          line(-2,0,2,0,'#9b8665');line(-2,3,1,3,'#9b8665');
        }else rect(-3,-2,7,4,['#6497e4','#ede6ce','#d96363','#d6b569'][i%4]);
        g.restore();
      }
      const plunge=Math.max(0,(t-.25)/.75),lift=quiet?(falling?50:0):falling?155*(1-plunge**3):Math.sin(Math.min(1,age/.3)*Math.PI)*15;
      g.translate(x,y-lift);g.rotate(quiet?0:falling?-.18*(1-t):Math.sin(age*13)*.06*fade);
      // Compress briefly at contact, keeping the base on the contact point.
      const press=quiet||falling?0:Math.max(0,1-age/.12);
      g.scale(1+press*.1,1-press*.12);
      if(objectArt){
        g.drawImage(objectArt,-44,-132,88,136); // image deja recadree (484x748, 2x la taille max affichee)
      }else{
        poly([[-39,-12],[30,-12],[42,-3],[34,9],[-35,9],[-43,-1]],'#96703a','#423425');
        rect(-36,-12,72,13,'#d5ad61');rect(-32,-10,64,3,'#f8dc92');rect(-25,-18,50,7,'#9f7437');
        rect(-11,-55,22,37,'#263d67');rect(-7,-54,6,33,'#5876a0');rect(-15,-59,30,10,'#d1a252');
        poly([[-18,-76],[-10,-84],[11,-84],[19,-76],[16,-61],[-16,-61]],'#b28442','#473520');
        rect(-24,-5,16,8,'#477ac4');rect(-8,-5,16,8,'#eee5cc');rect(8,-5,16,8,'#c85157');
      }
    }
    g.restore();
  }
  function energyBurst(e){
    const t=e.age/e.duration,quiet=motionOptions.reducedMotion;
    const power=e.hit?1:.45,spread=(8+t*36)*power;
    g.save();g.translate(e.x,e.y);g.rotate(Math.atan2(e.dy,e.dx));
    g.globalAlpha=(1-t)*(e.blocked?.65:1);
    if(quiet){
      poly([[-6,0],[0,-12],[6,0],[0,12]],'#b6e8ff');
    }else{
      g.lineWidth=2;
      poly(Array.from({length:12},(_,i)=>[Math.cos(i*Math.PI/6)*spread*.5,Math.sin(i*Math.PI/6)*spread]),'#b7edff18',e.blocked?'#b7d2e6':'#8dd9ff');
      for(let i=0;i<14;i++){
        const a=i*2.399,r=spread*(.7+i%3*.3),xx=Math.cos(a)*r,yy=Math.sin(a)*r;
        line(xx,yy,xx+Math.cos(a)*(5+8*(1-t)),yy+Math.sin(a)*(5+8*(1-t)),['#71cfff','#fff3d5','#f77578'][i%3],i%3?2:3);
      }
      if(e.hit&&t<.28){
        g.globalAlpha=(1-t/.28)*.8;
        poly([[-5,0],[-9,-12],[0,-7],[4,-22],[7,-7],[16,-11],[8,0],[15,12],[5,7],[0,21],[-3,7],[-12,10]],'#e9faff');
      }
    }
    g.restore();
  }
  // Coup au contact: poing qui claque, flash et etincelles au point d'impact. 'whiff' = coup dans le vide.
  function strike(e){
    const t=Math.min(1,e.age/e.duration),miss=e.kind==='whiff',y=e.y-26,x=e.x;
    const ux=e.ux??1,uy=(e.uy??0)*ky/kx,big=e.heavy?1.5:1;
    g.save();g.globalAlpha=1-t;
    if(!miss){
      g.fillStyle='#fff8d8';g.beginPath();g.arc(x,y,(10+t*16)*big,0,Math.PI*2);g.fill();
      for(let i=0;i<8;i++){const a=i*Math.PI/4+.2,d=(8+t*30)*big;rect(x+Math.cos(a)*d-2,y+Math.sin(a)*d*.8-2,4,4,i%2?'#ffd35a':'#ffffff');}
      g.translate(x-ux*(6-t*6),y-uy*(6-t*6));g.rotate(Math.atan2(uy,ux));
      rect(-8*big,-6*big,14*big,12*big,'#2b1b12');rect(-6*big,-5*big,11*big,10*big,'#e9b184');rect(3*big,-5*big,3*big,10*big,'#c98a60');
      label(e.heavy?'POW!':'WHAM!',0,-16*big,e.heavy?13:10,'#fff4c8');
    }else{
      g.strokeStyle='#ffffffaa';g.lineWidth=3;g.beginPath();const a=Math.atan2(uy,ux);g.arc(x-ux*10,y-uy*10,22,a-1,a+1);g.stroke();
    }
    g.restore();
  }
  // Onde de choc AU SOL centree sur le lanceur: anneaux ecrases en perspective, fissures, poussiere.
  function shockwave(e,front){
    const t=Math.min(1,e.age/e.duration),R=e.r*kx*(.25+.75*t),col=e.team==='B'?'#f16b70':'#589afa';
    g.save();g.globalAlpha=1-t;
    if(!front){
      for(let k=0;k<3;k++){const r=Math.max(2,R-k*10);g.strokeStyle=k===0?col:'#f3ead4';g.lineWidth=k===0?5:2;g.beginPath();g.ellipse(e.x,e.y,r,r*ky/kx,0,0,Math.PI*2);g.stroke();}
      g.fillStyle=col+'22';g.beginPath();g.ellipse(e.x,e.y,R,R*ky/kx,0,0,Math.PI*2);g.fill();
      for(let i=0;i<10;i++){const a=i*Math.PI/5+.3;line(e.x+Math.cos(a)*R*.3,e.y+Math.sin(a)*R*.3*ky/kx,e.x+Math.cos(a)*R*.8,e.y+Math.sin(a)*R*.8*ky/kx,'#3b4353',2);}
    }else if(!motionOptions.reducedMotion){
      for(let i=0;i<14;i++){const a=i*2.399,d=R*(.6+(i%3)*.15);rect(e.x+Math.cos(a)*d,e.y+Math.sin(a)*d*ky/kx-10-t*18,4,4,i%2?'#d9cfb4':'#9aa4ad');}
    }
    g.restore();
  }
  function baguette(shot){
    const a=Math.atan2(shot.dy,shot.dx),x=shot.x,y=shot.y-(shot.height??38);
    g.save();g.translate(x,y);g.rotate(a);
    if(!motionOptions.reducedMotion){line(-34,-3,-19,-3,'#f7d69688',2);line(-40,3,-22,3,'#f7d69655',2);}
    poly([[-22,-3],[-18,-7],[17,-7],[24,-2],[24,3],[18,7],[-17,7],[-22,3]],'#d89a4d','#774523');
    rect(-16,-5,31,3,'#f3cc80');for(let i=0;i<4;i++)line(-12+i*8,-3,-7+i*8,3,'#ffe9af',2);
    g.restore();
  }
  return {wall,
    decree(drop,front=false){const [x,y]=project(drop.x,drop.y);decree({...drop,x,y},front);},
    projectile(shot){
      if(shot.visual==='maduroOil'||shot.visual==='xiStar'){
        const [x,y]=project(shot.x,shot.y),star=shot.visual==='xiStar',img=getImage(star?'sprites/xi_attack.png':'sprites/maduro_attack.png');
        g.save();g.translate(x,y-34);g.rotate(Math.atan2(shot.vy*ky,shot.vx*kx));
        if(img)g.drawImage(img,-45,-18,60,36);else poly([[-14,-8],[12,-8],[18,0],[12,8],[-14,8]],star?'#e44040':'#695938','#f5c359');
        g.restore();return true;
      }
      if(shot.visual==='icecream'){
        const [x,y]=project(shot.x,shot.y),img=getImage('sprites/biden_icecream.svg');
        g.save();g.translate(x,y-34);g.rotate(Math.atan2(shot.vy*ky,shot.vx*kx)+Math.PI/2);
        if(img)g.drawImage(img,-14,-22,28,40);else{poly([[-9,0],[9,0],[0,20]],'#d4a05d');rect(-10,-15,20,15,'#ffe6de');}
        g.restore();return true;
      }
      if(shot.visual==='energy'){
        const [x,y]=project(shot.x,shot.y),art=getImage('sprites/obama_attack.png');
        g.save();g.translate(x,y-36);g.rotate(Math.atan2(shot.vy*ky,shot.vx*kx));
        line(-46,0,-9,0,'#328adb88',12);line(-33,0,-6,0,'#90e5ff',5);
        // The luminous core also remains visible while the PNG loads.
        poly([[-16,0],[-5,-10],[12,-7],[19,0],[12,7],[-5,10]],'#c4f4ff','#318fe0');
        if(art)g.drawImage(art,-28,-16,52,32);
        rect(4,-3,9,6,'#ffffff');g.restore();return true;
      }
      if(shot.visual!=='baguette'&&shot.visual!=='decree')return false;
      const [x,y]=project(shot.x,shot.y);
      if(shot.visual==='baguette'){baguette({...shot,x,y,dx:shot.vx*kx,dy:shot.vy*ky});return true;}
      g.save();g.translate(x,y-20);g.rotate(Math.atan2(shot.vy*ky,shot.vx*kx));
      line(-30,0,-8,0,'#d9b97788',5);poly([[-9,-9],[7,-9],[13,0],[7,9],[-9,9],[-14,0]],'#e5bd73','#744d29');
      rect(-7,-5,5,10,'#4781d4');rect(-2,-5,5,10,'#f5e9c8');rect(3,-5,5,10,'#d15c62');g.restore();return true;
    },
    micDrop(drop,front=false){const [x,y]=project(drop.x,drop.y);micDrop({...drop,x,y},front);},
    // Super cible a distance: alerte au sol couleur d'equipe qui se remplit pendant le delai, puis eclair d'impact.
    strikeZone(z){
      const [x,y]=project(z.x,z.y),rx=z.r*kx,ry=z.r*ky,col=z.team==='B'?'#e0413a':'#2f7de1',light=z.team==='B'?'#f87171':'#60a5fa';
      g.save();
      if(z.age<z.delay){
        const t=Math.max(0,z.age/z.delay),blink=t>.75&&!motionOptions.reducedMotion&&Math.floor(z.age*16)%2;
        g.globalAlpha=.22;g.fillStyle=col;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();
        g.globalAlpha=.5;g.fillStyle=blink?'#ffffff':light;g.beginPath();g.ellipse(x,y,rx*t,ry*t,0,0,Math.PI*2);g.fill();
        g.globalAlpha=1;g.strokeStyle=blink?'#ffffff':col;g.lineWidth=3;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.stroke();
        g.strokeStyle='#030812';g.lineWidth=1;g.beginPath();g.ellipse(x,y,rx+2,ry+1,0,0,Math.PI*2);g.stroke();
        // viseur
        line(x-rx*.35,y,x-rx*.12,y,'#ffffff',2);line(x+rx*.12,y,x+rx*.35,y,'#ffffff',2);
        line(x,y-ry*.35,x,y-ry*.12,'#ffffff',2);line(x,y+ry*.12,x,y+ry*.35,'#ffffff',2);
      }else{
        const t=Math.min(1,(z.age-z.delay)/.4);
        g.globalAlpha=1-t;g.fillStyle='#fff6d8';g.beginPath();g.ellipse(x,y,rx*(.6+t*.5),ry*(.6+t*.5),0,0,Math.PI*2);g.fill();
        g.strokeStyle=light;g.lineWidth=4;g.beginPath();g.ellipse(x,y,rx*(1+t*.3),ry*(1+t*.3),0,0,Math.PI*2);g.stroke();
      }
      g.restore();
    },
    effect(e,front=false){const [x,y]=project(e.x,e.y);
      if(e.visual==='maduroOil'||e.visual==='xiStar'){
        if(front){g.save();g.globalAlpha=Math.max(0,1-e.age/e.duration);for(let i=0;i<12;i++){const a=i*2.399,r=6+e.age*55;rect(x+Math.cos(a)*r,y-25+Math.sin(a)*r*.5,3,3,e.visual==='xiStar'?(i%2?'#ed5148':'#eac56a'):'#645b44');}g.restore();}return;
      }
      if(e.visual==='icecream'||e.kind==='bikeWreck'){
        if(front){g.save();g.globalAlpha=Math.max(0,1-e.age/e.duration);for(let i=0;i<12;i++){const a=i*2.399,r=8+e.age*70;rect(x+Math.cos(a)*r,y-15+Math.sin(a)*r*.4,4,4,e.kind==='bikeWreck'?'#e5bd62':i%2?'#ffe4d9':'#efb3c4');}g.restore();}return;
      }
      if((e.kind==='strike'||e.kind==='whiff')&&e.visual==='baguette'){
        if(front){
          const t=Math.min(1,e.age/e.duration),hit=e.kind==='strike',ux=e.ux??1,uy=e.uy??0;
          g.save();g.globalAlpha=(1-t)*(hit?1:.65);
          for(let i=-1;i<=1;i++){
            const a=Math.atan2(uy*ky,ux*kx)+i*.24,swing=reducedMotion?0:Math.sin(t*Math.PI)*9;
            baguette({x:x+Math.cos(a)*swing,y:y+i*5,dx:Math.cos(a),dy:Math.sin(a)});
          }
          if(hit)for(let i=0;i<9;i++){const a=i*2.399,d=9+t*35;rect(x+Math.cos(a)*d,y-32+Math.sin(a)*d*.55,3,3,i%2?'#f4d58c':'#bd8444');}
          g.restore();
        }return;
      }
      // Musk: coup standard (BASE_ATTACK) affiche comme une flamme courte, du lanceur au point d'impact (visuel seul).
      if((e.kind==='strike'||e.kind==='whiff')&&e.visual==='flame'){if(front){
        const img=getImage('sprites/musk_attack.png'),t=Math.min(1,e.age/e.duration),dx=(e.ux??1)*kx,dy=(e.uy||0)*ky,len=Math.hypot(dx,dy)||1;
        const reach=85*len; // portee standard en pixels decor
        g.save();g.globalAlpha=Math.max(0,1-t)*(e.kind==='strike'?1:.6);g.translate(x,y-28);g.rotate(Math.atan2(dy,dx));
        const w=reach*(.75+.25*Math.min(1,e.age/.08)),h=Math.max(14,reach*.32);
        if(img)g.drawImage(img,-w*.55,-h/2,w,h);else poly([[-w*.55,-3],[w*.45,-h/2],[w*.45,h/2],[-w*.55,3]],'#ffaf38');
        if(e.kind==='strike'&&!motionOptions.reducedMotion)for(let i=0;i<8;i++){const a=i*2.399,d=6+t*22;rect(w*.4+Math.cos(a)*d,Math.sin(a)*d*.6,3,3,i%2?'#ffeaa0':'#ff8f26');}
        g.restore();
      }return;}
      if((e.kind==='strike'||e.kind==='whiff')&&e.visual==='energy'){if(front){
        const art=getImage('sprites/obama_attack.png');
        if(art&&e.age<.2){g.save();g.globalAlpha=1-e.age/.2;g.translate(x,y-32);g.rotate(Math.atan2((e.uy||0)*ky,(e.ux??1)*kx));g.drawImage(art,-45,-18,54,36);g.restore();}
        energyBurst({...e,x,y:y-32,dx:(e.ux??1)*kx,dy:(e.uy||0)*ky,hit:e.kind==='strike'});
      }return;}
      if(e.kind==='impact'){impact({...e,x,y},front);return;}
      if(e.kind==='shockwave'){shockwave({...e,x,y},front);return;}
      if(e.kind==='strike'||e.kind==='whiff'){if(front)strike({...e,x,y});return;}
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
