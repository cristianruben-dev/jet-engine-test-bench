/* Thermodynamics: simplified Brayton cycle per engine with ISA atmosphere, fuel flow,
   station table (T, P, V), efficiencies and physics warnings */
import {clamp,smooth,lerp,fmt} from './utils.js';
import {isa} from './atmosphere.js';

const G=1.4,GH=1.33,CP=1005,CPH=1150,RG=287,LHV=43e6,LHV_H2=120e6;
const ramRecovery=M=>M<=1?0.985:(M<=5?0.985*(1-0.075*Math.pow(M-1,1.35)):0.985*800/(Math.pow(M,4)+935));
const compress=(Tt,Pt,PR,eta)=>{const tau=Math.pow(PR,(G-1)/G);return [Tt*(1+(tau-1)/eta),Pt*PR];};
const expand=(Tt,Pt,dT,eta)=>{const tau=Math.max(0.05,1-dT/(Tt*eta));return [Tt-dT,Pt*Math.pow(tau,GH/(GH-1))];};
function nozzle(Tt,Pt,P0,g,cp,eta=0.97){const pr=Math.max(Pt/P0,1.0001);const T9i=Tt/Math.pow(pr,(g-1)/g);const dT=(Tt-T9i)*eta;return {v:Math.sqrt(2*cp*dT),T9:Tt-dT};}
const ambient=c=>{const a=isa(c.alt||0);const M=c.M;return {T0:a.T,P0:a.P,rho0:a.rho,a0:a.a,alt:a.h,M,V0:M*a.a,Tt0:a.T*(1+0.2*M*M)};};

/* steady-state inputs (spool speeds, fuel fraction) for a throttle setting */
const STEADY={
  turbofan:t=>({N1:0.22+0.78*t,N2:0.62+0.38*t,fuel:0.1+0.9*t,lit:true}),
  turbojet:t=>({N:0.63+0.37*t,fuel:0.3+0.7*t,ab:clamp((t-0.85)/0.15,0,1),lit:true}),
  ramjet:()=>({fuelOn:true}),
  scramjet:()=>({fuelOn:true}),
};
/* thrust, specific thrust, consumption and efficiencies */
function perf(R,F,mdot,Wf,ke,lhv){R.F=F;R.Fsp=mdot>1?F/mdot:0;R.Wf=Wf;R.TSFC=(F>300&&Wf>0)?Wf/F:NaN;R.etaP=(ke>0&&F>0)?clamp(F*R.V0/ke,0,1):0;R.etaT=(Wf>0&&ke>0)?clamp(ke/(Wf*lhv),0,1):0;R.eta=R.etaP*R.etaT;}

function thermoTurbofan(c){
  const A=ambient(c);const {T0,P0,M,V0,Tt0}=A;const N1=clamp(c.N1,0,1.05),N2=clamp(c.N2,0,1.05),lit=c.lit!==false,surge=c.surge||0;
  const Pt0=P0*Math.pow(1+0.2*M*M,3.5)*0.985;
  const PRf=1+0.65*N1*N1,PRl=1+1.3*N1*N1,PRh=1+10.5*N2*N2;
  const [Tt13,Pt13]=compress(Tt0,Pt0,PRf,0.91),[Tt25,Pt25]=compress(Tt13,Pt13,PRl,0.89),[Tt3,Pt3]=compress(Tt25,Pt25,PRh,0.87);
  const corr=(P0/101325)*Math.sqrt(288.15/T0);
  const mdot=Math.max(0.5,1150*N1*(1+0.35*M)*corr*(1-0.7*surge));const BPR=8.2,mc=mdot/(1+BPR),mb=mdot-mc;
  const Wf=lit?clamp(c.fuel,0,1.2)*3.0:0;const dT=Math.min(1150,(Wf/mc)*LHV*0.99/CPH)*(1+0.4*surge);
  const Tt4=Tt3+dT,Pt4=Pt3*0.95;
  const [Tt45,Pt45]=expand(Tt4,Pt4,(CP/CPH)*(Tt3-Tt25)/1.02,0.9);
  const [Tt5,Pt5]=expand(Tt45,Pt45,(CP/CPH)*((1+BPR)*(Tt13-Tt0)+(Tt25-Tt13))/1.02,0.9);
  const core=nozzle(Tt5,Pt5*0.98,P0,GH,CPH),byp=nozzle(Tt13,Pt13*0.985,P0,G,CP);
  let F=mc*(core.v-V0)+mb*(byp.v-V0);F=lit?Math.max(0,F)*(1-0.8*surge):-0.25*mdot*V0;
  const ke=Math.max(0,0.5*(mc*(core.v*core.v-V0*V0)+mb*(byp.v*byp.v-V0*V0)));
  const vIn=30+150*N1,vFan=40+140*N1;
  const R={...A,Tt13,Tt25,Tt3,Tt4,Tt45,Tt5,T9:core.T9,T19:byp.T9,v9:core.v,v19:byp.v,mdot,mc,mb,OPR:PRf*PRl*PRh,BPR,N1,N2,rpm:{N1:N1*2550,N2:N2*10850},
    burn:lit?clamp(dT/850,0,1):0,ab:0,vIn,vFan,EGT:Tt5,lit,surge,vk:1-1.8*surge,Tcool:Tt3,warnings:[],
    st:{amb:{T:T0,P:P0,V:V0},in:{T:Tt0,P:Pt0,V:vIn},fan:{T:Tt13,P:Pt13,V:vFan},lpc:{T:Tt25,P:Pt25,V:vFan*0.9},hpc:{T:Tt3,P:Pt3,V:vFan*0.8},comb:{T:Tt4,P:Pt4,V:90+90*N1},hpt:{T:Tt45,P:Pt45,V:200+180*N1},lpt:{T:Tt5,P:Pt5,V:150+120*N1},noz:{T:core.T9,P:P0,V:core.v},byp:{T:byp.T9,P:P0,V:byp.v}},
    cycle:[['0','amb'],['2','in'],['13','fan'],['25','lpc'],['3','hpc'],['4','comb'],['45','hpt'],['5','lpt'],['9','noz']]};
  perf(R,F,mdot,Wf,ke,LHV);
  if(Tt5>1223)R.warnings.push(['off','EGT por encima del límite (950 °C)']);
  if(Tt4>1950)R.warnings.push(['off','Temperatura de turbina excesiva']);
  const tEq=clamp((c.fuel-0.1)/0.9,0,1);
  if(!lit){R.status='Sin combustión';R.level='off';}
  else if(tEq>0.85){R.status='Potencia de despegue: TIT máxima, el fan aporta ~85 % del empuje';R.level='warn';}
  else if(tEq<0.12){R.status='Ralentí: el eje de alta (N2) gira al 62 % aunque el fan vaya despacio';R.level='ok';}
  else{R.status='Régimen de crucero/ascenso: ciclo estable';R.level='ok';}
  return R;
}
function thermoTurbojet(c){
  const A=ambient(c);const {T0,P0,M,V0,Tt0}=A;const N=clamp(c.N,0,1.05),lit=c.lit!==false,surge=c.surge||0,ab=lit?clamp(c.ab||0,0,1):0;
  const Pt0=P0*Math.pow(1+0.2*M*M,3.5)*ramRecovery(M);
  const PRc=1+12.2*N*N;const [Tt3,Pt3]=compress(Tt0,Pt0,PRc,0.85);
  const corr=(P0/101325)*Math.sqrt(288.15/T0);
  const mdot=Math.max(0.3,77*N*(1+0.5*M)*corr*(1-0.7*surge));
  const Wf=lit?clamp(c.fuel,0,1.2)*1.4:0;const dT=Math.min(1050,(Wf/mdot)*LHV*0.99/CPH)*(1+0.4*surge);
  const Tt4=Tt3+dT,Pt4=Pt3*0.95;
  const [Tt5,Pt5]=expand(Tt4,Pt4,(CP/CPH)*(Tt3-Tt0)/1.02,0.9);
  const WfAB=ab*2.6;const dT7=Math.min(2150-Tt5,(WfAB/mdot)*LHV*0.9/CPH);const Tt7=Tt5+Math.max(0,dT7),Pt7=Pt5*(1-0.06*ab)*0.98;
  const noz=nozzle(Tt7,Pt7,P0,GH,CPH);
  let F=mdot*(noz.v-V0);F=lit?Math.max(0,F)*(1-0.8*surge):-0.25*mdot*V0;
  const ke=Math.max(0,0.5*mdot*(noz.v*noz.v-V0*V0));
  const vIn=40+130*N;
  const R={...A,Tt3,Tt4,Tt5,Tt7,T9:noz.T9,v9:noz.v,mdot,OPR:PRc,N,rpm:{N:N*7685},burn:lit?clamp(dT/650,0,1):0,ab,vIn,EGT:Tt5,lit,surge,vk:1-1.8*surge,Tcool:Tt3,warnings:[],
    st:{amb:{T:T0,P:P0,V:V0},in:{T:Tt0,P:Pt0,V:vIn},comp:{T:Tt3,P:Pt3,V:vIn*0.85},comb:{T:Tt4,P:Pt4,V:60+80*N},turb:{T:Tt5,P:Pt5,V:180+150*N},ab:{T:Tt7,P:Pt7,V:150+100*N+150*ab},noz:{T:noz.T9,P:P0,V:noz.v}},
    cycle:[['0','amb'],['2','in'],['3','comp'],['4','comb'],['5','turb'],['7','ab'],['9','noz']]};
  perf(R,F,mdot,Wf+WfAB,ke,LHV);
  if(Tt5>1050)R.warnings.push(['off','EGT por encima del límite (780 °C)']);
  if(!lit){R.status='Sin combustión';R.level='off';}
  else if(ab>0.02){R.status='Postquemador encendido: la tobera se abre y el empuje sube ~50 % a costa de triplicar el consumo';R.level='warn';}
  else if(M>1.8){R.status='Supersónico: la toma genera choques y pierde presión (recuperación '+fmt(ramRecovery(M)*100)+' %)';R.level='ok';}
  else{R.status='Régimen seco: un solo eje mueve compresor y turbina';R.level='ok';}
  return R;
}
function thermoRamjet(c){
  const A=ambient(c);const {T0,P0,rho0,M,V0,Tt0}=A;const fuelOn=c.fuelOn!==false;
  const Pt0=P0*Math.pow(1+0.2*M*M,3.5)*ramRecovery(M);
  const mdot=Math.max(0.01,rho0*V0*0.55);
  const burn=fuelOn?c.t*smooth(0.45,1.0,M):0;
  const dT=burn*Math.max(0,Math.min(1950,2350-Tt0));const Tt4=Tt0+dT,Pt4=Pt0*0.93;
  const noz=nozzle(Tt4,Pt4,P0,GH,CPH);const F=Math.max(0,mdot*(noz.v-V0));
  const Wf=mdot*CPH*dT/(0.95*LHV);const ke=Math.max(0,0.5*mdot*(noz.v*noz.v-V0*V0));
  const R={...A,Tt4,T9:noz.T9,v9:noz.v,mdot,OPR:Pt4/P0,rpm:{},burn,ab:burn,EGT:Tt4,lit:burn>0.02,vk:1,Tcool:T0+250,warnings:[],
    st:{amb:{T:T0,P:P0,V:V0},in:{T:Tt0*0.92,P:Pt0,V:V0*0.6},diff:{T:Tt0,P:Pt0*0.98,V:Math.max(1,V0*0.3)},comb:{T:Tt4,P:Pt4,V:V0*0.45+100*burn},noz:{T:noz.T9,P:P0,V:Math.max(noz.v,V0*0.6)}},
    cycle:[['0','amb'],['2','diff'],['4','comb'],['9','noz']]};
  perf(R,F,mdot,Wf,ke,LHV);
  if(Tt4>2300)R.warnings.push(['off','Cámara por encima de 2 000 °C: el revestimiento se degrada']);
  let status,level='ok';
  if(M<0.45){status='Parado no hay flujo ni compresión: un estatorreactor no puede arrancar por sí solo';level='off';}
  else if(M<1){status='Subsónico: la compresión dinámica es débil y el rendimiento, pobre';level='warn';}
  else if(M<=5){status='Régimen de diseño (M 2–5): el cono genera un choque oblicuo y el difusor frena el aire';}
  else{status='Más allá de M 5 el aire entra tan caliente que apenas se puede calentar más: el rendimiento cae';level='warn';}
  R.status=status;R.level=level;return R;
}
function thermoScramjet(c){
  const A=ambient(c);const {T0,P0,rho0,M,V0,Tt0}=A;const fuelOn=c.fuelOn!==false,unstart=c.unstart||0;
  const Pt0=P0*Math.pow(1+0.2*M*M,3.5)*ramRecovery(M);
  const mdot=Math.max(0.01,rho0*V0*0.6);
  const burnCmd=fuelOn?c.t*smooth(4.2,5.5,M):0;const burn=burnCmd*(1-0.85*unstart);
  const dTt=burn*1650;const lim=M>=4.5?600+260*(M-4.5):0;
  const Tt4=Tt0+dTt,Pt4=Pt0*0.9*(1-0.5*unstart);
  const M3=Math.max(1.2,M/3),T3=Tt0/(1+0.2*M3*M3),T4s=Tt4/1.45;
  const Tramp=T0*(1+0.18*M*M)*0.8;
  const P3=Pt0*Math.pow(1/(1+0.2*M3*M3),3.5),Pramp=P0*(1+0.12*M*M);
  const noz=nozzle(Tt4,Pt4,P0,GH,CPH);const F=Math.max(0,mdot*(noz.v-V0))*(1-0.9*unstart);
  const Wf=mdot*CPH*dTt/(0.85*LHV_H2);const ke=Math.max(0,0.5*mdot*(noz.v*noz.v-V0*V0));
  const R={...A,Tt4,T3,T4s,Tramp,M3,T9:noz.T9,v9:noz.v,mdot,OPR:Pt4/P0,rpm:{},burn,ab:burn,EGT:Tt4,lit:burn>0.02,vk:1,Tcool:T0+400,unstart,chokeMargin:lim>0?1-burnCmd*1650/lim:-1,warnings:[],
    st:{amb:{T:T0,P:P0,V:V0},ramp:{T:Tramp,P:Pramp,V:V0*0.93},iso:{T:T3,P:P3,V:V0*0.8},comb:{T:T4s,P:P3*0.9,V:V0*0.85},noz:{T:noz.T9,P:P0,V:Math.max(noz.v,V0)}},
    cycle:[['0','amb'],['2','ramp'],['3','iso'],['4','comb'],['9','noz']]};
  perf(R,F,mdot,Wf,ke,LHV_H2);
  if(Tramp>2200)R.warnings.push(['off','Bordes de ataque por encima de 1 900 °C']);
  let status,level='ok';
  if(M<1){status='Parado no funciona: necesita el aire comprimido por su propia velocidad';level='off';}
  else if(M<4.5){status='Fuera de rango: por debajo de M ≈ 4,5 el flujo en la cámara no es supersónico y la llama no se sostiene';level='off';}
  else if(M<=9.5){status='Combustión supersónica: el aire cruza la cámara en milisegundos a M '+fmt(M3,1);}
  else{status='M > 9,5: el gas se disocia y las rampas superan los 2 000 °C';level='warn';}
  R.status=status;R.level=level;return R;
}
const THERMO={turbofan:thermoTurbofan,turbojet:thermoTurbojet,ramjet:thermoRamjet,scramjet:thermoScramjet};
/* steady-state point at full throttle, used by the comparison chart */
function steadyPoint(id,t,M,alt){return THERMO[id]({...STEADY[id](t),t,M,alt});}

export {G,GH,CP,CPH,RG,LHV,LHV_H2,ramRecovery,compress,expand,nozzle,STEADY,THERMO,steadyPoint,thermoTurbofan,thermoTurbojet,thermoRamjet,thermoScramjet};
