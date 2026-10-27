# Jet Engine Test Bench

Interactive 3D simulation (Three.js) of four jet engines: a high-bypass turbofan, an afterburning turbojet, a ramjet and a scramjet. Moving parts, airflow particles with inlet suction, casing cutaways, per-part tooltips and a thermal map per component computed from a simplified thermodynamic cycle. The user interface is in Spanish.

## Run

The files must be served over HTTP (ES modules do not load from `file://`):

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

then open <http://localhost:8765/>. Three.js and its addons load from jsDelivr.

## Layout

```
index.html              Page markup only (no styles, no logic)
css/styles.css          Stylesheet (tokens, panel, tooltip, phone layout)
js/main.js              Entry point and simulation loop
js/ui.js                Panel, tabs, legend, tooltip and engine loading
js/state.js             Global state and time-scale constants
js/fallback.js          Warning when the CDN does not respond
js/core/utils.js        Numeric helpers, formatting and temperature palettes
js/core/scene.js        Renderer, camera, lights, environment and bloom
js/core/cuts.js         Cutaway clipping planes
js/core/materials.js    Base materials
js/core/geometry.js     Bodies of revolution, instanced blades, profiles
js/core/flame.js        Flame shader (simplex noise) and flame tubes
js/core/shocks.js       Shock waves and the θ-β-M relation
js/core/engine.js       Engine class: parts, spools, flames, streams, cutaway
js/core/thermo.js       Thermodynamic model of each engine
js/core/flow.js         Air particles with streaks and suction
js/core/thermal.js      Per-part color by temperature
js/engines/turbofan.js  Turbofan geometry and streams
js/engines/turbojet.js  Turbojet with afterburner and petal nozzle
js/engines/ramjet.js    Ramjet with inlet spike
js/engines/scramjet.js  Scramjet with ramps and oblique shocks
js/engines/index.js     Engine catalog (builder, thermo, ranges, copy)
```

## Debugging

The page exposes `window.__sim` (camera, controls, state, `loadEngine`, `fps`) so the simulation can be driven from the browser console.
