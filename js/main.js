/* Entry point: wires up the UI, loads the turbofan and runs the simulation loop */
import {$,LUT} from './core/utils.js';
import {state} from './state.js';
import {renderer,scene,camera,controls,composer} from './core/scene.js';
import {updateMaterials} from './core/thermal.js';
import {app,initUI,loadEngine,updatePanel,pick,pointer} from './ui.js';

initUI();
loadEngine('turbofan');

let last=performance.now(),uiAcc=0,first=true,fpsN=0,fpsT=performance.now(),fps=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(0.05,(now-last)/1000);last=now;
  const {engine,def}=app;
  const R=app.R=def.thermo(state.throttle,state.mach);
  engine.update(R,dt);
  updateMaterials(engine,R,state.hover,state.view==='thermal');
  if(state.flow)app.flow.update(dt,engine,R,state.view==='thermal'?LUT.ironLin:LUT.flowLin);
  if(pointer.due&&now-pointer.last>90){pointer.due=false;pointer.last=now;pick();}
  controls.update();
  if(state.bloom)composer.render();else renderer.render(scene,camera);
  uiAcc+=dt;if(uiAcc>0.12){uiAcc=0;updatePanel();}
  fpsN++;if(now-fpsT>1000){fps=fpsN*1000/(now-fpsT);fpsN=0;fpsT=now;}
  if(first){first=false;$('#loading').remove();window.__engineReady=true;}
}
requestAnimationFrame(frame);

/* console access for debugging and automated tests */
window.__sim={camera,controls,state,get engine(){return app.engine;},get R(){return app.R;},get fps(){return fps;},loadEngine,renderer};
