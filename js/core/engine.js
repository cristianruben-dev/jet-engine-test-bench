/* Engine: part registry (station temperature, pressure, velocity, metal cooling), spools,
   variable stators, flames, air streams, cutaway planes and section caps */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {state,KROT} from '../state.js';
import {cutPlanes} from './cuts.js';
import {bladeRow,ringX,profileAt} from './geometry.js';
import {smooth,lerp,DEG} from './utils.js';
import {rebuildCaps,disposeCaps} from './caps.js';

/* gas state at a station key, or interpolated between two keys: ['hpc','comb',0.5] */
function stationOf(R,at){const st=R.st;if(typeof at==='string')return st[at]||st.amb;const a=st[at[0]]||st.amb,b=st[at[1]]||st.amb,f=at[2]??0.5;return {T:lerp(a.T,b.T,f),P:Math.exp(lerp(Math.log(a.P),Math.log(b.P),f)),V:lerp(a.V,b.V,f)};}

class Engine{
  constructor(id){this.id=id;this.group=new THREE.Group();this.parts=[];this.spools={};this.omega={};this.rotors=[];this.flames=[];this.discs=[];this.casingMats=[];this.streams=[];this.hooks=[];this.vsv=[];this.caps=[];this.capsGroup=null;this.T0=288.15;this.center=[1.8,0,0];this.tour=[];}
  spool(n){if(!this.spools[n]){const g=new THREE.Group();this.spools[n]=g;this.group.add(g);}return this.spools[n];}
  part(mesh,o){
    const nm=mesh.material.clone();
    if(o.casing){nm.side=THREE.DoubleSide;nm.clippingPlanes=cutPlanes(this,state.cut);nm.clipIntersection=true;}
    const tm=new THREE.MeshStandardMaterial({color:0x000000,emissive:0x000000,roughness:0.92,metalness:0,side:nm.side,clippingPlanes:nm.clippingPlanes,clipIntersection:true,transparent:nm.transparent,opacity:nm.opacity,envMapIntensity:0,alphaMap:nm.alphaMap||null,alphaTest:nm.alphaTest||0});
    mesh.material=nm;
    const p={mesh,name:o.name,desc:o.desc||'',at:o.at||'amb',Tfn:o.T||null,cool:o.cool||0,matN:nm,matT:tm,casing:!!o.casing,solid:!!o.solid,pick:o.pick!==false,spool:o.spool||null,glow:o.glow!==undefined?o.glow:!o.casing};
    p.gas=R=>{const g=stationOf(R,p.at);return p.Tfn?{T:p.Tfn(R),P:g.P,V:g.V}:g;};
    p.T=R=>p.gas(R).T;
    p.metal=R=>{const T=p.T(R);const Tc=R.Tcool??R.T0;return (p.cool>0&&T>Tc)?T-p.cool*(T-Tc):T;};
    mesh.userData.part=p;this.parts.push(p);
    if(o.casing)this.casingMats.push(nm,tm);
    (o.spool?this.spool(o.spool):this.group).add(mesh);
    return p;
  }
  rotorRow(o,info){const m=bladeRow(o);this.part(m,{...info,spool:o.spool});this.rotors.push({x0:o.x-0.06,x1:o.x+0.3,spool:o.spool});
    const disc=new THREE.Mesh(ringX(o.x,o.hub,o.tip),new THREE.MeshBasicMaterial({color:o.mat.color.clone().multiplyScalar(0.8),transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
    disc.renderOrder=2;this.group.add(disc);this.discs.push({mesh:disc,n:o.n,spool:o.spool});return m;}
  /* variable stator vanes: the row pivots about its radial axis by fn(R) degrees */
  vsvRow(o,info,fn){const m=bladeRow(o);this.part(m,info);this.vsv.push({mesh:m,n:o.n,fn,cur:NaN});return m;}
  flame(mesh,fn){this.group.add(mesh);this.flames.push({mesh,fn,cur:0});return mesh;}
  stream(def){const s={kind:def.kind||'annular',name:def.name,next:def.next||null,pmap:def.pmap||null,X:[],A:[],B:[],C:[],vf:[],Tf:[],V:[],TT:[]};for(const st of def.st){s.X.push(st[0]);s.A.push(st[1]);s.B.push(st[2]);s.vf.push(st[3]);s.Tf.push(st[4]);s.C.push(st[5]??0.6);}s.V=new Float32Array(s.X.length);s.TT=new Float32Array(s.X.length);this.streams.push(s);return s;}
  evalStreams(R){for(const s of this.streams)for(let i=0;i<s.X.length;i++){s.V[i]=s.vf[i](R);s.TT[i]=s.Tf[i](R);}}
  /* pressure ratio to ambient along a stream, from its [x, station] map */
  pressureAt(s,x,R){const pm=s.pmap||this.pmap;if(!pm)return 1;if(x<=pm[0][0])return R.st[pm[0][1]].P/R.P0;for(let i=0;i<pm.length-1;i++){if(x<=pm[i+1][0]){const f=(x-pm[i][0])/(pm[i+1][0]-pm[i][0]);return Math.exp(lerp(Math.log(R.st[pm[i][1]].P),Math.log(R.st[pm[i+1][1]].P),f))/R.P0;}}return R.st[pm[pm.length-1][1]].P/R.P0;}
  setCut(mode){for(const m of this.casingMats){m.clippingPlanes=cutPlanes(this,mode);m.needsUpdate=true;}rebuildCaps(this,mode);}
  update(R,dt){
    const ts=state.tscale;
    for(const n in this.spools){const rps=(R.rpm[n]||0)/60;const w=rps*KROT*ts*Math.PI*2;this.omega[n]=w;this.spools[n].rotation.x+=w*dt;}
    for(const d of this.discs){const w=this.omega[d.spool]||0;const bpf=d.n*w/(2*Math.PI)/60;d.mesh.material.opacity=smooth(0.3,1.1,bpf)*0.45;}
    for(const f of this.flames){const target=f.fn(R);f.cur+=(target-f.cur)*Math.min(1,dt*4);const u=f.mesh.material.uniforms;u.uIntensity.value=f.cur;u.uTime.value+=dt*(0.3+1.4*ts);f.mesh.visible=f.cur>0.01;}
    const m=new THREE.Matrix4(),ry=new THREE.Matrix4();
    for(const v of this.vsv){const d=v.fn(R);if(!(Math.abs(d-v.cur)<0.15)){v.cur=d;ry.makeRotationY(-d*DEG);for(let i=0;i<v.n;i++){m.makeRotationX(i/v.n*Math.PI*2).multiply(ry);v.mesh.setMatrixAt(i,m);}v.mesh.instanceMatrix.needsUpdate=true;}}
    for(const h of this.hooks)h(R,dt);
  }
  swirl(x){let w=0;for(const r of this.rotors){if(x>r.x0&&x<r.x1){const f=1-smooth(r.x1-0.12,r.x1,x);w+=(this.omega[r.spool]||0)*0.55*f;}}return w;}
  /* camera presets derived from the engine's centre and default view */
  views(){const [cx,cy]=this.center;return {cut:this.cam,front:{pos:[cx-8.5,cy+1.1,1.6],target:[cx-0.5,cy,0]},side:{pos:[cx,cy+0.6,8.6],target:[cx,cy,0]},jet:{pos:[cx+8.5,cy+1.8,4.2],target:[cx+2.2,cy,0]}};}
  dispose(){disposeCaps(this);this.group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});for(const p of this.parts){p.matT.dispose();}}
}

/* body of revolution: deflects outside air and keeps particles out of the solid */
function annularBody(E,prof){E.rBody=prof;E.inside=(x,y,z)=>{const r=profileAt(prof,x);return r>=0&&Math.hypot(y,z)<r+0.04;};E.deflect=(P,i)=>{const x=P[i*3],y=P[i*3+1],z=P[i*3+2];const rb=profileAt(prof,x);if(rb<0)return;const r=Math.hypot(y,z);if(r<rb+0.04){const s=(rb+0.045)/(r||1e-6);P[i*3+1]=r<1e-6?rb+0.045:y*s;P[i*3+2]=r<1e-6?0:z*s;}};}

export {Engine,annularBody,stationOf};
