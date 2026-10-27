/* Synthesised engine sound (WebAudio): fan tone at the blade-pass frequency, shaft whine, combustion
   rumble, jet hiss, afterburner roar, starter motor and the bang of a surge or an unstart. Nothing is
   loaded: oscillators and filtered noise driven by the live cycle, in real time (not slowed down). */
import {clamp,smooth} from './utils.js';

class Sound{
  constructor(){this.ctx=null;this.on=false;this.prevSurge=0;this.prevUn=0;}
  /* the context is created on the first enable, which must come from a user gesture */
  enable(on){this.on=on;if(on&&!this.ctx)this.build();if(!this.ctx)return;if(on)this.ctx.resume();this.master.gain.setTargetAtTime(on?1:0,this.ctx.currentTime,0.15);if(!on)setTimeout(()=>{if(!this.on&&this.ctx)this.ctx.suspend();},700);}
  build(){
    const C=this.ctx=new (window.AudioContext||window.webkitAudioContext)();
    this.master=C.createGain();this.master.gain.value=0;
    const comp=C.createDynamicsCompressor();comp.threshold.value=-18;comp.ratio.value=6;this.master.connect(comp).connect(C.destination);
    const buf=C.createBuffer(1,C.sampleRate*2,C.sampleRate);const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const noise=(type,f,q)=>{const n=C.createBufferSource();n.buffer=buf;n.loop=true;const fl=C.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const g=C.createGain();g.gain.value=0;n.connect(fl).connect(g).connect(this.master);n.start();return {fl,g};};
    const tone=(type,f,cut)=>{const o=C.createOscillator();o.type=type;o.frequency.value=f;const fl=C.createBiquadFilter();fl.type='lowpass';fl.frequency.value=cut;const g=C.createGain();g.gain.value=0;o.connect(fl).connect(g).connect(this.master);o.start();return {o,g};};
    this.rumble=noise('lowpass',140,0.8);this.hiss=noise('bandpass',2200,0.6);this.wind=noise('bandpass',700,0.9);this.bang=noise('lowpass',260,1.2);
    this.fan=tone('sawtooth',400,1400);this.whine=tone('sine',3000,8000);this.starter=tone('triangle',300,2000);
  }
  update(R,st,dyn){
    if(!this.on||!this.ctx)return;const C=this.ctx,t=C.currentTime;const set=(p,v,tau=0.12)=>p.setTargetAtTime(v,t,tau);
    const id=st.engine,turbo=id==='turbofan'||id==='turbojet';const N1=turbo?(R.N1??R.N):0,N2=turbo?(R.N2??R.N):0;const burn=R.burn||0,ab=R.ab||0,M=R.M||0;
    const bpf=id==='turbofan'?N1*2550/60*22:N1*7685/60*30;      /* blade-pass frequency, Hz */
    set(this.fan.o.frequency,Math.max(30,bpf*0.5));set(this.fan.g.gain,turbo?0.045*N1*N1:0);
    set(this.whine.o.frequency,1500+6000*N2);set(this.whine.g.gain,turbo?0.012*smooth(0.3,1,N2):0);
    set(this.rumble.g.gain,0.35*burn+0.12*N1+0.25*ab);set(this.rumble.fl.frequency,120+120*burn+200*ab);
    set(this.hiss.g.gain,0.05*N1+0.35*ab+(turbo?0:0.25*burn)+0.04*clamp(M/3,0,1));set(this.hiss.fl.frequency,1800+1500*ab);
    set(this.wind.g.gain,turbo?0.04*clamp(M/1.5,0,1):0.12*clamp(M/4,0,1));set(this.wind.fl.frequency,500+150*M);
    set(this.starter.g.gain,R.starter?0.03:0);set(this.starter.o.frequency,150+700*N2);
    const s=dyn?dyn.surge:0,u=dyn?dyn.unstart:0;
    if(s>this.prevSurge+0.5||u>this.prevUn+0.5){const g=this.bang.g.gain;g.cancelScheduledValues(t);g.setValueAtTime(0.9,t);g.exponentialRampToValueAtTime(0.001,t+0.5);}
    this.prevSurge=s;this.prevUn=u;
  }
}

export {Sound};
