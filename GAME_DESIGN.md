### Space AI — Game Design Specification

Last updated: 2025-12-11

This document describes the current game systems, data models, player UI, and extensibility points for Space AI. It is intended to be shared with an LLM to brainstorm improvements to game progression, balance, and content.

---

## 1) High‑level overview

- You pilot and program small rockets/satellites in a toy two‑body system (a planet with atmosphere and a moon). 
- The simulation always runs in real time with a fixed physics tick. You can pause/resume and adjust speed.
- You write simple JavaScript “autopilot” scripts that run on a rocket’s Guidance System (CPU). Scripts run periodically (e.g., every 2 seconds for basic CPUs) with processing and energy limits.
- Earn money by completing missions (reach altitudes, speeds, orbit, SOI, etc.). Use money to buy and upgrade parts.
- Manage multiple rockets; switch which one is “active” (receives controls and drives the main panels). Upgrades are queued and applied on the next Reset Rocket.

Core loops:
- Build → Script → Launch → Observe → Earn → Upgrade → Repeat
- Strategic progression across missions and parts; tactical execution through autopilot scripting and manual controls.

---

## 2) Time & simulation

- Physics loop: fixed time step dt = 1/120 s; rendering at ~30 Hz (throttled).
- Game clock: advances only when the simulation runs.
  - 1 simulated second equals 1 in‑game minute (scale 60×).
  - Calendar is a simple 12×30 months; the header displays HH:MM.
- Speed: 0.5×, 1×, 2×, 4× (fast‑forward steps extra ticks; capped for frame stability).
- Reset Rocket: rebuilds the active rocket from layout, refills resources, clears trails, resets turn state, and requires Take Off again.
- Reset All: resets everything (missions, money, layouts, scripts, upgrades, game clock).

---

## 3) World & celestial system

- Toy System (configurable):
  - Planet “Toy Planet” — radius 5,000 m; surface gravity 9.81 m/s²; green disk; atmosphere scale height ≈ 200 m.
  - Moon “Big Moon” — radius 800 m; surface gravity 1.62 m/s²; circular orbit around the planet (radius 25 km, period 600 s).
- Sphere of Influence (SOI): each tick, the body that exerts the strongest gravitational acceleration on the rocket is considered primary for orbital analysis (Ap/Pe) and predicted elliptic path drawing.

---

## 4) Atmosphere, drag, thrust, heating

- Atmospheric density ρ(h): exponential barometric falloff with a hard cutoff altitude Hcut = scaleHeight × 7.
  - ρ(h) = ρ₀·exp(−h/H), for 0 ≤ h < Hcut; ρ(h) = 0 beyond cutoff.
- Drag: quadratic model, Fd = 0.5·ρ·v²·Cd·A along −v direction.
- Heating: proportional to dynamic pressure times speed (tunable placeholder).
- Engine thrust vs atmosphere: each engine defines its own vacuum bonus. Actual thrust is:
  - T(h) = Tmax × [1 + bonus × (1 − clamp(ρ/ρ₀, 0..1))].
  - Small Engine bonus: +25% at vacuum.
- Visuals: 
  - World scene fills black when in space; draws a faded blue atmospheric disk around the planet while in atmosphere.
  - Minimap shows the atmosphere cutoff circle as a dashed ring.

---

## 5) Orbits

- Apoapsis (Ap) and Periapsis (Pe) are computed each tick when orbit is bound (e < 1) relative to the current SOI body. 
- The minimap overlays the predicted elliptical trajectory for bound orbits (focus at SOI body).

---

## 6) Rockets — state & controls

- State: position (m), velocity (m/s), orientation (rad), mass (kg), temperature (arb.), fuel and battery resources, per‑tick forces breakdown.
- Attitude control: Reaction Wheels provide a maximum turn rate (rad/s). Turning consumes battery energy proportional to angular speed.
- Turning model: commands set a persistent angular velocity (rad/s) that persists until set to 0.
  - API: `api.setTurnRate(rateRadPerS)` (preferred), or compatibility `turnLeft/turnRight` (internally mapped to rates).
- Launch gating: engines cannot be turned on by scripts until “Take Off” has been clicked for the active rocket (turning is allowed pre‑launch).
- Multi‑rocket: all rockets are simulated and drawn; camera focuses on the active rocket. Take Off applies per‑rocket.

---

## 7) Parts (catalog & specs)

Starter catalog (expandable). Prices are used by the store; missions unlock some parts.

- Engines
  - Small Engine (engine.small)
    - Dry mass 50 kg, Tmax 2,000 N, Burn 2.5 kg/s, Vacuum bonus +25%.
- Fuel Tanks
  - Small Fuel Tank (fueltank.small): dry 20 kg; 60 kg fuel capacity (starts full).
  - Large Fuel Tank (fueltank.large): dry 60 kg; 200 kg fuel; unlocked by Reach 500 m mission.
- Batteries
  - Small Battery (battery.small): mass 10 kg; capacity 50,000 J.
- Guidance (CPU)
  - Basic Guidance System (cpu.basic): mass 8 kg; budget/tick 100; energy/tick 50 J; max chars 40k; slots 1; processing interval 2 s.
  - Advanced Guidance System (cpu.advanced): mass 10 kg; budget/tick 350; energy/tick 120 J; max chars 12k; slots 2; processing interval 1 s; unlocked by Reach 1 km.
- Sensors
  - Basic Navigation Sensor (sensor.nav.basic): exposes position/velocity/altitude/orientation, Ap, Pe, airDensity.
- Reaction Wheels
  - Small Reaction Wheels (rw.small): mass 5 kg; max ω 0.5 rad/s; energy cost 40 J per (rad/s) per second.
- Antennas
  - Small Antenna (antenna.small): mass 3 kg; range 15,000 m.

Telemetry: many parts expose snapshot keys (e.g., `fuelConsumptionKgPerS`, `fuelKg`, battery fields, CPU metrics, RW metrics) used by the UI and made available to scripts through sensors/parts whitelisting.

---

## 8) Scripting (user code)

- Environment: JavaScript `function update(api) { ... }`. Runs in a sandbox with budgets and energy cost provided by the installed Guidance System.
- Execution cadence: determined by the CPU’s `processingIntervalSeconds`.
  - Basic CPU: runs your update every ~2 s.
  - Advanced CPU: every ~1 s.
  - Interval ≤0 would mean every physics tick (not used by current parts).
- Budgets per run:
  - Processing budget (abstract cost units): charged by API operations. Exceeding throws and aborts the tick.
  - Energy (J/tick): drawn from batteries per script slot that runs.
- API surface (core):
  - `api.getSnapshot().data` → read‑only bag limited by installed sensors & part exposes.
  - `api.setEnginePower(0|1)` → binary throttle; subject to launch gating.
  - `api.setTurnRate(rateRadPerS)` → persistent angular velocity; 0 stops turning.
  - `api.memory.get/set/remove/clear` → ephemeral per‑CPU memory (64 KB limit).
  - `api.log(message)` → log line in the World page Script Logs panel.
- Autocomplete: the editor suggests API methods after `api.` and telemetry keys after `api.getSnapshot().data.` or `snap.`; keys are published dynamically based on current rocket composition.
- Example: the default autopilot demonstrates liftoff (until ρ halves), raising Ap, coasting to Ap, and circularizing to a ~2 km orbit using Ap/Pe and prograde alignment.

Notes for progression design:
- Smaller CPU intervals (e.g., advanced CPUs), higher budgets, and more slots increase control fidelity; missions and costs should scale accordingly.

---

## 9) Missions & economy

- Missions are checked post‑tick; on completion, a reward (money) is added once.
- Seeded missions include:
  - Reach 500 m, 1 km, 2 km (altitude goals).
  - Speed 100 m/s, 200 m/s.
  - Reach Space (ρ→0).
  - Circularize ~2 km (Ap & Pe ≥ 2 km within 10%).
  - Enter Moon SOI.
  - Stay above 200 m for 30 s.
- Part unlocks (examples):
  - Large Fuel Tank: Reach 500 m.
  - Advanced Guidance System: Reach 1 km.
- Money UI: displayed in the header; updated live.

Store & upgrades:
- Upgrading is queued (pending) per rocket and applied only on the next Reset Rocket.
- Selecting the same part as current is disallowed.
- Downgrades (choosing cheaper parts) are free.
- Items show price and are disabled if locked or unaffordable (except free downgrades).

---

## 10) Enterprise management (multi‑rocket)

- Per‑rocket naming (persisted for the session); names appear in the World page selector.
- Per‑rocket script assignment (slot 0): assign a saved script and enable/disable it.
- Per‑rocket pending upgrades summary; upgrades queue is applied on that rocket’s next reset.
- General upgrades (per rocket): Heating Protection level (UI shows derived max temperature in World → Structure panel).

---

## 11) Player UI (Chakra UI v3)

Pages:
- World Scene
  - Controls: Play/Pause, Speed, Take Off / Reset Rocket, active rocket selector.
  - Panels (cards):
    - Navigation: altitude, position, velocity, orientation, turn rate (actual & desired), Ap/Pe, air density.
    - Rocket: fuel, burn rate, estimated Δv, battery bar and values, mass, RW max turn rate, temperature (with per‑rocket max).
    - Guidance System: processing interval & next run ETA, scripts running, last‑tick cost & energy.
    - Forces: thrust/drag/gravity (total & per body), air density.
    - Minimap: whole system, atmosphere cutoff ring, all rockets (active highlighted), predicted orbit overlay.
    - Script Logs: per‑slot tabs (if multi‑slot), clear current/all.
  - Canvas: main scene (planet, moon, base structure at top of planet, rockets, plumes, thrust trail, atmosphere glow).
- Scripts
  - Scripts Directory (create, delete), Editor (CodeMirror with lint and autocomplete), Save, Compile; compiles to the active rocket’s runner.
- Enterprise
  - Base tab: base info and per‑rocket general upgrades (heating protection).
  - Rockets tab: select rocket; rename; assign/enable script; show installed parts/specs; upgrade selectors; Upgrade (grid) dialog with part specs.
- Missions
  - Cards with description, reward, status, and live progress bars; filter by Active/Completed/All.

---

## 12) Telemetry & editor integration

- Telemetry keys are collected from installed sensors and parts (`exposes` arrays). 
- `TelemetryService` publishes `telemetry-keys` events whenever composition changes (e.g., after reset/upgrades).
- The editor listens to these keys to suggest completions for `snap.`.

---

## 13) Data & persistence (session‑scoped)

- Layouts: stored per rocket index; default rocket is saved on first run.
- Scripts library: `{ id, name, code, updatedAt }[]`; slot assignments include optional `rocketIndex`.
- Pending upgrades: stored per rocket index by category; applied on Reset Rocket.
- Upgrades: per rocket (heating protection level).
- Money: stored in memory during a session (reset on Reset All).
- Names: per rocket names persisted in session storage.

---

## 14) Extension points & roadmap suggestions

These are intentionally designed to be independent of the physics hot path:

- Parts
  - Engines with different ISPs/vacuum bonuses and throttling (0..1 power) and gimbal.
  - Tanks with different dry mass ratios; multiple tanks and staging.
  - Batteries and energy generation (solar panels, RTGs) and consumers (reaction wheels, transmitters).
  - Guidance with variable intervals, budgets, slot counts, and fault behaviors (throttle/thermal limits).
  - Sensors (altimeter, horizon/attitude, SOI body ID, terrain, proximity, radiation, sun angle).
  - Antennas (range, bandwidth), relay satellites, link budgets.
- Economy & missions
  - Chains of missions culminating in lunar flyby/landing and multi‑launch objectives (deploy network, map planet, etc.).
  - Part blueprints and research trees; mission rewards unlock blueprints rather than direct parts.
- Base and comms
  - Base mass pad limits gating heavy launches; upgradable via missions.
  - Base global memory as a shared data store; rockets transmit logs/measurements when in range.
  - Antenna network (satellite relays) to extend range and coverage.
- Scripting
  - Typed ambient definitions for RocketAPI for richer IntelliSense.
  - Multiple scripts with message passing between slots.
  - On‑rocket local file storage with quotas and upload when in range.
- UI/UX
  - Charts for resource histories (fuel, battery, CPU cost).
  - Problem panels for script errors, mission hints, and part health.

Note: A `BaseService` exists for base upgrades, global memory, and link rate accounting. It is a good foundation for the comms/memory progression proposed above.

---

## 15) Glossary

- Ap/Pe — Apoapsis/Periapsis: highest/lowest orbital altitude over the current SOI body.
- SOI — Sphere of Influence (approx.): body with strongest instantaneous gravitational acceleration.
- Δv — Delta‑V estimate: ve·ln(m0/m1) with ve≈T/ṁ at full thrust.
- ρ0 — Sea‑level air density.
- Cd, A — Drag coefficient and reference area.
- CPU interval — Minimum seconds between script runs on a rocket’s Guidance System.

---

## 16) Balancing hooks (for LLM discussion)

Provide candidate knobs the LLM can tune or propose curves for:
- Atmosphere: `scaleHeight`, `cutoffFactor`, ρ0.
- Engines: Tmax, fuel burn, vacuum bonus, power curve.
- Reaction wheels: max ω, energy per ω.
- CPUs: interval, budget/tick, energy/tick, slots.
- Tanks & batteries: capacities, masses.
- Mission thresholds, rewards, and unlock dependencies.
- Store prices and base starting money.
- Header time scale (currently 60×).

This specification mirrors the current codebase behavior while highlighting planned extension points suitable for progression design.
