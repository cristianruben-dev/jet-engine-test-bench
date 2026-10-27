/* Single-spool turbojet with afterburner and petal nozzle */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {Engine,annularBody} from '../core/engine.js';
import {MAT} from '../core/materials.js';
import {lathe,cylX,tubeX,ringX,torusX,box,merge,bladeRow,radialArray,extrudeZ,profileAt} from '../core/geometry.js';
import {flameTube} from '../core/flame.js';
import {shockMat,shockAngle,machAfter} from '../core/shocks.js';
import {PLANE_Z} from '../core/cuts.js';
import {lerp,smooth,fmt,DEG} from '../core/utils.js';

function buildTurbojet(){
  const E=new Engine('turbojet');E.T0=288.15;E.spool('N');
  E.part(new THREE.Mesh(lathe([[-0.5,0.455],[-0.42,0.49],[0.0,0.505],[1.4,0.505],[1.4,0.405],[1.0,0.43],[0.1,0.455],[-0.42,0.45],[-0.5,0.455]],96),MAT.titanium),{name:'Toma y carcasa del compresor',desc:'Todo el aire pasa por el núcleo: no hay derivación. Diez etapas axiales elevan la presión 13 veces.',T:R=>(R.Tt0+R.Tt3)/2,casing:true});
  E.part(new THREE.Mesh(lathe([[1.4,0.505],[1.5,0.57],[2.0,0.575],[2.1,0.515],[2.1,0.47],[2.0,0.53],[1.5,0.53],[1.4,0.405],[1.4,0.505]],96),MAT.steel),{name:'Carcasa de la cámara de combustión',desc:'Aloja diez cámaras tubulares (cannulares) en torno al eje.',T:R=>R.Tt3,casing:true});
  E.part(new THREE.Mesh(lathe([[2.1,0.515],[2.5,0.51],[2.5,0.475],[2.1,0.47],[2.1,0.515]],96),MAT.inconel),{name:'Carcasa de turbina',desc:'Tres etapas de turbina mueven el compresor.',T:R=>(R.Tt4+R.Tt5)/2,casing:true});
  E.part(new THREE.Mesh(lathe([[2.5,0.51],[3.82,0.51],[3.82,0.475],[2.5,0.475],[2.5,0.51]],96),MAT.inconel),{name:'Conducto del postquemador',desc:'Tubo largo donde se vuelve a quemar combustible con el oxígeno sobrante. Refrigerado por una camisa de aire.',T:R=>lerp(R.Tt5,R.Tt7,0.6),casing:true});
  E.part(new THREE.Mesh(lathe([[-0.5,0],[-0.42,0.08],[-0.25,0.15],[-0.08,0.19],[0.0,0.2]]),MAT.paint),{name:'Cono de entrada',desc:'Fijo: reparte el aire hacia la primera etapa.',T:R=>R.Tt0});
  E.part(bladeRow({x:-0.03,n:26,hub:0.2,tip:0.45,chord:0.09,stag:-18,camber:0.04,thick:0.06,mat:MAT.titanium}),{name:'Álabes guía de entrada (IGV)',desc:'Orientan el aire antes del primer rotor; en motores reales son de ángulo variable.',T:R=>R.Tt0});
  E.part(new THREE.Mesh(lathe([[0.02,0.2],[0.6,0.25],[1.35,0.3],[1.4,0.27],[1.4,0.08]]),MAT.titanium),{name:'Tambor del compresor',desc:'',T:R=>(R.Tt0+R.Tt3)/2,spool:'N'});
  for(let i=0;i<10;i++){const x=0.1+0.125*i,hub=lerp(0.205,0.3,i/9),tip=lerp(0.45,0.405,i/9);const Tf=R=>lerp(R.Tt0,R.Tt3,(i+0.5)/10);const mat=i<6?MAT.titanium:MAT.inconel;
    E.rotorRow({x,n:30+4*i,hub,tip,chord:0.06,stag:42,camber:0.06,thick:0.07,mat,spool:'N'},{name:`Compresor, rotor ${i+1}`,desc:'Etapa axial: cada rotor sube la presión ~30 %.',T:Tf});
    E.part(bladeRow({x:x+0.062,n:36+4*i,hub:hub+0.004,tip,chord:0.055,stag:-36,camber:0.06,thick:0.07,mat}),{name:`Compresor, estátor ${i+1}`,desc:'',T:Tf});}
  E.part(new THREE.Mesh(cylX(1.35,2.2,0.09,0.09,24),MAT.steel),{name:'Eje principal',desc:'Un único eje une compresor y turbina: ~7 700 rpm a plena potencia.',T:R=>R.Tt3,spool:'N'});
  const can=()=>{const dome=new THREE.SphereGeometry(0.1,24,12,0,Math.PI*2,0,Math.PI/2);dome.rotateZ(Math.PI/2);dome.translate(1.52,0,0);const g=merge([cylX(1.52,2.04,0.1,0.1,24,true),dome]);g.translate(0,0.4,0);return g;};
  E.part(new THREE.Mesh(radialArray(can,10),MAT.inconel),{name:'Cámaras de combustión tubulares (10)',desc:'Diseño cannular clásico: diez tubos de llama con orificios de dilución. Cada uno tiene su inyector; las bujías van en dos de ellos.',T:R=>lerp(R.Tt3,R.Tt4,0.5),casing:true,glow:true});
  E.part(new THREE.Mesh(radialArray(()=>cylX(1.42,1.54,0.02,0.02,10).translate(0,0.4,0),10),MAT.gold),{name:'Inyectores de combustible (10)',desc:'',T:R=>R.Tt3});
  E.part(new THREE.Mesh(torusX(1.42,0.4,0.012,72,8),MAT.gold),{name:'Colector de combustible',desc:'',T:R=>R.Tt3});
  for(let i=0;i<10;i++){const f=flameTube(1.56,2.04,0.04,0.085,'kerosene',{scale:1.2,seg:20});f.position.y=0.4;f.geometry.translate(0,0.4,0);f.position.y=0;f.rotation.x=i/10*Math.PI*2;E.flame(f,R=>R.burn*0.95);}
  const tx=[2.14,2.28,2.42];
  for(let i=0;i<3;i++){const Tf=R=>lerp(R.Tt4,R.Tt5,(i+0.5)/3);
    E.part(bladeRow({x:tx[i],n:40+4*i,hub:0.3,tip:0.46,chord:0.065,stag:-50,camber:0.14,thick:0.1,mat:i===0?MAT.ceramic:MAT.inconel}),{name:`Álabes guía de turbina ${i+1} (NGV)`,desc:i===0?'Primeros en recibir el gas de la cámara: refrigerados por aire del compresor.':'',T:Tf});
    E.rotorRow({x:tx[i]+0.07,n:64+6*i,hub:0.3,tip:0.46,chord:0.055,stag:42,camber:0.12,thick:0.1,mat:MAT.inconel,spool:'N'},{name:`Turbina, etapa ${i+1}`,desc:'Extrae la energía justa para mover el compresor; el resto sale por la tobera.',T:Tf});}
  E.part(new THREE.Mesh(lathe([[2.16,0.09],[2.18,0.3],[2.5,0.29],[2.52,0.09]]),MAT.inconel),{name:'Discos de turbina',desc:'',T:R=>R.Tt5,spool:'N'});
  E.part(new THREE.Mesh(lathe([[2.52,0.29],[2.8,0.2],[3.05,0.08],[3.15,0]]),MAT.inconel),{name:'Cono difusor del postquemador',desc:'Frena el gas de la turbina para que la llama del postquemador pueda sostenerse.',T:R=>R.Tt5});
  E.part(new THREE.Mesh(merge([torusX(2.62,0.18,0.012,48,8),torusX(2.62,0.3,0.012,64,8),torusX(2.62,0.42,0.012,72,8),radialArray(()=>box(0.02,0.46,0.02,2.62,0.25,0),8)]),MAT.gold),{name:'Barras de inyección del postquemador',desc:'Rocían combustible en el gas aún rico en oxígeno (la cámara principal solo consume ~25 %).',T:R=>R.Tt5});
  E.part(new THREE.Mesh(merge([torusX(2.86,0.26,0.03,64,6),torusX(2.86,0.41,0.03,72,6),radialArray(()=>box(0.05,0.44,0.03,2.86,0.24,0),6)]),MAT.inconel),{name:'Estabilizadores de llama (canales en V)',desc:'Crean una estela de baja velocidad donde la llama se ancla aunque el gas pase a 200 m/s.',T:R=>lerp(R.Tt5,R.Tt7,0.5)});
  E.flame(flameTube(2.9,4.0,0.42,0.4,'afterburner',{scale:2.2,tail:0.7,seg:48}),R=>R.ab*0.9);
  E.flame(flameTube(2.9,3.9,0.26,0.3,'afterburner',{scale:1.4,tail:0.65}),R=>R.ab*0.8);
  E.flame(flameTube(4.05,7.4,0.3,0.52,'afterburner',{diamonds:true,scale:1.5,tail:0.78,seg:48}),R=>R.ab);
  const nPet=16;const petals=new THREE.InstancedMesh(box(0.46,0.014,0.2,0.23,-0.007,0),MAT.inconel,nPet);
  E.part(petals,{name:'Tobera de pétalos variable',desc:'Dieciséis pétalos articulados. Se abren al encender el postquemador para mantener la turbina en su punto y se cierran en seco.',T:R=>R.Tt7});
  let theta=24*DEG;const m4=new THREE.Matrix4(),mr=new THREE.Matrix4(),mt=new THREE.Matrix4(),mz=new THREE.Matrix4();
  E.hooks.push((R,dt)=>{const target=lerp(24,11,R.ab)*DEG;theta+=(target-theta)*Math.min(1,dt*2.5);for(let i=0;i<nPet;i++){mr.makeRotationX(i/nPet*Math.PI*2);mt.makeTranslation(3.82,0.47,0);mz.makeRotationZ(-theta);m4.copy(mr).multiply(mt).multiply(mz);petals.setMatrixAt(i,m4);}petals.instanceMatrix.needsUpdate=true;});
  annularBody(E,[[-0.5,0.455],[0,0.505],[1.4,0.505],[1.5,0.575],[2.0,0.575],[2.1,0.515],[3.82,0.51],[4.28,0.36],[4.3,0.0]]);
  E.capture={x:-0.5,r:0.45};E.suction=R=>90*(R.mdot/77);
  E.stream({name:'flow',st:[[-0.5,0,0.45,R=>R.vIn,R=>R.Tt0],[0.0,0.2,0.455,R=>R.vIn,R=>R.Tt0],[1.4,0.3,0.405,R=>R.vIn*0.85,R=>R.Tt3],[1.5,0.3,0.53,R=>40+40*R.N,R=>R.Tt3],[2.06,0.3,0.5,R=>60+80*R.N,R=>R.Tt4],[2.12,0.3,0.465,R=>90+100*R.N,R=>R.Tt4],[2.5,0.29,0.475,R=>180+150*R.N,R=>R.Tt5],[2.9,0.15,0.475,R=>120+90*R.N,R=>R.Tt5],[3.82,0.0,0.47,R=>150+100*R.N+150*R.ab,R=>R.Tt7],[4.28,0,0.34,R=>R.v9,R=>R.T9],[7.5,0,0.62,R=>R.v9*0.6+R.V0*0.4,R=>lerp(R.T9,R.T0,0.5)],[10,0,0.85,R=>R.v9*0.35+R.V0*0.65,R=>lerp(R.T9,R.T0,0.8)]]});
  E.spawn={x0:-6,x1:9,r:2.3};
  E.table=[['Toma de aire',R=>R.Tt0],['Compresor (salida)',R=>R.Tt3],['Cámara de combustión (TIT)',R=>R.Tt4],['Turbina (EGT)',R=>R.Tt5],['Postquemador',R=>R.Tt7],['Chorro de salida',R=>R.T9]];
  E.readouts=R=>[['Régimen',fmt(R.rpm.N),'rpm'],['Empuje',fmt(R.F/1000,1),'kN'],['Flujo de aire',fmt(R.mdot),'kg/s'],['Rel. presiones',fmt(R.OPR,1),':1'],['EGT',fmt(R.Tt5-273.15),'°C'],['Chorro',fmt(R.v9),'m/s'],['Postquemador',R.ab>0?fmt(R.ab*100)+' %':'apagado',''],['Velocidad',fmt(R.V0*3.6),'km/h']];
  E.cam={pos:[-3.2,1.9,5.8],target:[1.9,0,0]};
  return E;
}

export {buildTurbojet};
