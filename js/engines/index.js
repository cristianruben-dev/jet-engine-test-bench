/* Engine catalog: builder, thermodynamic model, ranges, copy and scenario presets */
import {buildTurbofan} from './turbofan.js';
import {buildTurbojet} from './turbojet.js';
import {buildRamjet} from './ramjet.js';
import {buildScramjet} from './scramjet.js';
import {THERMO} from '../core/thermo.js';

/* presets receive a small api: set(fields), start(), cut(), fadec(bool), view(name), after(ms, fn) */
const ENGINES={
  turbofan:{build:buildTurbofan,thermo:THERMO.turbofan,machMax:0.95,altMax:14000,defaults:{throttle:0.75,mach:0.15,alt:0,tscale:0.5,cut:'quarter'},
    blurb:'<b>Turbofan de alta derivación</b> (tipo GE90 / Trent). El fan impulsa ~90 % del aire por el conducto de derivación; solo el núcleo se comprime, quema y expande. Dos ejes concéntricos: <b>N1</b> (fan, booster y turbina de baja) y <b>N2</b> (compresor y turbina de alta).',
    presets:[
      {name:'Despegue',desc:'Gas a fondo a nivel del mar',run:a=>{a.start();a.set({throttle:1,mach:0.2,alt:0});}},
      {name:'Crucero M 0,85 · 11 km',desc:'Régimen de crucero típico',run:a=>{a.start();a.set({throttle:0.8,mach:0.85,alt:11000});}},
      {name:'Ralentí en pista',desc:'Succión con el avión parado',run:a=>{a.start();a.set({throttle:0,mach:0,alt:0,view:'mat'});}},
      {name:'Arranque en frío',desc:'Corte y secuencia de arranque completa',run:a=>{a.set({throttle:0,mach:0,alt:0});a.stop();a.after(1500,()=>a.start());}},
      {name:'Corte en vuelo (molinete)',desc:'Apagado a M 0,7: los ejes siguen girando por el viento',run:a=>{a.set({throttle:0.6,mach:0.7,alt:6000});a.after(800,()=>a.cut());}},
      {name:'Acelerón sin limitador',desc:'FADEC desconectado: bombeo del compresor',run:a=>{a.start();a.set({throttle:0,mach:0.1,alt:0,fadec:false});a.after(3500,()=>a.set({throttle:1}));}},
      {name:'Aterrizaje: inversor',desc:'Tocando pista a M 0,2 con el inversor desplegado',run:a=>{a.start();a.set({throttle:0.7,mach:0.2,alt:0,reverser:true,cut:'half'});}},
      {name:'Viento cruzado en estático',desc:'20 m/s de lado y gas a fondo: vórtice de suelo y desprendimiento en el labio',run:a=>{a.start();a.set({throttle:1,mach:0,alt:0,cross:20,view:'mat'});}},
    ]},
  turbojet:{build:buildTurbojet,thermo:THERMO.turbojet,machMax:2.2,altMax:16000,defaults:{throttle:0.92,mach:0.4,alt:0,tscale:0.5,cut:'quarter'},
    blurb:'<b>Turborreactor de un eje con postquemador</b> (tipo J79). Todo el aire atraviesa compresor, cámaras tubulares y turbina. Por encima del 85 % de gas se inyecta combustible en el postquemador y la tobera de pétalos se abre.',
    presets:[
      {name:'Seco a fondo',desc:'Máximo sin postquemador',run:a=>{a.start();a.set({throttle:0.84,mach:0.3,alt:0});}},
      {name:'Encender postquemador',desc:'Del régimen seco al 100 %',run:a=>{a.start();a.set({throttle:0.84,mach:0.4,alt:0});a.after(1500,()=>a.set({throttle:1}));}},
      {name:'Supersónico M 2 · 12 km',desc:'Choques en la toma y pérdida de presión',run:a=>{a.start();a.set({throttle:1,mach:2.0,alt:12000});}},
      {name:'Arranque en frío',desc:'Corte y secuencia de arranque',run:a=>{a.set({throttle:0,mach:0,alt:0});a.stop();a.after(1500,()=>a.start());}},
      {name:'Acelerón sin limitador',desc:'Bombeo del compresor',run:a=>{a.start();a.set({throttle:0,mach:0.2,alt:0,fadec:false});a.after(3500,()=>a.set({throttle:1}));}},
    ]},
  ramjet:{build:buildRamjet,thermo:THERMO.ramjet,machMax:6,altMax:30000,defaults:{throttle:0.8,mach:2.5,alt:15000,tscale:0.3,cut:'quarter'},
    blurb:'<b>Estatorreactor (ramjet)</b>: sin compresor ni turbina. La propia velocidad comprime el aire en el cono de entrada (choque oblicuo) y el difusor; los estabilizadores en V sostienen la llama. No produce empuje parado: hay que lanzarlo ya rápido.',
    presets:[
      {name:'Lanzamiento M 0,8',desc:'Aún sin compresión útil',run:a=>{a.start();a.set({throttle:0.8,mach:0.8,alt:8000});}},
      {name:'Diseño M 3 · 15 km',desc:'Choque sobre el labio',run:a=>{a.start();a.set({throttle:0.8,mach:3,alt:15000});}},
      {name:'Límite M 5,5',desc:'Aire de entrada demasiado caliente',run:a=>{a.start();a.set({throttle:1,mach:5.5,alt:22000});}},
      {name:'Corte de combustible',desc:'Solo pasa aire',run:a=>{a.set({throttle:0.8,mach:3,alt:15000});a.cut();}},
    ]},
  scramjet:{build:buildScramjet,thermo:THERMO.scramjet,machMax:10,altMax:32000,defaults:{throttle:0.6,mach:7,alt:30000,tscale:0.14,cut:'quarter'},
    blurb:'<b>Scramjet</b> (X-43 / X-51): la combustión ocurre con el flujo todavía supersónico. Las rampas del fuselaje comprimen el aire mediante choques oblicuos; sin partes móviles. Solo funciona a partir de M ≈ 5.',
    presets:[
      {name:'X-43 a M 7',desc:'Punto de diseño',run:a=>{a.start();a.set({throttle:0.6,mach:7,alt:30000});}},
      {name:'Límite inferior M 4,8',desc:'La llama apenas se sostiene',run:a=>{a.start();a.set({throttle:0.5,mach:4.8,alt:27000});}},
      {name:'Bloqueo térmico (unstart)',desc:'Demasiado combustible a M 5',run:a=>{a.start();a.set({throttle:0.3,mach:5.2,alt:28000});a.after(2500,()=>a.set({throttle:1}));}},
      {name:'Récord M 9,6',desc:'Rampas al rojo blanco',run:a=>{a.start();a.set({throttle:0.8,mach:9.6,alt:32000});}},
    ]},
};

export {ENGINES};
