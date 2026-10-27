/* UI: engine tabs, sliders, start/stop, view toolbar, legend, instrument panel (head with key instruments,
   tabbed body: instruments, charts, scenarios, settings), guided tour, camera presets and the part tooltip */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {$,fmt,tFrac,cssLUT,cssGradient,LUT,VIEWS,clamp} from './core/utils.js';
import {state,PARTICLES} from './state.js';
import {scene,camera,controls,canvas,grid,flyTo} from './core/scene.js';
import {cutPlanes,inCut} from './core/cuts.js';
import {Flow} from './core/flow.js';
import {Dynamics} from './core/dynamics.js';
import {ENGINES} from './engines/index.js';
import {SERIES,drawComparison,drawCycle,valuesAt} from './core/charts.js';

export const ui={thr:$('#throttle'),wind:$('#wind'),alt:$('#alt'),ts:$('#tscale'),thrOut:$('#thrOut'),windOut:$('#windOut'),altOut:$('#altOut'),tsOut:$('#tsOut'),engBtn:$('#engBtn'),fadec:$('#fadec'),status:$('#status'),statusText:$('#statusText'),warnings:$('#warnings'),readouts:$('#readouts'),temps:$('#temps'),blurb:$('#blurb'),legend:$('#legend'),tip:$('#tip'),panel:$('#panel'),body:$('#panelBody'),hud:$('#hud'),chart:$('#chart'),chartTip:$('#chartTip'),chartLegend:$('#chartLegend'),chartNote:$('#chartNote'),chartTable:$('#chartTable'),presets:$('#presets'),tour:$('#tour'),hint:$('#hint'),pause:$('#pauseBtn'),app:$('#app')};
/* active engine, its catalog entry, the dynamics and the latest thermodynamic result */
export const app={engine:null,def:null,R:null,a0:340,flow:null,dyn:new Dynamics(),roCells:[],tRows:[],hudCells:[],timers:[],tourI:-1,chartHover:null,chartData:null,tableOpen:false,pane:'inst',preset:null};

const VIEW_KEYS=['mat','thermal','pressure','velocity'],CUT_KEYS=['none','quarter','half'];
const mobileQuery=matchMedia('(max-width:760px)');
/* filled portion of a range input, read by the track gradient */
const fill=el=>{el.style.setProperty('--p',((el.value-el.min)/(el.max-el.min)*100||0)+'%');};
function setFlow(level){if(app.flow){scene.remove(app.flow.group);app.flow.dispose();}app.flow=new Flow(PARTICLES[level]||PARTICLES.medium);app.flow.group.visible=state.flow;scene.add(app.flow.group);if(app.engine)app.flow.reset(app.engine);}
const metalOf=(R,key,cool)=>{const T=R.st[key].T;const Tc=R.Tcool??R.T0;return cool&&T>Tc?T-cool*(T-Tc):T;};
const cell=(cls,k)=>{const d=document.createElement('div');d.className=cls;d.innerHTML=`<span class="k">${k}</span><span class="v"></span>`;return d;};

function buildPanel(){
  const {engine,R,def}=app;const ro=engine.readouts(R);
  ui.readouts.innerHTML='';app.roCells=[];
  for(const [k] of ro){const d=cell('ro',k);ui.readouts.appendChild(d);app.roCells.push(d.querySelector('.v'));}
  /* key instruments shown in the panel head whatever tab is open */
  ui.hud.innerHTML='';app.hudCells=[];
  for(const h of engine.hud||[0,1,2,3]){const [i,label]=Array.isArray(h)?h:[h,ro[h]&&ro[h][0]];if(!ro[i])continue;const d=cell('hc',label);ui.hud.appendChild(d);app.hudCells.push({i,v:d.querySelector('.v')});}
  ui.temps.innerHTML='';app.tRows=[];
  for(const [name] of engine.table){const d=document.createElement('div');d.className='tr';d.innerHTML=`<span class="chip"></span><span class="n">${name}</span><span class="t"></span><span class="bar"><i></i></span>`;ui.temps.appendChild(d);app.tRows.push({chip:d.querySelector('.chip'),t:d.querySelector('.t'),bar:d.querySelector('.bar i')});}
  ui.presets.innerHTML='';
  for(const p of def.presets){const b=document.createElement('button');b.className='preset';b.innerHTML=`<b>${p.name}</b><small>${p.desc}</small><span class="play">▶</span>`;b.addEventListener('click',()=>runPreset(p,b));ui.presets.appendChild(b);}
  ui.chartLegend.innerHTML=Object.entries(SERIES).map(([id,s])=>`<span><i style="background:${s.color}"></i>${s.label}</span>`).join('');
  buildLegend();
}
export function buildLegend(){const VW=VIEWS[state.view];const lut=LUT[VW.lut];ui.legend.querySelector('.lbl').textContent=(VW.short||VW.label)+(state.view==='thermal'?(state.thermalMode==='metal'?' del metal':' del gas'):'');ui.legend.querySelector('.bar').style.background=cssGradient(lut);const ticks=ui.legend.querySelector('.ticks');ticks.innerHTML='';for(const [f,l] of VW.ticks){const s=document.createElement('span');s.style.left=(f*100)+'%';s.textContent=l;ticks.appendChild(s);}}
function engineButton(){const d=app.dyn;const on=d.running;ui.engBtn.textContent=on?'Cortar combustible':(d.turbo?'Arrancar':'Inyectar combustible');ui.engBtn.className='btn '+(on?'danger':'go');}
const roText=r=>r[1]+(r[2]?`<small>${r[2]}</small>`:'');
export function updatePanel(){
  const {engine,R}=app;const lut=LUT[state.view==='thermal'?'iron':'flow'];
  const ro=engine.readouts(R);for(let i=0;i<app.roCells.length;i++)app.roCells[i].innerHTML=roText(ro[i]);
  for(const h of app.hudCells)h.v.innerHTML=roText(ro[h.i]);
  for(let i=0;i<app.tRows.length;i++){const [,key,cool]=engine.table[i];const Tg=R.st[key].T,Tm=metalOf(R,key,cool);const row=app.tRows[i];row.chip.style.background=cssLUT(tFrac(Tg),lut);row.t.innerHTML=fmt(Tg-273.15)+' °C'+(cool?`<small>metal ${fmt(Tm-273.15)}</small>`:'');row.bar.style.width=(tFrac(Tg)*100)+'%';row.bar.style.background=cssLUT(tFrac(Tg),lut);}
  ui.status.className=R.level;ui.statusText.textContent=R.status;
  ui.warnings.innerHTML=R.warnings.map(([lv,t])=>`<span class="wchip ${lv}">${t}</span>`).join('');
  ui.windOut.textContent=`M ${fmt(state.mach,2)} · ${fmt(R.V0*3.6)} km/h`;ui.altOut.textContent=`${fmt(state.alt)} m · ${fmt(R.T0-273.15)} °C`;
  engineButton();if(app.pane==='charts')drawChart();
}
function drawChart(){
  const {R}=app;
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
function setSliders(){ui.wind.value=state.mach;ui.thr.value=Math.round(state.throttle*100);ui.alt.value=state.alt;ui.ts.value=state.tscale;ui.fadec.checked=state.fadec;ui.thrOut.textContent=`${Math.round(state.throttle*100)} %`;ui.tsOut.textContent=`×${fmt(state.tscale,2)}`;ui.windOut.textContent=`M ${fmt(state.mach,2)} · ${fmt(state.mach*app.a0*3.6)} km/h`;ui.altOut.textContent=`${fmt(state.alt)} m`;[ui.wind,ui.thr,ui.alt,ui.ts].forEach(fill);}
function setPause(p){state.paused=p;ui.pause.setAttribute('aria-pressed',String(p));ui.pause.textContent=p?'▶':'⏸';ui.pause.setAttribute('aria-label',p?'Reanudar':'Pausa');ui.pause.title=p?'Reanudar (espacio)':'Pausa (espacio)';}
function setPane(name){app.pane=name;document.querySelectorAll('#ptabs button').forEach(b=>{const on=b.dataset.p===name;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});document.querySelectorAll('#panelBody .pane').forEach(p=>{p.hidden=p.dataset.pane!==name;});ui.body.scrollTop=0;if(name==='charts')drawChart();}
function markPreset(b){document.querySelectorAll('.preset').forEach(x=>x.removeAttribute('aria-current'));if(b)b.setAttribute('aria-current','true');app.preset=b||null;}
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
  buildPanel();updatePanel();ui.blurb.innerHTML=def.blurb;markPreset(null);
  document.querySelectorAll('#tabs button').forEach(b=>{const on=b.dataset.engine===id;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
  if(app.pane==='charts')drawChart();
}

/* scenario presets */
function runPreset(p,btn){
  for(const t of app.timers)clearTimeout(t);app.timers=[];
  const api={set(f){if(f.throttle!==undefined)state.throttle=f.throttle;if(f.mach!==undefined)state.mach=Math.min(f.mach,app.def.machMax);if(f.alt!==undefined)state.alt=Math.min(f.alt,app.def.altMax);if(f.fadec!==undefined)state.fadec=f.fadec;if(f.view!==undefined){state.view=f.view;applyView();}if(f.cut!==undefined){state.cut=f.cut;applyCut();}setSliders();},
    start:()=>app.dyn.start(),cut:()=>app.dyn.cut(),stop:()=>app.dyn.stop(),after:(ms,fn)=>app.timers.push(setTimeout(fn,ms))};
  setPause(false);markPreset(btn);
  p.run(api);engineButton();
}

/* guided tour: the card replaces the engine description under the tabs */
function showTour(i){const steps=app.engine.tour;if(!steps.length)return;app.tourI=clamp(i,0,steps.length-1);const s=steps[app.tourI];
  $('#tourTitle').textContent=`${app.tourI+1}. ${s.title}`;$('#tourText').textContent=s.text;$('#tourN').textContent=`Paso ${app.tourI+1} de ${steps.length}`;
  $('#tourDots').innerHTML=steps.map((_,k)=>`<i class="${k===app.tourI?'on':''}"></i>`).join('');
  $('#tourPrev').disabled=app.tourI===0;$('#tourNext').textContent=app.tourI===steps.length-1?'Terminar':'Siguiente ▶';
  ui.tour.hidden=false;ui.blurb.hidden=true;ui.hint.classList.add('fade');flyTo(s.cam.pos,s.cam.target,1.2);
  state.highlight=app.engine.parts.find(p=>p.name.includes(s.part))||null;
  if(mobileQuery.matches&&!ui.panel.classList.contains('collapsed'))togglePanel(true);}
function closeTour(){app.tourI=-1;ui.tour.hidden=true;ui.blurb.hidden=false;state.highlight=null;}

/* bottom sheet on phones: the canvas sits above it, so its height is handed to the stylesheet */
function togglePanel(collapse){const c=ui.panel.classList.toggle('collapsed',collapse);$('#panelToggle').setAttribute('aria-expanded',String(!c));$('#panelToggle').textContent=c?'Mostrar panel':'Instrumentos';}
function sheetHeight(){const a=ui.app.getBoundingClientRect(),p=ui.panel.getBoundingClientRect();ui.app.style.setProperty('--sheet',mobileQuery.matches?Math.max(0,a.bottom-p.top)+'px':'0px');}

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
    ui.tip.hidden=false;const box=ui.app.getBoundingClientRect();const tw=ui.tip.offsetWidth,th=ui.tip.offsetHeight;
    let lx=pointer.x-box.left+16,ly=pointer.y-box.top+16;if(lx+tw>box.width-8)lx=pointer.x-box.left-tw-12;if(ly+th>box.height-8)ly=pointer.y-box.top-th-12;ui.tip.style.left=lx+'px';ui.tip.style.top=ly+'px';}
  else ui.tip.hidden=true;
}

/* arrow keys move between the buttons of a tab list */
function rovingTabs(nav){nav.addEventListener('keydown',e=>{if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;const bs=[...nav.querySelectorAll('button')];const i=bs.indexOf(document.activeElement);if(i<0)return;e.preventDefault();const n=bs[(i+(e.key==='ArrowRight'?1:bs.length-1))%bs.length];n.focus();n.click();});}

export function initUI(){
  document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>loadEngine(b.dataset.engine)));
  document.querySelectorAll('#ptabs button').forEach(b=>b.addEventListener('click',()=>setPane(b.dataset.p)));
  rovingTabs($('#tabs'));rovingTabs($('#ptabs'));
  document.querySelectorAll('#viewMode button').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.v;applyView();}));
  document.querySelectorAll('#thermalMode button').forEach(b=>b.addEventListener('click',()=>{state.thermalMode=b.dataset.m;applyView();}));
  document.querySelectorAll('#cutMode button').forEach(b=>b.addEventListener('click',()=>{state.cut=b.dataset.c;applyCut();}));
  document.querySelectorAll('#camMode button').forEach(b=>b.addEventListener('click',()=>{const v=app.engine.views()[b.dataset.cam];if(v)flyTo(v.pos,v.target,1.0);}));
  document.querySelectorAll('#chartMode button').forEach(b=>b.addEventListener('click',()=>{state.chart=b.dataset.ch;document.querySelectorAll('#chartMode button').forEach(x=>x.setAttribute('aria-pressed',x===b));app.chartHover=null;drawChart();}));
  const manual=()=>markPreset(null);
  ui.thr.addEventListener('input',()=>{state.throttle=ui.thr.value/100;ui.thrOut.textContent=`${ui.thr.value} %`;fill(ui.thr);manual();});
  ui.wind.addEventListener('input',()=>{state.mach=parseFloat(ui.wind.value);ui.windOut.textContent=`M ${fmt(state.mach,2)} · ${fmt(state.mach*app.a0*3.6)} km/h`;fill(ui.wind);manual();});
  ui.alt.addEventListener('input',()=>{state.alt=parseFloat(ui.alt.value);ui.altOut.textContent=`${fmt(state.alt)} m`;fill(ui.alt);manual();});
  ui.ts.addEventListener('input',()=>{state.tscale=parseFloat(ui.ts.value);ui.tsOut.textContent=`×${fmt(state.tscale,2)}`;fill(ui.ts);});
  ui.engBtn.addEventListener('click',()=>{app.dyn.toggle();engineButton();manual();});
  ui.fadec.addEventListener('change',e=>{state.fadec=e.target.checked;});
  ui.pause.addEventListener('click',()=>setPause(!state.paused));
  $('#particles').value=state.particles;$('#particles').addEventListener('change',e=>{state.particles=e.target.value;setFlow(state.particles);});
  $('#showFlow').checked=state.flow;$('#showFlow').addEventListener('change',e=>{state.flow=e.target.checked;app.flow.group.visible=state.flow;});
  $('#bloom').checked=state.bloom;$('#bloom').addEventListener('change',e=>{state.bloom=e.target.checked;});
  $('#tableBtn').addEventListener('click',e=>{app.tableOpen=!app.tableOpen;ui.chartTable.hidden=!app.tableOpen;e.target.setAttribute('aria-expanded',String(app.tableOpen));e.target.textContent=app.tableOpen?'Ocultar tabla':'Ver tabla';if(app.tableOpen)fillTable();});
  ui.chart.addEventListener('pointermove',e=>{if(state.chart!=='compare')return;const r=ui.chart.getBoundingClientRect();const x=(e.clientX-r.left-40)/(r.width-48);app.chartHover=x>=0&&x<=1?Math.round(x*100)/10:null;drawChart();});
  ui.chart.addEventListener('pointerleave',()=>{app.chartHover=null;drawChart();});
  $('#tourBtn').addEventListener('click',()=>showTour(0));
  $('#tourPrev').addEventListener('click',()=>showTour(app.tourI-1));
  $('#tourNext').addEventListener('click',()=>{if(app.tourI>=app.engine.tour.length-1)closeTour();else showTour(app.tourI+1);});
  $('#tourClose').addEventListener('click',closeTour);
  $('#panelToggle').addEventListener('click',()=>togglePanel());
  new ResizeObserver(sheetHeight).observe(ui.panel);mobileQuery.addEventListener('change',sheetHeight);sheetHeight();
  canvas.addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.due=true;});
  canvas.addEventListener('pointerdown',e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.due=true;pointer.last=0;ui.hint.classList.add('fade');});
  canvas.addEventListener('pointerleave',()=>{state.hover=null;ui.tip.hidden=true;});
  setTimeout(()=>ui.hint.classList.add('fade'),18000);
  /* a mouse click should not leave the focus ring on a button, so that the shortcuts keep working */
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&e.detail>0)b.blur();});
  document.addEventListener('keydown',e=>{
    const t=e.target,tag=t.tagName;if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA'||tag==='BUTTON'||t.isContentEditable||e.metaKey||e.ctrlKey||e.altKey)return;
    if(e.key===' '){e.preventDefault();setPause(!state.paused);}
    else if(e.key>='1'&&e.key<='4'){state.view=VIEW_KEYS[e.key-1];applyView();}
    else if(e.key==='c'||e.key==='C'){state.cut=CUT_KEYS[(CUT_KEYS.indexOf(state.cut)+1)%CUT_KEYS.length];applyCut();}
    else if(e.key==='Escape'&&app.tourI>=0)closeTour();
  });
}
