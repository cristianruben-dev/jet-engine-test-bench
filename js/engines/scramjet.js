/* Scramjet: compression ramps, isolator, supersonic combustion, expansion ramp, fins */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {Engine} from '../core/engine.js';
import {MAT} from '../core/materials.js';
import {box,merge,extrudeZ,profileAt} from '../core/geometry.js';
import {flameTube} from '../core/flame.js';
import {shockMat,shockAngle,machAfter} from '../core/shocks.js';
import {PLANE_Z} from '../core/cuts.js';
import {lerp,smooth,fmt,DEG} from '../core/utils.js';

const SJ_WALL=[[-2.6,0.45],[-1.4,0.34],[0.0,0.08],[1.2,0.08],[2.6,0.12],[5.2,0.78]];
const SJ_TOP=[[-2.6,0.45],[-0.4,0.95],[5.2,0.95]];
const sjWall=x=>profileAt(SJ_WALL,x),sjTop=x=>profileAt(SJ_TOP,x);
function buildScramjet(){
  const E=new Engine('scramjet');E.T0=226.5;E.center=[1.3,0.15,0];E.cuts={none:[],quarter:[PLANE_Z,new THREE.Plane(new THREE.Vector3(0,1,0),-0.3)],half:[PLANE_Z]};
  E.part(new THREE.Mesh(extrudeZ([[-2.6,0.45],[-1.4,0.34],[0.0,0.08],[0.0,0.95],[-0.4,0.95]],1.2,-0.6),MAT.carbon),{name:'Rampas de compresión (proa)',desc:'Dos rampas de 5° y 10°: cada quiebro genera un choque oblicuo que comprime el aire sin frenarlo por debajo de Mach 1. Paneles de carbono-carbono y cerámica.',at:'ramp',cool:0.4,casing:true,solid:true});
  E.part(new THREE.Mesh(extrudeZ([[0.0,0.08],[1.2,0.08],[2.6,0.12],[2.6,0.95],[0.0,0.95]],1.2,-0.6),MAT.carbon),{name:'Aislador y cámara (pared superior)',desc:'El aislador amortigua el tren de choques; la cámara diverge ligeramente para evitar el bloqueo térmico. Las paredes se refrigeran con el propio hidrógeno antes de inyectarlo.',at:['iso','comb',0.5],cool:0.5,casing:true,solid:true});
  E.part(new THREE.Mesh(extrudeZ([[2.6,0.12],[5.2,0.78],[5.2,0.95],[2.6,0.95]],1.2,-0.6),MAT.carbon),{name:'Rampa de expansión (tobera)',desc:'La mitad inferior de la tobera es el propio aire exterior: el chorro se expande contra la rampa del fuselaje.',at:['comb','noz',0.5],cool:0.5,casing:true,solid:true});
  E.part(new THREE.Mesh(extrudeZ([[-2.63,0.45],[-2.3,0.414],[-2.3,0.526]],1.22,-0.61),MAT.inconel),{name:'Borde de ataque (carbono-carbono)',desc:'Afilado como un cuchillo para que el choque se mantenga pegado; a M 7 supera los 1 400 °C y se enfría solo por radiación.',at:'ramp',cool:0.3,glow:true});
  E.part(new THREE.Mesh(box(3.3,0.06,1.2,1.65,-0.25,0),MAT.carbon),{name:'Carenado inferior (cowl)',desc:'Cierra el conducto. Su labio recibe los choques de las rampas al Mach de diseño (≈ 7).',at:'iso',cool:0.5,casing:true,solid:true});
  const side=[[0.0,0.08],[1.2,0.08],[2.6,0.12],[3.3,0.3],[3.3,-0.22],[0.0,-0.22]];
  E.part(new THREE.Mesh(merge([extrudeZ(side,0.04,0.58),extrudeZ(side,0.04,-0.62)]),MAT.carbon),{name:'Paredes laterales',desc:'',at:'iso',cool:0.5,casing:true,solid:true});
  E.part(new THREE.Mesh(merge([extrudeZ([[4.2,0.95],[5.2,0.95],[5.2,1.5],[4.75,1.5]],0.04,0.5),extrudeZ([[4.2,0.95],[5.2,0.95],[5.2,1.5],[4.75,1.5]],0.04,-0.54)]),MAT.carbon),{name:'Estabilizadores verticales',desc:'Timones del vehículo de ensayo; a M 7 cualquier superficie es un radiador al rojo.',at:'amb'});
  E.part(new THREE.Mesh(merge([box(1.3,0.04,0.8,3.5,0.55,1.0),box(1.3,0.04,0.8,3.5,0.55,-1.0)]),MAT.carbon),{name:'Alas',desc:'Pequeñas: a esta velocidad basta muy poca superficie para sustentar.',at:'amb'});
  E.part(new THREE.Mesh(merge([box(0.16,0.3,0.03,1.32,-0.07,-0.3),box(0.16,0.3,0.03,1.32,-0.07,0),box(0.16,0.3,0.03,1.32,-0.07,0.3)]),MAT.inconel),{name:'Soportes inyectores de hidrógeno (3)',desc:'Inyectan hidrógeno en el flujo supersónico; su estela sirve de estabilizador de llama. La mezcla debe arder en ~1 ms.',at:'iso',cool:0.5});
  E.part(new THREE.Mesh(box(0.1,0.04,1.1,1.32,0.1,0),MAT.gold),{name:'Colector de hidrógeno',desc:'',at:'iso'});
  const fl=flameTube(1.4,2.7,0.12,0.16,'hydrogen',{scale:1.2,tail:0.75,seg:40});fl.scale.set(1,1,3.6);fl.position.y=-0.07;E.flame(fl,R=>R.burn);
  const pl=flameTube(0,4.2,0.2,0.62,'hydrogen',{diamonds:true,scale:1.5,tail:0.8,seg:48});pl.scale.set(1,1,2.4);pl.rotation.z=8*DEG;pl.position.set(2.7,-0.02,0);E.flame(pl,R=>R.burn*0.9);
  const mkShock=()=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1.24).rotateX(Math.PI/2),shockMat());m.renderOrder=4;E.group.add(m);return m;};
  const s1=mkShock(),s2=mkShock(),s3=mkShock();
  const train=[];for(let k=0;k<3;k++){const m=mkShock();m.scale.set(0.42,1,1);m.rotation.z=(k%2?1:-1)*35*DEG;m.position.set(0.35+0.3*k,-0.07,0);train.push(m);}
  /* normal shock expelled in front of the cowl during an unstart */
  const bow=new THREE.Mesh(new THREE.PlaneGeometry(0.5,1.24).rotateY(Math.PI/2),shockMat());bow.rotation.z=-20*DEG;bow.position.set(-0.3,0.0,0);bow.renderOrder=4;E.group.add(bow);
  const place=(m,x0,y0,ang,len)=>{m.visible=len>0;if(len<=0)return;m.scale.x=len;m.rotation.z=ang;m.position.set(x0+Math.cos(ang)*len/2,y0+Math.sin(ang)*len/2,0);};
  E.hooks.push((R)=>{const M=R.M;const vis=M>1.3;const op=0.16*smooth(1.2,1.8,M);
    const b1=shockAngle(M,5.2);if(!vis||b1===null){s1.visible=s2.visible=s3.visible=false;}else{
      const a1=-b1;const L1=Math.min(5,(0.45+0.3)/Math.sin(b1));place(s1,-2.6,0.45,a1,L1);s1.material.opacity=op;
      const M1=machAfter(M,b1,5.2);const b2=shockAngle(M1,10.5);
      if(b2===null){s2.visible=false;s3.visible=false;}else{const a2=-(b2+5.2*DEG);const L2=Math.min(4,(0.34+0.3)/Math.sin(-a2));place(s2,-1.4,0.34,a2,L2);s2.material.opacity=op;
        const M2=machAfter(M1,b2,10.5);const b3=shockAngle(M2,15.7);
        if(b3===null){s3.visible=false;}else{const a3=b3-15.7*DEG;const L3=a3>0.02?Math.min(3,0.3/Math.sin(a3)):0;place(s3,0.0,-0.22,a3,L3);s3.material.opacity=op;}}}
    for(const m of train){m.material.opacity=0.12*R.burn;m.visible=R.burn>0.02;}
    bow.visible=(R.unstart||0)>0.05;bow.material.opacity=0.3*(R.unstart||0);});
  E.inside=(x,y,z)=>{if(Math.abs(z)>0.62)return false;if(x>=-2.6&&x<=5.2){const w=sjWall(x),t=sjTop(x);if(y>w-0.02&&y<t+0.02)return true;}if(x>=0&&x<=3.3&&y>-0.3&&y<-0.2)return true;return false;};
  E.deflect=(P,i)=>{const x=P[i*3],y=P[i*3+1],z=P[i*3+2];if(Math.abs(z)>0.62)return;if(x>=-2.6&&x<=5.2){const w=sjWall(x),t=sjTop(x);if(y>w-0.02&&y<t+0.02){P[i*3+1]=y<(w+t)/2?w-0.03:t+0.03;return;}}if(x>=0&&x<=3.3&&y>-0.3&&y<-0.2){P[i*3+1]=-0.31;}};
  E.capture={x:-3.2,channel:true,yl:-0.5,yh:0.45,zh:0.58};E.suction=()=>0;
  E.stream({name:'flow',kind:'channel',pmap:[[-3.2,'amb'],[-2.6,'amb'],[-1.4,'ramp'],[0,'iso'],[1.2,'iso'],[2.6,'comb'],[5.2,'noz']],st:[[-3.2,-0.5,0.45,R=>R.V0,R=>R.T0,0.58],[-2.6,-0.5,0.45,R=>R.V0,R=>R.T0,0.58],[-1.4,-0.42,0.34,R=>R.V0*0.93,R=>R.T0*1.35,0.58],[0.0,-0.22,0.08,R=>R.V0*0.82,R=>R.T3,0.58],[1.2,-0.22,0.08,R=>R.V0*0.8,R=>R.T3,0.58],[2.6,-0.22,0.12,R=>R.V0*0.85,R=>R.T4s,0.58],[3.3,-0.24,0.3,R=>R.V0*0.95,R=>R.T4s,0.6],[5.2,-0.45,0.78,R=>Math.max(R.v9,R.V0),R=>R.T9,0.75],[8,-0.9,1.3,R=>Math.max(R.v9,R.V0)*0.9,R=>lerp(R.T9,R.T0,0.4),1.0]]});
  E.spawn={x0:-7,x1:10,r:2.1,yc:0.1};
  E.table=[['Rampas y borde de ataque','ramp',0.35],['Aislador (estática)','iso',0.5],['Cámara (estática)','comb',0.5],['Chorro de salida','noz']];
  E.readouts=R=>[['Mach',fmt(R.M,1),''],['Velocidad',fmt(R.V0*3.6),'km/h'],['Empuje',fmt(R.F/1000,1),'kN'],['Flujo de aire',fmt(R.mdot,1),'kg/s'],['Hidrógeno',fmt(R.Wf,2),'kg/s'],['Consumo esp.',fmt(R.TSFC*1e6,1),'g/kN·s'],['Mach en cámara',fmt(R.M3,1),''],['Margen bloqueo',R.chokeMargin>=0?fmt(R.chokeMargin*100)+' %':'—',''],['Rend. propulsivo',fmt(R.etaP*100),'%'],['Rend. térmico',fmt(R.etaT*100),'%'],['Altitud',fmt(R.alt),'m'],['Partes móviles','0','']];
  E.cam={pos:[-2.6,2.0,8.4],target:[1.3,0.15,0]};
  E.tour=[
    {title:'Rampas de compresión',text:'El fuselaje es la toma: dos rampas generan choques oblicuos que comprimen el aire sin frenarlo por debajo de Mach 1. Al Mach de diseño los choques caen justo en el labio del carenado; a otro Mach se desvían y el motor traga de más o de menos.',cam:{pos:[-3.4,1.2,3.6],target:[-1.2,0.1,0]},part:'Rampas de compresión'},
    {title:'Aislador',text:'Un tramo recto que amortigua el tren de choques entre la toma y la cámara. Si la cámara añade demasiado calor, el tren retrocede hasta la toma y el motor sufre un «unstart»: prueba a subir el combustible a M 5.',cam:{pos:[0.0,0.9,2.6],target:[0.6,-0.05,0]},part:'Aislador y cámara'},
    {title:'Combustión supersónica',text:'El aire cruza la cámara a más de M 2 en un par de milisegundos: por eso se usa hidrógeno, que enciende y arde más rápido que cualquier otro combustible. Los soportes lo inyectan y anclan la llama en su estela.',cam:{pos:[1.4,0.8,2.4],target:[1.9,-0.05,0]},part:'Soportes inyectores de hidrógeno'},
    {title:'Rampa de expansión',text:'Media tobera: el gas se expande contra la rampa del fuselaje y la otra mitad la hace el aire exterior. El X-43 alcanzó M 9,6 así, sin una sola pieza móvil.',cam:{pos:[4.8,1.6,4.0],target:[3.8,0.3,0]},part:'Rampa de expansión'},
  ];
  return E;
}

export {buildScramjet};
