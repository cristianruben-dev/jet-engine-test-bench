/* Entry point: wires up the UI, loads the turbofan and runs the simulation loop */
import {$} from './core/utils.js';
import {state} from './state.js';
import {renderer,scene,camera,controls,composer,updateFlight,flyTo} from './core/scene.js';
import {updateMaterials} from './core/paint.js';
import {app,initUI,loadEngine,updatePanel,pick,pointer} from './ui.js';

initUI();
loadEngine('turbofan');

let last=performance.now(),uiAcc=0,first=true,fpsN=0,fpsT=performance.now(),fps=0;
function frame(now){
  requestAnimationFrame(frame);
  const real=Math.min(0.05,Math.max(0,(now-last)/1000));last=now;
  const dt=state.paused?0:real;
  const {engine,def}=app;
  /* spool dynamics in real time, then the cycle for the resulting state */
  const c=app.dyn.step(dt,state,app.R);
  const R=app.R=def.thermo(c);app.dyn.annotate(R,state);
  engine.update(R,dt);
  updateMaterials(engine,R,state);
  if(state.flow)app.flow.update(dt,engine,R,state.view);
  if(pointer.due&&now-pointer.last>90){pointer.due=false;pointer.last=now;pick();}
  updateFlight(real);controls.update();
  if(state.bloom)composer.render();else renderer.render(scene,camera);
  uiAcc+=real;if(uiAcc>0.12){uiAcc=0;updatePanel();}
  fpsN++;if(now-fpsT>1000){fps=fpsN*1000/(now-fpsT);fpsN=0;fpsT=now;}
  if(first){first=false;$('#loading').remove();window.__engineReady=true;}
}
requestAnimationFrame(frame);

/* console access for debugging and automated tests */
window.__sim={camera,controls,state,flyTo,get engine(){return app.engine;},get R(){return app.R;},get dyn(){return app.dyn;},get fps(){return fps;},loadEngine,renderer};
