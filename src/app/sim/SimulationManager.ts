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
import { Renderer } from "../../rendering/Renderer";
import { CelestialScene } from "../../rendering/CelestialScene";
import { ScriptRunner, type ScriptRunnerOptions } from "../../scripting/ScriptRunner";
import type { LayoutService, StoredLayout } from "../services/LayoutService";
import type { ScriptLibraryService } from "../services/ScriptLibraryService";
import type { TelemetryService } from "../services/TelemetryService";
import type { PendingUpgradesService } from "../services/PendingUpgradesService";

export interface SimulationManagerOptions {
  /** Initial rocket instance (usually built from a stored layout). */
  rocket: Rocket;
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
  private rocket: Rocket;
  private env: Environment;
  private renderer: Renderer;
  private scene: CelestialScene;
  private loop: SimulationLoop;
  private runner: ScriptRunner;
  private readonly manualQueue = new SimpleQueue();

  private postTickListeners = new Set<PostTickListener>();
  
  // Launch gating per rocket: scripts cannot power engines until takeOff() is called for that rocket
  private launchedByIndex: boolean[] = [];
  private postRenderListeners = new Set<PostRenderListener>();

  constructor(private readonly opts: SimulationManagerOptions) {
    this.rocket = opts.rocket;
    const primaryDef = opts.system.bodies.find(b => b.id === opts.system.primaryId)!;
    // Create additional rockets from stored layouts (index-aware) for a multi-rocket world
    const layout1 = this.opts.layoutSvc.loadLayoutFor ? this.opts.layoutSvc.loadLayoutFor(1) : null;
    const secondRocket = this.opts.layoutSvc.buildRocketFromLayout(layout1 ?? null);
    for (const e of secondRocket.engines) e.power = 0; // start idle

    this.env = new Environment(this.rocket, {
      system: opts.system,
      atmosphere: new AtmosphereWithCutoff({ scaleHeightMeters: primaryDef.atmosphereScaleHeightMeters ?? 200, rho0: 1.225, cutoffFactor: 7 }),
      drag: QuadraticDrag,
      heating: SimpleHeating,
      rockets: [secondRocket],
      activeRocketIndex: 0,
      structures: [
        { id: "base", name: "Base", bodyId: opts.system.primaryId, angleRad: Math.PI / 2 },
      ],
    });

    // Initialize per-rocket launch flags
    try {
      const count = (this.env as any).getRockets?.().length ?? 1;
      this.launchedByIndex = new Array(Math.max(1, count)).fill(false);
    } catch {
      this.launchedByIndex = [false];
    }

    this.runner = new ScriptRunner(this.rocket);
    this.renderer = new Renderer({ ctx: opts.ctx });
    this.scene = new CelestialScene({ provider: { get: () => this.env.snapshot() } });
    this.renderer.attachScene(this.scene);

    // Fixed-timestep loop, start paused by default (UI decides when to start)
    this.loop = new SimulationLoop({ fixedDt: 1 / 120, targetRenderHz: 30, startPaused: true });

    // Internal tick wiring: run scripts, combine command queues, then advance env
    this.loop.onTick((dt, i) => {
      const scriptQueue = this.runner.runTick(dt, this.opts.defaultScriptRunnerOpts);
      const combined: RocketCommandQueue = {
        drain: () => {
          const cmds = [...scriptQueue.drain(), ...this.manualQueue.drain()];
          // Determine gating for current active rocket
          let allowEngineOn = true;
          try {
            const ai = (this.env as any).getActiveRocketIndex?.() ?? 0;
            allowEngineOn = !!this.launchedByIndex[ai];
          } catch { allowEngineOn = true; }
          if (!allowEngineOn) {
            // Block engine-on until takeOff() is called for the active rocket; allow engine-off and turning.
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
      // Advance game clock (1 sim sec = 60 game secs by default)
      this.simGameSeconds += dt * this.gameTimeScale;
      // Notify UI subscribers after the environment advances
      this.postTickListeners.forEach((fn) => {
        try { fn(this.env, i); } catch {}
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
        try { fn(alpha, now); } catch {}
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
      try { fn(0, now); } catch {}
    });
  }

  /** Enqueue a manual command to be applied on the next tick. */
  enqueue(cmd: RocketCommand): void { this.manualQueue.enqueue(cmd); }

  // State accessors
  getRocket(): Rocket { return this.rocket; }
  getRockets(): ReadonlyArray<Rocket> { try { return (this.env as any).getRockets?.() ?? [this.rocket]; } catch { return [this.rocket]; } }
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
    } catch {}
    // Start engines on next tick
    this.manualQueue.enqueue({ type: "setEnginePower", value: 1 });
  }

  getActiveRocketIndex(): number { try { return (this.env as any).getActiveRocketIndex?.() ?? 0; } catch { return 0; } }

  // --- Fleet naming (persisted to session) ---
  private get namesKey(): string { return "session:rocket-names"; }
  getRocketNames(): string[] {
    try {
      const raw = sessionStorage.getItem(this.namesKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          // Ensure length matches current rockets
          const count = (this.env as any).getRockets?.().length ?? 1;
          if (arr.length !== count) {
            const base = this.defaultNames(count);
            const merged = base.map((n, i) => (typeof arr[i] === "string" && arr[i].trim().length ? arr[i] : n));
            sessionStorage.setItem(this.namesKey, JSON.stringify(merged));
            return merged;
          }
          return arr;
        }
      }
    } catch {}
    const count = (this.env as any).getRockets?.().length ?? 1;
    const base = this.defaultNames(count);
    try { sessionStorage.setItem(this.namesKey, JSON.stringify(base)); } catch {}
    return base;
  }
  setRocketName(index: number, name: string): void {
    const count = (this.env as any).getRockets?.().length ?? 1;
    const idx = Math.max(0, Math.min(Math.floor(index), count - 1));
    const arr = this.getRocketNames();
    arr[idx] = String(name || '').trim() || this.defaultNames(count)[idx];
    try { sessionStorage.setItem(this.namesKey, JSON.stringify(arr)); } catch {}
  }
  private defaultNames(count: number): string[] { return new Array(Math.max(1, count)).fill(0).map((_, i) => `Rocket ${i+1}`); }

  private syncLaunchFlagsToEnv(): void {
    try {
      const count = (this.env as any).getRockets?.().length ?? 1;
      if (this.launchedByIndex.length !== count) {
        const prev = this.launchedByIndex;
        this.launchedByIndex = new Array(count).fill(false);
        for (let i = 0; i < Math.min(prev.length, count); i++) this.launchedByIndex[i] = prev[i];
      }
    } catch {}
  }

  /** Switch which rocket is active (controlled and surfaced in snapshot.rocket). */
  setActiveRocketIndex(i: number): void {
    try { (this.env as any).setActiveRocketIndex?.(i); } catch {}
    // Keep launch flags array in sync with current environment
    this.syncLaunchFlagsToEnv();
    // Update active rocket alias
    try { this.rocket = (this.env as any).getActiveRocket?.() ?? this.rocket; } catch {}
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
    // Replace active rocket only
    const newRocket = this.opts.layoutSvc.buildRocketFromLayout(layout);
    for (const e of newRocket.engines) e.power = 0;
    try { (this.env as any).replaceActiveRocket?.(newRocket); } catch {}
    this.rocket = newRocket;

    // Recreate runner bound to the active rocket
    this.runner = new ScriptRunner(this.rocket);

    // Keep launch flags length in sync in case rockets array changed
    this.syncLaunchFlagsToEnv();

    // Re-attach a fresh scene (clears trails + minimap bounds)
    this.scene = new CelestialScene({ provider: { get: () => this.env.snapshot() } });
    this.renderer.attachScene(this.scene);

    // Reinstall any assigned scripts
    this.reinstallAssignedScripts();

    // Publish telemetry keys for the new composition
    this.publishTelemetry();
  }

  /** Build from stored layout and recreate. */
  resetSimulationOnly(): void {
    // Determine active rocket index
    const ai = (() => { try { return (this.env as any).getActiveRocketIndex?.() ?? 0; } catch { return 0; } })();
    const stored = (this.opts.layoutSvc as any).loadLayoutFor ? (this.opts.layoutSvc as any).loadLayoutFor(ai) : this.opts.layoutSvc.loadLayout();
    const effective = stored ?? this.opts.layoutSvc.getLayoutFromRocket(this.rocket);
    const merged = this.opts.pending && (this.opts.pending as any).consumeIntoLayout
      ? (this.opts.pending as any).consumeIntoLayout(effective, ai)
      : (this.opts.pending ? this.opts.pending.consumeIntoLayout(effective) : effective);
    // Reset launch gating for the active rocket so user must press Take Off again
    try { this.launchedByIndex[ai] = false; } catch {}
    this.recreateFromLayout(merged);
    // Persist the newly applied layout for this specific rocket index
    try {
      if ((this.opts.layoutSvc as any).saveLayoutFor) (this.opts.layoutSvc as any).saveLayoutFor(ai, this.rocket as any);
      else this.opts.layoutSvc.saveLayout(this.rocket as any);
    } catch {}
  }

  /**
   * Reinstall scripts assigned to CPU slots, restoring enabled flags.
   * Uses ScriptLibraryService for persistence.
   */
  reinstallAssignedScripts(): void {
    const assigns = this.opts.scriptLib.loadAssignments();
    if (!this.rocket.cpu) return;
    const ai = (() => { try { return (this.env as any).getActiveRocketIndex?.() ?? 0; } catch { return 0; } })();
    for (const a of assigns) {
      const rx = (a as any).rocketIndex ?? 0;
      if (rx !== ai) continue; // only install scripts for the active rocket
      if (a.slot < 0 || a.slot >= (this.rocket.cpu.scriptSlots || 1)) continue;
      const s = this.opts.scriptLib.getById(a.scriptId || undefined as any);
      if (s) {
        try { this.runner.installScriptToSlot(s.code, this.opts.defaultScriptRunnerOpts, a.slot, s.name); } catch {}
      }
      try { this.runner.setSlotEnabled?.(a.slot, !!a.enabled); } catch {}
    }
  }

  /** Compute and publish telemetry keys for editor autocomplete. */
  publishTelemetry(): void {
    const keys = this.opts.telemetry.currentKeys(this.rocket);
    this.opts.telemetry.publish(keys);
  }
}
