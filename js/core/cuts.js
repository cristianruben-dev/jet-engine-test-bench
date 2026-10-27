/* Cutaway clipping planes shared by casings and picking */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';

const PLANE_Z=new THREE.Plane(new THREE.Vector3(0,0,-1),0);   // removes z>0
const PLANE_Y=new THREE.Plane(new THREE.Vector3(0,-1,0),0);   // removes y>0
const CUTS={none:[],quarter:[PLANE_Z,PLANE_Y],half:[PLANE_Z]};
function inCut(p,planes){return planes.length>0&&planes.every(pl=>pl.distanceToPoint(p)<0);}
function cutPlanes(E,mode){return (E&&E.cuts&&E.cuts[mode])||CUTS[mode];}

export {PLANE_Z,PLANE_Y,CUTS,inCut,cutPlanes};
