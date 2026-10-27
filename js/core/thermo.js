/* Thermodynamics: simplified Brayton cycle per engine type */
import {clamp,smooth,fmt} from './utils.js';

const G=1.4,GH=1.33,CP=1005,CPH=1150,RG=287;
const ramRecovery=M=>M<=1?0.985:(M<=5?0.985*(1-0.075*Math.pow(M-1,1.35)):0.985*800/(Math.pow(M,4)+935));
const compress=(Tt,Pt,PR,eta)=>{const tau=Math.pow(PR,(G-1)/G);return [Tt*(1+(tau-1)/eta),Pt*PR];};
const expand=(Tt,Pt,dT,eta)=>{const tau=Math.max(0.05,1-dT/(Tt*eta));return [Tt-dT,Pt*Math.pow(tau,GH/(GH-1))];};
function nozzle(Tt,Pt,P0,g,cp,eta=0.97){const pr=Math.max(Pt/P0,1.0001);const T9i=Tt/Math.pow(pr,(g-1)/g);const dT=(Tt-T9i)*eta;return {v:Math.sqrt(2*cp*dT),T9:Tt-dT};}

function thermoTurbofan(t,M){
  const T0=288.15,P0=101325,a0=Math.sqrt(G*RG*T0),V0=M*a0;
  const N1=0.22+0.78*t,N2=0.62+0.38*t;
  const Tt0=T0*(1+0.2*M*M),Pt0=P0*Math.pow(1+0.2*M*M,3.5)*0.985;
  const PRf=1+0.65*N1*N1,PRl=1+1.3*N1*N1,PRh=1+10.5*N2*N2;
  const [Tt13,Pt13]=compress(Tt0,Pt0,PRf,0.91),[Tt25,Pt25]=compress(Tt13,Pt13,PRl,0.89),[Tt3,Pt3]=compress(Tt25,Pt25,PRh,0.87);
  const Tt4=Math.max(Tt3+150,980+820*t),Pt4=Pt3*0.95;
  const BPR=8.2,mdot=1150*N1*(1+0.35*M),mc=mdot/(1+BPR),mb=mdot-mc;
  const [Tt45,Pt45]=expand(Tt4,Pt4,(CP/CPH)*(Tt3-Tt25)/1.02,0.9);
  const [Tt5,Pt5]=expand(Tt45,Pt45,(CP/CPH)*((1+BPR)*(Tt13-Tt0)+(Tt25-Tt13))/1.02,0.9);
  const core=nozzle(Tt5,Pt5*0.98,P0,GH,CPH),byp=nozzle(Tt13,Pt13*0.985,P0,G,CP);
  const F=Math.max(0,mc*(core.v-V0)+mb*(byp.v-V0));
  return {T0,M,V0,Tt0,Tt13,Tt25,Tt3,Tt4,Tt45,Tt5,T9:core.T9,T19:byp.T9,v9:core.v,v19:byp.v,mdot,mc,mb,F,OPR:PRf*PRl*PRh,BPR,N1,N2,
    rpm:{N1:N1*2550,N2:N2*10850},burn:t,ab:0,vIn:30+150*N1,vFan:40+140*N1,EGT:Tt5,
    status:t>0.85?'Potencia de despegue: TIT máxima, el fan aporta ~85 % del empuje':(t<0.15?'Ralentí: el eje de alta (N2) gira al 62 % aunque el fan vaya despacio':'Régimen de crucero/ascenso: ciclo estable'),level:t>0.85?'warn':'ok'};
}
function thermoTurbojet(t,M){
  const T0=288.15,P0=101325,a0=Math.sqrt(G*RG*T0),V0=M*a0;
  const N=0.63+0.37*t;
  const Tt0=T0*(1+0.2*M*M),Pt0=P0*Math.pow(1+0.2*M*M,3.5)*ramRecovery(M);
  const PRc=1+12.2*N*N;const [Tt3,Pt3]=compress(Tt0,Pt0,PRc,0.85);
  const Tt4=Math.max(Tt3+120,950+330*t),Pt4=Pt3*0.95;
  const mdot=77*N*(1+0.5*M);
  const [Tt5,Pt5]=expand(Tt4,Pt4,(CP/CPH)*(Tt3-Tt0)/1.02,0.9);
  const ab=clamp((t-0.85)/0.15,0,1);const Tt7=Tt5+ab*(2050-Tt5),Pt7=Pt5*(1-0.06*ab)*0.98;
  const noz=nozzle(Tt7,Pt7,P0,GH,CPH);const F=Math.max(0,mdot*(noz.v-V0));
  return {T0,M,V0,Tt0,Tt3,Tt4,Tt5,Tt7,T9:noz.T9,v9:noz.v,mdot,F,OPR:PRc,N,rpm:{N:N*7685},burn:t,ab,vIn:40+130*N,EGT:Tt5,
    status:ab>0?'Postquemador encendido: la tobera se abre y el empuje sube ~50 % a costa de triplicar el consumo':(M>1.8?'Supersónico: la toma genera choques y pierde presión (recuperación '+fmt(ramRecovery(M)*100)+' %)':'Régimen seco: un solo eje mueve compresor y turbina'),level:ab>0?'warn':'ok'};
}
function thermoRamjet(t,M){
  const T0=216.65,P0=12112,rho0=0.1948,a0=Math.sqrt(G*RG*T0),V0=M*a0;
  const Tt0=T0*(1+0.2*M*M),Pt0=P0*Math.pow(1+0.2*M*M,3.5)*ramRecovery(M);
  const mdot=rho0*V0*0.55;
  const burn=t*smooth(0.45,1.0,M);
  const Tt4=Tt0+burn*Math.max(0,Math.min(1950,2350-Tt0)),Pt4=Pt0*0.93;
  const noz=nozzle(Tt4,Pt4,P0,GH,CPH);const F=Math.max(0,mdot*(noz.v-V0));
  let status,level='ok';
  if(M<0.45){status='Parado no hay flujo ni compresión: un estatorreactor no puede arrancar por sí solo';level='off';}
  else if(M<1){status='Subsónico: la compresión dinámica es débil y el rendimiento, pobre';level='warn';}
  else if(M<=5){status='Régimen de diseño (M 2–5): el cono genera un choque oblicuo y el difusor frena el aire';}
  else{status='Más allá de M 5 el aire entra tan caliente que apenas se puede calentar más: el rendimiento cae';level='warn';}
  return {T0,M,V0,Tt0,Tt4,T9:noz.T9,v9:noz.v,mdot,F,OPR:Pt4/P0,rpm:{},burn,ab:burn,EGT:Tt4,status,level};
}
function thermoScramjet(t,M){
  const T0=226.5,P0=1197,rho0=0.0184,a0=Math.sqrt(G*RG*T0),V0=M*a0;
  const Tt0=T0*(1+0.2*M*M),Pt0=P0*Math.pow(1+0.2*M*M,3.5)*ramRecovery(M);
  const mdot=rho0*V0*0.6;
  const burn=t*smooth(4.2,5.5,M);
  const Tt4=Tt0+burn*1650,Pt4=Pt0*0.9;
  const M3=Math.max(1.2,M/3),T3=Tt0/(1+0.2*M3*M3),T4s=Tt4/1.45;
  const Tramp=T0*(1+0.18*M*M)*0.8;
  const noz=nozzle(Tt4,Pt4,P0,GH,CPH);const F=Math.max(0,mdot*(noz.v-V0));
  let status,level='ok';
  if(M<1){status='Parado no funciona: necesita el aire comprimido por su propia velocidad';level='off';}
  else if(M<4.5){status='Fuera de rango: por debajo de M ≈ 4,5 el flujo en la cámara no es supersónico y la llama no se sostiene';level='off';}
  else if(M<=9.5){status='Combustión supersónica: el aire cruza la cámara en milisegundos a M '+fmt(M3,1);}
  else{status='M > 9,5: el gas se disocia y las rampas superan los 2 000 °C';level='warn';}
  return {T0,M,V0,Tt0,Tt4,T3,T4s,Tramp,M3,T9:noz.T9,v9:noz.v,mdot,F,OPR:Pt4/P0,rpm:{},burn,ab:burn,EGT:Tt4,status,level};
}

export {G,GH,CP,CPH,RG,ramRecovery,compress,expand,nozzle,thermoTurbofan,thermoTurbojet,thermoRamjet,thermoScramjet};
