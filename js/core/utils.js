/* Numeric helpers, formatting and temperature palettes */
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const DEG=Math.PI/180;
const fmt=(v,d=0)=>v.toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
const isMobile=matchMedia('(max-width:760px)').matches;

/* temperature palettes. Non-linear map: 250 K → 0, 2400 K → 1 */
const T_LO=250, T_HI=2400;
const tFrac=T=>Math.pow(clamp((T-T_LO)/(T_HI-T_LO),0,1),0.6);
const IRONBOW=[[0.02,0.0,0.05],[0.12,0.0,0.3],[0.38,0.0,0.6],[0.68,0.05,0.5],[0.92,0.25,0.12],[1,0.55,0],[1,0.85,0.2],[1,1,0.72],[1,1,1]];
const FLOW=[[0.42,0.72,1.0],[0.62,0.85,1.0],[0.9,0.96,1.0],[1.0,0.95,0.62],[1.0,0.76,0.28],[1.0,0.48,0.12],[1.0,0.24,0.06],[0.95,0.12,0.05],[1,0.6,0.5]];
function buildLUT(stops,linear){const lut=new Float32Array(256*3);for(let i=0;i<256;i++){const f=i/255*(stops.length-1);const k=Math.min(stops.length-2,Math.floor(f));const t=f-k;for(let c=0;c<3;c++){let v=lerp(stops[k][c],stops[k+1][c],t);if(linear)v=Math.pow(v,2.2);lut[i*3+c]=v;}}return lut;}
const LUT={iron:buildLUT(IRONBOW,false),ironLin:buildLUT(IRONBOW,true),flow:buildLUT(FLOW,false),flowLin:buildLUT(FLOW,true)};
const tIdx=T=>Math.round(tFrac(T)*255)*3;
function cssTemp(T,lut){const i=tIdx(T);return `rgb(${Math.round(lut[i]*255)},${Math.round(lut[i+1]*255)},${Math.round(lut[i+2]*255)})`;}
function cssGradient(lut){const s=[];for(let k=0;k<=16;k++){const i=Math.round(k/16*255)*3;s.push(`rgb(${Math.round(lut[i]*255)},${Math.round(lut[i+1]*255)},${Math.round(lut[i+2]*255)}) ${k/16*100}%`);}return `linear-gradient(90deg,${s.join(',')})`;}

export {$,clamp,lerp,smooth,DEG,fmt,isMobile,T_LO,T_HI,tFrac,IRONBOW,FLOW,buildLUT,LUT,tIdx,cssTemp,cssGradient};
