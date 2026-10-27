/* Spool dynamics, start/stop sequence, FADEC acceleration limiter, surge, flameout and unstart.
   Runs in real time (independent of the visual slow motion). */
import {clamp} from './utils.js';
import {STEADY} from './thermo.js';

const lag=(x,target,dt,tau)=>x+(target-x)*(1-Math.exp(-dt/tau));

class Dynamics{
  constructor(){this.reset('turbofan',0.75);}
  reset(id,t){
    this.id=id;this.mode='run';this.fuelOn=true;this.surge=0;this.unstart=0;this.limiting=false;this.event=null;this.eventT=0;this.lit=true;this.starter=false;this.rev=0;this.revCmd=0;
    const s=STEADY[id](t);this.N1=s.N1??0;this.N2=s.N2??0;this.N=s.N??0;this.fuel=s.fuel??0;this.ab=s.ab??0;
  }
  get turbo(){return this.id==='turbofan'||this.id==='turbojet';}
  get running(){return this.turbo?this.mode!=='off':this.fuelOn;}
  /* the big button: start / cut fuel */
  toggle(){
    if(this.turbo){
      if(this.mode==='off'){this.mode='start';this.starter=true;this.note('Arranque: el arrancador neumático gira el eje de alta; a partir del 20 % se inyecta combustible y se enciende','warn',5);}
      else{this.mode='off';this.starter=false;this.note('Combustible cortado: la llama se apaga y los ejes se frenan (o giran en molinete si hay viento relativo)','off',5);}
    }else{this.fuelOn=!this.fuelOn;this.note(this.fuelOn?'Inyección de combustible abierta':'Combustible cortado','warn',3);}
  }
  cut(){if(this.running)this.toggle();}
  /* instant shutdown with the spools at rest (cold engine) */
  stop(){this.mode='off';this.fuelOn=false;this.starter=false;this.lit=false;this.N1=this.N2=this.N=0;this.fuel=0;this.ab=0;this.surge=0;this.event=null;}
  start(){if(!this.running)this.toggle();}
  note(text,level='warn',t=4){this.event={text,level};this.eventT=t;}
  /* rate-limited fuel with the acceleration schedule of the FADEC */
  fuelStep(dt,cmd,lim,fadec){
    const up=fadec?0.3:2.5,down=fadec?0.5:2.5;
    this.fuel=clamp(this.fuel+clamp(cmd-this.fuel,-down*dt,up*dt),0,1.2);
    this.limiting=false;
    if(fadec&&this.fuel>lim){this.fuel=lim;this.limiting=cmd>lim+0.01;}
  }
  step(dt,state,Rprev){
    const t=state.throttle,M=state.mach,alt=state.alt,fadec=state.fadec;
    this.eventT=Math.max(0,this.eventT-dt);if(this.eventT<=0)this.event=null;
    this.surge=Math.max(0,this.surge-dt/1.4);this.unstart=Math.max(0,this.unstart-dt/2.5);
    if(this.id==='turbofan')return this.stepTurbofan(dt,t,M,alt,fadec,state);
    if(this.id==='turbojet')return this.stepTurbojet(dt,t,M,alt,fadec);
    if(this.id==='scramjet'&&Rprev&&this.fuelOn&&Rprev.burn>0.05&&Rprev.chokeMargin<0&&this.unstart<0.05){this.unstart=1;this.note('UNSTART: el calor añadido frena el flujo hasta M 1, la toma expulsa el choque y pierde la compresión. Reduce el combustible','off',4);}
    return {t,M,alt,fuelOn:this.fuelOn,unstart:this.unstart};
  }
  stepTurbofan(dt,t,M,alt,fadec,state){
    const idle=0.1;let cmd;
    if(this.mode==='off')cmd=0;
    else if(this.mode==='start'){cmd=this.N2>=0.18?idle:0;if(this.N2>=0.6){this.mode='run';this.starter=false;this.note('Ralentí estable: arranque completado','ok',4);}}
    else cmd=idle+0.9*t;
    const surgeLine=(idle+0.9*clamp((this.N2-0.62)/0.38,0,1))*1.3+0.06;
    this.fuelStep(dt,cmd,surgeLine*0.9,fadec);
    if(this.mode==='off')this.lit=false;else if(this.mode==='start')this.lit=this.N2>=0.18&&this.fuel>0.02;else this.lit=true;
    if(this.lit&&this.mode==='run'&&alt>12500&&this.fuel<0.18){this.lit=false;this.mode='off';this.note('Apagado de llama: mezcla demasiado pobre a gran altitud. Desciende y rearranca','off',6);}
    if(this.lit&&!fadec&&this.fuel>surgeLine*1.1&&this.surge<0.05){this.surge=1;this.note('¡Bombeo del compresor! El flujo se invierte, sale una llamarada por la toma y la EGT se dispara','off',3);}
    const tEq=clamp((this.fuel-idle)/0.9,0,1);const wm1=0.42*M,wm2=0.14*M;
    const N2ss=this.lit?Math.max(0.62+0.38*tEq-0.18*this.surge,wm2):wm2;
    this.N2=lag(this.N2,N2ss,dt,this.lit?(N2ss>this.N2?1.6:2.4)+5*Math.pow(1-this.N2,2):7);
    if(this.starter){this.N2=Math.min(this.N2+0.05*dt,0.62);if(this.N2>0.5&&this.lit)this.starter=false;}
    const t1=clamp((this.N2-0.62)/0.38,0,1);const N1ss=this.lit?Math.max(0.22+0.78*t1-0.1*this.surge,wm1):wm1;
    this.N1=lag(this.N1,N1ss,dt,this.lit?3.2:9);
    const revCmd=state.reverser?1:0;if(revCmd!==this.revCmd){this.revCmd=revCmd;this.note(revCmd?'Inversor: el manguito retrocede y las compuertas cierran el bypass; el aire del fan sale hacia delante':'Inversor replegado','warn',4);}
    this.rev=lag(this.rev,revCmd,dt,0.8);
    return {t,M,alt,N1:this.N1,N2:this.N2,fuel:this.fuel,lit:this.lit,surge:this.surge,rev:this.rev};
  }
  stepTurbojet(dt,t,M,alt,fadec){
    const idle=0.3;let cmd;
    if(this.mode==='off')cmd=0;
    else if(this.mode==='start'){cmd=this.N>=0.18?idle:0;if(this.N>=0.6){this.mode='run';this.starter=false;this.note('Ralentí estable: arranque completado','ok',4);}}
    else cmd=idle+0.7*t;
    const surgeLine=(idle+0.7*clamp((this.N-0.63)/0.37,0,1))*1.3+0.06;
    this.fuelStep(dt,cmd,surgeLine*0.92,fadec);
    if(this.mode==='off')this.lit=false;else if(this.mode==='start')this.lit=this.N>=0.18&&this.fuel>0.02;else this.lit=true;
    if(this.lit&&!fadec&&this.fuel>surgeLine*1.1&&this.surge<0.05){this.surge=1;this.note('¡Bombeo del compresor! El flujo se invierte, sale una llamarada por la toma y la EGT se dispara','off',3);}
    const tEq=clamp((this.fuel-idle)/0.7,0,1);const wm=0.3*M;
    const Nss=this.lit?Math.max(0.63+0.37*tEq-0.15*this.surge,wm):wm;
    this.N=lag(this.N,Nss,dt,this.lit?(Nss>this.N?1.8:2.8)+5*Math.pow(1-this.N,2):6);
    if(this.starter){this.N=Math.min(this.N+0.05*dt,0.63);if(this.N>0.5&&this.lit)this.starter=false;}
    const abCmd=(this.mode==='run'&&this.lit&&this.N>0.9)?clamp((t-0.85)/0.15,0,1):0;
    if(abCmd>0.05&&this.ab<0.03)this.note('Encendido del postquemador: chorro de combustible sobre los estabilizadores y apertura de la tobera','warn',3);
    this.ab=lag(this.ab,abCmd,dt,0.6);
    return {t,M,alt,N:this.N,fuel:this.fuel,ab:this.ab,lit:this.lit,surge:this.surge};
  }
  /* compressor map state: speed, design pressure ratio, idle speed and the fuel excess over the steady
     schedule (the acceleration limiter holds it below the surge line; without it the point crosses) */
  map(){
    if(!this.turbo)return null;const tf=this.id==='turbofan';const N=tf?this.N2:this.N,n0=tf?0.62:0.63,idle=tf?0.1:0.3,span=tf?0.9:0.7;
    const fuelSS=idle+span*clamp((N-n0)/(1-n0),0,1);return {N,n0,PRd:tf?11.5:13.2,excess:(this.fuel-fuelSS)/fuelSS,surge:this.surge,lit:this.lit,hp:tf};
  }
  /* status and warnings that depend on the transient state */
  annotate(R,state){
    const ev=this.event;
    if(ev){R.status=ev.text;R.level=ev.level;}
    else if(this.turbo&&this.mode==='start'){R.status=this.lit?'Encendido: el motor acelera hacia ralentí por sus propios medios':'Arrancador: girando el eje de alta hasta el 18 % para poder encender';R.level='warn';}
    else if(this.turbo&&this.mode==='off'){R.status=state.mach>0.2?'Motor parado: los ejes giran en molinete por el viento relativo':'Motor parado. Pulsa «Arrancar» para la secuencia de encendido';R.level='off';}
    else if(this.limiting){R.status='Limitador de aceleración: el FADEC dosifica el combustible para no cruzar la línea de bombeo';R.level='warn';}
    else if(!this.turbo&&!this.fuelOn){R.status='Combustible cortado: solo pasa aire';R.level='off';}
    if(this.surge>0.05)R.warnings.unshift(['off','Bombeo del compresor']);
    if(this.unstart>0.05)R.warnings.unshift(['off','Unstart de la toma']);
    if(this.limiting)R.warnings.push(['warn','Limitador de aceleración']);
    if(!state.fadec&&this.turbo)R.warnings.push(['warn','Sin limitador: riesgo de bombeo']);
    if(R.chokeMargin!==undefined&&R.chokeMargin<0.15&&R.chokeMargin>=0&&R.burn>0.05)R.warnings.push(['warn','Cerca del bloqueo térmico']);
    if(this.turbo&&this.mode==='off'&&state.mach>0.2)R.warnings.push(['warn','Molinete']);
    R.mode=this.mode;R.running=this.running;R.starter=this.starter;R.fuelFrac=this.fuel;
  }
}

export {Dynamics};
