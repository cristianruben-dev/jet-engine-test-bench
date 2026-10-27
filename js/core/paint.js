/* Paints each part and section cap according to the active view: materials with red-hot glow,
   or an emissive map of temperature (gas or metal), pressure or velocity */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {LUT,VIEWS,fIdx,tFrac,smooth} from './utils.js';

const probe={T:0,Pr:1,V:0};
function updateMaterials(engine,R,st){
  const view=st.view,hover=st.hover,VW=VIEWS[view],lut=LUT[VW.lut];
  for(const p of engine.parts){
    if(view==='mat'){
      if(hover===p||st.highlight===p){p.matN.emissive.setRGB(1,0.71,0.28,THREE.SRGBColorSpace);p.matN.emissiveIntensity=0.45;}
      else{const g=p.glow?smooth(950,1750,p.metal(R)):0;p.matN.emissive.setRGB(1,0.3,0.06,THREE.SRGBColorSpace);p.matN.emissiveIntensity=g*0.9;}
    }else{
      const g=p.gas(R);let f;
      if(view==='thermal')f=tFrac(st.thermalMode==='metal'?p.metal(R):g.T);
      else{probe.T=g.T;probe.Pr=g.P/R.P0;probe.V=g.V;f=VW.frac(probe);}
      const i=fIdx(f);p.matT.emissive.setRGB(lut[i],lut[i+1],lut[i+2],THREE.SRGBColorSpace);p.matT.color.copy(p.matT.emissive).multiplyScalar(0.22);p.matT.emissiveIntensity=(hover===p||st.highlight===p)?1.5:1.0;
    }
  }
  for(const c of engine.caps){
    if(view==='mat'){c.mat.color.copy(c.part.matN.color).multiplyScalar(0.62);c.mat.emissive.setRGB(0,0,0);}
    else{c.mat.color.copy(c.part.matT.emissive).multiplyScalar(0.35);c.mat.emissive.copy(c.part.matT.emissive).multiplyScalar(0.55);}
  }
}

export {updateMaterials};
