import { SimulationLoop } from "./core/SimulationLoop";
import { Environment, SimpleAtmosphere, QuadraticDrag, SimpleHeating } from "./simulation/Environment";
import { Rocket, RocketCommandQueue, SimpleQueue } from "./simulation/Rocket";
import { SmallEngine } from "./simulation/parts/Engine";
import { SmallFuelTank } from "./simulation/parts/FuelTank";
import { SmallBattery } from "./simulation/parts/Battery";
import { BasicProcessingUnit } from "./simulation/parts/ProcessingUnit";
import { BasicNavigationSensor } from "./simulation/parts/Sensor";
import { Renderer } from "./rendering/Renderer";
import { CelestialScene } from "./rendering/CelestialScene";
import { ScriptRunner } from "./scripting/ScriptRunner";
import { PartStore, DefaultCatalog } from "./game/PartStore";
import { MissionManager, ReachAltitudeMission, ReachSpeedMission, ReachSpaceMission, CircularizeOrbitMission, EnterSoIMission, StayAloftMission } from "./game/MissionManager";

// Modular services (Phase 1 extraction)
import { LayoutService } from "./app/services/LayoutService";
import type { StoredLayout } from "./app/services/LayoutService";
import { ScriptLibraryService } from "./app/services/ScriptLibraryService";
import { TelemetryService } from "./app/services/TelemetryService";
import { UpgradesService } from "./app/services/UpgradesService";
import { PendingUpgradesService } from "./app/services/PendingUpgradesService";
import { SessionKeys } from "./app/services/SessionKeys";
import type { ScriptItem, SlotAssign } from "./app/services/ScriptLibraryService";
import { SimulationManager } from "./app/sim/SimulationManager";
import { initScriptsLibraryPanel } from "./app/ui/ScriptsLibraryPanel";
import { initCpuSlotsPanel } from "./app/ui/CpuSlotsPanel";
import { initControlsPanel } from "./app/ui/ControlsPanel";
import { initInstalledPanel } from "./app/ui/InstalledPanel";
import { initPartsPanel } from "./app/ui/PartsPanel";
import { initMetricsPanel } from "./app/ui/MetricsPanel";
import { initSparklines } from "./app/ui/Sparklines";
import { ToySystem as SharedToySystem } from "./app/config/ToySystem";
import { BASE_STARTING_MONEY } from "./app/config/constants";
import { seedDefaultMissions } from "./app/config/missions";

// Exported initializer to bootstrap the simulation and UI bindings after React mounts.
export function initAppLogic(): void {
  // Services (modularized)
  const layoutSvc = new LayoutService();
  const scripts = new ScriptLibraryService();
  const telemetrySvc = new TelemetryService();
  const upgrades = new UpgradesService();
  const pending = new PendingUpgradesService();
  // Helpers to create default rocket
  function buildDefaultRocket(): Rocket {
    return layoutSvc.buildDefaultRocket();
  }

  // Session persistence keys (centralized)
  const SESSION_SCRIPT_KEY = SessionKeys.SCRIPT;
  const SESSION_LAYOUT_KEY = SessionKeys.LAYOUT;
  const SESSION_SCRIPTS_KEY = SessionKeys.SCRIPTS; // library of named scripts
  const SESSION_CPU_SLOTS_KEY = SessionKeys.CPU_SLOTS; // slot assignments
  const SESSION_CURRENT_SCRIPT_NAME = SessionKeys.CURRENT_SCRIPT_NAME;


  function getLayoutFromRocket(r: Rocket): StoredLayout {
    return layoutSvc.getLayoutFromRocket(r);
  }

  function buildRocketFromLayout(layout: StoredLayout | null | undefined): Rocket {
    return layoutSvc.buildRocketFromLayout(layout);
  }

  function saveLayout(r: Rocket): void {
    layoutSvc.saveLayout(r);
  }

  function loadLayout(): StoredLayout | null {
    return layoutSvc.loadLayout();
  }

  // Mutable references so we can reset the simulation
  let rocket: Rocket = buildRocketFromLayout(loadLayout());
  // Ensure we have a stored layout for this session
  if (!sessionStorage.getItem(SESSION_LAYOUT_KEY)) {
    saveLayout(rocket);
  }
  // Toy celestial system moved to shared module to avoid drift during refactors
  // and to be reused by new bootstrap.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const ToySystem = SharedToySystem;
  let env: Environment = new Environment(rocket, {
    system: ToySystem,
    atmosphere: SimpleAtmosphere,
    drag: QuadraticDrag,
    heating: SimpleHeating,
  });

  // --- Scripting engine wiring ---
  let runner: ScriptRunner = new ScriptRunner(rocket);

  // Prefill the editor with a simple script that uses the Rocket API and memory/logging.
  const scriptEl = document.getElementById("script") as HTMLTextAreaElement | null;
  const defaultExample = `// Orbit insertion autopilot using Apoapsis/Periapsis
// Goal: Raise Apoapsis (Ap) to ~2000 m, coast to Ap, then burn prograde until Periapsis (Pe) reaches ~2000 m (±10%).
// API: const s = api.getSnapshot().data; fields used: altitude, velocity{x,y}, orientationRad, apAltitude, peAltitude, fuelKg, airDensity
// Controls: api.setEnginePower(0|1); api.turnLeft(rateRadPerS); api.turnRight(rateRadPerS); pass 0 to stop turning. Also: api.memory, api.log
function update(api) {
  const PHASES = ["liftoff","raise_ap","coast_to_ap","circularize","done"];
  // Show all phases once
  if (!api.memory.get("__phasesListed")) {
    api.log("Phases: " + PHASES.join(" -> "));
    api.memory.set("__phasesListed", 1);
  }

  const s = api.getSnapshot().data;
  const alt = Number(s.altitude ?? 0);
  const v = s.velocity || { x: 0, y: 0 };
  const vx = Number(v.x || 0), vy = Number(v.y || 0);
  const fuel = Number(s.fuelKg ?? 0);
  const ap = Number(s.apAltitude ?? NaN);
  const pe = Number(s.peAltitude ?? NaN);
  const orient = Number(s.orientationRad ?? 0);

  // Parameters
  const targetAp = 2000;    // m
  const targetPe = 2000;    // m (±10% acceptable)
  const peOkLow = targetPe * 0.9;
  const peOkHigh = targetPe * 1.1;
  const alignRate = 0.10;   // rad/s turn rate to command
  const alignTol = 0.03;    // rad (~1.7°)

  // Persistent phase (ensure first one is logged)
  const storedPhase = api.memory.get("phase");
  let phase = (typeof storedPhase === "string" && storedPhase) ? storedPhase : "liftoff";
  if (storedPhase !== phase) { api.memory.set("phase", phase); api.log("Phase → " + phase); }
  function setPhase(p) { if (p !== phase) { phase = p; api.memory.set("phase", p); api.memory.set("__lastProgressBucket", -1); api.log("Phase → " + p); } }

  // Helpers
  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  function angleWrap(a) { const TWO = Math.PI * 2; let x = a % TWO; if (x < 0) x += TWO; return x; }
  function angDiff(a, b) { // shortest signed difference a - b in [-pi, pi]
    let d = angleWrap(a) - angleWrap(b);
    if (d > Math.PI) d -= 2*Math.PI; else if (d < -Math.PI) d += 2*Math.PI; return d;
  }
  function progradeAngle() { return Math.atan2(vy, vx); }
  function alignTo(targetAngle) {
    const err = angDiff(targetAngle, orient);
    if (Math.abs(err) <= alignTol) { api.setTurnRate(0); return true; }
    api.setTurnRate(err > 0 ? +alignRate : -alignRate);
    return false;
  }
  function reportProgress(label, p){
    p = clamp01(p);
    const lastPhase = api.memory.get("__progressPhase") || "";
    let lastBucket = Number(api.memory.get("__lastProgressBucket") ?? -1);
    const bucket = Math.floor(p * 10); // 0..10
    if (phase !== lastPhase || bucket > lastBucket) {
      api.log(label + ": " + Math.round(p*100) + "%");
      api.memory.set("__progressPhase", phase);
      api.memory.set("__lastProgressBucket", bucket);
    }
  }

  // Safety
  if (fuel <= 0) { api.setEnginePower(0); api.turnRight(0); return; }

  // Track last altitude for apoapsis detection during coast
  const prevAlt = Number(api.memory.get("prevAlt") ?? alt);
  api.memory.set("prevAlt", alt);

  if (phase === "liftoff") {
    // New liftoff phase: ascend vertically until air density halves, then start turning.
    const rho = Number(s.airDensity ?? NaN);
    let rho0 = Number(api.memory.get("rho0") ?? NaN);
    if (!isFinite(rho0) && isFinite(rho)) { rho0 = rho; api.memory.set("rho0", rho0); }
    // Align to local vertical (outward normal): orientation should be pi/2 at launch; keep correcting just in case.
    const upAngle = Math.PI / 2;
    alignTo(upAngle);
    api.setEnginePower(1);
    if (isFinite(rho0) && isFinite(rho)) {
      const target = 0.5 * rho0;
      const p = clamp01(1 - (rho - target) / Math.max(1e-6, rho0 - target));
      reportProgress("Liftoff", p);
      if (rho <= target) {
        setPhase("raise_ap");
      }
    }
  } else if (phase === "raise_ap") {
    // Gravity turn: gradually tilt from vertical to build horizontal velocity,
    // then follow prograde as it approaches the horizon. This avoids staying vertical forever.
    const upAngle = Math.PI / 2;
    let tilt = Number(api.memory.get("tilt") ?? 0);
    const maxTilt = Math.PI * 0.45; // ~81° from +X i.e., slightly below horizontal in screen terms
    // Increase tilt a bit every script run (runner interval ~2s on basic guidance)
    tilt = Math.min(maxTilt, tilt + 0.12);
    api.memory.set("tilt", tilt);

    // Desired attitude: start from up and subtract tilt (turn right toward +X)
    const desired = upAngle - tilt;

    // Once horizontal speed is significant, hand over to prograde alignment (avoid early vertical lock)
    const vhor = Math.abs(vx);
    const usePrograde = vhor > 20; // m/s horizontal threshold

    // Diagnostics to understand why we might not be turning
    try {
      const errDeg = (angDiff(usePrograde ? progradeAngle() : desired, orient) * 180) / Math.PI;
      const desRW = Number(s.rwDesiredOmegaRadPerS ?? NaN);
      const actRW = Number(s.rwOmegaRadPerS ?? NaN);
      api.log("[raise_ap] tilt=" + tilt.toFixed(2) + " rad, aim=" + (usePrograde ? "prograde" : "gravity-turn") + " orientDeg=" + ((orient*180)/Math.PI).toFixed(1) + ", errDeg=" + errDeg.toFixed(1) + ", vhor=" + vhor.toFixed(1) + " m/s, desRW=" + (isFinite(desRW)? desRW.toFixed(3) : "-") + " rad/s, actRW=" + (isFinite(actRW)? actRW.toFixed(3) : "-") + " rad/s");
    } catch {}

    if (usePrograde) {
      // Align to prograde when we have meaningful horizontal speed
      const aim = progradeAngle();
      const aligned = alignTo(aim);
      try { api.log("[raise_ap] prograde align aligned=" + (aligned ? "true" : "false")); } catch {}
    } else {
      // During the gravity-turn phase, command a steady rightward turn rate so we visibly tip over
      api.setTurnRate(-alignRate); // negative = left (CCW) in our convention toward +X when starting at +Y
      try { api.log("[raise_ap] gravity-turn cmdRate=" + (-alignRate).toFixed(2) + " rad/s"); } catch {}
    }

    api.setEnginePower(1);
    if (isFinite(ap) && isFinite(targetAp)) {
      reportProgress("Raise Ap", clamp01(ap / targetAp));
    }
    if (isFinite(ap) && ap >= targetAp * 0.98) { // reached ~target Ap
      api.setEnginePower(0);
      api.turnRight(0); // stop any residual rotation
      setPhase("coast_to_ap");
    }
  } else if (phase === "coast_to_ap") {
    // Engines off; wait until we reach (or are very near) apoapsis
    api.setEnginePower(0);
    api.turnRight(0);
    if (isFinite(ap)) {
      const close = Math.abs(ap - alt) < 25; // within 25 m of Ap
      const passedPeak = prevAlt > alt && alt > ap * 0.9; // started descending near Ap
      const p = clamp01(1 - Math.abs(ap - alt) / Math.max(1, ap));
      reportProgress("Coast to Ap", p);
      if (close || passedPeak) {
        setPhase("circularize");
      }
    }
  } else if (phase === "circularize") {
    // At/near Ap: burn prograde to raise Periapsis to target band
    const aim = progradeAngle();
    const aligned = alignTo(aim);
    api.setEnginePower(aligned ? 1 : 0);
    if (isFinite(pe) && isFinite(targetPe)) {
      reportProgress("Circularize (raise Pe)", clamp01(pe / targetPe));
    }
    if (isFinite(pe) && pe >= peOkLow) {
      api.setEnginePower(0);
      api.turnRight(0);
      setPhase("done");
    }
  } else if (phase === "done") {
    api.setEnginePower(0);
    api.turnRight(0);
    reportProgress("Mission", 1);
  }
}`.trim();
  if (scriptEl) {
    scriptEl.value = defaultExample;
  }
  // Script Library: session-scoped named scripts and slot assignments
  // Using ScriptItem and SlotAssign types from ScriptLibraryService
  function loadScripts(): ScriptItem[] {
    return scripts.list();
  }
  function saveScripts(all: ScriptItem[]): void {
    scripts.saveAll(all);
  }
  function loadCpuSlots(): SlotAssign[] {
    return scripts.loadAssignments();
  }
  function saveCpuSlots(all: SlotAssign[]): void {
    scripts.saveAssignments(all);
  }
  function upsertScriptByName(name: string, code: string): ScriptItem {
    return scripts.upsertByName(name, code);
  }
  function getScriptById(id: string | null | undefined): ScriptItem | null {
    return scripts.getById(id);
  }

  // Seed session script/library (migrates from legacy localStorage if needed)
  scripts.seedIfEmpty(scriptEl?.value ?? defaultExample, "TakeOff.js");

  // Compile button
  const compileBtn = document.getElementById("compile");
  compileBtn?.addEventListener("click", () => {
    const ta = document.getElementById("script") as HTMLTextAreaElement | null;
    const code = ta?.value ?? sessionStorage.getItem(SESSION_SCRIPT_KEY) ?? "";
    try {
      runner.installScript(code, { timeLimitMs: 6 });
      compileBtn!.textContent = "Compiled ✓";
      setTimeout(() => (compileBtn!.textContent = "Compile Script"), 1200);
    } catch (e: any) {
      alert("Compile error: " + (e?.message ?? String(e)));
    }
  });

  // --- Scripts Library UI & Slot Assignment ---
  function refreshScriptNameInput() {
    const el = document.getElementById("scriptNameInput") as HTMLInputElement | null;
    if (!el) return;
    try {
      const name = sessionStorage.getItem(SESSION_CURRENT_SCRIPT_NAME) || "";
      el.value = name;
    } catch {}
  }

  function renderScriptsLibrary() {
    const el = document.getElementById("scriptsLibrary") as HTMLElement | null;
    if (!el) return;
    const list = loadScripts();
    if (list.length === 0) {
      el.innerHTML = '<div class="muted">No saved scripts yet. Use Save to add the current editor script.</div>';
      return;
    }
    const rows = list
      .sort((a,b) => b.updatedAt - a.updatedAt)
      .map(s => {
        const date = new Date(s.updatedAt).toLocaleTimeString();
        return `<div class="row" data-id="${s.id}"><strong>${s.name}</strong> <small class="muted">${date}</small> <button data-action="load" data-id="${s.id}">Load</button> <button data-action="delete" data-id="${s.id}">Delete</button></div>`;
      });
    el.innerHTML = rows.join("");
  }

  {
    // Scripts Library UI managed by controller
    const panel = initScriptsLibraryPanel({
      scripts,
      isRunning: () => loop.isRunning(),
      onSlotsRepopulate: () => populateSlotSelects(),
    });
  }

  function populateSlotSelects() {
    const list = loadScripts();
    const opts = ["<option value=\"\">-- Select script --</option>", ...list.map(s => `<option value="${s.id}">${s.name}</option>`)];
    const s1El = document.getElementById("slot1Select") as HTMLSelectElement | null;
    const s2El = document.getElementById("slot2Select") as HTMLSelectElement | null;
    if (s1El) { s1El.innerHTML = opts.join(""); }
    if (s2El) { s2El.innerHTML = opts.join(""); }
    // Preselect according to saved assignments
    const assigns = loadCpuSlots();
    const s1 = assigns.find(a => a.slot === 0)?.scriptId || "";
    const s2 = assigns.find(a => a.slot === 1)?.scriptId || "";
    if (s1El) s1El.value = s1 || "";
    if (s2El) s2El.value = s2 || "";
  }

  function saveCurrentScript(name: string, forceNew = false) {
    const code = sessionStorage.getItem(SESSION_SCRIPT_KEY) ?? "";
    let targetName = name && name.trim().length > 0 ? name.trim() : "Untitled.js";
    if (forceNew) {
      // ensure unique by appending (n)
      const list = loadScripts();
      let base = targetName; let n = 1;
      while (list.some(s => s.name === targetName)) { targetName = base.replace(/(\.\w+)?$/, m => ` (${n++})${m}`); }
    }
    const item = upsertScriptByName(targetName, code);
    try { sessionStorage.setItem(SESSION_CURRENT_SCRIPT_NAME, item.name); } catch {}
    refreshScriptNameInput();
    renderScriptsLibrary();
    populateSlotSelects();
  }

  {
    const btn = document.getElementById("saveScriptBtn") as HTMLButtonElement | null;
    btn?.addEventListener("click", () => {
      if (loop.isRunning()) return;
      const nameInput = document.getElementById("scriptNameInput") as HTMLInputElement | null;
      const name = nameInput?.value || "Untitled.js";
      saveCurrentScript(name, false);
    });
  }
  {
    const btn = document.getElementById("saveAsScriptBtn") as HTMLButtonElement | null;
    btn?.addEventListener("click", () => {
      if (loop.isRunning()) return;
      const nameInput = document.getElementById("scriptNameInput") as HTMLInputElement | null;
      const name = nameInput?.value || "Untitled.js";
      saveCurrentScript(name, true);
    });
  }

  function reinstallAssignedScripts() {
    const assigns = loadCpuSlots();
    if (!rocket.cpu) return;
    for (const a of assigns) {
      if (a.slot < 0 || a.slot >= (rocket.cpu.scriptSlots || 1)) continue;
      const s = getScriptById(a.scriptId);
      if (s) {
        try { runner.installScriptToSlot(s.code, { timeLimitMs: 6 }, a.slot, s.name); } catch {}
      }
      try { runner.setSlotEnabled?.(a.slot, !!a.enabled); } catch {}
    }
  }

  // initialize UI lists
  renderScriptsLibrary();

  // Manual controls now enqueue directly into SimulationManager
  // Manual controls will be bound by ControlsPanel controller

  // --- Simple Parts Store + Installed UI ---
  let baseMoney = BASE_STARTING_MONEY; // starting money per design
  let money = baseMoney;
  const moneyEl = document.getElementById("money");
  const partsWrap = document.getElementById("parts");
  const installedWrap = document.getElementById("installed");
  const massEl = document.getElementById("massValue");
  const store = new PartStore(DefaultCatalog);
  const missionMgr = new MissionManager();

  // Helpers to (re)create environment and scene with current rocket
  function recreateEnvironmentAndScene(newRocket: Rocket) {
    // Delegate to SimulationManager to recreate from layout
    const layout = getLayoutFromRocket(newRocket);
    manager.recreateFromLayout(layout);
    // Sync local aliases
    rocket = manager.getRocket();
    env = manager.getEnvironment();
    runner = manager.getRunner();
    // Refresh UI panels via controllers
    installedPanelRef.render();
    partsPanelRef.render();
    metricsPanelRef.renderNow();
    renderScriptsLibrary();
    try { cpuPanelRef?.populateSelects(); } catch {}
    refreshScriptNameInput();
    // Publish telemetry keys for editor autocomplete
    publishTelemetryKeys();
  }

  function resetSimulationOnly() {
    // Rebuild rocket from stored layout, which gives fresh resources
    const layout = loadLayout();
    const newRocket = buildRocketFromLayout(layout);
    // Ensure engines are off at reset
    for (const e of newRocket.engines) e.power = 0;
    recreateEnvironmentAndScene(newRocket);
  }

  function resetSessionAll() {
    try {
      // Clear legacy single-rocket layout key and all namespaced layouts
      sessionStorage.removeItem(SESSION_LAYOUT_KEY);
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i)!; if (k && k.startsWith(SESSION_LAYOUT_KEY + ":")) keys.push(k);
      }
      for (const k of keys) sessionStorage.removeItem(k);
      sessionStorage.setItem(SESSION_SCRIPT_KEY, defaultExample);
      sessionStorage.removeItem(SESSION_SCRIPTS_KEY);
      sessionStorage.removeItem(SESSION_CPU_SLOTS_KEY);
      sessionStorage.setItem(SESSION_CURRENT_SCRIPT_NAME, "TakeOff.js");
      // Reseed the scripts library with the default example via service
      scripts.seedIfEmpty(defaultExample, "TakeOff.js");
    } catch {}
    // Also reset upgrades & pending upgrades to defaults
    try { (upgrades as any).clearAll?.(); } catch { try { upgrades.setHeatProtectionLevel(0 as any); } catch {} }
    try { pending.clear(); } catch {}
    // Notify React editor to reset its state
    try { window.dispatchEvent(new CustomEvent("session-state-reset")); } catch {}
    const newRocket = buildDefaultRocket();
    saveLayout(newRocket);
    recreateEnvironmentAndScene(newRocket);
    // Reset money to starting value
    try { money = baseMoney; refreshMoney(); } catch {}
  }

  // Game buttons
  (document.getElementById("reset") as HTMLButtonElement | null)?.addEventListener("click", () => {
    resetSimulationOnly();
  });
  const performResetAll = () => {
    // If running, stop first, then reset all state and keep paused
    if (loop.isRunning()) {
      loop.pause();
    }
    resetSessionAll();
    // Reset the simulation-driven game clock back to Year 1
    try { (window as any).__manager?.resetGameClock?.(); } catch {}
    // Ensure UI reflects paused state and controls are enabled again
    try {
      simRunning = false;
      updateRunUI();
      staticRenderOnce();
    } catch {}
  };
  (document.getElementById("resetAll") as HTMLButtonElement | null)?.addEventListener("click", () => {
    performResetAll();
  });
  // Seed default missions from centralized config
  seedDefaultMissions(missionMgr);

  function fmt(n: number) { return n.toLocaleString(); }
  function refreshMoney() { if (moneyEl) moneyEl.textContent = fmt(money); }
  function getCompleted(): readonly string[] { return missionMgr.getCompletedMissionIds(); }

  function renderInstalled() {
    if (!installedWrap) return;
    installedWrap.innerHTML = "";
    const addRow = (name: string) => {
      const row = document.createElement("div");
      row.className = "part";
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<strong>${name}</strong>`;
      row.appendChild(meta);
      installedWrap.appendChild(row);
    };
    for (const e of rocket.engines) addRow(e.name);
    for (const t of rocket.fuelTanks) addRow(t.name);
    for (const b of rocket.batteries) addRow(b.name);
    if (rocket.cpu) addRow(rocket.cpu.name);
    for (const s of rocket.sensors) addRow(s.name);
  }


  function publishTelemetryKeys() {
    telemetrySvc.publish(telemetrySvc.currentKeys(rocket));
  }

  function renderParts() {
    if (!partsWrap) return;
    partsWrap.innerHTML = "";

    // Build a set of installed part ids; if a part id is installed, we hide it from the store.
    const installedIds = new Set<string>();
    for (const e of rocket.engines) installedIds.add(e.id);
    for (const t of rocket.fuelTanks) installedIds.add(t.id);
    for (const b of rocket.batteries) installedIds.add(b.id);
    if (rocket.cpu) installedIds.add(rocket.cpu.id);
    for (const s of rocket.sensors) installedIds.add(s.id);

    const availableAll = store.listAvailable(getCompleted());
    const available = availableAll.filter(p => !installedIds.has(p.id));

    for (const p of available) {
      const row = document.createElement("div");
      row.className = "part";
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<strong>${p.name}</strong><small class=\"muted\">$${fmt(p.price)}</small>`;
      const btn = document.createElement("button");
      btn.textContent = "Install";
      btn.disabled = money < p.price || loop.isRunning();
      btn.addEventListener("click", () => {
        if (loop.isRunning()) return; // disallow purchases while running
        const res = store.purchase<any>(p.id, money, getCompleted());
        if (!res) return;
        money = res.newBalance;
        // Install into rocket by category
        switch ((p as any).category) {
          case "engine":
            rocket.engines.push(res.instance);
            break;
          case "fuel":
            rocket.fuelTanks.push(res.instance);
            break;
          case "battery":
            rocket.batteries.push(res.instance);
            break;
          case "cpu":
            rocket.cpu = res.instance;
            break;
          case "sensor":
            rocket.sensors.push(res.instance);
            // Refresh metrics immediately as capabilities changed
            renderMetricsNow();
            break;
        }
        // Persist new layout for this session
        saveLayout(rocket);
        refreshMoney();
        renderInstalled();
        renderParts();
        publishTelemetryKeys();
      });
      row.appendChild(meta);
      row.appendChild(btn);
      partsWrap.appendChild(row);
    }
  }

  // --- Rocket Console: Metrics + CPU Slots/Logs + Sparklines ---
  const metricsEl = document.getElementById("metrics");
  const assignSlot1Btn = document.getElementById("assignSlot1") as HTMLButtonElement | null;
  const assignSlot2Btn = document.getElementById("assignSlot2") as HTMLButtonElement | null;
  const toggleSlot1Btn = document.getElementById("toggleSlot1") as HTMLButtonElement | null;
  const toggleSlot2Btn = document.getElementById("toggleSlot2") as HTMLButtonElement | null;
  const slot1Select = document.getElementById("slot1Select") as HTMLSelectElement | null;
  const slot2Select = document.getElementById("slot2Select") as HTMLSelectElement | null;
  const saveScriptBtn = document.getElementById("saveScriptBtn") as HTMLButtonElement | null;
  const saveAsScriptBtn = document.getElementById("saveAsScriptBtn") as HTMLButtonElement | null;
  const scriptNameInput = document.getElementById("scriptNameInput") as HTMLInputElement | null;
  const log1El = document.getElementById("logSlot1");
  const log2El = document.getElementById("logSlot2");
  const sparkFuel = document.getElementById("sparkFuel") as HTMLCanvasElement | null;
  const sparkBattery = document.getElementById("sparkBattery") as HTMLCanvasElement | null;
  const scriptsLibEl = document.getElementById("scriptsLibrary") as HTMLElement | null;

  function fmtNum(v: unknown): string {
    if (typeof v !== "number") return String(v);
    const a = Math.abs(v);
    if (a >= 10000) return v.toFixed(0);
    if (a >= 1000) return v.toFixed(1);
    return v.toFixed(2);
  }
  function renderMetricsNow(): void {
    if (!metricsEl) return;
    const allowedKeys = telemetrySvc.currentKeys(rocket);
    const allowed = new Set<string>(allowedKeys);
    const snap: any = env.snapshot().rocket;
    const lines: string[] = [];
    for (const key of allowed) {
      const val = snap[key];
      if (val === undefined) continue;
      if (val && typeof val === "object") {
        // Expand shallow object like position/velocity
        for (const subKey of Object.keys(val)) {
          const subVal: any = (val as any)[subKey];
          if (typeof subVal === "number" || typeof subVal === "string") {
            lines.push(`${key}.${subKey}: ${fmtNum(subVal)}`);
          }
        }
      } else {
        lines.push(`${key}: ${fmtNum(val)}`);
      }
    }
    (metricsEl as HTMLElement).innerHTML = lines.map(l => `<div>${l}</div>`).join("");
  }

  // CPU Slots handled by CpuSlotsPanel controller (see app/ui/CpuSlotsPanel.ts)

  // Delegates to CpuSlotsPanel when available
  let cpuPanelRef: { render: () => void; populateSelects: () => void } | null = null;
  function renderCpuUi() {
    try { cpuPanelRef?.render(); } catch {}
  }

  // Simple sparkline data & drawing
  const sparkFuelData: number[] = [];
  const sparkBatteryData: number[] = [];
  function pushSparkSamples() {
    const snap = env.snapshot().rocket as any;
    sparkFuelData.push(Number(snap.fuelKg) || 0);
    const pct = Number(snap.batteryPercent) || 0;
    sparkBatteryData.push(pct);
    const maxLen = 120; // last ~24s at 5Hz
    if (sparkFuelData.length > maxLen) sparkFuelData.splice(0, sparkFuelData.length - maxLen);
    if (sparkBatteryData.length > maxLen) sparkBatteryData.splice(0, sparkBatteryData.length - maxLen);
  }
  function drawSparkline(canvas: HTMLCanvasElement, data: number[], color: string, normalized = false) {
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const w = canvas.width = canvas.clientWidth || 240; // sync to CSS size
    const h = canvas.height = canvas.height; // keep provided height
    ctx.clearRect(0, 0, w, h);
    if (data.length < 2) return;
    let min = Math.min(...data); let max = Math.max(...data);
    if (normalized) { min = 0; max = 100; }
    const span = Math.max(1e-6, max - min);
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * (w - 2) + 1;
      const y = h - 1 - ((data[i] - min) / span) * (h - 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  let lastMetricsRender = 0;
  function renderMetrics(nowMs: number): void {
    if (nowMs - lastMetricsRender < 200) return; // ~5 Hz UI update
    lastMetricsRender = nowMs;
    renderMetricsNow();
    renderCpuUi();
    pushSparkSamples();
    if (sparkFuel) drawSparkline(sparkFuel, sparkFuelData, "#4FD1C5", false);
    if (sparkBattery) drawSparkline(sparkBattery, sparkBatteryData, "#F6AD55", true);
  }
  renderMetricsNow();

  // Wire up canvas and create SimulationManager (renderer + loop inside)
  const canvas = document.getElementById("game") as HTMLCanvasElement | null;
  if (!canvas) { throw new Error("Canvas #game not found in index.html"); }

  // Ensure the canvas drawing buffer matches the displayed size (Chakra's Box uses CSS width/height)
  const cssW = canvas.clientWidth || 900;
  const cssH = canvas.clientHeight || 600;
  canvas.width = Math.max(1, Math.round(cssW));
  canvas.height = Math.max(1, Math.round(cssH));

  const ctx = canvas.getContext("2d");
  if (ctx) ctx.imageSmoothingEnabled = true;

  const manager = new SimulationManager({
    rocket,
    system: ToySystem,
    ctx: ctx ?? undefined,
    layoutSvc,
    scriptLib: scripts,
    telemetry: telemetrySvc,
    pending,
    defaultScriptRunnerOpts: { timeLimitMs: 6 },
  });
  // Expose manager and services globally for React pages
  try {
    (window as any).__manager = manager;
    (window as any).__services = { layoutSvc, scripts, telemetrySvc, upgrades, pending };
    (window as any).__services.getMissions = () => {
      try { return missionMgr.describeAll(env.snapshot()); } catch { return []; }
    };
    // Expose helpers for top bar UI
    (window as any).__services.getMoney = () => money;
    (window as any).__services.setMoney = (v: number) => { money = Math.max(0, Number(v) || 0); refreshMoney(); };
    (window as any).__services.getCompleted = () => getCompleted();
    (window as any).__services.getAvailableIds = () => {
      try {
        return store.listAvailable(getCompleted()).map(p => p.id);
      } catch { return []; }
    };
    (window as any).__services.purchasePart = (partId: string) => {
      try {
        const available = store.listAvailable(getCompleted());
        const part: any = available.find(p => p.id === partId);
        if (!part) return { ok: false, reason: "locked" };
        if (money < part.price) return { ok: false, reason: "insufficient", price: part.price, balance: money };
        money = money - part.price;
        refreshMoney();
        return { ok: true, price: part.price, newBalance: money, part: { id: part.id, name: part.name, category: part.category } };
      } catch (e: any) {
        return { ok: false, reason: "error", message: e?.message ?? String(e) };
      }
    };
    (window as any).__services.resetAll = () => {
      try { performResetAll(); } catch {}
    };
  } catch {}
  // Always start simulation (always-running world)
  try { manager.start(); } catch {}
  // Rebind local references to use manager-owned instances
  env = manager.getEnvironment();
  runner = manager.getRunner();
  const renderer = manager.getRenderer();

  // Missions and rewards on post-tick
  manager.onPostTick(() => {
    const newly = missionMgr.tick(env.snapshot());
    if (newly.length > 0) {
      let gained = 0;
      for (const m of newly) gained += m.reward();
      money += gained;
      refreshMoney();
      partsPanelRef.render();
    }
  });

  // UI render cadence
  manager.onPostRender((alpha, now) => {
    try { metricsPanelRef.update(now); } catch {}
    try { cpuPanelRef?.render(); } catch {}
    try { sparklinesRef.update(); } catch {}
    if (massEl) {
      const m = env.snapshot().rocket.massKg;
      (massEl as HTMLElement).textContent = fmt(m);
    }
  });

  // Adapter to keep existing references working
  const loop = {
    isRunning: () => manager.isRunning(),
    start: () => manager.start(),
    pause: () => manager.pause(),
  } as const;

  // --- UI Controllers ---
  const controlsPanel = initControlsPanel({ manager });
  const installedPanelRef = initInstalledPanel({ getRocket: () => rocket });
  const partsPanelRef = initPartsPanel({
    getRocket: () => rocket,
    store,
    missions: missionMgr,
    isRunning: () => loop.isRunning(),
    getMoney: () => money,
    setMoney: (next) => { money = next; refreshMoney(); },
    saveLayout: (r) => saveLayout(r),
    publishTelemetry: () => publishTelemetryKeys(),
    refreshInstalled: () => installedPanelRef.render(),
  });
  const metricsPanelRef = initMetricsPanel({ hostId: "metrics", getEnv: () => env, getRocket: () => rocket, telemetry: telemetrySvc });
  const sparklinesRef = initSparklines({ getEnv: () => env, fuelCanvasId: "sparkFuel", batteryCanvasId: "sparkBattery" });

  // Initialize CPU Slots panel and perform initial UI renders
  cpuPanelRef = initCpuSlotsPanel({ manager, scripts });
  try { cpuPanelRef?.populateSelects(); } catch {}
  refreshScriptNameInput();
  try { manager.reinstallAssignedScripts(); } catch {}
  refreshMoney();
  installedPanelRef.render();
  partsPanelRef.render();
  metricsPanelRef.renderNow();

  // --- Simulation run-state management (Take Off / Reset) ---
  let simRunning = false;
  const primaryBtn = document.getElementById("primaryAction") as HTMLButtonElement | null;
  const compileBtnEl = document.getElementById("compile") as HTMLButtonElement | null;
  const openEditorBtn = document.getElementById("openEditor") as HTMLButtonElement | null;

  function staticRenderOnce() {
    // Render one frame while paused so UI shows current state
    renderer.render(0, performance.now());
    try { metricsPanelRef.renderNow(); } catch {}
    if (massEl) {
      const m = env.snapshot().rocket.massKg;
      (massEl as HTMLElement).textContent = fmt(m);
    }
  }

  function updateRunUI() {
    // Reflect running state in UI controls and attributes
    try { (document.body as any).dataset.simRunning = simRunning ? "true" : "false"; } catch {}
    if (primaryBtn) {
      primaryBtn.textContent = simRunning ? "Reset" : "Take Off";
      primaryBtn.setAttribute("data-variant", simRunning ? "solid" : "solid");
      primaryBtn.setAttribute("data-color-scheme", simRunning ? "gray" : "green");
    }
    if (compileBtnEl) compileBtnEl.disabled = simRunning;
    if (openEditorBtn) openEditorBtn.disabled = simRunning;
    if (saveScriptBtn) saveScriptBtn.disabled = simRunning;
    if (saveAsScriptBtn) saveAsScriptBtn.disabled = simRunning;
    if (scriptNameInput) scriptNameInput.disabled = simRunning;
    if (slot1Select) slot1Select.disabled = simRunning;
    if (slot2Select) slot2Select.disabled = simRunning || (rocket.cpu?.scriptSlots ?? 1) < 2;
    if (assignSlot1Btn) assignSlot1Btn.disabled = simRunning;
    if (assignSlot2Btn) assignSlot2Btn.disabled = simRunning || (rocket.cpu?.scriptSlots ?? 1) < 2;
    if (toggleSlot1Btn) toggleSlot1Btn.disabled = simRunning;
    if (toggleSlot2Btn) toggleSlot2Btn.disabled = simRunning || (rocket.cpu?.scriptSlots ?? 1) < 2;
    // Re-render parts to update install button disabled state
    partsPanelRef.render();
  }

  function startSimulation() {
    if (simRunning) return;
    simRunning = true;
    updateRunUI();
    loop.start();
  }

  function stopSimulation() {
    if (!simRunning) return;
    loop.pause();
    simRunning = false;
    updateRunUI();
    staticRenderOnce();
  }

  // Wire primary action button: Take Off when paused, Reset when running
  primaryBtn?.addEventListener("click", () => {
    if (!simRunning) {
      startSimulation();
    } else {
      // Stop and reset simulation state only
      stopSimulation();
      resetSimulationOnly();
    }
  });

  // Disable compile while running at handler level as well
  if (compileBtn) {
    compileBtn.addEventListener("click", (ev) => {
      if (simRunning) {
        ev.preventDefault();
        return;
      }
    }, { capture: true });
  }

  // Initial UI state and static render while paused
  updateRunUI();
  staticRenderOnce();
  // Publish initial telemetry keys for editor
  publishTelemetryKeys();
}
