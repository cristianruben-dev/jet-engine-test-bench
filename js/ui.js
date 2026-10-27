/* UI: tabs, sliders, instruments, legend, tooltip and engine loading */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {$,fmt,tFrac,cssTemp,cssGradient,LUT,isMobile} from './core/utils.js';
import {state} from './state.js';
import {scene,camera,controls,canvas,grid} from './core/scene.js';
import {cutPlanes,inCut} from './core/cuts.js';
import {Flow} from './core/flow.js';
import {ENGINES} from './engines/index.js';

export const ui={thr:$('#throttle'),wind:$('#wind'),ts:$('#tscale'),thrOut:$('#thrOut'),windOut:$('#windOut'),tsOut:$('#tsOut'),status:$('#status'),statusText:$('#statusText'),readouts:$('#readouts'),temps:$('#temps'),blurb:$('#blurb'),legend:$('#legend'),tip:$('#tip'),panel:$('#panel')};
/* active engine, its catalog entry and the latest thermodynamic result */
export const app={engine:null,def:null,R:null,a0:340,flow:new Flow(isMobile?2600:6000),roCells:[],tRows:[]};
scene.add(app.flow.group);

function buildPanel(){
  ui.readouts.innerHTML='';app.roCells=[];
  for(const [k] of app.engine.readouts(app.R)){const d=document.createElement('div');d.className='ro';d.innerHTML=`<span class="k">${k}</span><span class="v"></span>`;ui.readouts.appendChild(d);app.roCells.push(d.querySelector('.v'));}
  ui.temps.innerHTML='';app.tRows=[];
  for(const [name] of app.engine.table){const d=document.createElement('div');d.className='tr';d.innerHTML=`<span class="chip"></span><span class="n">${name}</span><span class="t"></span><span class="bar"><i></i></span>`;ui.temps.appendChild(d);app.tRows.push({chip:d.querySelector('.chip'),t:d.querySelector('.t'),bar:d.querySelector('.bar i')});}
  buildLegend();
}
export function buildLegend(){const lut=state.view==='thermal'?LUT.iron:LUT.flow;ui.legend.querySelector('.bar').style.background=cssGradient(lut);const ticks=ui.legend.querySelector('.ticks');ticks.innerHTML='';for(const c of [0,300,700,1200,1800]){const s=document.createElement('span');s.style.left=(tFrac(c+273.15)*100)+'%';s.textContent=c+' °C';ticks.appendChild(s);}}
export function updatePanel(){
  const {engine,R}=app;const lut=state.view==='thermal'?LUT.iron:LUT.flow;
  const ro=engine.readouts(R);for(let i=0;i<app.roCells.length;i++){app.roCells[i].innerHTML=ro[i][1]+(ro[i][2]?`<small>${ro[i][2]}</small>`:'');}
  for(let i=0;i<app.tRows.length;i++){const T=engine.table[i][1](R);const row=app.tRows[i];row.chip.style.background=cssTemp(T,lut);row.t.textContent=fmt(T-273.15)+' °C';row.bar.style.width=(tFrac(T)*100)+'%';row.bar.style.background=cssTemp(T,lut);}
  ui.status.className=R.level;ui.statusText.textContent=R.status;
  ui.windOut.textContent=`M ${fmt(state.mach,2)} · ${fmt(R.V0*3.6)} km/h`;
}
export function applyView(){for(const p of app.engine.parts)p.mesh.material=state.view==='thermal'?p.matT:p.matN;grid.material.opacity=state.view==='thermal'?0.35:0.7;document.querySelectorAll('#viewMode button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===state.view));buildLegend();}
export function applyCut(){app.engine.setCut(state.cut);document.querySelectorAll('#cutMode button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.c===state.cut));}
export function loadEngine(id){
  if(app.engine){scene.remove(app.engine.group);app.engine.dispose();}
  state.engine=id;const def=app.def=ENGINES[id];Object.assign(state,def.defaults);state.hover=null;ui.tip.hidden=true;
  const engine=app.engine=def.build();scene.add(engine.group);app.a0=def.thermo(0,1).V0;
  ui.wind.max=def.machMax;ui.wind.step=def.machMax>3?0.05:0.01;ui.wind.value=state.mach;ui.thr.value=Math.round(state.throttle*100);ui.ts.value=state.tscale;
  ui.thrOut.textContent=`${Math.round(state.throttle*100)} %`;ui.tsOut.textContent=`×${fmt(state.tscale,2)}`;
  app.R=def.thermo(state.throttle,state.mach);
  applyCut();applyView();
  camera.position.set(...engine.cam.pos);controls.target.set(...engine.cam.target);controls.update();
  app.flow.reset(engine);buildPanel();updatePanel();ui.blurb.innerHTML=def.blurb;
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.engine===id));
}

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
  if(found){const T=found.T(R);const rpm=found.spool&&R.rpm[found.spool];
    ui.tip.innerHTML=`<b>${found.name}</b>${found.desc?`<div class="d">${found.desc}</div>`:''}<div class="m"><em>${fmt(T-273.15)} °C</em>${rpm?` · ${fmt(rpm)} rpm`:''}</div>`;
    ui.tip.hidden=false;const box=$('#app').getBoundingClientRect();const tw=ui.tip.offsetWidth,th=ui.tip.offsetHeight;
    let lx=pointer.x-box.left+16,ly=pointer.y-box.top+16;if(lx+tw>box.width-8)lx=pointer.x-box.left-tw-12;if(ly+th>box.height-8)ly=pointer.y-box.top-th-12;ui.tip.style.left=lx+'px';ui.tip.style.top=ly+'px';}
  else ui.tip.hidden=true;
}

export function initUI(){
  document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>loadEngine(b.dataset.engine)));
  document.querySelectorAll('#viewMode button').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.v;applyView();}));
  document.querySelectorAll('#cutMode button').forEach(b=>b.addEventListener('click',()=>{state.cut=b.dataset.c;applyCut();}));
  ui.thr.addEventListener('input',()=>{state.throttle=ui.thr.value/100;ui.thrOut.textContent=`${ui.thr.value} %`;});
  ui.wind.addEventListener('input',()=>{state.mach=parseFloat(ui.wind.value);ui.windOut.textContent=`M ${fmt(state.mach,2)} · ${fmt(state.mach*app.a0*3.6)} km/h`;});
  ui.ts.addEventListener('input',()=>{state.tscale=parseFloat(ui.ts.value);ui.tsOut.textContent=`×${fmt(state.tscale,2)}`;});
  $('#showFlow').addEventListener('change',e=>{state.flow=e.target.checked;app.flow.group.visible=state.flow;});
  $('#bloom').checked=state.bloom;$('#bloom').addEventListener('change',e=>{state.bloom=e.target.checked;});
  $('#panelToggle').addEventListener('click',()=>{const c=ui.panel.classList.toggle('collapsed');$('#panelToggle').setAttribute('aria-expanded',String(!c));$('#panelToggle').textContent=(c?'▴':'▾')+' Instrumentos';});
  canvas.addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.due=true;});
  canvas.addEventListener('pointerdown',e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.due=true;pointer.last=0;});
  canvas.addEventListener('pointerleave',()=>{state.hover=null;ui.tip.hidden=true;});
}
