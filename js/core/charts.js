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
  g.fillStyle=col.fg;g.font='600 11px "Rajdhani", "IBM Plex Sans", sans-serif';g.textAlign='left';g.textBaseline='bottom';g.fillText(title,x0,y1-4);
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
  panel(g,col,x0,mid-22,x1,12,'Empuje específico (N·s/kg)',data,'Fsp',1200,current&&{id:current.id,M:current.M,v:current.Fsp},hoverM);
  panel(g,col,x0,h-18,x1,mid+6,'Consumo específico (g/kN·s)',data,'TSFC',120,current&&{id:current.id,M:current.M,v:current.TSFC},hoverM);
  return data;
}
/* values of every engine at one Mach, for the hover tooltip and the table twin */
function valuesAt(data,M){const out=[];for(const id in data){const pts=data[id];if(M<pts[0].M-0.05||M>pts[pts.length-1].M+0.05){out.push({id,label:SERIES[id].label,color:SERIES[id].color});continue;}let j=0;while(j<pts.length-2&&pts[j+1].M<M)j++;const f=clamp((M-pts[j].M)/(pts[j+1].M-pts[j].M),0,1);out.push({id,label:SERIES[id].label,color:SERIES[id].color,Fsp:lerp(pts[j].Fsp,pts[j+1].Fsp,f),TSFC:lerp(pts[j].TSFC,pts[j+1].TSFC,f)});}return out;}

/* T-s diagram of the current engine: total conditions at each station, entropy relative to ambient */
function drawCycle(canvas,R,id){
  const {g,w,h}=prep(canvas),col=ink();const x0=44,x1=w-10,y0=h-20,y1=14;
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

export {SERIES,RANGE,sweep,drawComparison,drawCycle,valuesAt};
