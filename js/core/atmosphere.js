/* International Standard Atmosphere up to 32 km */
import {clamp} from './utils.js';

function isa(h){
  h=clamp(h||0,0,32000);let T,P;
  if(h<=11000){T=288.15-0.0065*h;P=101325*Math.pow(T/288.15,5.2559);}
  else if(h<=20000){T=216.65;P=22632*Math.exp(-(h-11000)/6341.6);}
  else{T=216.65+0.001*(h-20000);P=5474.9*Math.pow(T/216.65,-34.163);}
  return {h,T,P,rho:P/(287*T),a:Math.sqrt(1.4*287*T)};
}

export {isa};
