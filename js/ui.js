/* UI: tabs, sliders, start/stop, views, instruments, temperatures, charts, scenarios, tour, camera presets and tooltip */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {$,fmt,tFrac,cssLUT,cssGradient,LUT,VIEWS,clamp} from './core/utils.js';
import {state,PARTICLES} from './state.js';
import {scene,camera,controls,canvas,grid,flyTo} from './core/scene.js';
import {cutPlanes,inCut} from './core/cuts.js';
import {Flow} from './core/flow.js';
import {Dynamics} from './core/dynamics.js';
import {ENGINES} from './engines/index.js';
import {SERIES,drawComparison,drawCycle,valuesAt} from './core/charts.js';

export const ui={thr:$('#throttle'),wind:$('#wind'),alt:$('#alt'),ts:$('#tscale'),thrOut:$('#thrOut'),windOut:$('#windOut'),altOut:$('#altOut'),tsOut:$('#tsOut'),engBtn:$('#engBtn'),fadec:$('#fadec'),status:$('#status'),statusText:$('#statusText'),warnings:$('#warnings'),readouts:$('#readouts'),temps:$('#temps'),blurb:$('#blurb'),legend:$('#legend'),tip:$('#tip'),panel:$('#panel'),chart:$('#chart'),chartTip:$('#chartTip'),chartLegend:$('#chartLegend'),chartNote:$('#chartNote'),chartTable:$('#chartTable'),presets:$('#presets'),tour:$('#tour'),hint:$('#hint'),pause:$('#pauseBtn')};
/* active engine, its catalog entry, the dynamics and the latest thermodynamic result */
export const app={engine:null,def:null,R:null,a0:340,flow:null,dyn:new Dynamics(),roCells:[],tRows:[],timers:[],tourI:-1,chartHover:null,chartData:null,tableOpen:false};

function setFlow(level){if(app.flow){scene.remove(app.flow.group);app.flow.dispose();}app.flow=new Flow(PARTICLES[level]||PARTICLES.medium);app.flow.group.visible=state.flow;scene.add(app.flow.group);if(app.engine)app.flow.reset(app.engine);}
const metalOf=(R,key,cool)=>{const T=R.st[key].T;const Tc=R.Tcool??R.T0;return cool&&T>Tc?T-cool*(T-Tc):T;};

function buildPanel(){
  const {engine,R,def}=app;
  ui.readouts.innerHTML='';app.roCells=[];
  for(const [k] of engine.readouts(R)){const d=document.createElement('div');d.className='ro';d.innerHTML=`<span class="k">${k}</span><span class="v"></span>`;ui.readouts.appendChild(d);app.roCells.push(d.querySelector('.v'));}
  ui.temps.innerHTML='';app.tRows=[];
  for(const [name] of engine.table){const d=document.createElement('div');d.className='tr';d.innerHTML=`<span class="chip"></span><span class="n">${name}</span><span class="t"></span><span class="bar"><i></i></span>`;ui.temps.appendChild(d);app.tRows.push({chip:d.querySelector('.chip'),t:d.querySelector('.t'),bar:d.querySelector('.bar i')});}
  ui.presets.innerHTML='';
  for(const p of def.presets){const b=document.createElement('button');b.className='preset';b.innerHTML=`<b>${p.name}</b><small>${p.desc}</small>`;b.addEventListener('click',()=>runPreset(p));ui.presets.appendChild(b);}
  ui.chartLegend.innerHTML=Object.entries(SERIES).map(([id,s])=>`<span><i style="background:${s.color}"></i>${s.label}</span>`).join('');
  buildLegend();
}
export function buildLegend(){const VW=VIEWS[state.view];const lut=LUT[VW.lut];ui.legend.querySelector('.lbl').textContent=VW.label+(state.view==='thermal'?(state.thermalMode==='metal'?' del metal':' del gas'):'');ui.legend.querySelector('.bar').style.background=cssGradient(lut);const ticks=ui.legend.querySelector('.ticks');ticks.innerHTML='';for(const [f,l] of VW.ticks){const s=document.createElement('span');s.style.left=(f*100)+'%';s.textContent=l;ticks.appendChild(s);}}
function engineButton(){const d=app.dyn;if(d.turbo){const on=d.mode!=='off';ui.engBtn.textContent=on?'Cortar combustible':'Arrancar';ui.engBtn.className='btn'+(on?' off':'');}else{ui.engBtn.textContent=d.fuelOn?'Cortar combustible':'Inyectar combustible';ui.engBtn.className='btn'+(d.fuelOn?' off':'');}}
export function updatePanel(){
  const {engine,R}=app;const VW=VIEWS[state.view==='mat'?'mat':state.view];const lut=LUT[state.view==='thermal'?'iron':'flow'];
  const ro=engine.readouts(R);for(let i=0;i<app.roCells.length;i++){app.roCells[i].innerHTML=ro[i][1]+(ro[i][2]?`<small>${ro[i][2]}</small>`:'');}
  for(let i=0;i<app.tRows.length;i++){const [,key,cool]=engine.table[i];const Tg=R.st[key].T,Tm=metalOf(R,key,cool);const row=app.tRows[i];row.chip.style.background=cssLUT(tFrac(Tg),lut);row.t.innerHTML=fmt(Tg-273.15)+' °C'+(cool?`<small>metal ${fmt(Tm-273.15)}</small>`:'');row.bar.style.width=(tFrac(Tg)*100)+'%';row.bar.style.background=cssLUT(tFrac(Tg),lut);}
  ui.status.className=R.level;ui.statusText.textContent=R.status;
  ui.warnings.innerHTML=R.warnings.map(([lv,t])=>`<span class="wchip ${lv}">${t}</span>`).join('');
  ui.windOut.textContent=`M ${fmt(state.mach,2)} · ${fmt(R.V0*3.6)} km/h`;ui.altOut.textContent=`${fmt(state.alt)} m · ${fmt(R.T0-273.15)} °C`;
  engineButton();drawChart();
}
function drawChart(){
  const {engine,R}=app;
  if(state.chart==='compare'){app.chartData=drawComparison(ui.chart,state.alt,{id:state.engine,M:state.mach,Fsp:R.Fsp,TSFC:R.TSFC*1e6},app.chartHover);ui.chartLegend.hidden=false;
    ui.chartNote.textContent=`Gas a fondo, a ${fmt(state.alt)} m para los cuatro. El punto marca el régimen actual. Empuje por kg/s de aire y combustible por kN y segundo: por eso el turbofan gana en crucero y el estatorreactor solo existe a partir de M 1.`;
    if(app.chartHover!==null){const vals=valuesAt(app.chartData,app.chartHover);ui.chartTip.hidden=false;ui.chartTip.innerHTML=`<b>M ${fmt(app.chartHover,1)}</b><br>`+vals.map(v=>`<span class="k" style="background:${v.color}"></span>${v.label}: ${v.Fsp!==undefined?fmt(v.Fsp)+' N·s/kg · '+fmt(v.TSFC)+' g/kN·s':'fuera de rango'}`).join('<br>');}else ui.chartTip.hidden=true;}
  else{drawCycle(ui.chart,R,state.engine);ui.chartLegend.hidden=true;ui.chartTip.hidden=true;ui.chartNote.textContent='Temperatura total frente a entropía en cada estación. Compresión casi vertical, calor a presión constante, expansión en la turbina y la tobera. El área encerrada es el trabajo útil por kg de aire.';}
  if(app.tableOpen)fillTable();
}
function fillTable(){
  const {R}=app;let html;
  if(state.chart==='compare'){const Ms=[0,0.5,0.9,1.5,2,3,4,5,6,7,8,10];html='<table><thead><tr><th>Mach</th>'+Object.values(SERIES).map(s=>`<th>${s.label}<br>N·s/kg · g/kN·s</th>`).join('')+'</tr></thead><tbody>'+Ms.map(M=>'<tr><td>M '+fmt(M,1)+'</td>'+valuesAt(app.chartData||{},M).map(v=>`<td>${v.Fsp!==undefined?fmt(v.Fsp)+' · '+fmt(v.TSFC):'—'}</td>`).join('')+'</tr>').join('')+'</tbody></table>';}
  else{html='<table><thead><tr><th>Estación</th><th>T total K</th><th>P / P₀</th><th>Velocidad m/s</th></tr></thead><tbody>'+R.cycle.map(([n,k])=>`<tr><td>${n} · ${k}</td><td>${fmt(R.st[k].T)}</td><td>${fmt(R.st[k].P/R.P0,1)}</td><td>${fmt(R.st[k].V)}</td></tr>`).join('')+'</tbody></table>';}
  ui.chartTable.innerHTML=html;
}
export function applyView(){for(const p of app.engine.parts)p.mesh.material=state.view==='mat'?p.matN:p.matT;grid.material.opacity=state.view==='mat'?0.7:0.35;document.querySelectorAll('#viewMode button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===state.view));$('#thermalMode').hidden=state.view!=='thermal';document.querySelectorAll('#thermalMode button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===state.thermalMode));buildLegend();}
export function applyCut(){app.engine.setCut(state.cut);document.querySelectorAll('#cutMode button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.c===state.cut));}
function setSliders(){ui.wind.value=state.mach;ui.thr.value=Math.round(state.throttle*100);ui.alt.value=state.alt;ui.ts.value=state.tscale;ui.fadec.checked=state.fadec;ui.thrOut.textContent=`${Math.round(state.throttle*100)} %`;ui.tsOut.textContent=`×${fmt(state.tscale,2)}`;ui.windOut.textContent=`M ${fmt(state.mach,2)} · ${fmt(state.mach*app.a0*3.6)} km/h`;ui.altOut.textContent=`${fmt(state.alt)} m`;}
export function loadEngine(id){
  for(const t of app.timers)clearTimeout(t);app.timers=[];closeTour();
  if(app.engine){scene.remove(app.engine.group);app.engine.dispose();}
  state.engine=id;const def=app.def=ENGINES[id];Object.assign(state,def.defaults);state.hover=null;state.highlight=null;state.fadec=true;ui.tip.hidden=true;
  const engine=app.engine=def.build();scene.add(engine.group);app.a0=def.thermo({...def.defaults,t:0,M:1,alt:state.alt,N1:0,N2:0,N:0,fuel:0}).V0;
  ui.wind.max=def.machMax;ui.wind.step=def.machMax>3?0.05:0.01;ui.alt.max=def.altMax;setSliders();
  app.dyn.reset(id,state.throttle);
  app.R=def.thermo(app.dyn.step(0,state,null));app.dyn.annotate(app.R,state);
  applyCut();applyView();
  camera.position.set(...engine.cam.pos);controls.target.set(...engine.cam.target);controls.update();
  if(!app.flow)setFlow(state.particles);else app.flow.reset(engine);
  buildPanel();updatePanel();ui.blurb.innerHTML=def.blurb;
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.engine===id));
}

/* scenario presets */
function runPreset(p){
  for(const t of app.timers)clearTimeout(t);app.timers=[];
  const api={set(f){if(f.throttle!==undefined)state.throttle=f.throttle;if(f.mach!==undefined)state.mach=Math.min(f.mach,app.def.machMax);if(f.alt!==undefined)state.alt=Math.min(f.alt,app.def.altMax);if(f.fadec!==undefined)state.fadec=f.fadec;if(f.view!==undefined){state.view=f.view;applyView();}if(f.cut!==undefined){state.cut=f.cut;applyCut();}setSliders();},
    start:()=>app.dyn.start(),cut:()=>app.dyn.cut(),stop:()=>app.dyn.stop(),after:(ms,fn)=>app.timers.push(setTimeout(fn,ms))};
  state.paused=false;ui.pause.setAttribute('aria-pressed','false');ui.pause.textContent='⏸ Pausa';
  p.run(api);engineButton();
}

/* guided tour */
function showTour(i){const steps=app.engine.tour;if(!steps.length)return;app.tourI=clamp(i,0,steps.length-1);const s=steps[app.tourI];
  $('#tourTitle').textContent=`${app.tourI+1}. ${s.title}`;$('#tourText').textContent=s.text;$('#tourN').textContent=`${app.tourI+1} / ${steps.length}`;
  $('#tourPrev').disabled=app.tourI===0;$('#tourNext').textContent=app.tourI===steps.length-1?'Terminar':'Siguiente ▶';
  ui.tour.hidden=false;ui.hint.hidden=true;flyTo(s.cam.pos,s.cam.target,1.2);
  state.highlight=app.engine.parts.find(p=>p.name.includes(s.part))||null;}
function closeTour(){app.tourI=-1;ui.tour.hidden=true;ui.hint.hidden=false;state.highlight=null;}

/* part picking with the pointer */
export const pointer={x:0,y:0,due:false,last:0};
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
export function pick(){
  const {engine,R}=app;
  const rect=canvas.getBoundingClientRect();ndc.set(((pointer.x-rect.left)/rect.width)*2-1,-((pointer.y-rect.top)/rect.height)*2+1);ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects(engine.parts.filter(p=>p.pick).map(p=>p.mesh),false);
  let found=null;const planes=cutPlanes(engine,state.cut);
  for(const h of hits){const p=h.object.userData.part;if(p.casing&&inCut(h.point,planes))continue;found=p;break;}
  state.hover=found;
  if(found){const g=found.gas(R),Tm=found.metal(R);const rpm=found.spool&&R.rpm[found.spool];
    ui.tip.innerHTML=`<b>${found.name}</b>${found.desc?`<div class="d">${found.desc}</div>`:''}<div class="g"><span>Gas</span><span><em>${fmt(g.T-273.15)} °C</em></span>${found.cool?`<span>Metal</span><span><em>${fmt(Tm-273.15)} °C</em> <small>refrigerado</small></span>`:''}<span>Presión</span><span>${fmt(g.P/R.P0,1)} × ambiente</span><span>Velocidad</span><span>${fmt(g.V)} m/s</span>${rpm?`<span>Régimen</span><span>${fmt(rpm)} rpm</span>`:''}</div>`;
    ui.tip.hidden=false;const box=$('#app').getBoundingClientRect();const tw=ui.tip.offsetWidth,th=ui.tip.offsetHeight;
    let lx=pointer.x-box.left+16,ly=pointer.y-box.top+16;if(lx+tw>box.width-8)lx=pointer.x-box.left-tw-12;if(ly+th>box.height-8)ly=pointer.y-box.top-th-12;ui.tip.style.left=lx+'px';ui.tip.style.top=ly+'px';}
  else ui.tip.hidden=true;
}

export function initUI(){
  document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>loadEngine(b.dataset.engine)));
  document.querySelectorAll('#viewMode button').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.v;applyView();}));
  document.querySelectorAll('#thermalMode button').forEach(b=>b.addEventListener('click',()=>{state.thermalMode=b.dataset.m;applyView();}));
  document.querySelectorAll('#cutMode button').forEach(b=>b.addEventListener('click',()=>{state.cut=b.dataset.c;applyCut();}));
  document.querySelectorAll('#camMode button').forEach(b=>b.addEventListener('click',()=>{const v=app.engine.views()[b.dataset.cam];if(v)flyTo(v.pos,v.target,1.0);}));
  document.querySelectorAll('#chartMode button').forEach(b=>b.addEventListener('click',()=>{state.chart=b.dataset.ch;document.querySelectorAll('#chartMode button').forEach(x=>x.setAttribute('aria-pressed',x===b));app.chartHover=null;drawChart();}));
  ui.thr.addEventListener('input',()=>{state.throttle=ui.thr.value/100;ui.thrOut.textContent=`${ui.thr.value} %`;});
  ui.wind.addEventListener('input',()=>{state.mach=parseFloat(ui.wind.value);ui.windOut.textContent=`M ${fmt(state.mach,2)} · ${fmt(state.mach*app.a0*3.6)} km/h`;});
  ui.alt.addEventListener('input',()=>{state.alt=parseFloat(ui.alt.value);ui.altOut.textContent=`${fmt(state.alt)} m`;});
  ui.ts.addEventListener('input',()=>{state.tscale=parseFloat(ui.ts.value);ui.tsOut.textContent=`×${fmt(state.tscale,2)}`;});
  ui.engBtn.addEventListener('click',()=>{app.dyn.toggle();engineButton();});
  ui.fadec.addEventListener('change',e=>{state.fadec=e.target.checked;});
  ui.pause.addEventListener('click',()=>{state.paused=!state.paused;ui.pause.setAttribute('aria-pressed',String(state.paused));ui.pause.textContent=state.paused?'▶ Reanudar':'⏸ Pausa';});
  $('#particles').value=state.particles;$('#particles').addEventListener('change',e=>{state.particles=e.target.value;setFlow(state.particles);});
  $('#showFlow').addEventListener('change',e=>{state.flow=e.target.checked;app.flow.group.visible=state.flow;});
  $('#bloom').checked=state.bloom;$('#bloom').addEventListener('change',e=>{state.bloom=e.target.checked;});
  $('#tableBtn').addEventListener('click',e=>{app.tableOpen=!app.tableOpen;ui.chartTable.hidden=!app.tableOpen;e.target.setAttribute('aria-expanded',String(app.tableOpen));e.target.textContent=app.tableOpen?'Ocultar tabla':'Ver tabla';if(app.tableOpen)fillTable();});
  ui.chart.addEventListener('pointermove',e=>{if(state.chart!=='compare')return;const r=ui.chart.getBoundingClientRect();const x=(e.clientX-r.left-40)/(r.width-48);app.chartHover=x>=0&&x<=1?Math.round(x*100)/10:null;drawChart();});
  ui.chart.addEventListener('pointerleave',()=>{app.chartHover=null;drawChart();});
  $('#tourBtn').addEventListener('click',()=>showTour(0));
  $('#tourPrev').addEventListener('click',()=>showTour(app.tourI-1));
  $('#tourNext').addEventListener('click',()=>{if(app.tourI>=app.engine.tour.length-1)closeTour();else showTour(app.tourI+1);});
  $('#tourClose').addEventListener('click',closeTour);
  $('#panelToggle').addEventListener('click',()=>{const c=ui.panel.classList.toggle('collapsed');$('#panelToggle').setAttribute('aria-expanded',String(!c));$('#panelToggle').textContent=(c?'▴':'▾')+' Instrumentos';});
  canvas.addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.due=true;});
  canvas.addEventListener('pointerdown',e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.due=true;pointer.last=0;});
  canvas.addEventListener('pointerleave',()=>{state.hover=null;ui.tip.hidden=true;});
  document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;if(e.key===' '){e.preventDefault();ui.pause.click();}});
}
