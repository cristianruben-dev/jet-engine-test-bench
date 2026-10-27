/* Model tests: atmosphere, thermodynamic cycles, spool dynamics and the compressor map.
   These modules have no DOM or Three.js dependency, so they run in Node: `node --test test/` */
import test from 'node:test';
import assert from 'node:assert/strict';
import {isa} from '../js/core/atmosphere.js';
import {steadyPoint,THERMO} from '../js/core/thermo.js';
import {Dynamics} from '../js/core/dynamics.js';
import {mapPoint} from '../js/core/charts.js';

test('ISA atmosphere: sea level and the tropopause',()=>{
  const s=isa(0);assert.ok(Math.abs(s.T-288.15)<1e-6);assert.ok(Math.abs(s.P-101325)<1);
  const t=isa(11000);assert.ok(Math.abs(t.T-216.65)<0.01);assert.ok(Math.abs(t.P-22632)<60);
  assert.ok(isa(20000).rho<isa(0).rho/10);
});
test('turbofan at take-off: thrust, consumption and turbine temperature in range',()=>{
  const R=steadyPoint('turbofan',1,0,0);
  assert.ok(R.F>250e3&&R.F<420e3,`thrust ${R.F}`);
  assert.ok(R.TSFC*1e6>7&&R.TSFC*1e6<14,`TSFC ${R.TSFC*1e6}`);
  assert.ok(R.Tt4<1950);assert.equal(R.q,1);assert.ok(R.v19<R.v9);
});
test('in cruise the turbofan burns less per newton than the turbojet',()=>{
  const a=steadyPoint('turbofan',1,0.85,11000),b=steadyPoint('turbojet',1,0.85,11000);
  assert.ok(a.TSFC<b.TSFC);
});
test('a stopped engine with no wind has no through-flow',()=>{
  const R=THERMO.turbofan({N1:0,N2:0,fuel:0,lit:false,M:0,alt:0});
  assert.equal(R.q,0);assert.equal(R.vIn,0);assert.equal(R.st.comb.V,0);
  const W=THERMO.turbofan({N1:0.3,N2:0.1,fuel:0,lit:false,M:0.7,alt:6000});
  assert.ok(W.vIn>0,'windmilling air still flows');
});
test('afterburner raises thrust and multiplies consumption',()=>{
  const dry=steadyPoint('turbojet',0.84,0.4,0),wet=steadyPoint('turbojet',1,0.4,0);
  assert.ok(wet.F>dry.F*1.3);assert.ok(wet.TSFC>dry.TSFC*1.8);assert.ok(wet.ab>0.9);
});
test('ramjet needs speed; scramjet works at its design point',()=>{
  assert.ok(steadyPoint('ramjet',1,0.2,0).F<1000);
  assert.ok(steadyPoint('ramjet',1,3,15000).F>20e3);
  const S=steadyPoint('scramjet',0.6,7,30000);assert.ok(S.F>0);assert.ok(S.chokeMargin>0);assert.ok(S.M3>1);
});
test('the thrust reverser gives negative thrust',()=>{
  const R=THERMO.turbofan({N1:0.75,N2:0.9,fuel:0.7,lit:true,M:0.2,alt:0,rev:1});
  assert.ok(R.F<0);assert.equal(R.rev,1);
});
test('start sequence: starter, light-up and a stable idle',()=>{
  const d=new Dynamics();d.reset('turbofan',0);d.stop();d.start();
  const st={throttle:0,mach:0,alt:0,fadec:true,reverser:false};let t=0;
  while(d.mode!=='run'&&t<120){d.step(1/60,st,null);t+=1/60;}
  assert.equal(d.mode,'run');assert.ok(d.N2>0.55);assert.ok(t>5,'the start takes a while');
});
test('a throttle slam surges without the limiter and not with it',()=>{
  const run=fadec=>{const d=new Dynamics();d.reset('turbofan',0);const st={throttle:0,mach:0.1,alt:0,fadec,reverser:false};
    for(let i=0;i<120;i++)d.step(1/60,st,null);st.throttle=1;let peak=0;for(let i=0;i<300;i++){d.step(1/60,st,null);peak=Math.max(peak,d.surge);}return peak;};
  assert.ok(run(false)>0.5);assert.equal(run(true),0);
});
test('scramjet unstart on excess fuel at Mach 5',()=>{
  const d=new Dynamics();d.reset('scramjet',1);const st={throttle:1,mach:5.2,alt:28000};let R=null,un=0;
  for(let i=0;i<300;i++){const c=d.step(1/60,st,R);R=THERMO.scramjet(c);un=Math.max(un,d.unstart);}
  assert.ok(un>0.5);
});
test('compressor map: the steady point sits on the operating line and surge pushes it up',()=>{
  const [x,PR]=mapPoint({N:0.9,PRd:11.5,excess:0,surge:0});
  assert.ok(Math.abs(PR-(1+10.5*0.81))<1e-9);assert.ok(x>80&&x<100);
  const [,PR2]=mapPoint({N:0.9,PRd:11.5,excess:0.43,surge:0});assert.ok(PR2>PR*1.15);
});
