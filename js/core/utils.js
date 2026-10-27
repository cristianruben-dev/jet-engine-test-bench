/* Numeric helpers, formatting and the palettes of every view */
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const DEG=Math.PI/180;
const fmt=(v,d=0)=>Number.isFinite(v)?v.toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const isMobile=typeof matchMedia==='function'&&matchMedia('(max-width:760px)').matches;   /* false outside a browser (tests) */

/* temperature: non-linear map, 250 K → 0, 2400 K → 1 */
const T_LO=250,T_HI=2400;
const tFrac=T=>Math.pow(clamp((T-T_LO)/(T_HI-T_LO),0,1),0.6);
/* pressure: log10 of the ratio to ambient, 0.4× → 0, 60× → 1 */
const pFrac=pr=>clamp((Math.log10(Math.max(pr,0.01))+0.4)/2.18,0,1);
/* velocity: square-root map, 0 → 0, 3200 m/s → 1 */
const vFrac=v=>Math.sqrt(clamp(Math.abs(v)/3200,0,1));

const IRONBOW=[[0.02,0.0,0.05],[0.12,0.0,0.3],[0.38,0.0,0.6],[0.68,0.05,0.5],[0.92,0.25,0.12],[1,0.55,0],[1,0.85,0.2],[1,1,0.72],[1,1,1]];
const FLOW=[[0.42,0.72,1.0],[0.62,0.85,1.0],[0.9,0.96,1.0],[1.0,0.95,0.62],[1.0,0.76,0.28],[1.0,0.48,0.12],[1.0,0.24,0.06],[0.95,0.12,0.05],[1,0.6,0.5]];
const PRESSURE=[[0.03,0.05,0.22],[0.07,0.22,0.62],[0.12,0.58,0.86],[0.45,0.86,0.62],[0.95,0.92,0.32],[1,1,0.9]];
const VELOCITY=[[0.05,0.03,0.28],[0.33,0.06,0.62],[0.68,0.18,0.56],[0.94,0.42,0.26],[1,0.78,0.18],[1,1,0.85]];
function buildLUT(stops,linear){const lut=new Float32Array(256*3);for(let i=0;i<256;i++){const f=i/255*(stops.length-1);const k=Math.min(stops.length-2,Math.floor(f));const t=f-k;for(let c=0;c<3;c++){let v=lerp(stops[k][c],stops[k+1][c],t);if(linear)v=Math.pow(v,2.2);lut[i*3+c]=v;}}return lut;}
const LUT={iron:buildLUT(IRONBOW,false),ironLin:buildLUT(IRONBOW,true),flow:buildLUT(FLOW,false),flowLin:buildLUT(FLOW,true),press:buildLUT(PRESSURE,false),pressLin:buildLUT(PRESSURE,true),vel:buildLUT(VELOCITY,false),velLin:buildLUT(VELOCITY,true)};
const fIdx=f=>Math.round(clamp(f,0,1)*255)*3;
const tIdx=T=>fIdx(tFrac(T));
function cssLUT(f,lut){const i=fIdx(f);return `rgb(${Math.round(lut[i]*255)},${Math.round(lut[i+1]*255)},${Math.round(lut[i+2]*255)})`;}
function cssTemp(T,lut){return cssLUT(tFrac(T),lut);}
function cssGradient(lut){const s=[];for(let k=0;k<=16;k++){const i=Math.round(k/16*255)*3;s.push(`rgb(${Math.round(lut[i]*255)},${Math.round(lut[i+1]*255)},${Math.round(lut[i+2]*255)}) ${k/16*100}%`);}return `linear-gradient(90deg,${s.join(',')})`;}

/* what each view paints: palette, scale and legend ticks */
const VIEWS={
  mat:{lut:'flow',lin:'flowLin',frac:g=>tFrac(g.T),ticks:[[0,'0 °C'],[300,'300'],[700,'700'],[1200,'1200'],[1800,'1800']].map(([c,l])=>[tFrac(c+273.15),l]),label:'Temperatura del aire',short:'Temp. del aire'},
  thermal:{lut:'iron',lin:'ironLin',frac:g=>tFrac(g.T),ticks:[[0,'0 °C'],[300,'300'],[700,'700'],[1200,'1200'],[1800,'1800']].map(([c,l])=>[tFrac(c+273.15),l]),label:'Temperatura',short:'Temp.'},
  pressure:{lut:'press',lin:'pressLin',frac:g=>pFrac(g.Pr),ticks:[[0.5,'0,5×'],[1,'1×'],[3,'3×'],[10,'10×'],[30,'30×']].map(([p,l])=>[pFrac(p),l]),label:'Presión (veces la ambiente)',short:'Presión × ambiente'},
  velocity:{lut:'vel',lin:'velLin',frac:g=>vFrac(g.V),ticks:[[0,'0'],[150,'150'],[500,'500'],[1200,'1200'],[2500,'2500 m/s']].map(([v,l])=>[vFrac(v),l]),label:'Velocidad del gas',short:'Velocidad del gas'},
};

export {$,clamp,lerp,smooth,DEG,fmt,isMobile,T_LO,T_HI,tFrac,pFrac,vFrac,IRONBOW,FLOW,buildLUT,LUT,fIdx,tIdx,cssLUT,cssTemp,cssGradient,VIEWS};
