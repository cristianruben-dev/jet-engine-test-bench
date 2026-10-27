/* Global simulation state and time-scale constants */
import {isMobile} from './core/utils.js';

const state={
  engine:'turbofan',throttle:0.75,mach:0.15,alt:0,tscale:0.5,
  view:'mat',            /* mat | thermal | pressure | velocity */
  thermalMode:'metal',   /* thermal view paints gas or metal temperature */
  cut:'quarter',flow:true,bloom:!isMobile,hover:null,
  paused:false,fadec:true,particles:isMobile?'low':'medium',
  chart:'compare',       /* compare | cycle */
};
const KROT=1/34;   /* visual rev/s per real rev/s (slow motion) */
const KV=0.0125;   /* scene units per (m/s · s) */
const PARTICLES={low:isMobile?1200:2500,medium:isMobile?2600:6000,high:isMobile?4500:11000};

export {state,KROT,KV,PARTICLES};
