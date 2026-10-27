/* Global simulation state and time-scale constants */
import {isMobile} from './core/utils.js';

const state={engine:'turbofan',throttle:0.75,mach:0.15,tscale:0.5,view:'mat',cut:'quarter',flow:true,bloom:!isMobile,hover:null};
const KROT=1/34;   /* visual rev/s per real rev/s (slow motion) */
const KV=0.0125;   /* scene units per (m/s · s) */

export {state,KROT,KV};
