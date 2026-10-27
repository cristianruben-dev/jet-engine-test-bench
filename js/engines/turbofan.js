/* High-bypass turbofan, two spools (N1 / N2), variable stators, bleed valves, pylon */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {Engine,annularBody} from '../core/engine.js';
import {MAT} from '../core/materials.js';
import {lathe,latheShell,cylX,tubeX,ringX,torusX,box,merge,bladeRow,radialArray,boltRing,extrudeZ,profileAt} from '../core/geometry.js';
import {flameTube} from '../core/flame.js';
import {panelTexture,holesTexture,coolingTexture} from '../core/textures.js';
import {lerp,smooth,clamp,fmt,DEG} from '../core/utils.js';

function buildTurbofan(){
  const E=new Engine('turbofan');E.T0=288.15;E.spool('N1');E.spool('N2');E.center=[1.8,0,0];
  const paint=MAT.paint.clone();paint.map=panelTexture();paint.color.set(0xd0d4d9);
  /* the nacelle is split at x=1.45: a fixed forward cowl and the translating sleeve of the thrust reverser */
  const nac=[[-0.62,1.03],[-0.52,1.11],[-0.3,1.16],[0.4,1.21],[1.4,1.2],[1.45,1.191],[1.45,0.943],[1.3,0.955],[0.5,0.985],[0.1,1.0],[-0.2,1.0],[-0.45,0.985],[-0.56,1.0],[-0.62,1.03]];
  E.part(new THREE.Mesh(lathe(nac,96),paint),{name:'Góndola y toma de aire',desc:'Carcasa exterior con paneles remachados y puertas de acceso. El labio redondeado acelera el aire hacia el fan sin desprendimientos, incluso con el avión parado.',at:'in',casing:true,solid:true});
  const sleeve=new THREE.Mesh(lathe([[1.45,1.191],[2.1,1.08],[2.45,0.93],[2.45,0.87],[2.0,0.9],[1.45,0.943],[1.45,1.191]],96),paint);sleeve.frustumCulled=false;
  E.part(sleeve,{name:'Manguito del inversor de empuje',desc:'Parte trasera de la góndola. Al desplegar el inversor se desplaza hacia atrás: descubre las cascadas y arrastra las compuertas que cierran el conducto de derivación.',at:'fan',casing:true,solid:true});
  E.part(new THREE.Mesh(merge([0,1,2].map(k=>radialArray(()=>{const g=box(0.028,0.17,0.075,0,0,0);g.rotateZ(-38*DEG);g.translate(1.56+0.11*k,1.065,0);return g;},40))),MAT.titanium),{name:'Cascadas del inversor',desc:'Tres anillos de álabes fijos inclinados hacia delante, ocultos dentro de la góndola. Cuando el manguito retrocede, el aire de derivación sale por ellos hacia delante y frena el avión en pista.',at:'fan'});
  const doors=new THREE.InstancedMesh(box(0.3,0.012,0.24,-0.15,0,0),MAT.steel,10);
  E.part(doors,{name:'Compuertas de bloqueo (10)',desc:'Articuladas en el borde trasero del manguito: al desplegar el inversor giran hacia dentro, cierran el conducto de derivación y desvían el aire del fan hacia las cascadas.',at:'fan'});
  let sx=0;const md=new THREE.Matrix4(),mdr=new THREE.Matrix4(),mdt=new THREE.Matrix4(),mdz=new THREE.Matrix4();
  E.hooks.push((R)=>{const target=(R.rev||0)*0.42;if(Math.abs(target-sx)>0.002){sleeve.geometry.translate(target-sx,0,0);sx=target;}
    const ang=(R.rev||0)*64*DEG;for(let i=0;i<10;i++){mdr.makeRotationX(i/10*Math.PI*2);mdt.makeTranslation(2.34+sx,0.915,0);mdz.makeRotationZ(ang);md.copy(mdr).multiply(mdt).multiply(mdz);doors.setMatrixAt(i,md);}doors.instanceMatrix.needsUpdate=true;});
  E.part(new THREE.Mesh(latheShell([[-0.2,0.992],[0.28,0.992]],0.012,96),MAT.carbon),{name:'Carcasa de contención del fan',desc:'Anillo de kevlar/aluminio que retiene un álabe si se desprende.',at:'in',casing:true,solid:true});
  E.part(new THREE.Mesh(extrudeZ([[0.8,1.19],[2.3,1.05],[2.8,1.5],[1.3,1.5]],0.26,-0.13),MAT.paint),{name:'Pilón de anclaje al ala',desc:'Transmite el empuje al ala y lleva dentro los conductos de combustible, sangrado y cableado.',at:'amb'});
  E.part(new THREE.Mesh(lathe([[-0.5,0],[-0.44,0.06],[-0.32,0.14],[-0.16,0.21],[0.0,0.25],[0.14,0.262]]),MAT.paint),{name:'Cono (spinner)',desc:'Gira con el fan (N1). Guía el aire hacia la raíz de los álabes y evita que se acumule hielo.',at:'in',spool:'N1'});
  E.rotorRow({x:0.04,n:22,hub:0.25,tip:0.985,chord:0.3,chordTip:0.36,stag:30,stagTip:62,camber:0.07,thick:0.05,sweep:0.12,mat:MAT.composite,spool:'N1'},{name:'Fan (N1)',desc:'22 álabes de cuerda ancha en composite de carbono con borde de ataque de titanio. Mueve ~90 % del aire y genera la mayor parte del empuje.',at:['in','fan',0.5]});
  E.part(new THREE.Mesh(lathe([[0.14,0.262],[0.3,0.265],[0.42,0.27],[0.95,0.31],[1.0,0.29],[1.0,0.1]]),MAT.titanium),{name:'Tambor del compresor de baja (N1)',desc:'Soporta los álabes rotores del booster y transmite el par del eje de baja.',at:['fan','lpc',0.5],spool:'N1'});
  E.part(bladeRow({x:0.62,n:50,hub:0.455,tip:0.98,chord:0.16,stag:-20,camber:0.05,thick:0.05,mat:MAT.titanium}),{name:'Álabes guía de salida (OGV)',desc:'Enderezan el flujo del fan (eliminan el giro) y sostienen estructuralmente el núcleo dentro de la góndola.',at:'fan'});
  const cowl=[[0.3,0.42],[0.45,0.47],[0.8,0.51],[1.4,0.55],[2.0,0.575],[2.6,0.59],[3.1,0.585],[3.5,0.54],[3.92,0.455],[3.92,0.44],[3.5,0.525],[3.1,0.57],[2.6,0.575],[2.0,0.56],[1.4,0.535],[0.8,0.495],[0.45,0.455],[0.3,0.42]];
  E.part(new THREE.Mesh(lathe(cowl,96),MAT.steel),{name:'Carenado del núcleo',desc:'Separa el flujo de derivación (bypass) del que entra al núcleo. Relación de derivación ≈ 8:1.',at:'fan',casing:true,solid:true});
  E.part(new THREE.Mesh(latheShell([[0.32,0.425],[0.6,0.41],[0.96,0.385]]),MAT.steel),{name:'Carcasa del compresor de baja',desc:'Tres etapas de booster acopladas al fan (N1).',at:['fan','lpc',0.5],casing:true,solid:true});
  for(let i=0;i<3;i++){const x=0.42+0.17*i,hub=0.27+0.013*i,tip=0.42-0.012*i;const at=['fan','lpc',(i+0.5)/3];
    E.rotorRow({x,n:36+6*i,hub,tip,chord:0.09,stag:40,camber:0.07,thick:0.07,mat:MAT.titanium,spool:'N1'},{name:`Compresor de baja, rotor ${i+1} (N1)`,desc:'Etapa de booster: añade presión antes del compresor de alta.',at});
    E.part(bladeRow({x:x+0.085,n:44+6*i,hub:hub+0.004,tip,chord:0.08,stag:-34,camber:0.06,thick:0.07,mat:MAT.titanium}),{name:`Compresor de baja, estátor ${i+1}`,desc:'Álabes fijos: convierten la velocidad del rotor en presión y reorientan el aire.',at});}
  const hpcCase=[[0.97,0.385],[1.1,0.36],[1.85,0.27]];
  E.part(new THREE.Mesh(latheShell(hpcCase),MAT.steel),{name:'Carcasa del compresor de alta',desc:'Nueve etapas; el área se reduce porque el aire se comprime (hasta 40:1 en total).',at:['lpc','hpc',0.5],casing:true,solid:true});
  E.part(new THREE.Mesh(lathe([[0.98,0.255],[1.3,0.245],[1.85,0.225],[1.9,0.2],[1.9,0.11]]),MAT.titanium),{name:'Tambor del compresor de alta (N2)',desc:'Gira a más de 10 000 rpm movido por la turbina de alta.',at:['lpc','hpc',0.5],spool:'N2'});
  const vsvOpen=R=>clamp((1-R.N2)/0.38,0,1)*22;const rings=[];
  for(let i=0;i<9;i++){const x=1.05+0.085*i,tip=lerp(0.365,0.28,i/8),hub=lerp(0.255,0.228,i/8);const at=['lpc','hpc',(i+0.5)/9];const mat=i<5?MAT.titanium:MAT.inconel;
    E.rotorRow({x,n:42+5*i,hub,tip,chord:0.05,chordTip:0.045,stag:44,camber:0.06,thick:0.08,mat,spool:'N2'},{name:`Compresor de alta, rotor ${i+1} (N2)`,desc:i<5?'Etapa de titanio.':'Etapas finales en aleación de níquel: el aire ya supera los 500 °C.',at});
    const row={x:x+0.042,n:50+5*i,hub:hub+0.003,tip,chord:0.045,stag:-38,camber:0.06,thick:0.08,mat};
    if(i<4){E.vsvRow(row,{name:`Estátor de geometría variable ${i+1} (VSV)`,desc:'Álabes fijos que pivotan sobre su eje radial: a bajo régimen se cierran para alejar las primeras etapas de la pérdida; se abren al acelerar. Mira cómo giran al mover el gas.',at},vsvOpen);
      const rc=profileAt(hpcCase,row.x)+0.03;rings.push(torusX(row.x,rc,0.011,72,8),radialArray(()=>box(0.016,0.05,0.014,row.x,rc-0.02,0),14));}
    else E.part(bladeRow(row),{name:`Compresor de alta, estátor ${i+1}`,desc:'Álabes fijos que evitan la entrada en pérdida.',at});}
  E.part(new THREE.Mesh(merge(rings),MAT.steel),{name:'Anillos de mando de los VSV',desc:'Cuatro anillos de unísono movidos por actuadores hidráulicos: giran a la vez todos los álabes variables de cada etapa.',at:['lpc','hpc',0.25]});
  /* bleed valves: open at low N2 */
  const rb=profileAt(hpcCase,1.42)+0.02;
  E.part(new THREE.Mesh(radialArray(()=>box(0.1,0.03,0.09,1.42,rb,0),3),MAT.dark),{name:'Válvulas de sangrado (3)',desc:'Abiertas a bajo régimen descargan aire del compresor al conducto de derivación para alejarlo de la línea de bombeo; se cierran por encima del 85 % de N2. Mira la compuerta al mover el gas.',at:['lpc','hpc',0.5]});
  const flaps=new THREE.InstancedMesh(box(0.09,0.008,0.08,0.045,0.004,0),MAT.steel,3);
  E.part(flaps,{name:'Compuertas de sangrado',desc:'',at:['lpc','hpc',0.5],pick:false});
  const m4=new THREE.Matrix4(),mr=new THREE.Matrix4(),mt=new THREE.Matrix4(),mz=new THREE.Matrix4();let flap=0;
  E.hooks.push((R,dt)=>{const target=(1-smooth(0.72,0.9,R.N2))*55*DEG;flap+=(target-flap)*Math.min(1,dt*3);for(let i=0;i<3;i++){mr.makeRotationX(i/3*Math.PI*2);mt.makeTranslation(1.375,rb+0.02,0);mz.makeRotationZ(flap);m4.copy(mr).multiply(mt).multiply(mz);flaps.setMatrixAt(i,m4);}flaps.instanceMatrix.needsUpdate=true;});
  E.part(new THREE.Mesh(cylX(-0.1,3.45,0.06,0.06,24),MAT.titanium),{name:'Eje de baja (N1)',desc:'Une fan y booster con la turbina de baja. Pasa por dentro del eje de alta.',at:'lpc',spool:'N1'});
  E.part(new THREE.Mesh(tubeX(1.0,2.62,0.1,24),MAT.steel),{name:'Eje de alta (N2)',desc:'Eje hueco concéntrico: une compresor y turbina de alta.',at:'hpc',spool:'N2'});
  E.part(new THREE.Mesh(latheShell([[1.85,0.28],[1.9,0.36],[1.98,0.43],[2.3,0.435],[2.38,0.41],[2.4,0.395]]),MAT.steel),{name:'Carcasa de la cámara de combustión',desc:'Contiene el aire a 40 atmósferas; el difusor previo lo frena para que la llama se mantenga.',at:'hpc',casing:true,solid:true});
  E.part(new THREE.Mesh(latheShell([[1.9,0.205],[2.0,0.2],[2.36,0.215],[2.4,0.24]]),MAT.inconel),{name:'Carcasa interior de la cámara',desc:'',at:'hpc',casing:true,solid:true});
  const liner=MAT.inconel.clone();liner.alphaMap=holesTexture();liner.alphaTest=0.5;
  E.part(new THREE.Mesh(tubeX(1.97,2.36,0.375,72),liner),{name:'Camisa de la cámara (anular)',desc:'Chapa perforada de aleación de níquel: por los orificios primarios entra el aire de combustión y por los de dilución el que enfría el gas antes de la turbina. Una película de aire sobre la chapa la mantiene 500 °C por debajo de la llama.',at:['hpc','comb',0.5],cool:0.45,casing:true,glow:true});
  E.part(new THREE.Mesh(tubeX(1.97,2.36,0.255,72),liner),{name:'Camisa interior de la cámara',desc:'',at:['hpc','comb',0.5],cool:0.45,casing:true,glow:true});
  E.part(new THREE.Mesh(ringX(1.97,0.255,0.375,72),MAT.inconel),{name:'Cúpula de la cámara',desc:'Pared frontal donde se montan los inyectores y los torbellinadores.',at:'hpc',casing:true});
  E.part(new THREE.Mesh(radialArray(()=>box(0.14,0.03,0.03,1.9,0.315,0),20),MAT.gold),{name:'Inyectores de combustible (20)',desc:'Pulverizan queroseno; el aire del compresor lo mezcla y lo quema.',at:'hpc'});
  E.part(new THREE.Mesh(torusX(1.86,0.315,0.012,72,8),MAT.gold),{name:'Colector de combustible',desc:'',at:'hpc'});
  for(const r of [0.282,0.315,0.348])E.flame(flameTube(1.99,2.36,r,r,'kerosene',{scale:1.6,seg:48}),R=>R.burn*0.9);
  E.part(new THREE.Mesh(latheShell([[2.38,0.4],[2.66,0.4]]),MAT.inconel),{name:'Carcasa de la turbina de alta',desc:'',at:['comb','hpt',0.5],casing:true,solid:true});
  const cooled=MAT.ceramic.clone();cooled.map=coolingTexture();
  E.part(bladeRow({x:2.42,n:44,hub:0.26,tip:0.385,chord:0.07,stag:-50,camber:0.14,thick:0.1,mat:cooled}),{name:'Álabes guía de turbina de alta (NGV 1)',desc:'Reciben el gas más caliente del motor, por encima del punto de fusión de su aleación. Sobreviven gracias a cientos de orificios de refrigeración por película, una barrera térmica cerámica y aire del compresor por dentro.',at:'comb',cool:0.55});
  E.rotorRow({x:2.48,n:72,hub:0.26,tip:0.385,chord:0.055,stag:42,camber:0.12,thick:0.1,mat:cooled,spool:'N2'},{name:'Turbina de alta, etapa 1 (N2)',desc:'Extrae energía del gas para mover el compresor de alta. Monocristal de níquel refrigerado por dentro.',at:['comb','hpt',0.3],cool:0.45});
  E.part(bladeRow({x:2.54,n:50,hub:0.26,tip:0.39,chord:0.065,stag:-48,camber:0.13,thick:0.1,mat:MAT.ceramic}),{name:'Álabes guía de turbina de alta (NGV 2)',desc:'',at:['comb','hpt',0.55],cool:0.4});
  E.rotorRow({x:2.6,n:80,hub:0.26,tip:0.39,chord:0.055,stag:40,camber:0.12,thick:0.1,mat:MAT.inconel,spool:'N2'},{name:'Turbina de alta, etapa 2 (N2)',desc:'',at:['comb','hpt',0.85],cool:0.3});
  E.part(new THREE.Mesh(lathe([[2.42,0.12],[2.44,0.25],[2.63,0.26],[2.65,0.12]]),MAT.inconel),{name:'Discos de turbina de alta (N2)',desc:'',at:'hpt',cool:0.5,spool:'N2'});
  E.part(new THREE.Mesh(latheShell([[2.66,0.40],[3.0,0.46],[3.38,0.515]]),MAT.inconel),{name:'Carcasa de la turbina de baja',desc:'Cinco etapas de diámetro creciente: el gas se expande y pierde presión.',at:['hpt','lpt',0.5],casing:true,solid:true});
  for(let i=0;i<5;i++){const x=2.72+0.125*i,tip=lerp(0.41,0.5,i/4),hub=lerp(0.28,0.3,i/4);
    E.part(bladeRow({x,n:56,hub,tip,chord:0.06,stag:-46,camber:0.12,thick:0.09,mat:MAT.ceramic}),{name:`Turbina de baja, estátor ${i+1}`,desc:'',at:['hpt','lpt',i/5],cool:i===0?0.15:0});
    E.rotorRow({x:x+0.062,n:84+8*i,hub,tip,chord:0.055,stag:40,camber:0.1,thick:0.09,mat:MAT.inconel,spool:'N1'},{name:`Turbina de baja, etapa ${i+1} (N1)`,desc:'Mueve el fan y el booster a través del eje de baja.',at:['hpt','lpt',(i+0.6)/5],cool:i===0?0.12:0});}
  E.part(new THREE.Mesh(lathe([[2.66,0.1],[2.68,0.27],[3.38,0.3],[3.42,0.25],[3.42,0.1]]),MAT.inconel),{name:'Discos de turbina de baja (N1)',desc:'',at:'lpt',spool:'N1'});
  E.part(new THREE.Mesh(latheShell([[3.38,0.515],[3.6,0.49],[3.92,0.44]]),MAT.inconel),{name:'Tobera del núcleo',desc:'Acelera el gas caliente hasta ~450 m/s.',at:'lpt',casing:true,solid:true});
  E.part(new THREE.Mesh(lathe([[3.4,0.26],[3.8,0.21],[4.1,0.12],[4.42,0.0]]),MAT.inconel),{name:'Cono de cola',desc:'Suaviza la expansión del chorro del núcleo.',at:'lpt'});
  E.part(new THREE.Mesh(radialArray(()=>box(0.08,0.24,0.025,3.4,0.385,0),6),MAT.inconel),{name:'Bastidor trasero de turbina',desc:'Seis puntales que sostienen el cojinete trasero.',at:'lpt'});
  E.part(new THREE.Mesh(merge([boltRing(0.97,0.405),boltRing(1.86,0.3),boltRing(2.38,0.415),boltRing(2.66,0.415),boltRing(3.38,0.53)]),MAT.steel),{name:'Bridas atornilladas',desc:'Uniones entre módulos: el motor se desmonta por módulos para el mantenimiento.',at:['lpc','lpt',0.5]});
  E.part(new THREE.Mesh(box(0.55,0.2,0.4,0.9,-0.75,0),MAT.dark),{name:'Caja de accesorios',desc:'Movida por el eje de alta: bombas de combustible y aceite, generador y arrancador neumático. Durante el arranque el flujo va al revés: el arrancador mueve el N2.',at:'amb',T:R=>R.T0+20});
  E.part(new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.42,12).translate(0.62,-0.5,0),MAT.steel),{name:'Eje de accesorios',desc:'',at:'amb',T:R=>R.T0+20});
  annularBody(E,[[-0.62,1.03],[-0.3,1.16],[0.4,1.21],[1.4,1.2],[2.1,1.08],[2.45,0.93],[2.46,0.59],[3.1,0.585],[3.5,0.54],[3.92,0.455],[3.93,0.26],[4.42,0.0]]);
  E.capture={x:-0.56,r:0.985};
  E.stream({name:'inlet',pmap:[[-0.56,'in'],[0.3,'fan']],st:[[-0.56,0.0,0.985,R=>R.vIn*0.85,R=>R.Tt0],[-0.3,0.14,0.985,R=>R.vIn,R=>R.Tt0],[0.0,0.25,0.985,R=>R.vIn,R=>R.Tt0],[0.3,0.25,0.985,R=>R.vFan,R=>R.Tt13]],
    next:(i,F,E)=>{const rho=F.rho[i],sp=0.232;if(rho<sp){F.S[i]=1;F.rho[i]=rho/sp;}else{F.S[i]=2;F.rho[i]=(rho-sp)/(1-sp);}F.seg[i]=0;F.P[i*3]=0.3001;}});
  E.stream({name:'core',jet:3.92,pmap:[[0.3,'fan'],[0.96,'lpc'],[1.85,'hpc'],[1.97,'hpc'],[2.36,'comb'],[2.66,'hpt'],[3.38,'lpt'],[3.92,'noz']],st:[[0.3,0.25,0.42,R=>R.vFan,R=>R.Tt13],[0.96,0.3,0.385,R=>R.vFan*0.9,R=>R.Tt25],[1.85,0.228,0.275,R=>R.vFan*0.8,R=>R.Tt3],[1.97,0.255,0.375,R=>(45+40*R.N1)*R.q,R=>R.Tt3],[2.36,0.26,0.375,R=>(90+90*R.N1)*R.q,R=>R.Tt4],[2.66,0.27,0.395,R=>(200+180*R.N1)*R.q,R=>R.Tt45],[3.38,0.3,0.5,R=>(150+120*R.N1)*R.q,R=>R.Tt5],[3.92,0.2,0.44,R=>R.v9,R=>R.T9],[4.42,0.0,0.46,R=>R.v9,R=>R.T9],[7.5,0.0,0.7,R=>R.v9*0.6+R.V0*0.4,R=>lerp(R.T9,R.T0,0.5)],[10,0,0.9,R=>R.v9*0.35+R.V0*0.65,R=>lerp(R.T9,R.T0,0.8)]]});
  E.stream({name:'bypass',jet:2.45,divert:(x,R)=>(R.rev>0.5&&x>=1.95&&x<2.3)?3:-1,pmap:[[0.3,'fan'],[2.45,'fan'],[2.46,'byp']],st:[[0.3,0.42,0.985,R=>R.vFan,R=>R.Tt13],[0.62,0.455,0.98,R=>R.vFan*1.05,R=>R.Tt13],[1.5,0.55,0.95,R=>R.vFan*1.2,R=>R.Tt13],[2.45,0.575,0.87,R=>Math.max(R.v19,R.vFan*1.3),R=>R.T19],[3.9,0.46,0.9,R=>Math.max(R.v19,R.vFan*1.3),R=>R.T19],[7.5,0.3,1.1,R=>Math.max(R.v19,R.vFan)*0.7+R.V0*0.3,R=>lerp(R.T19,R.T0,0.5)],[10,0.0,1.3,R=>Math.max(R.v19,R.vFan)*0.4+R.V0*0.6,R=>lerp(R.T19,R.T0,0.8)]]});
  /* with the reverser deployed the bypass air leaves through the cascades, forward and outward, and is released as free air */
  E.stream({name:'reverser',release:true,jetBelow:1.6,pmap:[[0.9,'byp'],[1.95,'fan']],st:[[0.9,1.3,1.95,R=>-R.v19*0.55,R=>R.T19],[1.6,0.98,1.28,R=>-R.v19*0.6,R=>R.T19],[1.95,0.6,0.93,R=>-R.v19*0.45,R=>R.T19]]});
  E.spawn={x0:-6,x1:9,r:2.4};
  E.table=[['Toma de aire','in'],['Fan','fan'],['Compresor de baja','lpc'],['Compresor de alta','hpc'],['Cámara de combustión (TIT)','comb',0.45],['Turbina de alta','hpt',0.45],['Turbina de baja (EGT)','lpt',0.12],['Chorro del núcleo','noz'],['Chorro de derivación','byp']];
  E.readouts=R=>[['N1 (fan)',fmt(R.rpm.N1),'rpm'],['N2 (núcleo)',fmt(R.rpm.N2),'rpm'],['Empuje',fmt(R.F/1000),'kN'],['Flujo de aire',fmt(R.mdot),'kg/s'],['Combustible',fmt(R.Wf,2),'kg/s'],['Consumo esp.',fmt(R.TSFC*1e6,1),'g/kN·s'],['Rel. presiones',fmt(R.OPR,1),':1'],['EGT',fmt(R.Tt5-273.15),'°C'],['Rend. propulsivo',fmt(R.etaP*100),'%'],['Rend. térmico',fmt(R.etaT*100),'%'],['Chorro núcleo',fmt(R.v9),'m/s'],['Chorro bypass',fmt(R.v19),'m/s']];
  E.hud=[[0,'N1'],[1,'N2'],[2,'Empuje'],[7,'EGT']];
  E.stations=[['amb','0','Aire libre',-1.7,0.7],['in','2','Toma',-0.3,0.62],['fan','13','Tras el fan',0.5,0.78],['lpc','25','Booster',0.98,0.37],['hpc','3','Compresor alta',1.88,0.31],['comb','4','Cámara',2.18,0.34],['hpt','45','Turbina alta',2.66,0.34],['lpt','5','Turbina baja',3.38,0.44],['noz','9','Chorro núcleo',4.2,0.26],['byp','19','Chorro bypass',3.1,0.8]];
  E.cam={pos:[-4.4,2.5,6.6],target:[1.7,0,0]};
  E.tour=[
    {title:'Toma de aire',text:'El labio redondeado de la góndola acelera el aire sin desprendimientos. Parado y a plena potencia, el fan aspira aire incluso desde detrás del labio: ponte frente al motor con viento cero y mira las estelas.',cam:{pos:[-3.6,1.3,2.8],target:[0,0,0]},part:'Góndola'},
    {title:'Fan',text:'Veintidós álabes de composite mueven unas 1 150 kg/s de aire a plena potencia. Casi el 90 % rodea el núcleo por el conducto de derivación y sale por la tobera trasera: es el chorro lento y frío que da la mayor parte del empuje.',cam:{pos:[-2.0,1.4,2.5],target:[0.2,0,0]},part:'Fan (N1)'},
    {title:'Compresores',text:'Tres etapas de booster y nueve de alta elevan la presión más de 40 veces y la temperatura hasta 650 °C sin ninguna llama. Los estátores variables de las primeras etapas se cierran a bajo régimen.',cam:{pos:[0.3,1.2,2.2],target:[1.3,0,0]},part:'Estátor de geometría variable 1'},
    {title:'Cámara de combustión',text:'Veinte inyectores pulverizan queroseno en el aire comprimido. La llama supera los 1 800 °C, pero la camisa perforada se protege con una película de aire y queda unos 500 °C más fría.',cam:{pos:[1.4,1.0,1.9],target:[2.15,0,0]},part:'Camisa de la cámara (anular)'},
    {title:'Turbinas',text:'Dos etapas de alta mueven el compresor de alta; cinco de baja mueven el fan. Los primeros álabes trabajan por encima del punto de fusión de su aleación: la refrigeración interna y la barrera cerámica lo hacen posible.',cam:{pos:[2.2,1.1,2.1],target:[2.9,0,0]},part:'Turbina de alta, etapa 1 (N2)'},
    {title:'Tobera y chorro',text:'El gas sale del núcleo a unos 450 m/s y el aire del fan a unos 290 m/s. Que casi todo el empuje venga del chorro lento es la razón de que el turbofan consuma menos de la mitad que un turborreactor.',cam:{pos:[5.6,1.5,3.4],target:[3.8,0,0]},part:'Tobera del núcleo'},
    {title:'Inversor de empuje',text:'Al tocar pista el manguito trasero de la góndola retrocede, diez compuertas cierran el conducto de derivación y el aire del fan sale hacia delante por las cascadas. Pulsa «Inversor» en el panel y mira las estelas salir por delante.',cam:{pos:[3.4,1.7,3.2],target:[1.9,0.3,0]},part:'Cascadas del inversor'},
  ];
  return E;
}

export {buildTurbofan};
