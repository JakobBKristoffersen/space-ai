# Refactor Plan – Space AI

This document outlines a step‑by‑step refactor plan to clean up the codebase, remove obsolete backward‑compat layers, and make modules easier to understand and extend — while preserving performance on the simulation hot path.

## Objectives
- Make the codebase modular and easier to navigate/modify.
- Remove legacy/backward‑compat code that obscures current behavior.
- Keep the simulation hot path (Environment.tick, ScriptRunner.runTick) allocation‑free and unchanged in complexity.
- Provide a stable, minimal public API between core (simulation/scripting/rendering) and UI.

## Non‑goals (for this refactor)
- No gameplay or physics feature additions (beyond minimal adjustments already delivered in current session).
- No visual redesign. The current Chakra UI v3 pages remain.
- No external dependency upgrades unless necessary to complete the refactor.

## Performance guardrails
- No new allocations inside Environment.tick or ScriptRunner.runTick.
- UI updates remain throttled (≈5 Hz) and occur post‑render only.
- Orbit/minimap overlays must avoid per‑frame garbage; cache where possible.

## Current architecture (inventory)
- Core hot path:
  - simulation/Environment.ts – physics & world snapshot
  - simulation/Rocket.ts – rocket state, mass, resources, command application
  - scripting/ScriptRunner.ts – sandbox scheduling, API, per‑slot logs
  - rendering/Renderer.ts + rendering/CelestialScene.ts – drawing
- Orchestration:
  - app/sim/SimulationManager.ts – owns Rocket, Environment, ScriptRunner, Renderer, Loop
- Services:
  - app/services/* (LayoutService, ScriptLibraryService, TelemetryService, UpgradesService, PendingUpgradesService, BaseService)
- UI (React, Chakra v3):
  - pages/WorldScenePage.tsx, ScriptsPage.tsx, EnterprisePage.tsx, MissionsPage.tsx
  - App.tsx (shell with tabs, header)
- Legacy/duplicate glue (to eliminate):
  - main.ts contains a large amount of historical UI wiring/controllers; it’s mostly superseded by React pages and SimulationManager.
  - app/ui/* DOM controllers (InstalledPanel, PartsPanel, ControlsPanel, etc.)—superseded by pages.
  - Deprecated sensors (BasicFuelSensor, BasicEngineSensor) — superseded by parts exposing telemetry.
  - RocketAPI.turnLeft/turnRight kept for compat; setTurnRate is canonical.

## Target module boundaries
- SimulationManager remains the only owner of Rocket, Environment, Renderer, CelestialScene, SimulationLoop.
- Services own persistence and configuration (session storage, catalog‑driven build, upgrades, pending queues, base state, telemetry keys event).
- EnvironmentSnapshot contains only world‑level state; per‑rocket transient fields live in RocketSnapshot (already done).
- UI pages are the only place with DOM concerns; eliminate legacy controllers.

## Back‑compat removal list
- Remove deprecated BasicFuelSensor and BasicEngineSensor.
- Prefer setTurnRate in RocketAPI and default scripts; keep turnLeft/turnRight but clearly mark deprecated in JSDoc (or remove in a follow‑up after consumers migrate).
- Remove (or relocate) legacy SimpleAtmosphere export if AtmosphereWithCutoff is canonical across the app.
- Remove legacy DOM controllers in app/ui/* after verifying the React pages cover the features.
- Trim main.ts to a thin bootstrap (or fully delegate to SimulationManager and React pages); remove legacy UI wiring.

## File cleanups/splits
- simulation/Rocket.ts: move interfaces/types to simulation/RocketTypes.ts to shorten the class file.
- rendering/CelestialScene.ts: extract trail/minimap/orbit overlay utilities into rendering/sceneParts/* (ensure no extra allocations on render).
- ui/ScriptEditor.tsx: extract CodeMirror completion/lint/theme setup into ui/editor/*.

## Optional infrastructure
- Add a tiny EventHub (app/utils/events.ts) for optional UI signals: UI_TICK, MONEY_CHANGED, TELEMETRY_CHANGED (not used on hot path). Pages can subscribe directly or via existing manager.onPostRender hooks.

## Phased execution plan

### Phase A — Planning + bootstrap slim down (no behavior changes)
- [x] Add this REFACTOR_PLAN.md and validate with stakeholders.
- [x] Make main.ts a thin bootstrap:
  - Keep only initAppLogic export, SimulationManager instantiation, services exposure, and minimal legacy compatibility for the React shell.
  - Remove dead/duplicate DOM bindings (legacy metrics, parts, installed, etc.). Ensure pages fully own UI.
- [x] Verify build/dev still run and app behaves identically.

### Phase B — Back‑compat cleanup (sensors & API)
- [x] Remove BasicFuelSensor and BasicEngineSensor; confirm no code paths add them.
- [x] RocketAPI: document turnLeft/turnRight as deprecated; ensure default example uses setTurnRate exclusively.
- [x] Ensure TelemetryService remains the single source for editor keys; confirm per‑part exposes.

### Phase C — File splits and renderer tidy (behavior‑neutral)
- [x] Create simulation/RocketTypes.ts; move interfaces, re‑export as needed.
- [x] Extract rendering/sceneParts/* with pure helpers for trail, orbit overlay, and minimap bounds.
- [ ] Extract ui/editor/* for CodeMirror config; keep ScriptEditor.tsx small. (optional)

### Phase D — Services unification and optional EventHub
- [x] Ensure all services are index‑aware where relevant (LayoutService, PendingUpgradesService, UpgradesService, BaseService—already largely index‑aware).
- [ ] (Optional) Introduce app/utils/events.ts for UI signals.
- [ ] Ensure BaseService hooks (antenna ranges, memory rates) are updated post‑tick only.

### Phase E — Final polish and docs
- [x] Delete app/ui/* legacy controllers after final parity check. (controllers removed from runtime; files left deprecated or will be pruned)
- [x] Update DEVELOPER.md with an architecture diagram, module responsibilities, and how to add a new part/page.
- [x] Add npm scripts for typecheck/lint/format if missing. (added typecheck)
- [x] Final performance pass: confirm zero additional allocations in Environment.tick and ScriptRunner.runTick (spot‑check with simple profiling/logging).

## Acceptance criteria
- main.ts is reduced to a small bootstrap delegating to SimulationManager; no legacy DOM UI remains.
- All UI is React/Chakra v3 pages; no app/ui/* controllers are referenced.
- Deprecated sensors are removed and parts expose their own telemetry.
- Editor autocomplete uses TelemetryService keys and continues to work after layout/upgrade changes.
- No behavior or performance regressions:
  - Always‑running sim; Play/Pause/Speed/Reset Rocket work.
  - Multi‑rocket switching and per‑rocket launch gating work.
  - Missions list, money rewards, upgrades (pending on reset), and Enterprise management work per rocket.
  - Orbit and atmosphere visuals remain stable; minimap shows atmosphere cutoff ring.

## Risks & mitigations
- Breaking hidden dependencies on legacy controllers — Mitigation: remove in small steps; smoke test after each removal.
- Type ripple from splitting Rocket types — Mitigation: re‑export from a central index or adjust imports in one pass with IDE support.
- Renderer GC churn from refactor — Mitigation: keep helpers pure; preserve cached arrays/refs and no per‑frame allocations.

## Rollback strategy
- Each phase is a small PR/commit; if a regression is found, revert that phase without affecting earlier ones.

## Verification checklist per phase
- Build compiles and app boots.
- World: visible scene, orbit overlay, atmosphere glow, minimap ring; Play/Pause/Speed; Take Off/Reset; per‑rocket switch.
- Scripts: save/load/delete, compile to slot 0, autocomplete keys reflect current parts.
- Enterprise: per‑rocket naming, script assignment enable/disable, queued upgrades apply on Reset Rocket; prices/locks enforced; antennas shown.
- Missions: progress updates live; rewards applied once; money in header updates.

---

Maintainers: update this plan by checking boxes and adding notes as phases complete. Keep DEVELOPER.md in sync with final architecture.
