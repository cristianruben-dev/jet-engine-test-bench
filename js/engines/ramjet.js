/* Ramjet: inlet spike, diffuser, V-gutter flame holders */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {Engine,annularBody} from '../core/engine.js';
import {MAT} from '../core/materials.js';
import {lathe,cylX,tubeX,ringX,torusX,box,merge,bladeRow,radialArray,extrudeZ,profileAt} from '../core/geometry.js';
import {flameTube} from '../core/flame.js';
import {shockMat,shockAngle,machAfter} from '../core/shocks.js';
import {PLANE_Z} from '../core/cuts.js';
import {lerp,smooth,fmt,DEG} from '../core/utils.js';

function buildRamjet(){
  const E=new Engine('ramjet');E.T0=216.65;
  E.part(new THREE.Mesh(lathe([[-0.35,0.47],[-0.2,0.5],[0.3,0.52],[1.4,0.52],[1.4,0.48],[0.3,0.46],[-0.35,0.455],[-0.35,0.47]],96),MAT.titanium),{name:'Carenado de entrada y difusor',desc:'La sección crece aguas abajo: el aire supersónico se frena hasta ~M 0,3 y así gana presión sin ningún compresor.',T:R=>R.Tt0,casing:true});
  E.part(new THREE.Mesh(lathe([[1.4,0.52],[3.3,0.52],[3.3,0.48],[1.4,0.48],[1.4,0.52]],96),MAT.inconel),{name:'Cámara de combustión',desc:'Un simple tubo: sin turbina detrás, la llama puede ser mucho más caliente (hasta 2 000 °C).',T:R=>lerp(R.Tt0,R.Tt4,0.6),casing:true});
  E.part(new THREE.Mesh(lathe([[3.3,0.52],[3.9,0.46],[4.3,0.42],[4.3,0.40],[3.7,0.33],[3.3,0.48],[3.3,0.52]],96),MAT.inconel),{name:'Tobera convergente-divergente',desc:'La garganta fija el caudal; la parte divergente acelera el gas a velocidad supersónica.',T:R=>lerp(R.Tt4,R.T9,0.4),casing:true});
  E.part(new THREE.Mesh(lathe([[-1.1,0],[-0.3,0.26],[0.2,0.3],[0.8,0.22],[1.3,0.1],[1.5,0.0]],96),MAT.titanium),{name:'Cono central (spike)',desc:'Genera un choque oblicuo cónico que comprime el aire antes de entrar. Su ángulo fija el Mach de diseño.',T:R=>R.Tt0});
  E.part(new THREE.Mesh(radialArray(()=>box(0.1,0.2,0.03,0.45,0.38,0),4),MAT.titanium),{name:'Soportes del cono',desc:'',T:R=>R.Tt0});
  E.part(new THREE.Mesh(merge([torusX(1.35,0.3,0.02,72,8),radialArray(()=>cylX(1.33,1.46,0.015,0.015,8).translate(0,0.3,0),12)]),MAT.gold),{name:'Anillo de inyección',desc:'Doce inyectores reparten el combustible aguas arriba de los estabilizadores.',T:R=>R.Tt0});
  E.part(new THREE.Mesh(merge([torusX(1.65,0.2,0.03,64,6),torusX(1.65,0.37,0.03,72,6),radialArray(()=>box(0.05,0.4,0.03,1.65,0.25,0),8)]),MAT.inconel),{name:'Estabilizadores de llama en V',desc:'Imprescindibles: sin ellos el flujo apagaría la llama como una vela al viento.',T:R=>lerp(R.Tt0,R.Tt4,0.7)});
  E.flame(flameTube(1.7,3.3,0.4,0.44,'afterburner',{scale:2.2,tail:0.75,seg:48}),R=>R.burn*0.9);
  E.flame(flameTube(1.7,3.2,0.22,0.3,'afterburner',{scale:1.4,tail:0.7}),R=>R.burn*0.8);
  E.flame(flameTube(4.3,7.6,0.4,0.62,'afterburner',{diamonds:true,scale:1.6,tail:0.8,seg:48}),R=>R.burn*smooth(0.3,1.5,R.M));
  const cone=new THREE.Mesh(new THREE.ConeGeometry(1,1,72,1,true).rotateZ(Math.PI/2),shockMat());cone.renderOrder=4;E.group.add(cone);
  const disc=new THREE.Mesh(ringX(-0.22,0.25,0.455,72),shockMat());disc.renderOrder=4;E.group.add(disc);
  E.hooks.push((R)=>{const b=shockAngle(R.M,10);const vis=R.M>1.02&&b!==null;cone.visible=vis;disc.visible=R.M>1.02;if(vis){const h=1.15,r=h*Math.tan(b);cone.scale.set(h,r,r);cone.position.set(-1.1+h/2,0,0);cone.material.opacity=0.11*smooth(1.0,1.4,R.M);}disc.material.opacity=0.16*smooth(1.0,1.3,R.M);});
  annularBody(E,[[-1.1,0],[-0.35,0.47],[0.3,0.52],[3.4,0.52],[4.3,0.42],[4.31,0]]);
  E.capture={x:-0.35,r:0.455};E.suction=()=>0;
  E.stream({name:'flow',st:[[-0.35,0.245,0.455,R=>R.V0,R=>R.Tt0*0.9],[0.2,0.3,0.46,R=>R.V0*0.35,R=>R.Tt0*0.95],[1.4,0.08,0.48,R=>R.V0*0.3,R=>R.Tt0],[1.7,0.0,0.48,R=>R.V0*0.3+60*R.burn,R=>lerp(R.Tt0,R.Tt4,0.5)],[3.3,0.0,0.48,R=>R.V0*0.45+100*R.burn,R=>R.Tt4],[3.7,0,0.33,R=>R.V0*0.9+200*R.burn,R=>R.Tt4*0.85],[4.3,0,0.4,R=>Math.max(R.v9,R.V0*0.6),R=>R.T9],[7.5,0,0.6,R=>Math.max(R.v9,R.V0*0.6)*0.7+R.V0*0.3,R=>lerp(R.T9,R.T0,0.5)],[10,0,0.8,R=>Math.max(R.v9,R.V0*0.6)*0.4+R.V0*0.6,R=>lerp(R.T9,R.T0,0.8)]]});
  E.spawn={x0:-6,x1:9,r:2.3};
  E.table=[['Cono y toma (temp. de remanso)',R=>R.Tt0],['Difusor',R=>R.Tt0],['Cámara de combustión',R=>R.Tt4],['Chorro de salida',R=>R.T9]];
  E.readouts=R=>[['Mach',fmt(R.M,2),''],['Velocidad',fmt(R.V0*3.6),'km/h'],['Empuje',fmt(R.F/1000,1),'kN'],['Flujo de aire',fmt(R.mdot),'kg/s'],['Rel. presiones',fmt(R.OPR,1),':1'],['Chorro',fmt(R.v9),'m/s'],['Altitud',fmt(15000),'m'],['Partes móviles','0','']];
  E.cam={pos:[-3.4,1.8,5.9],target:[1.6,0,0]};
  return E;
}

export {buildRamjet};
