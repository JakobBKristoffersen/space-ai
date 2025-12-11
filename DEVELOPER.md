### Space AI — Developer Guide

This document summarizes the modular architecture introduced to make the codebase easier to understand and evolve while keeping the simulation hot path fast.

#### Goals
- Keep physics/scripting/rendering (hot path) allocation-free and unchanged in cost.
- Move DOM/Chakra UI logic into small controller modules with a simple contract.
- Provide clear seams (services + manager) so UI can bind to state and actions easily.

---

### High-level Architecture

- Core domains (unchanged, hot path):
  - `src/simulation/*`, `src/scripting/*`, `src/rendering/*`, `src/core/*`, `src/game/*`.
- App orchestration layer (new): `src/app/*`
  - `sim/SimulationManager.ts`
    - Owns: `Rocket`, `Environment`, `ScriptRunner`, `Renderer`, `CelestialScene`, `SimulationLoop`.
    - API: `start()`, `pause()`, `isRunning()`, `staticRenderOnce()`, `enqueue(cmd)`, `recreateFromLayout(layout)`, `resetSimulationOnly()`, `reinstallAssignedScripts()`, `publishTelemetry()`.
    - Hooks: `onPostTick(fn)`, `onPostRender(fn)` for UI cadence.
  - `services/*`
    - `LayoutService.ts` — serialize/deserialize layout, build default rocket, save/load.
    - `ScriptLibraryService.ts` — named scripts CRUD, CPU slot assignments.
    - `TelemetryService.ts` — compute/publish allowed telemetry keys.
    - `SessionKeys.ts` — storage key constants.
  - `ui/*` (DOM-bound controllers)
    - `ControlsPanel.ts` — Engine ON/OFF, Turn L/R.
    - `InstalledPanel.ts` — installed parts list.
    - `PartsPanel.ts` — store listing, purchases, layout persistence.
    - `MetricsPanel.ts` — render allowed telemetry fields at ~5 Hz.
    - `Sparklines.ts` — rolling charts for fuel/battery.
    - (Earlier controllers already integrated): `ScriptsLibraryPanel.ts`, `CpuSlotsPanel.ts`.

`src/main.ts` is now a thin bootstrap that composes services + manager + controllers, wires post-tick and post-render hooks, and drives UI updates at ~5 Hz.

---

### Controller Contract

Each controller exports `init(deps) → { render?(), update?(), dispose?() }`.

- `render()` — optional immediate render (used for first paint).
- `update()` — optional method to call on the UI cadence. For example, `MetricsPanel.update(nowMs)` does throttled updates at ~5 Hz.
- `dispose()` — optional cleanup if the controller registers listeners.

Controllers must be DOM-only (no physics), and use TDZ-safe DOM queries (`document.getElementById` inside the controller) to avoid init order issues.

Example usage from `src/main.ts`:

```ts
const metricsPanel = initMetricsPanel({ hostId: "metrics", getEnv: () => env, getRocket: () => rocket, telemetry: telemetrySvc });
manager.onPostRender((alpha, now) => {
  metricsPanel.update(now);
});
```

---

### Simulation Hot Path

The hot path consists of `SimulationLoop.onTick` → `ScriptRunner.runTick` → `Environment.tick` (which calls `Rocket.applyCommands` and `Rocket.tickInternal`).

- No new allocations or event emissions were added in this path.
- UI work runs in `SimulationManager.onPostRender`, not in `onTick`.
- Telemetry keys are published only on composition changes (install/reset), not per frame.

---

### Adding a New UI Panel

1. Create `src/app/ui/MyPanel.ts` exporting `init(deps) → { render?, update?, dispose? }`.
2. Query DOM inside the module and add null guards.
3. Wire it in `src/main.ts` after `SimulationManager` creation:
   - Instantiate controller with required deps (`getEnv`, `getRocket`, `manager`, services).
   - Call `render()` once if needed.
   - Call `update()` from the post-render cadence.

---

### Telemetry Keys (for editor & metrics)

- Use `TelemetryService.currentKeys(rocket)` to get the union of keys exposed by sensors and parts.
- `TelemetryService.publish(keys)` dispatches `CustomEvent("telemetry-keys", { detail: { keys }})` for the editor to update autocompletion.
- Publish on startup and whenever the rocket composition changes (install/reset/recreate).

---

### Performance Guardrails

- Keep all expensive or UI-related work out of the simulation tick.
- Maintain a single UI cadence (~5 Hz) for metrics and sparklines.
- Avoid dynamic allocations in tight render loops; reuse arrays where possible.

---

### Future (optional) Cleanups

- Split `simulation/Rocket.ts` types into `simulation/RocketTypes.ts` to shorten the class file.
- Extract minor helpers from `rendering/CelestialScene.ts` without changing allocation patterns.
- Extract editor configuration (completion, linter, theme) into `src/ui/editor/*` to shorten `ScriptEditor.tsx`.
- Consider a tiny `EventHub` to unify non-critical UI events (e.g., MONEY_CHANGED) if needs grow.
