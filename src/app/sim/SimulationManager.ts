/**
 * SimulationManager centralizes ownership of the simulation hot path:
 * - Rocket, Environment, ScriptRunner
 * - Renderer + CelestialScene (view only)
 * - SimulationLoop (fixed-timestep tick + throttled render)
 *
 * It intentionally avoids any direct DOM/UI references.
 * UI layers can subscribe to post-tick and post-render callbacks, query
 * the current snapshot, and enqueue manual commands.
 */

import { SimulationLoop, type TickListener, type RenderListener } from "../../core/SimulationLoop";
import { Environment, AtmosphereWithCutoff, QuadraticDrag, SimpleHeating, type CelestialSystemDef } from "../../simulation/Environment";
import { Rocket, SimpleQueue, type RocketCommand, type RocketCommandQueue } from "../../simulation/Rocket";
import { CommSystem } from "../../comms/CommSystem";
import { Renderer } from "../../rendering/Renderer";
import { CelestialScene } from "../../rendering/CelestialScene";
import { ScriptRunner, type ScriptRunnerOptions } from "../../scripting/ScriptRunner";
import type { LayoutService, StoredLayout } from "../services/LayoutService";
import type { ScriptLibraryService } from "../services/ScriptLibraryService";
import type { TelemetryService } from "../services/TelemetryService";
import type { PendingUpgradesService } from "../services/PendingUpgradesService";

export interface SimulationManagerOptions {
  /** Initial rocket instance (usually built from a stored layout). */
  rocket?: Rocket;
  /** Celestial system definition for the Environment. */
  system: CelestialSystemDef;
  /** Optional 2D canvas context for Renderer. */
  ctx?: CanvasRenderingContext2D;
  /** Services required for resets and telemetry publishing. */
  layoutSvc: LayoutService;
  scriptLib: ScriptLibraryService;
  telemetry: TelemetryService;
  /** Optional: pending upgrades that should be applied on reset. */
  pending?: PendingUpgradesService;
  /** Optional: default sandbox options when installing scripts. */
  defaultScriptRunnerOpts?: ScriptRunnerOptions;
}

export type PostTickListener = (env: Environment, tickIndex: number) => void;
export type PostRenderListener = (alpha: number, nowMs: number) => void;

export class SimulationManager {
  private speedMultiplier = 1; // 1x by default
  // Game clock: counts in-game seconds (scaled from simulation seconds). 1 sim sec = 60 game secs by default.
  private simGameSeconds = 0;
  private readonly gameTimeScale = 60; // every real simulated second advances 1 in-game minute
  private rocket: Rocket | undefined;
  private env: Environment;
  private renderer: Renderer;
  private scene: CelestialScene;
  private loop: SimulationLoop;
  private runner: ScriptRunner;
  private readonly manualQueue = new SimpleQueue();
  private commSystem = new CommSystem();

  private postTickListeners = new Set<PostTickListener>();

  // Launch gating per rocket: scripts cannot power engines until takeOff() is called for that rocket
  private launchedByIndex: boolean[] = [];
  private postRenderListeners = new Set<PostRenderListener>();

  constructor(private readonly opts: SimulationManagerOptions) {
    this.rocket = opts.rocket;
    const primaryDef = opts.system.bodies.find(b => b.id === opts.system.primaryId)!;

    // Create environment with the single primary rocket (or undefined)
    this.env = new Environment(this.rocket, {
      system: opts.system,
      atmosphere: new AtmosphereWithCutoff({
        scaleHeightMeters: primaryDef.atmosphereScaleHeightMeters ?? 200,
        atmosphereHeightMeters: primaryDef.atmosphereHeightMeters,
        rho0: 1.225,
        cutoffFactor: 7
      }),
      drag: QuadraticDrag,
      heating: SimpleHeating,
      rockets: this.rocket ? [this.rocket] : [],
      activeRocketIndex: 0,
      structures: [
        { id: "base", name: "Base", bodyId: opts.system.primaryId, angleRad: Math.PI / 2 },
      ],
    });

    // Initialize per-rocket launch flags
    try {
      const count = (this.env as any).getRockets?.().length ?? 0;
      this.launchedByIndex = new Array(Math.max(0, count)).fill(false);
    } catch {
      this.launchedByIndex = [];
    }


    this.runner = new ScriptRunner(this.rocket);
    this.renderer = new Renderer({ ctx: opts.ctx });
    this.scene = new CelestialScene({ provider: { get: () => this.env.snapshot() } });
    this.renderer.attachScene(this.scene);

    // Fixed-timestep loop, start paused by default (UI decides when to start)
    this.loop = new SimulationLoop({ fixedDt: 1 / 120, targetRenderHz: 30, startPaused: true });

    this.setupPersistence();

    // Internal tick wiring: run scripts, combine command queues, then advance env
    this.loop.onTick((dt, i) => {
      // Determine gating for current active rocket
      let isLaunched = false;
      try {
        const ai = (this.env as any).getActiveRocketIndex?.() ?? 0;
        isLaunched = !!this.launchedByIndex[ai];
      } catch { isLaunched = false; }

      // Only run script if launched
      const scriptQueue = isLaunched ? this.runner.runTick(dt, this.opts.defaultScriptRunnerOpts) : { drain: () => [] };

      const combined: RocketCommandQueue = {
        drain: () => {
          const cmds = [...scriptQueue.drain(), ...this.manualQueue.drain()];

          if (!isLaunched) {
            // Block engine-on until takeOff() is called logic preserved just in case manual commands try to fire
            return cmds.map(c => {
              if (c.type === "setEnginePower") {
                return { type: "setEnginePower", value: 0 as 0 } as any;
              }
              return c;
            });
          }
          return cmds;
        },
      };
      this.env.tick(dt, i, combined);

      // Update Communication Network
      try {
        const snap = this.env.snapshot();
        // Assume base is at 0,0 relative to primary start, but primary moves? 
        // Base is structure on primary.
        // CommSystem expects absolute positions.
        // Rocket positions are absolute.
        // Base structure in snap has absolute position.
        const baseStruct = snap.structures?.find(s => s.id === "base");
        const basePos = baseStruct ? baseStruct.position : { x: 0, y: 0 };
        // We pass ReadonlyArray<BodyState> as BodyState[] - safeish for read access
        this.commSystem.update(dt, this.env.getRockets() as Rocket[], snap.bodies as any[], basePos);

        // Consume received packets
        const received = this.commSystem.receivedPackets.splice(0, this.commSystem.receivedPackets.length);
        for (const p of received) {
          if (p.type === "science_data_bulk") {
            const { type, values } = p.data;
            this.opts.layoutSvc.getScienceManager().onBulkDataReceived(type, values);
          }
        }
      } catch (e) { console.warn("Comm update failed", e); }

      // Advance game clock (1 sim sec = 60 game secs by default)
      this.simGameSeconds += dt * this.gameTimeScale;
      // Notify UI subscribers after the environment advances
      this.postTickListeners.forEach((fn) => {
        try { fn(this.env, i); } catch { }
      });
    });

    // Render wiring: draw scene first, then notify UI for overlays/metrics
    this.loop.onRender((alpha, now) => {
      // If fast-forward is enabled (>1x), advance extra fixed steps per render frame.
      if (this.speedMultiplier > 1) {
        const extra = Math.min(8, Math.floor(this.speedMultiplier) - 1); // cap to avoid long frames
        if (extra > 0) this.loop.stepTicks(extra);
      }
      this.renderer.render(alpha, now);
      this.postRenderListeners.forEach((fn) => {
        try { fn(alpha, now); } catch { }
      });
    });
  }

  // --- Public API for UI layers ---

  setSpeedMultiplier(mult: number): void {
    if (!Number.isFinite(mult) || mult <= 0) { this.speedMultiplier = 1; return; }
    this.speedMultiplier = Math.min(16, Math.max(0.25, mult));
  }
  getSpeedMultiplier(): number { return this.speedMultiplier; }

  start(): void { this.loop.start(); }
  pause(): void { this.loop.pause(); }
  isRunning(): boolean { return this.loop.isRunning(); }

  /** Render a single frame without advancing the simulation (while paused). Also notifies post-render listeners once so UI (e.g., header clock) can refresh. */
  staticRenderOnce(): void {
    const now = performance.now();
    this.renderer.render(0, now);
    this.postRenderListeners.forEach((fn) => {
      try { fn(0, now); } catch { }
    });
  }

  /** Enqueue a manual command to be applied on the next tick. */
  enqueue(cmd: RocketCommand): void { this.manualQueue.enqueue(cmd); }

  // State accessors
  getRocket(): Rocket | undefined { return this.rocket; }
  getRockets(): ReadonlyArray<Rocket> { try { return (this.env as any).getRockets?.() ?? (this.rocket ? [this.rocket] : []); } catch { return this.rocket ? [this.rocket] : []; } }
  getEnvironment(): Environment { return this.env; }
  getRunner(): ScriptRunner { return this.runner; }
  getRenderer(): Renderer { return this.renderer; }

  // Launch control
  hasLaunched(): boolean {
    try {
      const ai = (this.env as any).getActiveRocketIndex?.() ?? 0;
      return !!this.launchedByIndex[ai];
    } catch { return false; }
  }
  takeOff(): void {
    try {
      const ai = (this.env as any).getActiveRocketIndex?.() ?? 0;
      this.launchedByIndex[ai] = true;
    } catch { }
    // Start engines on next tick
    this.manualQueue.enqueue({ type: "setEnginePower", value: 1 });
  }

  getActiveRocketIndex(): number { try { return (this.env as any).getActiveRocketIndex?.() ?? 0; } catch { return 0; } }

  // Expose CommSystem packets for UI
  getReceivedPackets() { return this.commSystem.receivedPackets; }

  // --- Fleet naming ---
  getRocketNames(): string[] {
    try {
      return (this.env as any).getRockets?.().map((r: Rocket) => r.name) ?? [];
    } catch { return []; }
  }

  setRocketName(index: number, name: string): void {
    const rockets = (this.env as any).getRockets?.() ?? [];
    if (!rockets[index]) return;
    rockets[index].name = name;
    // We should ideally persist this change to the underlying layout if possible?
    // Or we rely on the next 'save' or 'launch' to persist it.
    // For now, in-memory is the source of truth for the session.
  }

  private syncLaunchFlagsToEnv(): void {
    try {
      const count = (this.env as any).getRockets?.().length ?? 0;
      if (this.launchedByIndex.length !== count) {
        const prev = this.launchedByIndex;
        this.launchedByIndex = new Array(count).fill(false);
        for (let i = 0; i < Math.min(prev.length, count); i++) this.launchedByIndex[i] = prev[i];
      }
    } catch { }
  }

  /** Switch which rocket is active (controlled and surfaced in snapshot.rocket). */
  setActiveRocketIndex(i: number): void {
    try { (this.env as any).setActiveRocketIndex?.(i); } catch { }
    // Keep launch flags array in sync with current environment
    this.syncLaunchFlagsToEnv();
    // Update active rocket alias
    try { this.rocket = (this.env as any).getActiveRocket?.() ?? this.rocket; } catch { }
    // Recreate runner bound to the active rocket
    this.runner = new ScriptRunner(this.rocket);
    // Reinstall assigned scripts and publish telemetry for editor
    this.reinstallAssignedScripts();
    this.publishTelemetry();
    // Trigger a static render to refresh UI immediately
    this.staticRenderOnce();
  }

  // Event subscriptions (post-advance / post-render)
  onPostTick(listener: PostTickListener): () => void {
    this.postTickListeners.add(listener);
    return () => this.postTickListeners.delete(listener);
  }
  onPostRender(listener: PostRenderListener): () => void {
    this.postRenderListeners.add(listener);
    return () => this.postRenderListeners.delete(listener);
  }

  // --- Game clock (simulation-driven) ---
  /** Returns the total in-game seconds since Year 1 start. */
  getGameSeconds(): number { return this.simGameSeconds; }
  /** Reset the game clock back to Year 1 start (used by Reset All). */
  resetGameClock(): void { this.simGameSeconds = 0; }

  /** Simple 12x30 calendar starting at Year 1. Returns zero-padded parts for UI. */
  getGameTimeParts(): { year: number; month: number; day: number; hours: number; minutes: number } {
    const sec = Math.max(0, Math.floor(this.simGameSeconds));
    const secondsPerMinute = 60;
    const secondsPerHour = 60 * secondsPerMinute;
    const secondsPerDay = 24 * secondsPerHour;
    const daysPerMonth = 30;
    const monthsPerYear = 12;

    const totalDays = Math.floor(sec / secondsPerDay);
    const secondsInDay = sec % secondsPerDay;
    const hours = Math.floor(secondsInDay / secondsPerHour);
    const minutes = Math.floor((secondsInDay % secondsPerHour) / secondsPerMinute);

    const year = Math.floor(totalDays / (daysPerMonth * monthsPerYear)) + 1; // Year 1-based
    const dayOfYear = totalDays % (daysPerMonth * monthsPerYear);
    const month = Math.floor(dayOfYear / daysPerMonth) + 1; // 1..12
    const day = (dayOfYear % daysPerMonth) + 1; // 1..30

    return { year, month, day, hours, minutes };
  }

  /**
   * Recreate simulation objects from a provided layout (fresh resources).
   * Clears scene transient state (trail/minimap), reinstalls scripts assignments,
   * and publishes telemetry keys for editor.
   */
  recreateFromLayout(layout: StoredLayout): void {
    // Replace active rocket and clear others (full reset behavior)
    const newRocket = this.opts.layoutSvc.buildRocketFromLayout(layout);
    for (const e of newRocket.engines) e.power = 0;
    try { (this.env as any).resetToSingleRocket?.(newRocket); } catch { }
    this.rocket = newRocket;

    // Recreate runner bound to the active rocket
    this.runner = new ScriptRunner(this.rocket);

    // Keep launch flags length in sync in case rockets array changed
    this.syncLaunchFlagsToEnv();

    // Re-attach a fresh scene (clears trails + minimap bounds)
    this.scene = new CelestialScene({ provider: { get: () => this.env.snapshot() } });
    this.renderer.attachScene(this.scene);

    // Sync Rocket Name if present in layout
    if (layout.name) newRocket.name = layout.name;

    // Reinstall any assigned scripts
    this.reinstallAssignedScripts(layout.scriptId);

    // Publish telemetry keys for the new composition
    this.publishTelemetry();

    // Persist new state immediately so we don't restore old flight on reload
    this.saveState();
  }

  /** Build from stored layout and recreate. */
  resetSimulationOnly(): void {
    // Determine active rocket index
    const ai = (() => { try { return (this.env as any).getActiveRocketIndex?.() ?? 0; } catch { return 0; } })();
    const stored = (this.opts.layoutSvc as any).loadLayoutFor ? (this.opts.layoutSvc as any).loadLayoutFor(ai) : this.opts.layoutSvc.loadLayout();
    const effective = stored ?? (this.rocket ? this.opts.layoutSvc.getLayoutFromRocket(this.rocket) : null);

    // If we have no stored layout and no rocket, default to basic layout?
    // Or do we start empty? User wants FIRST rocket built in VAB.
    // So if nothing exists, we might recreate from null? 
    // recreateFromLayout handles logic? 
    // If effective is null, we build Default default?
    // LayoutSvc.buildRocketFromLayout(null) -> buildDefaultRocket().
    // We want to avoid default rocket if user wants 0.

    // But resetSimulationOnly is explicitly called to Reset/Apply Changes.
    // If I just deleted the rocket, effective is null.
    // The previous behavior was: buildDefaultRocket().
    // If I want to allow 0 rockets, I should check if we WANT a rocket.
    // Typically reset is "I built something, put it on pad".
    // So we assume we want a rocket.

    const merged = effective && this.opts.pending && (this.opts.pending as any).consumeIntoLayout
      ? (this.opts.pending as any).consumeIntoLayout(effective, ai)
      : (effective && this.opts.pending ? this.opts.pending.consumeIntoLayout(effective) : effective);

    // Reset launch gating for the active rocket so user must press Take Off again
    try { this.launchedByIndex[ai] = false; } catch { }

    if (merged) {
      this.recreateFromLayout(merged);
    } else {
      // If no layout, do we create default?
      // LayoutSvc checks if (!layout) return this.buildDefaultRocket();
      // So recreateFromLayout(null) -> default rocket.
      // We probably want this for "Reset".
      this.recreateFromLayout(effective as any);
    }

    // Persist the newly applied layout for this specific rocket index
    try {
      if (this.rocket) {
        if ((this.opts.layoutSvc as any).saveLayoutFor) (this.opts.layoutSvc as any).saveLayoutFor(ai, effective as any); // Use effective/merged
        else this.opts.layoutSvc.saveLayout(effective as any);
      }
    } catch { }
  }

  /**
   * Reinstall scripts assigned to CPU slots, restoring enabled flags.
   * Uses ScriptLibraryService for persistence.
   */
  reinstallAssignedScripts(fallbackScriptId?: string): void {
    const assigns = this.opts.scriptLib.loadAssignments();
    if (!this.rocket || !this.rocket.cpu) return;
    const ai = (() => { try { return (this.env as any).getActiveRocketIndex?.() ?? 0; } catch { return 0; } })();

    let installedAny = false;
    for (const a of assigns) {
      const rx = (a as any).rocketIndex ?? 0;
      if (rx !== ai) continue; // only install scripts for the active rocket
      if (a.slot < 0 || a.slot >= (this.rocket.cpu.scriptSlots || 1)) continue;
      const s = this.opts.scriptLib.getById(a.scriptId || undefined as any);
      if (s) {
        try {
          const code = (s as any).compiledCode || s.code;
          this.runner.installScriptToSlot(code, this.opts.defaultScriptRunnerOpts, a.slot, s.name);
          installedAny = true;
        } catch (e: any) {
          this.runner.appendLog(a.slot, `System: Failed to load script "${s.name}". ${e.message}`);
        }
      }
      try { this.runner.setSlotEnabled?.(a.slot, !!a.enabled); } catch { }
    }

    // Fallback: If no explicit assignment found, use layout script ID
    if (!installedAny && fallbackScriptId) {
      const s = this.opts.scriptLib.getById(fallbackScriptId);
      if (s) {
        try {
          const code = (s as any).compiledCode || s.code;
          this.runner.installScriptToSlot(code, this.opts.defaultScriptRunnerOpts, 0, s.name);
        } catch (e: any) {
          this.runner.appendLog(0, `System: Failed to load fallback script. ${e.message}`);
        }
      }
    }
  }

  /** Compute and publish telemetry keys for editor autocomplete. */
  publishTelemetry(): void {
    if (!this.rocket) return;
    const keys = this.opts.telemetry.currentKeys(this.rocket);
    this.opts.telemetry.publish(keys);
  }

  // --- Persistence ---

  private saveState(): void {
    if (!this.rocket) return;
    try {
      const state: SimState = {
        timestamp: Date.now(),
        gameSeconds: this.simGameSeconds,
        launched: this.launchedByIndex,
        rocket: {
          state: { ...this.rocket.state },
          angularVelocityRadPerS: this.rocket.getAngularVelocityRadPerS(),
          fuelTanks: this.rocket.fuelTanks.map(t => ({ id: t.id, fuelKg: t.fuelKg })),
          batteries: this.rocket.batteries.map(b => ({ id: b.id, energyJoules: b.energyJoules })),
          parachutes: this.rocket.parachutes.map(p => ({ id: p.id, deployed: p.deployed })),
          solarPanels: this.rocket.solarPanels.map(p => ({ id: p.id, deployed: p.deployed })),
          engines: this.rocket.engines.map(e => ({ id: e.id, power: e.power })),
        }
      };
      localStorage.setItem("sim_state", JSON.stringify(state));
    } catch (e) { console.warn("Failed to save sim state", e); }
  }

  private restoreState(): boolean {
    try {
      const raw = localStorage.getItem("sim_state");
      if (!raw) return false;
      const state: SimState = JSON.parse(raw);

      this.simGameSeconds = state.gameSeconds || 0;
      if (state.launched) this.launchedByIndex = state.launched;

      if (this.rocket && state.rocket) {
        const r = this.rocket;
        // Restore kinematic state
        r.state.position = { ...state.rocket.state.position };
        r.state.velocity = { ...state.rocket.state.velocity };
        r.state.orientationRad = state.rocket.state.orientationRad;
        r.state.temperature = state.rocket.state.temperature;
        r._setActualAngularVelocityRadPerS(state.rocket.angularVelocityRadPerS || 0);

        // Restore Parts
        if (state.rocket.fuelTanks) {
          state.rocket.fuelTanks.forEach(saved => {
            const part = r.fuelTanks.find(p => p.id === saved.id);
            if (part) part.fuelKg = saved.fuelKg;
          });
        }
        if (state.rocket.batteries) {
          state.rocket.batteries.forEach(saved => {
            const part = r.batteries.find(p => p.id === saved.id);
            if (part) part.energyJoules = saved.energyJoules;
          });
        }
        if (state.rocket.parachutes) {
          state.rocket.parachutes.forEach(saved => {
            const part = r.parachutes.find(p => p.id === saved.id);
            if (part) part.deployed = saved.deployed;
          });
        }
        if (state.rocket.solarPanels) {
          state.rocket.solarPanels.forEach(saved => {
            const part = r.solarPanels.find(p => p.id === saved.id);
            if (part) part.deployed = saved.deployed;
          });
        }
        if (state.rocket.engines) {
          state.rocket.engines.forEach(saved => {
            const part = r.engines.find(p => p.id === saved.id);
            if (part) part.power = saved.power;
          });
        }
      }
      return true;
    } catch (e) {
      console.warn("Failed to restore sim state", e);
      return false;
    }
  }

  private setupPersistence() {
    // Restore on boot
    if (this.restoreState()) {
      console.log("Restored simulation state");
    }

    // Auto-save
    setInterval(() => this.saveState(), 5000); // 5s

    // Save on visibility change (tab switch/close)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.saveState();
    });
  }
}

interface SimState {
  timestamp: number;
  gameSeconds: number;
  launched: boolean[];
  rocket?: {
    state: {
      position: { x: number, y: number };
      velocity: { x: number, y: number };
      orientationRad: number;
      temperature: number;
    };
    angularVelocityRadPerS: number;
    fuelTanks: Array<{ id: string, fuelKg: number }>;
    batteries: Array<{ id: string, energyJoules: number }>;
    parachutes: Array<{ id: string, deployed: boolean }>;
    solarPanels: Array<{ id: string, deployed: boolean }>;
    engines: Array<{ id: string, power: number }>;
  };
}
