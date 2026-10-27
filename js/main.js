/* Entry point: wires up the UI, loads the turbofan and runs the simulation loop */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {$} from './core/utils.js';
import {state} from './state.js';
import {renderer,scene,camera,controls,composer,updateFlight,flyTo} from './core/scene.js';
import {updateMaterials} from './core/paint.js';
import {app,sound,initUI,loadEngine,applyHash,updatePanel,record,placeAnn,setParticles,pick,pointer} from './ui.js';

initUI();
if(!applyHash())loadEngine('turbofan');

let last=performance.now(),uiAcc=0,histAcc=0,first=true,fpsN=0,fpsT=performance.now(),fps=0,cost=0,slowN=0;const bufSize=new THREE.Vector2();
function frame(now){
  requestAnimationFrame(frame);const t0=performance.now();
  const real=Math.min(0.05,Math.max(0,(now-last)/1000));last=now;
  const dt=state.paused?0:real;
  const {engine,def}=app;
  /* spool dynamics in real time, then the cycle for the resulting state */
  const c=app.dyn.step(dt,state,app.R);
  const R=app.R=def.thermo(c);app.dyn.annotate(R,state);
  engine.update(R,dt);
  updateMaterials(engine,R,state);
  if(state.flow){renderer.getDrawingBufferSize(bufSize);app.flow.setViewport(bufSize.x,bufSize.y,renderer.getPixelRatio());app.flow.update(dt,engine,R,state.view);}
  if(pointer.due&&now-pointer.last>90){pointer.due=false;pointer.last=now;pick();}
  updateFlight(real);controls.update();placeAnn();sound.update(R,state,app.dyn);
  if(state.bloom)composer.render();else renderer.render(scene,camera);
  if(!state.paused){histAcc+=real;if(histAcc>=0.1){record(R,histAcc);histAcc=0;}}
  uiAcc+=real;if(uiAcc>0.12){uiAcc=0;updatePanel();}
  /* automatic quality: when a frame costs more than 22 ms of CPU for three seconds, drop one particle level
     (measured as work per frame, so a throttled tab does not trigger it) */
  cost+=performance.now()-t0;fpsN++;
  if(now-fpsT>1000){fps=fpsN*1000/(now-fpsT);const avg=cost/Math.max(1,fpsN);cost=0;fpsN=0;fpsT=now;
    if(avg>22){if(++slowN>=3){slowN=0;const order=['high','medium','low'],i=order.indexOf(state.particles);if(i>=0&&i<2)setParticles(order[i+1]);}}else slowN=0;}
  if(first){first=false;$('#loading').remove();window.__engineReady=true;}
}
requestAnimationFrame(frame);

/* console access for debugging and automated tests */
window.__sim={camera,controls,state,flyTo,get engine(){return app.engine;},get R(){return app.R;},get dyn(){return app.dyn;},get fps(){return fps;},loadEngine,renderer};
