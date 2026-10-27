/* Geometry: bodies of revolution, shells, instanced blades (with UVs) and profiles */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {lerp,DEG} from './utils.js';

/* profile [[x, r], …] revolved around the X axis */
function lathe(profile,seg=72){const pts=profile.map(([x,r])=>new THREE.Vector2(Math.max(r,0.0005),x));const g=new THREE.LatheGeometry(pts,seg);g.rotateZ(-Math.PI/2);return g;}
/* closed shell of thickness t around an open profile (so the cutaway can cap it) */
function latheShell(profile,t=0.014,seg=72){const o=profile.map(([x,r])=>[x,r+t/2]);const i=profile.slice().reverse().map(([x,r])=>[x,Math.max(r-t/2,0.001)]);return lathe([...o,...i,o[0]],seg);}
function cylX(x0,x1,r0,r1,seg=48,open=false){const g=new THREE.CylinderGeometry(r0,r1,x1-x0,seg,1,open);g.rotateZ(Math.PI/2);g.translate((x0+x1)/2,0,0);return g;}
function tubeX(x0,x1,r,seg=48){return cylX(x0,x1,r,r,seg,true);}
function ringX(x,ri,ro,seg=64){const g=new THREE.RingGeometry(ri,ro,seg);g.rotateY(Math.PI/2);g.translate(x,0,0);return g;}
function torusX(x,R,r,seg=64,tseg=10){const g=new THREE.TorusGeometry(R,r,tseg,seg);g.rotateY(Math.PI/2);g.translate(x,0,0);return g;}
function box(w,h,d,x,y,z){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);return g;}
function merge(geos){
  const pos=[],nor=[],uv=[],idx=[];let off=0;const allUv=geos.every(g=>g.attributes.uv);
  for(const G of geos){const p=G.attributes.position.array,n=G.attributes.normal?G.attributes.normal.array:null;for(let i=0;i<p.length;i++)pos.push(p[i]);if(n)for(let i=0;i<n.length;i++)nor.push(n[i]);if(allUv){const u=G.attributes.uv.array;for(let i=0;i<u.length;i++)uv.push(u[i]);}
    if(G.index){const ix=G.index.array;for(let i=0;i<ix.length;i++)idx.push(ix[i]+off);}else{for(let i=0;i<p.length/3;i++)idx.push(i+off);}off+=p.length/3;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));if(nor.length===pos.length)g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));else g.computeVertexNormals();if(allUv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);return g;
}

/* closed airfoil loop (simplified NACA 4-digit) */
function airfoilLoop(nPts,m,t){const up=[],lo=[];for(let i=0;i<nPts;i++){const s=i/(nPts-1);const x=(1-Math.cos(s*Math.PI))/2;const yt=5*t*(0.2969*Math.sqrt(x)-0.126*x-0.3516*x*x+0.2843*x*x*x-0.1036*x*x*x*x);const yc=4*m*x*(1-x);up.push([x,yc+yt]);lo.push([x,yc-yt]);}const loop=[];for(let i=nPts-1;i>=0;i--)loop.push(up[i]);for(let i=1;i<nPts-1;i++)loop.push(lo[i]);return loop;}
/* blade: root at rHub, tip at rTip, spanning +Y; chord in the axial-tangential plane with variable stagger */
function bladeGeometry(o){
  const spanSeg=o.spanSeg||6,loop=airfoilLoop(o.nPts||9,o.camber??0.06,o.thick??0.06),L=loop.length;
  const pos=[],uv=[],idx=[];
  for(let j=0;j<=spanSeg;j++){
    const s=j/spanSeg,r=lerp(o.rHub,o.rTip,s),chord=lerp(o.chordHub,o.chordTip??o.chordHub,s);
    const stag=lerp(o.stagHub,o.stagTip??o.stagHub,s)*DEG,sw=(o.sweep||0)*s*s,cs=Math.cos(stag),sn=Math.sin(stag);
    for(let k=0;k<L;k++){const [px,py]=loop[k];const ax=(px-0.42)*chord,tg=py*chord;pos.push(ax*cs-tg*sn+sw,r,ax*sn+tg*cs);uv.push(px,s);}
  }
  for(let j=0;j<spanSeg;j++)for(let k=0;k<L;k++){const a=j*L+k,b=j*L+(k+1)%L,c=(j+1)*L+k,d=(j+1)*L+(k+1)%L;idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
/* row of n instanced blades around the X axis */
function bladeRow(o){
  const geo=bladeGeometry({rHub:o.hub-0.012,rTip:o.tip,chordHub:o.chord,chordTip:o.chordTip,stagHub:o.stag,stagTip:o.stagTip,camber:o.camber,thick:o.thick,sweep:o.sweep,spanSeg:o.spanSeg,nPts:o.nPts});
  const m=new THREE.InstancedMesh(geo,o.mat,o.n);const mtx=new THREE.Matrix4();
  for(let i=0;i<o.n;i++){mtx.makeRotationX(i/o.n*Math.PI*2);m.setMatrixAt(i,mtx);}
  m.position.x=o.x;m.userData.row=o;return m;
}
function radialArray(geoFn,n,x){const geos=[];for(let i=0;i<n;i++){const g=geoFn();g.rotateX(i/n*Math.PI*2);geos.push(g);}const g=merge(geos);if(x!==undefined)g.translate(x,0,0);return g;}
/* ring of bolts on a flange */
function boltRing(x,r,n=36){return radialArray(()=>box(0.028,0.024,0.02,x,r,0),n);}

/* interpolated profile [[x, r], …]; -1 outside the range */
function profileAt(prof,x){if(x<prof[0][0]||x>prof[prof.length-1][0])return -1;for(let i=0;i<prof.length-1;i++){const [x0,r0]=prof[i],[x1,r1]=prof[i+1];if(x>=x0&&x<=x1){return x1===x0?r1:lerp(r0,r1,(x-x0)/(x1-x0));}}return -1;}
function shapeOf(pts){const s=new THREE.Shape();s.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)s.lineTo(pts[i][0],pts[i][1]);s.closePath();return s;}
function extrudeZ(pts,depth,z){const g=new THREE.ExtrudeGeometry(shapeOf(pts),{depth,bevelEnabled:false});g.translate(0,0,z);return g;}

export {lathe,latheShell,cylX,tubeX,ringX,torusX,box,merge,airfoilLoop,bladeGeometry,bladeRow,radialArray,boltRing,profileAt,shapeOf,extrudeZ};
