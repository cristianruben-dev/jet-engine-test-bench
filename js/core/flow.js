/* Airflow: soft screen-space streaks drawn in a single instanced call. Outside the engine the air is
   the free stream plus the sink of the captured mass flow (a source when the inlet spills or the
   compressor surges), steered around the bodies and entrained by the jet; inside it follows the
   programmed streams with rotor swirl, flame flicker and shear-layer mixing in the free jet.
   Coloured by the active view. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {state,KV} from '../state.js';
import {clamp,lerp,smooth,DEG,fIdx,LUT,VIEWS} from './utils.js';
import {profileAt} from './geometry.js';

const TAU=0.28;                                   /* a streak is TAU seconds of travel */
const LMAX=1.0;                                   /* longest streak (scene units) */
const SECTOR={quarter:[-25,100],half:[-15,195]};  /* open sector of each cutaway, degrees about +X */

/* each streak is a quad from the tail to the head, extended one half-width beyond the head for the
   round cap; the quad is built in screen space so the width is constant in pixels */
const VS=`
attribute vec3 aHead,aTail,aColor;attribute vec2 aMisc,corner;
uniform vec2 uRes;uniform float uWidth;
varying vec3 vCol;varying vec2 vUv;varying float vLen,vAlpha;
void main(){
  vec4 h=projectionMatrix*modelViewMatrix*vec4(aHead,1.0);
  vec4 t=projectionMatrix*modelViewMatrix*vec4(aTail,1.0);
  vCol=aColor;vAlpha=aMisc.y;vUv=corner;vLen=0.0;
  if(h.w<0.08||t.w<0.08){gl_Position=vec4(0.0,0.0,2.0,1.0);return;}
  vec2 hp=h.xy/h.w*uRes*0.5,tp=t.xy/t.w*uRes*0.5;
  vec2 d=hp-tp;float L=length(d);
  vec2 dir=L>1e-3?d/L:vec2(1.0,0.0);vec2 nrm=vec2(-dir.y,dir.x);
  float w=uWidth*aMisc.x;
  vec2 p=mix(tp,hp,corner.y)+nrm*corner.x*mix(w*0.3,w,corner.y)+dir*corner.y*w;
  gl_Position=vec4(p/(uRes*0.5)*h.w,h.z,h.w);
  vLen=L/w;
}`;
const FS=`
uniform float uOpacity;
varying vec3 vCol;varying vec2 vUv;varying float vLen,vAlpha;
void main(){
  float s=vUv.x,u=max(vUv.y,0.0)*(vLen+1.0);
  float a;
  if(u<vLen){a=(1.0-s*s)*pow(clamp(u/max(vLen,0.001),0.0,1.0),1.4)*0.8;}
  else{float dx=u-vLen;a=clamp(1.0-(dx*dx+s*s),0.0,1.0);a=a*(0.55+0.45*a);}
  a=clamp(a*vAlpha*uOpacity,0.0,1.0);
  if(!(a>0.003))discard;   /* also drops NaN, which the bloom blur would spread over the frame */
  gl_FragColor=vec4(vCol*a,a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const gauss=()=>(Math.random()+Math.random()+Math.random()-1.5)*1.41;
const reflect=v=>v<0?-v:(v>1?2-v:v);
/* linear interpolation of a per-station array of a stream at x */
function sample(st,arr,x){const X=st.X;if(x<=X[0])return arr[0];for(let g=0;g<X.length-1;g++)if(x<=X[g+1])return lerp(arr[g],arr[g+1],(x-X[g])/(X[g+1]-X[g]));return arr[X.length-1];}

/* air around a body of revolution: near the surface the radial velocity follows the slope of the
   profile, read a little ahead so the streamlines open before the nose and close behind the tail.
   Behind the nozzle the free jet continues the body: the outside air rides along its shear layer. */
function bodyR(E,jet,x){const r=profileAt(E.rBody,x);return (jet&&x>=jet.jet)?Math.max(r,sample(jet,jet.B,x)):r;}
function steerAnnular(E,jet,x,y,z,v,cap){
  const la=v[0]>=0?0.22:-0.22;
  const rb0=bodyR(E,jet,x),rb1=bodyR(E,jet,x+la);
  if(rb0<0&&rb1<0)return;
  const r=Math.hypot(y,z);
  if(rb0<0&&!E.solidNose&&r<cap.r)return;      /* on its way into the hollow inlet */
  const rb=Math.max(rb0,rb1),gap=r-rb,d=E.steerD;
  if(gap>d||gap<-0.03)return;
  const w=1-Math.max(gap,0)/d,ww=w*w;
  const slope=(rb0>=0&&rb1>=0)?clamp((rb1-rb0)/la,-1.2,1.2):(rb1>=0?1.4:-1.0)*Math.sign(la);
  const ny=r>1e-6?y/r:1,nz=r>1e-6?z/r:0;
  const vr=v[1]*ny+v[2]*nz;
  let dvr=(v[0]*slope-vr)*ww;
  if(gap<0.05)dvr+=(0.05-gap)*6;
  v[1]+=dvr*ny;v[2]+=dvr*nz;
}

class Flow{
  constructor(n){
    this.n=n;this.P=new Float32Array(n*3);this.Q=new Float32Array(n*3);this.S=new Int16Array(n).fill(-1);this.seg=new Uint16Array(n);
    this.rho=new Float32Array(n);this.th=new Float32Array(n);this.ze=new Float32Array(n);this.T=new Float32Array(n);this.V=new Float32Array(n);this.Pr=new Float32Array(n).fill(1);this.age=new Float32Array(n);this.far=new Uint8Array(n);
    this.wr=new Float32Array(n);this.wt=new Float32Array(n);   /* eddy drift across and around a stream */
    this.head=new Float32Array(n*3);this.tail=new Float32Array(n*3);this.col=new Float32Array(n*3);this.misc=new Float32Array(n*2);
    const g=new THREE.InstancedBufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0],3));
    g.setAttribute('corner',new THREE.Float32BufferAttribute([-1,0,1,0,-1,1,1,1],2));
    g.setIndex([0,1,2,2,1,3]);
    this.aHead=new THREE.InstancedBufferAttribute(this.head,3).setUsage(THREE.DynamicDrawUsage);
    this.aTail=new THREE.InstancedBufferAttribute(this.tail,3).setUsage(THREE.DynamicDrawUsage);
    this.aCol=new THREE.InstancedBufferAttribute(this.col,3).setUsage(THREE.DynamicDrawUsage);
    this.aMisc=new THREE.InstancedBufferAttribute(this.misc,2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aHead',this.aHead);g.setAttribute('aTail',this.aTail);g.setAttribute('aColor',this.aCol);g.setAttribute('aMisc',this.aMisc);g.instanceCount=n;
    this.mat=new THREE.ShaderMaterial({vertexShader:VS,fragmentShader:FS,uniforms:{uRes:{value:new THREE.Vector2(1,1)},uWidth:{value:1.3},uOpacity:{value:1}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.NormalBlending,premultipliedAlpha:true});
    this.mesh=new THREE.Mesh(g,this.mat);this.mesh.frustumCulled=false;this.mesh.renderOrder=3;
    this.group=new THREE.Group();this.group.add(this.mesh);this.probe={T:0,Pr:1,V:0};this.v=[0,0,0];
  }
  dispose(){this.mesh.geometry.dispose();this.mat.dispose();}
  /* drawing-buffer size and pixel ratio: the streak width is 2.6 css px at the head */
  setViewport(w,h,dpr){this.mat.uniforms.uRes.value.set(w,h);this.mat.uniforms.uWidth.value=1.3*dpr;}
  /* new particle: dense around the capture radius, a thin far field beyond; with a cutaway most of
     them start in the open sector so the internal flow can be seen */
  spawn(i,E,upstream){
    const b=E.spawn,cap=E.capture;const a=cap.channel?cap.zh*1.5:cap.r,rIn=a*1.15,rFar=Math.max(rIn+0.4,Math.min(b.r,a*2.6+0.4));
    const sec=SECTOR[state.cut];let x,y,z,far=false,k=0;
    /* moving air starts upstream of the box; still air only where the inlet can reach it */
    do{x=upstream?b.x0-Math.random()*2.5:b.x0+Math.random()*(Math.min(b.x1,cap.x+2.5)-b.x0);
      const u=Math.random();far=u>0.62;const r=far?rIn+(u-0.62)/0.38*(rFar-rIn):Math.sqrt(u/0.62)*rIn;
      const ang=(sec&&!far&&Math.random()<0.55)?(sec[0]+Math.random()*(sec[1]-sec[0]))*DEG:Math.random()*Math.PI*2;
      y=r*Math.cos(ang)+(b.yc||0);z=r*Math.sin(ang);k++;}while(E.inside(x,y,z)&&k<10);
    const j=i*3;this.P[j]=this.Q[j]=x;this.P[j+1]=this.Q[j+1]=y;this.P[j+2]=this.Q[j+2]=z;this.S[i]=-1;this.T[i]=E.T0;this.V[i]=0;this.Pr[i]=1;this.age[i]=0;this.far[i]=far?1:0;this.wr[i]=this.wt[i]=0;
  }
  reset(E){for(let i=0;i<this.n;i++)this.spawn(i,E,false);}
  /* colour by the active view; dark palette ends are lifted so cold, still air stays visible */
  paint(i,lut,VW){
    const j=i*3,pr=this.probe;pr.T=this.T[i];pr.Pr=this.Pr[i];pr.V=this.V[i];const ci=fIdx(VW.frac(pr));
    let r=lut[ci],g=lut[ci+1],b=lut[ci+2];const lift=0.26*(1-(0.3*r+0.59*g+0.11*b));r+=lift*0.4;g+=lift*0.58;b+=lift*0.9;
    const inside=this.S[i]>=0,far=this.far[i]===1,hot=inside?smooth(900,1500,this.T[i]):0;
    const br=inside?1+0.5*hot:(far?0.5:0.75);
    this.col[j]=r*br;this.col[j+1]=g*br;this.col[j+2]=b*br;
    const m=i*2;this.misc[m]=inside?1+0.25*hot:(far?0.7:0.85);this.misc[m+1]=inside?0.95:(far?0.32:0.65);
  }
  /* streak from the displacement of the last step */
  write(i,dt,lut,VW){
    const j=i*3,P=this.P,Q=this.Q,s=TAU/dt;let dx=(P[j]-Q[j])*s,dy=(P[j+1]-Q[j+1])*s,dz=(P[j+2]-Q[j+2])*s;
    const L=Math.hypot(dx,dy,dz);if(L>LMAX){const c=LMAX/L;dx*=c;dy*=c;dz*=c;}
    this.head[j]=P[j];this.head[j+1]=P[j+1];this.head[j+2]=P[j+2];this.tail[j]=P[j]-dx;this.tail[j+1]=P[j+1]-dy;this.tail[j+2]=P[j+2]-dz;
    this.paint(i,lut,VW);
  }
  upload(geom){this.aCol.needsUpdate=true;this.aMisc.needsUpdate=true;if(geom){this.aHead.needsUpdate=true;this.aTail.needsUpdate=true;}}
  update(dt,E,R,view){
    const VW=VIEWS[view]||VIEWS.mat,lut=LUT[VW.lin];
    const ts=state.tscale,k=KV*ts,V0=R.V0*k,vk=R.vk??1;const P=this.P,Q=this.Q,n=this.n,cap=E.capture,v=this.v;
    E.evalStreams(R);
    if(dt<=0){for(let i=0;i<n;i++)this.paint(i,lut,VW);this.upload(false);return;}   /* paused: recolour only */
    /* the captured stream tube acts as a sink of strength S (face velocity minus free stream);
       negative when the inlet spills or the compressor surges. It fades out along the body. */
    const a=cap.channel?0:cap.r,S=cap.channel?0:a*a*(E.streams[0].V[0]*k-V0)*vk/4;
    const xEnd=E.xEnd??E.spawn.x1,xMid=(cap.x+xEnd)/2;
    /* free jet: the stream that reaches furthest out just behind the body */
    let jet=null;if(!cap.channel){let rj=0;for(const st of E.streams){if(st.jet===undefined)continue;const e=sample(st,st.B,xEnd+0.5);if(e>rj){rj=e;jet=st;}}}
    const dts=dt*ts;   /* slow-motion seconds, for the eddies */
    for(let i=0;i<n;i++){const j=i*3;let x=P[j],y=P[j+1],z=P[j+2];Q[j]=x;Q[j+1]=y;Q[j+2]=z;
      if(this.S[i]<0){
        v[0]=V0;v[1]=0;v[2]=0;const r=Math.hypot(y,z);
        if(S!==0){const wS=x<xMid?1:1-smooth(xMid,xEnd+0.5,x);
          if(wS>0){const ir=1/(r||1e-6);let ty,tz;if(x<cap.x){const rr=Math.min(r,a);ty=rr*y*ir;tz=rr*z*ir;}else{ty=a*y*ir;tz=a*z*ir;}
            /* face velocity at the plane; the far field is drawn twice as strong as the sink law to stay legible in slow motion */
            const dx=cap.x-x,dy=ty-y,dz=tz-z;const d2=dx*dx+dy*dy+dz*dz,d=Math.sqrt(d2)+1e-6;const mag=S*wS/(d2+a*a*0.25)*(1+smooth(0,1.5*a,d));v[0]+=dx/d*mag;v[1]+=dy/d*mag;v[2]+=dz/d*mag;}}
        if(E.steer)E.steer(x,y,z,v,cap);else if(E.rBody)steerAnnular(E,jet,x,y,z,v,cap);
        if(jet&&x>xEnd-0.3){const vj=sample(jet,jet.V,x)*k;if(vj>V0){const e=Math.exp(-Math.pow(Math.max(0,r-sample(jet,jet.B,x))/0.45,2));v[0]+=(vj-V0)*0.3*e;}}
        v[0]+=gauss()*0.012;v[1]+=gauss()*0.012;v[2]+=gauss()*0.012;
        x+=v[0]*dt;y+=v[1]*dt;z+=v[2]*dt;P[j]=x;P[j+1]=y;P[j+2]=z;this.V[i]=k>0?Math.hypot(v[0],v[1],v[2])/k:0;this.Pr[i]=1;this.T[i]=R.T0;
        if(Q[j]<cap.x&&x>=cap.x){
          if(cap.channel){if(y>cap.yl&&y<cap.yh&&Math.abs(z)<cap.zh){this.S[i]=0;this.seg[i]=0;this.rho[i]=(y-cap.yl)/(cap.yh-cap.yl);this.ze[i]=z/cap.zh;P[j]=cap.x+1e-4;}}
          else{const rr=Math.hypot(y,z);if(rr<cap.r){const st=E.streams[0];this.S[i]=0;this.seg[i]=0;this.rho[i]=clamp((rr-st.A[0])/(st.B[0]-st.A[0]),0,1);this.th[i]=Math.atan2(z,y);P[j]=cap.x+1e-4;}}}
        if(this.S[i]<0){E.deflect(P,i);this.age[i]+=dt;
          if(x>E.spawn.x1||x<E.spawn.x0-3||Math.abs(y)>4.5||Math.abs(z)>4.5||(this.age[i]>16&&Math.random()<0.03)){this.spawn(i,E,V0>0.15);this.write(i,dt,lut,VW);continue;}}
      }
      if(this.S[i]>=0){
        const st=E.streams[this.S[i]],X=st.X;let g=this.seg[i];x=P[j];while(g<X.length-2&&x>=X[g+1])g++;while(g>0&&x<X[g])g--;this.seg[i]=g;
        const f=clamp((x-X[g])/(X[g+1]-X[g]),0,1);let A=lerp(st.A[g],st.A[g+1],f),B=lerp(st.B[g],st.B[g+1],f);const vs=lerp(st.V[g],st.V[g+1],f)*vk;const T=this.T[i]=lerp(st.TT[g],st.TT[g+1],f);this.V[i]=Math.abs(vs);this.Pr[i]=E.pressureAt(st,x,R);
        if(st.jet===undefined||x<st.jet){const mg=Math.min(0.03,(B-A)*0.2);B-=mg;A+=mg*0.5;}   /* keep a margin from the walls so streaks do not poke through the casing */
        x+=vs*k*dt;
        /* mixing: eddies in the shear layer of the free jet and the flicker of the flame, as a slowly
           wandering drift (Ornstein-Uhlenbeck) so the streaks wave instead of jittering */
        const sig=(st.jet!==undefined&&x>st.jet)?0.1+0.3*clamp(Math.abs(vs-R.V0)/500,0,1):0.07*smooth(950,1600,T);
        if(sig>0){const lam=2.5*dts,kick=sig*Math.sqrt(2*lam);this.wr[i]+=gauss()*kick-this.wr[i]*lam;this.wt[i]+=gauss()*kick-this.wt[i]*lam;
          this.rho[i]=reflect(this.rho[i]+this.wr[i]*dts);if(st.kind==='annular')this.th[i]+=this.wt[i]*dts*1.2;else this.ze[i]=clamp(this.ze[i]+this.wt[i]*dts*0.8,-1,1);}
        else{this.wr[i]*=0.9;this.wt[i]*=0.9;}
        if(st.kind==='annular'){const r=A+this.rho[i]*(B-A);this.th[i]+=E.swirl(x)*dt;y=r*Math.cos(this.th[i]);z=r*Math.sin(this.th[i]);}
        else{y=A+this.rho[i]*(B-A);z=this.ze[i]*lerp(st.C[g],st.C[g+1],f);}
        P[j]=x;P[j+1]=y;P[j+2]=z;
        if(x>=X[X.length-1]){if(st.next)st.next(i,this,E);else this.spawn(i,E,true);}
        else if(x<X[0]-0.3)this.spawn(i,E,true);
      }
      this.write(i,dt,lut,VW);
    }
    this.upload(true);
  }
}

export {Flow};
