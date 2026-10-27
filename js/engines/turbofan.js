/* High-bypass turbofan, two spools (N1 / N2) */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {Engine,annularBody} from '../core/engine.js';
import {MAT} from '../core/materials.js';
import {lathe,cylX,tubeX,ringX,torusX,box,merge,bladeRow,radialArray,extrudeZ,profileAt} from '../core/geometry.js';
import {flameTube} from '../core/flame.js';
import {shockMat,shockAngle,machAfter} from '../core/shocks.js';
import {PLANE_Z} from '../core/cuts.js';
import {lerp,smooth,fmt,DEG} from '../core/utils.js';

function buildTurbofan(){
  const E=new Engine('turbofan');E.T0=288.15;E.spool('N1');E.spool('N2');
  const nac=[[-0.62,1.03],[-0.52,1.11],[-0.3,1.16],[0.4,1.21],[1.4,1.2],[2.1,1.08],[2.45,0.93],[2.45,0.87],[2.0,0.9],[1.3,0.955],[0.5,0.985],[0.1,1.0],[-0.2,1.0],[-0.45,0.985],[-0.56,1.0],[-0.62,1.03]];
  E.part(new THREE.Mesh(lathe(nac,96),MAT.paint),{name:'Góndola y toma de aire',desc:'Carcasa exterior. El labio redondeado acelera el aire hacia el fan sin desprendimientos, incluso con el avión parado.',T:R=>R.Tt0,casing:true});
  E.part(new THREE.Mesh(tubeX(-0.2,0.28,0.995,96),MAT.carbon),{name:'Carcasa de contención del fan',desc:'Anillo de kevlar/aluminio que retiene un álabe si se desprende.',T:R=>R.Tt0,casing:true});
  E.part(new THREE.Mesh(lathe([[-0.5,0],[-0.44,0.06],[-0.32,0.14],[-0.16,0.21],[0.0,0.25],[0.14,0.262]]),MAT.paint),{name:'Cono (spinner)',desc:'Gira con el fan (N1). Guía el aire hacia la raíz de los álabes y evita que se acumule hielo.',T:R=>R.Tt0,spool:'N1'});
  E.rotorRow({x:0.04,n:22,hub:0.25,tip:0.985,chord:0.3,chordTip:0.36,stag:30,stagTip:62,camber:0.07,thick:0.05,sweep:0.12,mat:MAT.composite,spool:'N1'},{name:'Fan (N1)',desc:'22 álabes de cuerda ancha en composite de carbono con borde de ataque de titanio. Mueve ~90 % del aire y genera la mayor parte del empuje.',T:R=>(R.Tt0+R.Tt13)/2});
  E.part(new THREE.Mesh(lathe([[0.14,0.262],[0.3,0.265],[0.42,0.27],[0.95,0.31],[1.0,0.29],[1.0,0.1]]),MAT.titanium),{name:'Tambor del compresor de baja (N1)',desc:'Soporta los álabes rotores del booster y transmite el par del eje de baja.',T:R=>(R.Tt13+R.Tt25)/2,spool:'N1'});
  E.part(bladeRow({x:0.62,n:50,hub:0.455,tip:0.98,chord:0.16,stag:-20,camber:0.05,thick:0.05,mat:MAT.titanium}),{name:'Álabes guía de salida (OGV)',desc:'Enderezan el flujo del fan (eliminan el giro) y sostienen estructuralmente el núcleo dentro de la góndola.',T:R=>R.Tt13});
  const cowl=[[0.3,0.42],[0.45,0.47],[0.8,0.51],[1.4,0.55],[2.0,0.575],[2.6,0.59],[3.1,0.585],[3.5,0.54],[3.92,0.455],[3.92,0.44],[3.5,0.525],[3.1,0.57],[2.6,0.575],[2.0,0.56],[1.4,0.535],[0.8,0.495],[0.45,0.455],[0.3,0.42]];
  E.part(new THREE.Mesh(lathe(cowl,96),MAT.steel),{name:'Carenado del núcleo',desc:'Separa el flujo de derivación (bypass) del que entra al núcleo. Relación de derivación ≈ 8:1.',T:R=>R.Tt13,casing:true});
  E.part(new THREE.Mesh(lathe([[0.32,0.425],[0.6,0.41],[0.96,0.385]]),MAT.steel),{name:'Carcasa del compresor de baja',desc:'Tres etapas de booster acopladas al fan (N1).',T:R=>(R.Tt13+R.Tt25)/2,casing:true});
  for(let i=0;i<3;i++){const x=0.42+0.17*i,hub=0.27+0.013*i,tip=0.42-0.012*i;const Tf=R=>lerp(R.Tt13,R.Tt25,(i+0.5)/3);
    E.rotorRow({x,n:36+6*i,hub,tip,chord:0.09,stag:40,camber:0.07,thick:0.07,mat:MAT.titanium,spool:'N1'},{name:`Compresor de baja, rotor ${i+1} (N1)`,desc:'Etapa de booster: añade presión antes del compresor de alta.',T:Tf});
    E.part(bladeRow({x:x+0.085,n:44+6*i,hub:hub+0.004,tip,chord:0.08,stag:-34,camber:0.06,thick:0.07,mat:MAT.titanium}),{name:`Compresor de baja, estátor ${i+1}`,desc:'Álabes fijos: convierten la velocidad del rotor en presión y reorientan el aire.',T:Tf});}
  E.part(new THREE.Mesh(lathe([[0.97,0.385],[1.1,0.36],[1.85,0.27]]),MAT.steel),{name:'Carcasa del compresor de alta',desc:'Nueve etapas; el área se reduce porque el aire se comprime (hasta 40:1 en total).',T:R=>(R.Tt25+R.Tt3)/2,casing:true});
  E.part(new THREE.Mesh(lathe([[0.98,0.255],[1.3,0.245],[1.85,0.225],[1.9,0.2],[1.9,0.11]]),MAT.titanium),{name:'Tambor del compresor de alta (N2)',desc:'Gira a más de 10 000 rpm movido por la turbina de alta.',T:R=>(R.Tt25+R.Tt3)/2,spool:'N2'});
  for(let i=0;i<9;i++){const x=1.05+0.085*i,tip=lerp(0.365,0.28,i/8),hub=lerp(0.255,0.228,i/8);const Tf=R=>lerp(R.Tt25,R.Tt3,(i+0.5)/9);const mat=i<5?MAT.titanium:MAT.inconel;
    E.rotorRow({x,n:42+5*i,hub,tip,chord:0.05,chordTip:0.045,stag:44,camber:0.06,thick:0.08,mat,spool:'N2'},{name:`Compresor de alta, rotor ${i+1} (N2)`,desc:i<5?'Etapa de titanio.':'Etapas finales en aleación de níquel: el aire ya supera los 500 °C.',T:Tf});
    E.part(bladeRow({x:x+0.042,n:50+5*i,hub:hub+0.003,tip,chord:0.045,stag:-38,camber:0.06,thick:0.08,mat}),{name:`Compresor de alta, estátor ${i+1}`,desc:'Álabes fijos (algunos de geometría variable) que evitan la entrada en pérdida.',T:Tf});}
  E.part(new THREE.Mesh(cylX(-0.1,3.45,0.06,0.06,24),MAT.titanium),{name:'Eje de baja (N1)',desc:'Une fan y booster con la turbina de baja. Pasa por dentro del eje de alta.',T:R=>R.Tt25,spool:'N1'});
  E.part(new THREE.Mesh(tubeX(1.0,2.62,0.1,24),MAT.steel),{name:'Eje de alta (N2)',desc:'Eje hueco concéntrico: une compresor y turbina de alta.',T:R=>R.Tt3,spool:'N2'});
  E.part(new THREE.Mesh(lathe([[1.85,0.28],[1.9,0.36],[1.98,0.43],[2.3,0.435],[2.38,0.41],[2.4,0.395]]),MAT.steel),{name:'Carcasa de la cámara de combustión',desc:'Contiene el aire a 40 atmósferas; el difusor previo lo frena para que la llama se mantenga.',T:R=>R.Tt3,casing:true});
  E.part(new THREE.Mesh(lathe([[1.9,0.205],[2.0,0.2],[2.36,0.215],[2.4,0.24]]),MAT.inconel),{name:'Carcasa interior de la cámara',desc:'',T:R=>R.Tt3,casing:true});
  E.part(new THREE.Mesh(tubeX(1.97,2.36,0.375,72),MAT.inconel),{name:'Camisa de la cámara (anular)',desc:'Chapa perforada de aleación de níquel refrigerada por película: dentro arde el combustible a más de 1 800 °C, por eso el metal no se funde.',T:R=>lerp(R.Tt3,R.Tt4,0.5),casing:true,glow:true});
  E.part(new THREE.Mesh(tubeX(1.97,2.36,0.255,72),MAT.inconel),{name:'Camisa interior de la cámara',desc:'',T:R=>lerp(R.Tt3,R.Tt4,0.5),casing:true,glow:true});
  E.part(new THREE.Mesh(ringX(1.97,0.255,0.375,72),MAT.inconel),{name:'Cúpula de la cámara',desc:'Pared frontal donde se montan los inyectores y los torbellinadores.',T:R=>R.Tt3,casing:true});
  E.part(new THREE.Mesh(radialArray(()=>box(0.14,0.03,0.03,1.9,0.315,0),20),MAT.gold),{name:'Inyectores de combustible (20)',desc:'Pulverizan queroseno; el aire del compresor lo mezcla y lo quema.',T:R=>R.Tt3});
  E.part(new THREE.Mesh(torusX(1.86,0.315,0.012,72,8),MAT.gold),{name:'Colector de combustible',desc:'',T:R=>R.Tt3});
  for(const r of [0.282,0.315,0.348])E.flame(flameTube(1.99,2.36,r,r,'kerosene',{scale:1.6,seg:48}),R=>R.burn*0.9);
  E.part(new THREE.Mesh(tubeX(2.38,2.66,0.4,72),MAT.inconel),{name:'Carcasa de la turbina de alta',desc:'',T:R=>(R.Tt4+R.Tt45)/2,casing:true});
  E.part(bladeRow({x:2.42,n:44,hub:0.26,tip:0.385,chord:0.07,stag:-50,camber:0.14,thick:0.1,mat:MAT.ceramic}),{name:'Álabes guía de turbina de alta (NGV 1)',desc:'Reciben el gas más caliente del motor. Monocristal de níquel con barrera térmica cerámica y refrigeración interna.',T:R=>R.Tt4});
  E.rotorRow({x:2.48,n:72,hub:0.26,tip:0.385,chord:0.055,stag:42,camber:0.12,thick:0.1,mat:MAT.ceramic,spool:'N2'},{name:'Turbina de alta, etapa 1 (N2)',desc:'Extrae energía del gas para mover el compresor de alta.',T:R=>lerp(R.Tt4,R.Tt45,0.3)});
  E.part(bladeRow({x:2.54,n:50,hub:0.26,tip:0.39,chord:0.065,stag:-48,camber:0.13,thick:0.1,mat:MAT.ceramic}),{name:'Álabes guía de turbina de alta (NGV 2)',desc:'',T:R=>lerp(R.Tt4,R.Tt45,0.55)});
  E.rotorRow({x:2.6,n:80,hub:0.26,tip:0.39,chord:0.055,stag:40,camber:0.12,thick:0.1,mat:MAT.inconel,spool:'N2'},{name:'Turbina de alta, etapa 2 (N2)',desc:'',T:R=>lerp(R.Tt4,R.Tt45,0.85)});
  E.part(new THREE.Mesh(lathe([[2.42,0.12],[2.44,0.25],[2.63,0.26],[2.65,0.12]]),MAT.inconel),{name:'Discos de turbina de alta (N2)',desc:'',T:R=>R.Tt45,spool:'N2'});
  E.part(new THREE.Mesh(lathe([[2.66,0.40],[3.0,0.46],[3.38,0.515]]),MAT.inconel),{name:'Carcasa de la turbina de baja',desc:'Cinco etapas de diámetro creciente: el gas se expande y pierde presión.',T:R=>(R.Tt45+R.Tt5)/2,casing:true});
  for(let i=0;i<5;i++){const x=2.72+0.125*i,tip=lerp(0.41,0.5,i/4),hub=lerp(0.28,0.3,i/4);
    E.part(bladeRow({x,n:56,hub,tip,chord:0.06,stag:-46,camber:0.12,thick:0.09,mat:MAT.ceramic}),{name:`Turbina de baja, estátor ${i+1}`,desc:'',T:R=>lerp(R.Tt45,R.Tt5,i/5)});
    E.rotorRow({x:x+0.062,n:84+8*i,hub,tip,chord:0.055,stag:40,camber:0.1,thick:0.09,mat:MAT.inconel,spool:'N1'},{name:`Turbina de baja, etapa ${i+1} (N1)`,desc:'Mueve el fan y el booster a través del eje de baja.',T:R=>lerp(R.Tt45,R.Tt5,(i+0.6)/5)});}
  E.part(new THREE.Mesh(lathe([[2.66,0.1],[2.68,0.27],[3.38,0.3],[3.42,0.25],[3.42,0.1]]),MAT.inconel),{name:'Discos de turbina de baja (N1)',desc:'',T:R=>R.Tt5,spool:'N1'});
  E.part(new THREE.Mesh(lathe([[3.38,0.515],[3.6,0.49],[3.92,0.44]]),MAT.inconel),{name:'Tobera del núcleo',desc:'Acelera el gas caliente hasta ~450 m/s.',T:R=>R.Tt5,casing:true});
  E.part(new THREE.Mesh(lathe([[3.4,0.26],[3.8,0.21],[4.1,0.12],[4.42,0.0]]),MAT.inconel),{name:'Cono de cola',desc:'Suaviza la expansión del chorro del núcleo.',T:R=>R.Tt5});
  E.part(new THREE.Mesh(radialArray(()=>box(0.08,0.24,0.025,3.4,0.385,0),6),MAT.inconel),{name:'Bastidor trasero de turbina',desc:'Seis puntales que sostienen el cojinete trasero.',T:R=>R.Tt5});
  E.part(new THREE.Mesh(box(0.55,0.2,0.4,0.9,-0.75,0),MAT.dark),{name:'Caja de accesorios',desc:'Movida por el eje de alta: bombas de combustible y aceite, generador y arrancador.',T:R=>R.T0+20});
  E.part(new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.42,12).translate(0.62,-0.5,0),MAT.steel),{name:'Eje de accesorios',desc:'',T:R=>R.T0+20});
  annularBody(E,[[-0.62,1.03],[-0.3,1.16],[0.4,1.21],[1.4,1.2],[2.1,1.08],[2.45,0.93],[2.46,0.59],[3.1,0.585],[3.5,0.54],[3.92,0.455],[3.93,0.26],[4.42,0.0]]);
  E.capture={x:-0.56,r:0.985};E.suction=R=>170*(R.mdot/1150);
  E.stream({name:'inlet',st:[[-0.56,0.0,0.985,R=>R.vIn*0.85,R=>R.Tt0],[-0.3,0.14,0.985,R=>R.vIn,R=>R.Tt0],[0.0,0.25,0.985,R=>R.vIn,R=>R.Tt0],[0.3,0.25,0.985,R=>R.vFan,R=>R.Tt13]],
    next:(i,F,E)=>{const rho=F.rho[i],sp=0.232;if(rho<sp){F.S[i]=1;F.rho[i]=rho/sp;}else{F.S[i]=2;F.rho[i]=(rho-sp)/(1-sp);}F.seg[i]=0;F.P[i*3]=0.3001;}});
  E.stream({name:'core',st:[[0.3,0.25,0.42,R=>R.vFan,R=>R.Tt13],[0.96,0.3,0.385,R=>R.vFan*0.9,R=>R.Tt25],[1.85,0.228,0.275,R=>R.vFan*0.8,R=>R.Tt3],[1.97,0.255,0.375,R=>45+40*R.N1,R=>R.Tt3],[2.36,0.26,0.375,R=>90+90*R.N1,R=>R.Tt4],[2.66,0.27,0.395,R=>200+180*R.N1,R=>R.Tt45],[3.38,0.3,0.5,R=>150+120*R.N1,R=>R.Tt5],[3.92,0.2,0.44,R=>R.v9,R=>R.T9],[4.42,0.0,0.46,R=>R.v9,R=>R.T9],[7.5,0.0,0.7,R=>R.v9*0.6+R.V0*0.4,R=>lerp(R.T9,R.T0,0.5)],[10,0,0.9,R=>R.v9*0.35+R.V0*0.65,R=>lerp(R.T9,R.T0,0.8)]]});
  E.stream({name:'bypass',st:[[0.3,0.42,0.985,R=>R.vFan,R=>R.Tt13],[0.62,0.455,0.98,R=>R.vFan*1.05,R=>R.Tt13],[1.5,0.55,0.95,R=>R.vFan*1.2,R=>R.Tt13],[2.45,0.575,0.87,R=>Math.max(R.v19,R.vFan*1.3),R=>R.T19],[3.9,0.46,0.9,R=>Math.max(R.v19,R.vFan*1.3),R=>R.T19],[7.5,0.3,1.1,R=>Math.max(R.v19,R.vFan)*0.7+R.V0*0.3,R=>lerp(R.T19,R.T0,0.5)],[10,0.0,1.3,R=>Math.max(R.v19,R.vFan)*0.4+R.V0*0.6,R=>lerp(R.T19,R.T0,0.8)]]});
  E.spawn={x0:-6,x1:9,r:2.4};
  E.table=[['Toma de aire',R=>R.Tt0],['Fan',R=>R.Tt13],['Compresor de baja',R=>R.Tt25],['Compresor de alta',R=>R.Tt3],['Cámara de combustión (TIT)',R=>R.Tt4],['Turbina de alta',R=>R.Tt45],['Turbina de baja (EGT)',R=>R.Tt5],['Chorro del núcleo',R=>R.T9],['Chorro de derivación',R=>R.T19]];
  E.readouts=R=>[['N1 (fan)',fmt(R.rpm.N1),'rpm'],['N2 (núcleo)',fmt(R.rpm.N2),'rpm'],['Empuje',fmt(R.F/1000),'kN'],['Flujo de aire',fmt(R.mdot),'kg/s'],['Rel. presiones',fmt(R.OPR,1),':1'],['EGT',fmt(R.Tt5-273.15),'°C'],['Chorro núcleo',fmt(R.v9),'m/s'],['Chorro bypass',fmt(R.v19),'m/s']];
  E.cam={pos:[-4.4,2.5,6.6],target:[1.7,0,0]};
  return E;
}

export {buildTurbofan};
