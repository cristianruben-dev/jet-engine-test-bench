/* Engine catalog: builder, thermodynamic model, ranges and copy */
import {buildTurbofan} from './turbofan.js';
import {buildTurbojet} from './turbojet.js';
import {buildRamjet} from './ramjet.js';
import {buildScramjet} from './scramjet.js';
import {thermoTurbofan,thermoTurbojet,thermoRamjet,thermoScramjet} from '../core/thermo.js';

const ENGINES={
  turbofan:{build:buildTurbofan,thermo:thermoTurbofan,machMax:0.95,defaults:{throttle:0.75,mach:0.15,tscale:0.5,cut:'quarter'},blurb:'<b>Turbofan de alta derivación</b> (tipo GE90 / Trent). El fan impulsa ~90 % del aire por el conducto de derivación; solo el núcleo se comprime, quema y expande. Dos ejes concéntricos: <b>N1</b> (fan, booster y turbina de baja) y <b>N2</b> (compresor y turbina de alta). Nivel del mar.'},
  turbojet:{build:buildTurbojet,thermo:thermoTurbojet,machMax:2.2,defaults:{throttle:0.92,mach:0.4,tscale:0.5,cut:'quarter'},blurb:'<b>Turborreactor de un eje con postquemador</b> (tipo J79). Todo el aire atraviesa compresor, cámaras tubulares y turbina. Por encima del 85 % de gas se inyecta combustible en el postquemador y la tobera de pétalos se abre. Nivel del mar.'},
  ramjet:{build:buildRamjet,thermo:thermoRamjet,machMax:6,defaults:{throttle:0.8,mach:2.5,tscale:0.3,cut:'quarter'},blurb:'<b>Estatorreactor (ramjet)</b>: sin compresor ni turbina. La propia velocidad comprime el aire en el cono de entrada (choque oblicuo) y el difusor; los estabilizadores en V sostienen la llama. No produce empuje parado: hay que lanzarlo ya rápido. Altitud 15 km.'},
  scramjet:{build:buildScramjet,thermo:thermoScramjet,machMax:10,defaults:{throttle:0.8,mach:7,tscale:0.14,cut:'quarter'},blurb:'<b>Scramjet</b> (X-43 / X-51): la combustión ocurre con el flujo todavía supersónico. Las rampas del fuselaje comprimen el aire mediante choques oblicuos; sin partes móviles. Solo funciona a partir de M ≈ 5. Altitud 30 km.'},
};

export {ENGINES};
