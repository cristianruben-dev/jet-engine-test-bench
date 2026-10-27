/* Renderer, camera, lights, environment, post-processing (bloom) and camera flights */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js/+esm';
import {EffectComposer} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js/+esm';
import {RenderPass} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js/+esm';
import {UnrealBloomPass} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js/+esm';
import {OutputPass} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/OutputPass.js/+esm';
import {RoomEnvironment} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js/+esm';
import {$,isMobile,smooth} from './utils.js';

const canvas=$('#view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,stencil:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,isMobile?1.5:1.75));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
renderer.localClippingEnabled=true;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0a0d12);
const camera=new THREE.PerspectiveCamera(38,1,0.05,120);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=0.08;controls.minDistance=1.0;controls.maxDistance=24;
const pmrem=new THREE.PMREMGenerator(renderer);
scene.environment=pmrem.fromScene(new RoomEnvironment(renderer),0.04).texture;
scene.add(new THREE.HemisphereLight(0xa9bdd6,0x11141a,0.55));
const key=new THREE.DirectionalLight(0xffffff,1.1);key.position.set(-4,6,5);scene.add(key);
const fill=new THREE.DirectionalLight(0x9fc0ff,0.5);fill.position.set(5,2,-4);scene.add(fill);
const rim=new THREE.DirectionalLight(0xffd9a0,0.5);rim.position.set(2,-3,-3);scene.add(rim);
const grid=new THREE.GridHelper(40,40,0x1e2a38,0x141b25);grid.position.y=-1.9;grid.material.transparent=true;grid.material.opacity=0.7;scene.add(grid);

/* the composer's target needs a stencil buffer for the section caps; MSAA keeps edges clean */
const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,stencilBuffer:true,depthBuffer:true,samples:isMobile?0:4});
const composer=new EffectComposer(renderer,target);
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),0.45,0.3,1.45);
composer.addPass(bloom);
composer.addPass(new OutputPass());
/* portrait canvases (phone with the sheet open) widen the field of view so the engine still fits */
function resize(){const w=canvas.clientWidth||1,h=canvas.clientHeight||1;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.zoom=camera.aspect<1?Math.max(0.68,0.5+0.5*camera.aspect):1;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(canvas);resize();

/* smooth camera flights (presets and the guided tour) */
const flight={active:false,t:0,dur:1,p0:new THREE.Vector3(),p1:new THREE.Vector3(),t0:new THREE.Vector3(),t1:new THREE.Vector3()};
function flyTo(pos,target,dur=1.1){flight.p0.copy(camera.position);flight.t0.copy(controls.target);flight.p1.set(...pos);flight.t1.set(...target);flight.t=0;flight.dur=dur;flight.active=true;}
function updateFlight(dt){if(!flight.active)return;flight.t+=dt;const k=smooth(0,1,Math.min(1,flight.t/flight.dur));camera.position.lerpVectors(flight.p0,flight.p1,k);controls.target.lerpVectors(flight.t0,flight.t1,k);if(flight.t>=flight.dur)flight.active=false;}
controls.addEventListener('start',()=>{flight.active=false;});

export {canvas,renderer,scene,camera,controls,pmrem,grid,composer,bloom,resize,flyTo,updateFlight};
