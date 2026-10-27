/* Base materials (cloned per part in Engine.part) */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';

const std=(color,metalness,roughness,extra={})=>new THREE.MeshStandardMaterial({color,metalness,roughness,envMapIntensity:0.9,...extra});
const MAT={
  paint:std(0xc3c8ce,0.2,0.5),
  titanium:std(0x9ba4ae,0.9,0.38),
  steel:std(0x7f8893,0.95,0.42),
  inconel:std(0x6e6a68,0.85,0.5),
  ceramic:std(0xb9ad94,0.4,0.65),
  composite:std(0x1f2327,0.25,0.62),
  dark:std(0x2b3139,0.7,0.6),
  gold:std(0xc9a24a,0.9,0.35),
  copper:std(0xb0714a,0.9,0.4),
  carbon:std(0x33363a,0.3,0.7),
};

export {std,MAT};
