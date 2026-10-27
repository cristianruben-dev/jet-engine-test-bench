/* Airflow: streaked particles, inlet suction, internal streams; coloured by the active view */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {state,KV} from '../state.js';
import {clamp,lerp,fIdx,LUT,VIEWS} from './utils.js';

class Flow{
  constructor(n){
    this.n=n;this.P=new Float32Array(n*3);this.Q=new Float32Array(n*3);this.S=new Int16Array(n).fill(-1);this.seg=new Uint16Array(n);this.rho=new Float32Array(n);this.th=new Float32Array(n);this.ze=new Float32Array(n);this.T=new Float32Array(n);this.V=new Float32Array(n);this.Pr=new Float32Array(n).fill(1);this.age=new Float32Array(n);
    const g=new THREE.BufferGeometry();this.pos=new Float32Array(n*6);this.col=new Float32Array(n*6);
    g.setAttribute('position',new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('color',new THREE.BufferAttribute(this.col,3).setUsage(THREE.DynamicDrawUsage));
    this.lines=new THREE.LineSegments(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.8,blending:THREE.AdditiveBlending,depthWrite:false}));this.lines.frustumCulled=false;this.lines.renderOrder=3;
    const g2=new THREE.BufferGeometry();this.hp=new Float32Array(n*3);this.hc=new Float32Array(n*3);
    g2.setAttribute('position',new THREE.BufferAttribute(this.hp,3).setUsage(THREE.DynamicDrawUsage));g2.setAttribute('color',new THREE.BufferAttribute(this.hc,3).setUsage(THREE.DynamicDrawUsage));
    this.points=new THREE.Points(g2,new THREE.PointsMaterial({size:0.022,vertexColors:true,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false}));this.points.frustumCulled=false;this.points.renderOrder=3;
    this.group=new THREE.Group();this.group.add(this.lines,this.points);this.probe={T:0,Pr:1,V:0};
  }
  dispose(){this.lines.geometry.dispose();this.lines.material.dispose();this.points.geometry.dispose();this.points.material.dispose();}
  spawn(i,E,upstream){const b=E.spawn;let x,y,z,k=0;do{x=upstream?b.x0-Math.random()*2.5:b.x0+Math.random()*(b.x1-b.x0);const r=Math.sqrt(Math.random())*b.r,a=Math.random()*Math.PI*2;y=r*Math.cos(a)+(b.yc||0);z=r*Math.sin(a);k++;}while(E.inside(x,y,z)&&k<10);
    const j=i*3;this.P[j]=this.Q[j]=x;this.P[j+1]=this.Q[j+1]=y;this.P[j+2]=this.Q[j+2]=z;this.S[i]=-1;this.T[i]=E.T0;this.V[i]=0;this.Pr[i]=1;this.age[i]=0;}
  reset(E){for(let i=0;i<this.n;i++)this.spawn(i,E,false);}
  write(i,dt,lut,VW){const j=i*3,o=i*6,P=this.P,Q=this.Q;let dx=P[j]-Q[j],dy=P[j+1]-Q[j+1],dz=P[j+2]-Q[j+2];const inv=dt>0?0.22/dt:0;dx*=inv;dy*=inv;dz*=inv;const L=Math.hypot(dx,dy,dz);if(L>0.8){const s=0.8/L;dx*=s;dy*=s;dz*=s;}
    this.pos[o]=P[j];this.pos[o+1]=P[j+1];this.pos[o+2]=P[j+2];this.pos[o+3]=P[j]-dx;this.pos[o+4]=P[j+1]-dy;this.pos[o+5]=P[j+2]-dz;
    const pr=this.probe;pr.T=this.T[i];pr.Pr=this.Pr[i];pr.V=this.V[i];const ci=fIdx(VW.frac(pr));const r=lut[ci],g=lut[ci+1],b=lut[ci+2];const att=this.S[i]<0?clamp(0.28/(L+0.05),0.2,1):1;const br=(this.S[i]<0?0.5:0.9)*att,bp=(this.S[i]<0?0.28:0.9)*att;
    this.col[o]=r*br;this.col[o+1]=g*br;this.col[o+2]=b*br;this.col[o+3]=r*0.05;this.col[o+4]=g*0.05;this.col[o+5]=b*0.05;
    this.hp[j]=P[j];this.hp[j+1]=P[j+1];this.hp[j+2]=P[j+2];this.hc[j]=r*bp;this.hc[j+1]=g*bp;this.hc[j+2]=b*bp;}
  update(dt,E,R,view){
    const VW=VIEWS[view]||VIEWS.mat,lut=LUT[VW.lin];
    const k=KV*state.tscale,V0=R.V0*k,S=E.suction(R)*k,vk=R.vk??1;const P=this.P,Q=this.Q,n=this.n,cap=E.capture;
    E.evalStreams(R);
    for(let i=0;i<n;i++){const j=i*3;let x=P[j],y=P[j+1],z=P[j+2];Q[j]=x;Q[j+1]=y;Q[j+2]=z;
      if(this.S[i]<0){
        let vx=V0,vy=0,vz=0;
        if(S>0){const r=Math.hypot(y,z),a=cap.r;let ty,tz;
          if(x<cap.x){const rr=Math.min(r,a);ty=r>1e-6?rr*y/r:0;tz=r>1e-6?rr*z/r:0;}else{ty=a*y/(r||1e-6);tz=a*z/(r||1e-6);}
          const dx=cap.x-x,dy=ty-y,dz=tz-z;const d2=dx*dx+dy*dy+dz*dz,d=Math.sqrt(d2)+1e-6;const mag=S/(d2+0.25);vx+=dx/d*mag;vy+=dy/d*mag;vz+=dz/d*mag;}
        x+=vx*dt;y+=vy*dt;z+=vz*dt;P[j]=x;P[j+1]=y;P[j+2]=z;this.V[i]=k>0?Math.hypot(vx,vy,vz)/k:0;this.Pr[i]=1;
        if(Q[j]<cap.x&&x>=cap.x){
          if(cap.channel){if(y>cap.yl&&y<cap.yh&&Math.abs(z)<cap.zh){this.S[i]=0;this.seg[i]=0;this.rho[i]=(y-cap.yl)/(cap.yh-cap.yl);this.ze[i]=z/cap.zh;P[j]=cap.x+1e-4;}}
          else{const r=Math.hypot(y,z);if(r<cap.r){const st=E.streams[0];this.S[i]=0;this.seg[i]=0;this.rho[i]=clamp((r-st.A[0])/(st.B[0]-st.A[0]),0,1);this.th[i]=Math.atan2(z,y);P[j]=cap.x+1e-4;}}}
        if(this.S[i]<0){E.deflect(P,i);this.T[i]=R.T0;this.age[i]+=dt;
          if(P[j]>E.spawn.x1||Math.abs(P[j+1])>4.5||Math.abs(P[j+2])>4.5||(this.age[i]>16&&Math.random()<0.03)){this.spawn(i,E,V0>0.15);this.write(i,dt,lut,VW);continue;}}
      }
      if(this.S[i]>=0){
        const st=E.streams[this.S[i]],X=st.X;let g=this.seg[i];x=P[j];while(g<X.length-2&&x>=X[g+1])g++;while(g>0&&x<X[g])g--;this.seg[i]=g;
        const f=clamp((x-X[g])/(X[g+1]-X[g]),0,1);const a=lerp(st.A[g],st.A[g+1],f),b=lerp(st.B[g],st.B[g+1],f),v=lerp(st.V[g],st.V[g+1],f)*vk;this.T[i]=lerp(st.TT[g],st.TT[g+1],f);this.V[i]=Math.abs(v);this.Pr[i]=E.pressureAt(st,x,R);
        x+=v*k*dt;
        if(st.kind==='annular'){const r=a+this.rho[i]*(b-a);this.th[i]+=E.swirl(x)*dt;y=r*Math.cos(this.th[i]);z=r*Math.sin(this.th[i]);}
        else{y=a+this.rho[i]*(b-a);z=this.ze[i]*lerp(st.C[g],st.C[g+1],f);}
        P[j]=x;P[j+1]=y;P[j+2]=z;
        if(x>=X[X.length-1]){if(st.next)st.next(i,this,E);else{this.spawn(i,E,true);}}
        else if(x<X[0]-0.3){this.spawn(i,E,true);}
      }
      this.write(i,dt,lut,VW);
    }
    this.lines.geometry.attributes.position.needsUpdate=true;this.lines.geometry.attributes.color.needsUpdate=true;
    this.points.geometry.attributes.position.needsUpdate=true;this.points.geometry.attributes.color.needsUpdate=true;
  }
}

export {Flow};
