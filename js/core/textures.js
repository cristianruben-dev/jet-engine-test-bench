/* Procedural textures: nacelle panel seams, dilution holes, film-cooling dots, section hatch */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';

function canvasTex(w,h,draw,repeat,srgb=true){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');draw(g,w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(repeat)t.repeat.set(repeat[0],repeat[1]);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
const dot=(g,x,y,r)=>{g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();};
let cache={};
function panelTexture(){return cache.panel??=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#ececee';g.fillRect(0,0,w,h);g.strokeStyle='#a2a8b0';g.lineWidth=2;g.strokeRect(1,1,w-2,h-2);g.strokeStyle='#c4c8cd';g.lineWidth=1;g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();g.fillStyle='#8f969f';for(let i=14;i<w;i+=22){dot(g,i,7,2);dot(g,i,h-7,2);dot(g,7,i,2);dot(g,w-7,i,2);}},[14,2]);}
function holesTexture(){return cache.holes??=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);g.fillStyle='#000';for(let i=0;i<4;i++){dot(g,(i+0.5)/4*w,h*0.28,7);dot(g,(i+1)/4*w%w,h*0.72,11);}},[24,1],false);}
function coolingTexture(){return cache.cool??=canvasTex(64,64,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);g.fillStyle='#6a6a6a';for(let y=6;y<h;y+=12)for(let x=4;x<w;x+=10)dot(g,x+((y/12)%2?5:0),y,1.6);},[2,6]);}
function hatchTexture(){return cache.hatch??=canvasTex(64,64,(g,w,h)=>{g.fillStyle='#d6d6d6';g.fillRect(0,0,w,h);g.strokeStyle='#6c6c6c';g.lineWidth=2.5;for(let i=-h;i<w+h;i+=12){g.beginPath();g.moveTo(i,0);g.lineTo(i+h,h);g.stroke();}},[28,12]);}

export {canvasTex,panelTexture,holesTexture,coolingTexture,hatchTexture};
