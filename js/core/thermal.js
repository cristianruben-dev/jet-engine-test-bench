/* Paints each part by temperature: thermal palette or red-hot metal glow */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {LUT,tIdx,smooth} from './utils.js';

export function updateMaterials(engine,R,hover,thermal){
  for(const p of engine.parts){const T=p.T(R);
    if(thermal){const i=tIdx(T);p.matT.emissive.setRGB(LUT.iron[i],LUT.iron[i+1],LUT.iron[i+2],THREE.SRGBColorSpace);p.matT.color.copy(p.matT.emissive).multiplyScalar(0.22);p.matT.emissiveIntensity=hover===p?1.5:1.0;}
    else{if(hover===p){p.matN.emissive.setRGB(1,0.71,0.28,THREE.SRGBColorSpace);p.matN.emissiveIntensity=0.4;}else{const g=p.glow?smooth(950,1750,T):0;p.matN.emissive.setRGB(1,0.3,0.06,THREE.SRGBColorSpace);p.matN.emissiveIntensity=g*0.9;}}}
}
