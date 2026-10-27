/* 2D canvas charts: the four engines compared against Mach, and the live T-s cycle diagram */
import {steadyPoint,RG} from './thermo.js';
import {fmt,clamp,lerp} from './utils.js';

/* categorical slots (validated for the dark panel surface); one fixed colour per engine */
const SERIES={turbofan:{color:'#3987e5',label:'Turbofan',short:'Turbofan'},turbojet:{color:'#d95926',label:'Turborreactor',short:'Turborr.'},ramjet:{color:'#199e70',label:'Estatorreactor',short:'Ramjet'},scramjet:{color:'#c98500',label:'Scramjet',short:'Scramjet'}};
const RANGE={turbofan:[0,0.95],turbojet:[0,2.2],ramjet:[0.5,6],scramjet:[4.5,10]};
const ink=()=>{const s=getComputedStyle(document.documentElement);return {fg:s.getPropertyValue('--fg').trim()||'#e8edf4',muted:s.getPropertyValue('--muted').trim()||'#8d99ab',grid:s.getPropertyValue('--line').trim()||'#243040',surface:s.getPropertyValue('--bg-2').trim()||'#10151d'};};

let cache={alt:null,data:null};
/* full-throttle sweep of every engine at one altitude */
function sweep(alt){
  if(cache.alt===alt)return cache.data;
  const data={};
  for(const id in SERIES){const [m0,m1]=RANGE[id];const pts=[];for(let i=0;i<=44;i++){const M=m0+(m1-m0)*i/44;const R=steadyPoint(id,1,M,alt);pts.push({M,Fsp:R.Fsp,TSFC:Number.isFinite(R.TSFC)?R.TSFC*1e6:NaN});}data[id]=pts;}
  cache={alt,data};return data;
}
function prep(canvas){const dpr=Math.min(window.devicePixelRatio||1,2);const w=canvas.clientWidth||300,h=canvas.clientHeight||220;if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}const g=canvas.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);g.font='10.5px "IBM Plex Mono", ui-monospace, monospace';return {g,w,h};}
function axes(g,x0,y0,x1,y1,xt,yt,col,xfmt,yfmt){
  g.strokeStyle=col.grid;g.lineWidth=1;g.fillStyle=col.muted;g.textAlign='right';g.textBaseline='middle';
  for(const [v,f] of yt){const y=y0-(y0-y1)*f;g.beginPath();g.moveTo(x0,y);g.lineTo(x1,y);g.stroke();g.fillText(yfmt(v),x0-5,y);}
  g.textAlign='center';g.textBaseline='top';
  for(const [v,f] of xt){const x=x0+(x1-x0)*f;g.fillText(xfmt(v),x,y0+4);}
  g.strokeStyle=col.muted;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y0);g.stroke();
}
function panel(g,col,x0,y0,x1,y1,title,data,key,ymax,current,hoverM){
  g.fillStyle=col.fg;g.font='600 11.5px "Rajdhani", "IBM Plex Sans", sans-serif';g.textAlign='left';g.textBaseline='bottom';g.fillText(title,x0,y1-6);
  g.font='10.5px "IBM Plex Mono", ui-monospace, monospace';
  const yt=[];for(let v=0;v<=ymax;v+=ymax/4)yt.push([v,v/ymax]);const xt=[];for(let m=0;m<=10;m+=2)xt.push([m,m/10]);
  axes(g,x0,y0,x1,y1,xt,yt,col,v=>'M '+v,v=>fmt(v));
  const px=M=>x0+(x1-x0)*M/10,py=v=>y0-(y0-y1)*clamp(v/ymax,0,1.02);
  g.lineWidth=2;g.lineJoin='round';g.lineCap='round';
  for(const id in data){const pts=data[id].filter(p=>Number.isFinite(p[key])&&p[key]>0);if(pts.length<2)continue;g.strokeStyle=SERIES[id].color;g.beginPath();pts.forEach((p,i)=>{const x=px(p.M),y=py(p[key]);i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();
    /* direct label at the line end, in ink, with a colour key */
    const e=pts[pts.length-1];const lx=Math.min(px(e.M)+6,x1-52),ly=clamp(py(e[key]),y1+6,y0-6);g.fillStyle=SERIES[id].color;g.beginPath();g.arc(lx-3,ly,2.5,0,7);g.fill();g.fillStyle=col.muted;g.textAlign='left';g.textBaseline='middle';g.fillText(SERIES[id].short,lx+2,ly);}
  if(current&&Number.isFinite(current.v)&&current.v>0){const x=px(current.M),y=py(current.v);g.fillStyle=col.surface;g.beginPath();g.arc(x,y,6,0,7);g.fill();g.fillStyle=SERIES[current.id].color;g.beginPath();g.arc(x,y,4,0,7);g.fill();}
  if(hoverM!==null&&hoverM!==undefined){const x=px(hoverM);g.strokeStyle=col.muted;g.lineWidth=1;g.beginPath();g.moveTo(x,y1);g.lineTo(x,y0);g.stroke();}
}
/* specific thrust and specific fuel consumption of the four engines; `current` marks the live operating point */
function drawComparison(canvas,alt,current,hoverM){
  const {g,w,h}=prep(canvas),col=ink(),data=sweep(alt);const x0=40,x1=w-8,mid=h/2;
  panel(g,col,x0,mid-26,x1,20,'Empuje específico (N·s/kg)',data,'Fsp',1200,current&&{id:current.id,M:current.M,v:current.Fsp},hoverM);
  panel(g,col,x0,h-18,x1,mid+16,'Consumo específico (g/kN·s)',data,'TSFC',120,current&&{id:current.id,M:current.M,v:current.TSFC},hoverM);
  return data;
}
/* values of every engine at one Mach, for the hover tooltip and the table twin */
function valuesAt(data,M){const out=[];for(const id in data){const pts=data[id];if(M<pts[0].M-0.05||M>pts[pts.length-1].M+0.05){out.push({id,label:SERIES[id].label,color:SERIES[id].color});continue;}let j=0;while(j<pts.length-2&&pts[j+1].M<M)j++;const f=clamp((M-pts[j].M)/(pts[j+1].M-pts[j].M),0,1);out.push({id,label:SERIES[id].label,color:SERIES[id].color,Fsp:lerp(pts[j].Fsp,pts[j+1].Fsp,f),TSFC:lerp(pts[j].TSFC,pts[j+1].TSFC,f)});}return out;}

/* T-s diagram of the current engine: total conditions at each station, entropy relative to ambient */
function drawCycle(canvas,R,id){
  const {g,w,h}=prep(canvas),col=ink();const x0=44,x1=w-10,y0=h-20,y1=16;
  const cp=1080;const pts=R.cycle.map(([n,k])=>{const s=R.st[k];return {n,T:s.T,s:(cp*Math.log(s.T/R.T0)-RG*Math.log(s.P/R.P0))/1000};});
  const sMax=Math.max(0.3,...pts.map(p=>p.s))*1.12,sMin=Math.min(0,...pts.map(p=>p.s))-0.05,tMax=Math.max(...pts.map(p=>p.T))*1.1;
  const px=s=>x0+(x1-x0)*(s-sMin)/(sMax-sMin),py=T=>y0-(y0-y1)*T/tMax;
  const yt=[],step=tMax>2500?1000:500;for(let T=0;T<=tMax;T+=step)yt.push([T,T/tMax]);const xt=[];for(let s=0;s<=sMax;s+=0.5)xt.push([s,(s-sMin)/(sMax-sMin)]);
  axes(g,x0,y0,x1,y1,xt,yt,col,v=>fmt(v,1)+' kJ/kg·K',v=>fmt(v)+' K');
  /* isobars at ambient and peak pressure: T = T0·exp((s + R ln(P/P0))/cp) */
  g.strokeStyle=col.grid;g.lineWidth=1;const pMax=Math.max(...R.cycle.map(([,k])=>R.st[k].P));
  for(const P of [R.P0,pMax]){g.beginPath();let first=true;for(let s=sMin;s<=sMax;s+=0.02){const T=R.T0*Math.exp((s*1000+RG*Math.log(P/R.P0))/cp);if(T>tMax)break;const x=px(s),y=py(T);first?g.moveTo(x,y):g.lineTo(x,y);first=false;}g.stroke();}
  g.strokeStyle=SERIES[id].color;g.lineWidth=2;g.lineJoin='round';g.beginPath();pts.forEach((p,i)=>{const x=px(p.s),y=py(p.T);i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();
  g.strokeStyle=col.muted;g.lineWidth=1;g.beginPath();g.moveTo(px(pts[pts.length-1].s),py(pts[pts.length-1].T));g.lineTo(px(pts[0].s),py(pts[0].T));g.stroke();
  g.textAlign='left';g.textBaseline='bottom';
  for(const p of pts){const x=px(p.s),y=py(p.T);g.fillStyle=col.surface;g.beginPath();g.arc(x,y,5.5,0,7);g.fill();g.fillStyle=SERIES[id].color;g.beginPath();g.arc(x,y,3.5,0,7);g.fill();g.fillStyle=col.fg;g.fillText(p.n,x+6,y-2);}
  return pts;
}

/* ── live strip chart: the channels of each engine over the last minute, each on its own scale ── */
const TRACES={
  turbofan:[{k:'N1',u:'%',r:[0,110],f:R=>R.N1*100,c:'#3987e5'},{k:'N2',u:'%',r:[0,110],f:R=>R.N2*100,c:'#8fb8f0'},{k:'EGT',u:'°C',r:[0,1100],f:R=>R.Tt5-273.15,c:'#d95926'},{k:'Empuje',u:'kN',r:[0,350],f:R=>R.F/1000,c:'#58d68d'},{k:'Combustible',u:'kg/s',r:[0,4],f:R=>R.Wf,c:'#c98500'}],
  turbojet:[{k:'Régimen',u:'%',r:[0,110],f:R=>R.N*100,c:'#3987e5'},{k:'EGT',u:'°C',r:[0,1000],f:R=>R.Tt5-273.15,c:'#d95926'},{k:'Empuje',u:'kN',r:[0,80],f:R=>R.F/1000,c:'#58d68d'},{k:'Combustible',u:'kg/s',r:[0,5],f:R=>R.Wf,c:'#c98500'},{k:'Postquemador',u:'%',r:[0,100],f:R=>R.ab*100,c:'#e38bd2'}],
  ramjet:[{k:'Mach',u:'',r:[0,6],f:R=>R.M,c:'#3987e5'},{k:'Cámara',u:'°C',r:[0,2400],f:R=>R.Tt4-273.15,c:'#d95926'},{k:'Empuje',u:'kN',r:[0,160],f:R=>R.F/1000,c:'#58d68d'},{k:'Combustible',u:'kg/s',r:[0,10],f:R=>R.Wf,c:'#c98500'}],
  scramjet:[{k:'Mach',u:'',r:[0,10],f:R=>R.M,c:'#3987e5'},{k:'Cámara',u:'°C',r:[0,3000],f:R=>R.T4s-273.15,c:'#d95926'},{k:'Empuje',u:'kN',r:[0,40],f:R=>R.F/1000,c:'#58d68d'},{k:'Hidrógeno',u:'kg/s',r:[0,1],f:R=>R.Wf,c:'#c98500'},{k:'Margen',u:'%',r:[-50,100],f:R=>R.chokeMargin>=0?R.chokeMargin*100:NaN,c:'#e38bd2'}],
};
const SPAN=60,RATE=10;   /* seconds kept, samples per second */
class History{
  constructor(id){this.tr=TRACES[id];this.m=this.tr.length;this.cap=SPAN*RATE+10;this.t=new Float32Array(this.cap);this.v=new Float32Array(this.cap*this.m);this.ev=new Uint8Array(this.cap);this.n=0;this.head=0;this.clock=0;this.trail=[];}
  push(R,dyn,dt){
    this.clock+=dt;const i=this.head;this.t[i]=this.clock;for(let k=0;k<this.m;k++)this.v[i*this.m+k]=this.tr[k].f(R);this.ev[i]=(dyn.surge>0.5||dyn.unstart>0.5)?1:0;
    this.head=(i+1)%this.cap;this.n=Math.min(this.n+1,this.cap);
    const mp=dyn.map();if(mp){const p=mapPoint(mp);this.trail.push(p);if(this.trail.length>150)this.trail.shift();}
  }
  at(j){return (this.head-this.n+j+this.cap)%this.cap;}
}
function drawHistory(canvas,hist){
  const {g,w,h}=prep(canvas),col=ink();const x0=34,x1=w-10,y0=h-20,y1=14;const now=hist.clock;
  const xt=[];for(let s=-SPAN;s<=0;s+=15)xt.push([s,(s+SPAN)/SPAN]);
  axes(g,x0,y0,x1,y1,xt,[[0,0],[50,0.5],[100,1]],col,v=>v===0?'ahora':fmt(v)+' s',v=>fmt(v)+' %');
  const px=t=>x0+(x1-x0)*clamp((t-now+SPAN)/SPAN,0,1),py=f=>y0-(y0-y1)*clamp(f,0,1);
  g.lineWidth=1.6;g.lineJoin='round';g.lineCap='round';
  for(let k=0;k<hist.m;k++){const tr=hist.tr[k];g.strokeStyle=tr.c;g.beginPath();let pen=false;
    for(let j=0;j<hist.n;j++){const i=hist.at(j);const t=hist.t[i];if(t<now-SPAN)continue;const v=hist.v[i*hist.m+k];if(!Number.isFinite(v)){pen=false;continue;}const x=px(t),y=py((v-tr.r[0])/(tr.r[1]-tr.r[0]));pen?g.lineTo(x,y):g.moveTo(x,y);pen=true;}
    g.stroke();}
  g.strokeStyle='#ff5b2e';g.lineWidth=2;
  for(let j=0;j<hist.n;j++){const i=hist.at(j);if(!hist.ev[i]||hist.t[i]<now-SPAN)continue;const x=px(hist.t[i]);g.beginPath();g.moveTo(x,y1);g.lineTo(x,y1+8);g.stroke();}
  const last=hist.n?hist.at(hist.n-1):-1;
  return hist.tr.map((tr,k)=>{const v=last>=0?hist.v[last*hist.m+k]:NaN;return {k:tr.k,c:tr.c,text:Number.isFinite(v)?fmt(v,tr.u==='kg/s'?2:0)+(tr.u?' '+tr.u:''):'—'};});
}

/* ── compressor map: corrected flow against pressure ratio, with the surge line, the steady operating
   line, constant-speed lines, the trail of the last seconds and the live operating point ── */
const xN=N=>100*(0.08+0.92*Math.pow(Math.max(N,0),1.3)),PRop=(N,PRd)=>1+(PRd-1)*N*N,PRs=(N,PRd)=>PRop(N,PRd)*(1.1+0.12*N);
function mapPoint(m){const N=m.N,x=xN(N)*(1-0.45*m.surge);const PR=Math.max(1,PRop(N,m.PRd)*(1+(PRs(N,m.PRd)/PRop(N,m.PRd)-1)*clamp(m.excess,-1,1.3)/0.43)*(1-0.5*m.surge));return [x,PR];}
function drawMap(canvas,m,trail){
  const {g,w,h}=prep(canvas),col=ink();const x0=40,x1=w-12,y0=h-20,y1=16;const xmax=115,PRmax=m.PRd*1.32;
  const px=v=>x0+(x1-x0)*v/xmax,py=PR=>y0-(y0-y1)*clamp((PR-1)/(PRmax-1),0,1.02);
  const yt=[];for(let p=1;p<=PRmax;p+=m.PRd>12?3:2)yt.push([p,(p-1)/(PRmax-1)]);const xt=[];for(let v=0;v<=100;v+=25)xt.push([v,v/xmax]);
  axes(g,x0,y0,x1,y1,xt,yt,col,v=>v+' %',v=>fmt(v)+':1');
  g.fillStyle=col.muted;g.textAlign='right';g.textBaseline='bottom';g.fillText('caudal corregido',x1,y0-3);
  /* speed lines */
  g.strokeStyle=col.grid;g.lineWidth=1;g.fillStyle=col.muted;g.textAlign='center';g.textBaseline='bottom';
  for(const N of [0.5,0.6,0.7,0.8,0.9,1.0]){g.beginPath();for(let s=0;s<=1;s+=0.1){const x=px(xN(N)*(1.05-0.08*s*s)),y=py(PRop(N,m.PRd)*0.78+(PRs(N,m.PRd)-PRop(N,m.PRd)*0.78)*s);s?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();g.fillText(fmt(N*100)+' %',px(xN(N)*0.97),py(PRs(N,m.PRd))-3);}
  const line=(fn,dash,color,label,Nl,above)=>{g.setLineDash(dash);g.strokeStyle=color;g.lineWidth=1.8;g.beginPath();for(let N=0.35;N<=1.05;N+=0.025){const [x,p]=fn(N);N>0.35?g.lineTo(px(x),py(p)):g.moveTo(px(x),py(p));}g.stroke();g.setLineDash([]);const [lx,lp]=fn(Nl);g.fillStyle=color;g.textAlign=above?'right':'left';g.textBaseline=above?'bottom':'top';g.fillText(label,px(lx)+(above?-4:6),py(lp)+(above?-4:4));};
  line(N=>[xN(N)*0.98,PRs(N,m.PRd)],[5,4],'#ff5b2e','línea de bombeo',0.62,true);
  line(N=>[xN(N),PRop(N,m.PRd)],[],'#ffb547','línea de funcionamiento',0.55,false);
  g.lineWidth=2;g.lineJoin='round';
  for(let j=1;j<trail.length;j++){g.strokeStyle=`rgba(95,203,255,${0.08+0.6*j/trail.length})`;g.beginPath();g.moveTo(px(trail[j-1][0]),py(trail[j-1][1]));g.lineTo(px(trail[j][0]),py(trail[j][1]));g.stroke();}
  const [cx,cp]=mapPoint(m);g.fillStyle=col.surface;g.beginPath();g.arc(px(cx),py(cp),7,0,7);g.fill();g.fillStyle=m.surge>0.3?'#ff5b2e':'#5fcbff';g.beginPath();g.arc(px(cx),py(cp),4.5,0,7);g.fill();
  return (PRs(m.N,m.PRd)/cp-1)*100;
}

export {SERIES,RANGE,TRACES,History,sweep,drawComparison,drawCycle,drawHistory,drawMap,mapPoint,valuesAt};
