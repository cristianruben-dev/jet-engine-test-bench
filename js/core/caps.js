/* Section caps: stencil-filled cut faces for the closed casings of the cutaway */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {cutPlanes} from './cuts.js';
import {hatchTexture} from './textures.js';

let capGeo=null;
function stencilMesh(geometry,plane,side,op,order){
  const m=new THREE.MeshBasicMaterial({depthWrite:false,depthTest:false,colorWrite:false,stencilWrite:true,stencilFunc:THREE.AlwaysStencilFunc,side,clippingPlanes:[plane],stencilFail:op,stencilZFail:op,stencilZPass:op});
  const mesh=new THREE.Mesh(geometry,m);mesh.renderOrder=order;mesh.frustumCulled=false;return mesh;
}
function disposeCaps(E){
  if(!E.capsGroup)return;
  E.group.remove(E.capsGroup);
  E.capsGroup.traverse(o=>{if(o.material)o.material.dispose();});
  E.capsGroup=null;E.caps=[];
}
function rebuildCaps(E,mode){
  disposeCaps(E);
  const planes=cutPlanes(E,mode);
  E.capsGroup=new THREE.Group();E.caps=[];E.group.add(E.capsGroup);
  if(!planes.length)return;
  capGeo??=new THREE.PlaneGeometry(16,7);
  const center=new THREE.Vector3(E.center[0],E.center[1],0),pos=new THREE.Vector3();
  let order=10;
  for(const p of E.parts){
    if(!(p.casing&&p.solid))continue;
    for(const plane of planes){
      /* the cap of one plane shows only where the other planes also cut */
      const others=planes.filter(q=>q!==plane).map(q=>new THREE.Plane(q.normal.clone().negate(),-q.constant));
      E.capsGroup.add(stencilMesh(p.mesh.geometry,plane,THREE.BackSide,THREE.IncrementWrapStencilOp,order),stencilMesh(p.mesh.geometry,plane,THREE.FrontSide,THREE.DecrementWrapStencilOp,order));
      const mat=new THREE.MeshStandardMaterial({color:0x808080,roughness:0.85,metalness:0.1,map:hatchTexture(),side:THREE.DoubleSide,clippingPlanes:others,stencilWrite:true,stencilRef:0,stencilFunc:THREE.NotEqualStencilFunc,stencilFail:THREE.ReplaceStencilOp,stencilZFail:THREE.ReplaceStencilOp,stencilZPass:THREE.ReplaceStencilOp,envMapIntensity:0.3});
      const cap=new THREE.Mesh(capGeo,mat);cap.renderOrder=order+0.5;cap.frustumCulled=false;
      cap.onAfterRender=r=>r.clearStencil();
      plane.projectPoint(center,pos);cap.position.copy(pos);cap.lookAt(pos.clone().add(plane.normal));
      E.capsGroup.add(cap);E.caps.push({part:p,mat});order+=1;
    }
  }
}

export {rebuildCaps,disposeCaps};
