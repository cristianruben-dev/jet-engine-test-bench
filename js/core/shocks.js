/* Shock waves: translucent material and the θ-β-M relation */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import {DEG} from './utils.js';

const shockMat=()=>new THREE.MeshBasicMaterial({color:0x8fd8ff,transparent:true,opacity:0.14,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
/* θ-β-M relation (weak solution); returns β in rad, or null when the shock detaches */
function shockAngle(M,thetaDeg){if(M<=1.0001)return null;const th=thetaDeg*DEG,g=1.4;const f=b=>2/Math.tan(b)*(M*M*Math.sin(b)*Math.sin(b)-1)/(M*M*(g+Math.cos(2*b))+2)-Math.tan(th);const lo=Math.asin(1/M)+1e-4,hi=Math.PI/2-1e-4;let prev=f(lo);const N=240;for(let i=1;i<=N;i++){const b=lo+(hi-lo)*i/N,v=f(b);if(prev<0&&v>=0){let a=lo+(hi-lo)*(i-1)/N,c=b;for(let k=0;k<30;k++){const m=(a+c)/2;if(f(m)<0)a=m;else c=m;}return (a+c)/2;}prev=v;}return null;}
function machAfter(M,beta,thetaDeg){const g=1.4,Mn1=M*Math.sin(beta);const Mn2=Math.sqrt((1+(g-1)/2*Mn1*Mn1)/(g*Mn1*Mn1-(g-1)/2));return Mn2/Math.sin(beta-thetaDeg*DEG);}

export {shockMat,shockAngle,machAfter};
