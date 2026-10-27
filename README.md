# Jet Engine Test Bench

Interactive 3D simulation (Three.js) of four jet engines: a high-bypass turbofan, an afterburning turbojet, a ramjet and a scramjet. Moving parts, airflow streaks that are sucked into the inlet, steered around the bodies and mixed in the jet, casing cutaways with stencil-capped section faces, per-part tooltips and four paint modes (materials, temperature of gas or cooled metal, pressure, velocity) computed from a simplified thermodynamic cycle. Spool dynamics run in real time: start-up with a starter motor, fuel cut and windmilling, a FADEC acceleration limiter that can be switched off to provoke compressor surge, lean flameout at altitude and scramjet unstart. A chart compares the four engines against Mach (specific thrust and specific fuel consumption) next to a live T-s diagram. The user interface is in Spanish.

## Run

The files must be served over HTTP (ES modules do not load from `file://`):

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

then open <http://localhost:8765/>. Three.js and its addons load from jsDelivr.

## Interface

Full-bleed 3D scene. Top left: title, engine tabs and the engine description (replaced by the guided-tour card while a tour runs). Bottom centre, floating over the scene: the colour scale of the active view and the view toolbar (paint mode, gas/metal, cutaway, camera presets, pause). Right: the instrument panel, with a fixed head (throttle, airspeed, altitude, start/cut button, FADEC limiter, status line, warnings and four key instruments per engine) and a tabbed body: Instrumentos, Gráficas, Escenarios, Ajustes. On phones the panel becomes a bottom sheet and the canvas sits above it; the sheet collapses to the status line and the key instruments.

Keyboard: `Space` pause, `1`–`4` paint modes, `C` cycles the cutaway, `Esc` closes the tour, `←`/`→` move between tabs.

## Layout

```
index.html               Page markup only (no styles, no logic)
css/styles.css           Stylesheet (tokens, stage overlays, toolbar, panel, charts, tour, phone sheet)
js/main.js               Entry point and simulation loop (dynamics → cycle → paint → flow)
js/ui.js                 Tabs, sliders, start/stop, toolbar, legend, panel head and panes, charts, scenarios, tour, tooltip
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
js/core/flow.js          Air streaks in one instanced draw call: inlet sink, body steering, streams, swirl, jet mixing, view colouring
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
- The flow is not a CFD. Outside the engine each particle moves with the free stream plus the sink of the captured stream tube, whose strength is the inlet face velocity minus the flight speed (so a windmilling or throttled-back engine at speed spills, and a surging compressor blows air out of the inlet); near a body its radial velocity follows the slope of the profile, read a little ahead, and behind the nozzle the free jet continues the body so the outside air rides along the shear layer and is dragged by it. Inside, particles follow programmed streams (radius, velocity and temperature per station) with rotor swirl, a slowly wandering drift in the flame and in the free jet, and a through-flow factor `q` that goes to zero with the engine stopped and no wind.
- Streaks are screen-space quads (constant pixel width, soft edges, round head) drawn with premultiplied alpha; with a cutaway most new particles start in the open sector so the internal flow can be seen. Above about Mach 8 the scramjet temperatures ignore dissociation.

## Debugging

The page exposes `window.__sim` (camera, controls, state, `dyn`, `loadEngine`, `flyTo`, `fps`) so the simulation can be driven from the browser console. The browser pane throttles `requestAnimationFrame` while tools run, so fps readings there are meaningless.
