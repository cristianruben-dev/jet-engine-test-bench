# Jet Engine Test Bench

Interactive 3D simulation (Three.js) of four jet engines: a high-bypass turbofan, an afterburning turbojet, a ramjet and a scramjet. Moving parts, airflow particles with inlet suction, casing cutaways with stencil-capped section faces, per-part tooltips and four paint modes (materials, temperature of gas or cooled metal, pressure, velocity) computed from a simplified thermodynamic cycle. Spool dynamics run in real time: start-up with a starter motor, fuel cut and windmilling, a FADEC acceleration limiter that can be switched off to provoke compressor surge, lean flameout at altitude and scramjet unstart. A chart compares the four engines against Mach (specific thrust and specific fuel consumption) next to a live T-s diagram. The user interface is in Spanish.

## Run

The files must be served over HTTP (ES modules do not load from `file://`):

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

then open <http://localhost:8765/>. Three.js and its addons load from jsDelivr.

## Layout

```
index.html               Page markup only (no styles, no logic)
css/styles.css           Stylesheet (tokens, panel, charts, tour, phone layout)
js/main.js               Entry point and simulation loop (dynamics → cycle → paint → flow)
js/ui.js                 Panel, tabs, start/stop, views, instruments, charts, scenarios, tour, tooltip
js/state.js              Global state, time-scale constants, particle budgets
js/fallback.js           Warning when the CDN does not respond
js/core/utils.js         Numeric helpers, formatting and the palette of every view
js/core/atmosphere.js    ISA atmosphere (0–32 km)
js/core/scene.js         Renderer, camera, lights, environment, bloom, camera flights
js/core/cuts.js          Cutaway clipping planes
js/core/caps.js          Stencil-filled section caps for the cut casings
js/core/materials.js     Base materials
js/core/textures.js      Procedural textures: panel seams, dilution holes, cooling dots, hatch
js/core/geometry.js      Bodies of revolution, shells, instanced blades (with UVs), profiles
js/core/flame.js         Flame shader (simplex noise) and flame tubes
js/core/shocks.js        Shock waves and the θ-β-M relation
js/core/engine.js        Engine class: parts with station keys and cooling, spools, VSVs, streams, caps
js/core/thermo.js        Thermodynamic cycle of each engine: stations (T, P, V), fuel flow, efficiencies
js/core/dynamics.js      Spool dynamics, start/stop, FADEC limiter, surge, flameout, unstart
js/core/flow.js          Air particles with streaks, suction, reverse flow on surge, view colouring
js/core/paint.js         Per-part colour by view (glow, temperature, pressure, velocity) and cap colours
js/core/charts.js        Comparison chart (four engines vs Mach) and the T-s diagram
js/engines/turbofan.js   Turbofan geometry, VSVs, bleed valves, pylon, streams, tour
js/engines/turbojet.js   Turbojet with variable IGVs, afterburner and petal nozzle
js/engines/ramjet.js     Ramjet with inlet spike
js/engines/scramjet.js   Scramjet with ramps, oblique shocks and fins
js/engines/index.js      Engine catalog (builder, thermo, ranges, copy, scenario presets)
```

## Model notes

- Station temperatures are total (stagnation) gas temperatures; the thermal view can show instead the metal temperature of cooled parts, `T_metal = T_gas − cool·(T_gas − T_coolant)` with the coolant at compressor-delivery temperature.
- Fuel flow comes from the heat added per station (`ΔT = f·LHV·η/cp`); specific fuel consumption, propulsive and thermal efficiency are derived from it.
- The flow follows programmed streamlines, not a CFD; above about Mach 8 the scramjet temperatures ignore dissociation.

## Debugging

The page exposes `window.__sim` (camera, controls, state, `dyn`, `loadEngine`, `flyTo`, `fps`) so the simulation can be driven from the browser console. The browser pane throttles `requestAnimationFrame` while tools run, so fps readings there are meaningless.
