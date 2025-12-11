### Project Layout Overview

This repo is organized to enforce strict separation between Simulation, Rendering, Scripting, Game systems, and the UI shell.

#### Top-level
- `index.html` — Minimal HTML host; mounts React/Chakra app via `/src/main.tsx`.
- `vite.config.ts` — Vite configuration with React plugin.
- `tsconfig.json` — TypeScript settings (ES modules, DOM libs, React JSX).
- `package.json` — Scripts and dependencies.
- `junie/` — Guidance for contributors and AI agents.
  - `ui-guidelines.md` — Mandates Chakra UI v3 for UI work.
  - `project-layout.md` — This document.

#### Source tree (`/src`)
- `core/`
  - `SimulationLoop.ts` — Deterministic fixed-step loop; decoupled render callback.
- `simulation/`
  - `Environment.ts` — Physics orchestration and snapshot emission.
  - `Rocket.ts` — Rocket composition, mass/fuel/energy, command application.
  - `parts/` — Modular parts: engines, tanks, batteries, CPUs, sensors.
- `scripting/`
  - `RocketAPI.ts` — Only interface scripts can use (filtered by sensors).
  - `Sandbox.ts` — Budgeted script execution (soft time guards).
  - `ScriptRunner.ts` — Coordinates API + Sandbox per tick.
  - `CostModel.ts` — API call cost units.
- `rendering/`
  - `Renderer.ts` — View façade (no physics). Can drive Canvas2D or other.
  - `Scene.ts` — Simple scene that renders a rocket marker from snapshots.
- `game/`
  - `MissionManager.ts` — Mission framework and example mission type.
  - `PartStore.ts` — Economy and catalog (unlocks via missions).
- `App.tsx` — Chakra UI v3 layout shell (React) that renders panels and a canvas.
- `main.ts` — Imperative app logic (simulation/scripting/rendering bindings). Exports `initAppLogic()`.
- `main.tsx` — React entry point. Mounts `ChakraProvider` and `App`, then calls `initAppLogic()` after mount.

#### Separation rules (enforced)
- Simulation must never depend on rendering or React. It only exposes snapshots and accepts command queues.
- Rendering cannot mutate physics state.
- Scripting can only talk to the rocket through `RocketAPI`.
- UI (React/Chakra) is a shell for layout and DOM elements. It preserves specific element ids used by the imperative logic.

#### Run and build
- Dev server: `npm run dev` (Vite + React + Chakra UI v3)
- Build: `npm run build`
- Preview build: `npm run preview`

#### Migration notes
- The initial UI shell is React + Chakra v3 but preserves the existing imperative TypeScript to minimize risk.
- Future refactors can progressively move imperative DOM code into React components without breaking the architecture: create typed components for Parts Store, Installed Parts, Metrics Panel, Game Bar, and Script Editor; wire callbacks to the existing simulation layer.
