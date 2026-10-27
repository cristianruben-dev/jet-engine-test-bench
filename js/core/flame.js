/* Flames: GLSL simplex noise and additive flame tubes */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';

const NOISE=`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);
vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}`;
const FLAME_VS=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const FLAME_FS=`uniform float uTime,uIntensity,uSeed,uDiamonds,uScale,uTail;uniform vec3 uColA,uColB,uColC;varying vec2 vUv;${NOISE}
void main(){
  float s=1.0-vUv.y;float u=vUv.x*6.2831853;float t=uTime;
  vec3 q=vec3(cos(u)*uScale,sin(u)*uScale,s*3.2-t*2.4);
  float n1=snoise(q+vec3(uSeed,0.0,0.0));
  float n2=snoise(vec3(q.x*2.1+3.0,q.y*2.1,s*6.5-t*4.5+uSeed));
  float n=n1*0.65+n2*0.35;
  float body=smoothstep(0.0,0.06,s)*(1.0-smoothstep(uTail,1.0,s));
  float a=clamp((n*0.55+0.6)*body,0.0,1.0)*uIntensity;
  if(uDiamonds>0.5){a*=0.5+0.7*pow(abs(sin(s*3.14159*7.0)),1.6);}
  vec3 col=mix(uColA,uColB,smoothstep(0.0,0.45,s));col=mix(col,uColC,smoothstep(0.45,1.0,s));
  gl_FragColor=vec4(col*a*1.7,a);
}`;
const FLAME_COL={
  kerosene:[[1.0,0.96,0.75],[1.0,0.55,0.12],[0.9,0.22,0.05]],
  afterburner:[[0.72,0.74,1.0],[1.0,0.62,0.22],[1.0,0.3,0.1]],
  hydrogen:[[0.78,0.84,1.0],[1.0,0.82,0.5],[1.0,0.5,0.3]],
};
function flameMaterial(kind,opts={}){const c=FLAME_COL[kind];return new THREE.ShaderMaterial({vertexShader:FLAME_VS,fragmentShader:FLAME_FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{uTime:{value:Math.random()*10},uIntensity:{value:0},uSeed:{value:Math.random()*20},uDiamonds:{value:opts.diamonds?1:0},uScale:{value:opts.scale??1.6},uTail:{value:opts.tail??0.55},uColA:{value:new THREE.Vector3(...c[0])},uColB:{value:new THREE.Vector3(...c[1])},uColC:{value:new THREE.Vector3(...c[2])}}});}
/* flame tube from x0 (radius r0) to x1 (radius r1); v=1 at the upstream end */
function flameTube(x0,x1,r0,r1,kind,opts={}){const g=new THREE.CylinderGeometry(r0,r1,x1-x0,opts.seg||40,1,true);g.rotateZ(Math.PI/2);g.translate((x0+x1)/2,0,0);if(opts.sy)g.scale(1,opts.sy,1);const m=new THREE.Mesh(g,flameMaterial(kind,opts));m.frustumCulled=false;m.renderOrder=5;return m;}

export {NOISE,FLAME_VS,FLAME_FS,FLAME_COL,flameMaterial,flameTube};
