/**
 * RocketAPI is the ONLY interface the user script can use to interact with the rocket.
 * - It exposes a filtered snapshot (limited by installed sensors).
 * - It queues commands that the Environment will apply on the next tick.
 * - It charges processing cost for each operation, checked against CPU budget.
 * - It drains battery per script tick via the Rocket's batteries.
 *
 * This module contains no rendering or physics logic.
 */
import { DefaultCostModel, CostModel } from "./CostModel";
import { Rocket, RocketCommand, RocketCommandQueue, RocketSnapshot, ParachutePart, SolarPanelPart } from "../simulation/Rocket";
import { CPUTier, getCPUTier } from "../simulation/CPUTier";

export interface RocketAPICreationOptions {
  costModel?: CostModel;
}

export interface TickBudgetContext {
  /** Remaining processing budget for this tick. */
  remainingCost: number;
  /** Drains remaining budget by given amount or throws if not enough. */
  charge(cost: number): void;
}

export class SimpleTickBudget implements TickBudgetContext {
  constructor(public remainingCost: number) { }
  charge(cost: number): void {
    if (cost < 0) return;
    if (this.remainingCost - cost < 0) {
      throw new Error("Processing budget exceeded for this tick");
    }
    this.remainingCost -= cost;
  }
}

export interface FilteredSnapshot {
  // Intentionally loosely typed bag restricted by sensors; values are JSON-safe.
  readonly data: Record<string, unknown>;
}

export class RocketAPI {
  private readonly cost: CostModel;
  /** Internal per-tick budget set by the runner; hidden from user scripts. */
  private currentBudget: TickBudgetContext | null = null;
  /** Ephemeral per-run memory store (reset when ScriptRunner is recreated). */
  private memoryStore = new Map<string, unknown>();
  /** Optional logger provided by ScriptRunner to route script logs per slot. */
  private logger: ((msg: string) => void) | null = null;

  // --- Modules ---
  readonly control: RocketControlAPI;
  readonly telemetry: RocketTelemetryAPI;
  readonly nav: RocketNavigationAPI;
  readonly comms: RocketCommsAPI;

  constructor(
    public readonly rocket: Rocket,
    public readonly cmdQueue: { enqueue(cmd: RocketCommand): void } & RocketCommandQueue,
    opts?: RocketAPICreationOptions
  ) {
    this.cost = opts?.costModel ?? DefaultCostModel;

    // Initialize modules
    this.control = new RocketControlAPI(this);
    this.telemetry = new RocketTelemetryAPI(this);
    this.nav = new RocketNavigationAPI(this);
    this.comms = new RocketCommsAPI(this);
  }

  /** Called by the ScriptRunner/Sandbox at the start of a script tick. */
  beginTick(budget: TickBudgetContext): void { this.currentBudget = budget; }
  /** Called after the user update function returns (or throws). */
  endTick(): void { this.currentBudget = null; }

  /** Internal: set logger callback for current slot. */
  _setLogger(fn: ((msg: string) => void) | null) { this.logger = fn; }

  charge(cost: number): void {
    const b = this.currentBudget;
    if (!b) throw new Error("RocketAPI used outside of a script tick context");
    b.charge(cost);
  }

  getCostModel() { return this.cost; }

  // --- Memory API (ephemeral per ScriptRunner instance) ---
  /**
   * Access to a small per-CPU memory store, cleared on simulation reset.
   * Values must be JSON-serializable. Total size limited to ~64KB.
   */
  readonly memory = {
    get: (key: string): unknown => {
      this.charge(this.cost.memoryGet);
      return this.memoryStore.get(String(key));
    },
    set: (key: string, value: unknown): void => {
      this.charge(this.cost.memorySet);
      const k = String(key);
      // Enforce JSON-serializable and size limit
      let encoded = "";
      try { encoded = JSON.stringify(value); } catch { throw new Error("memory.set: value must be JSON-serializable"); }
      const totalSize = this._estimatedMemorySize() - this._estimateValueSize(this.memoryStore.get(k)) + encoded.length;
      if (totalSize > 64 * 1024) throw new Error("memory limit exceeded (64KB)");
      this.memoryStore.set(k, JSON.parse(encoded));
    },
    remove: (key: string): void => {
      this.charge(this.cost.memoryRemove);
      this.memoryStore.delete(String(key));
    },
    clear: (): void => {
      this.charge(this.cost.memoryClear);
      this.memoryStore.clear();
    },
  } as const;

  private _estimateValueSize(v: unknown): number {
    try { return JSON.stringify(v)?.length ?? 0; } catch { return 0; }
  }
  private _estimatedMemorySize(): number {
    let n = 0; for (const [k, v] of this.memoryStore) { n += k.length + this._estimateValueSize(v); } return n;
  }

  /** Log a message associated with the current script slot (if runner provided a logger). */
  log(msg: unknown): void {
    this.charge(this.cost.log);
    const text = typeof msg === "string" ? msg : (() => { try { return JSON.stringify(msg); } catch { return String(msg); } })();
    this.logger?.(String(text));
  }
}

// --- Sub-Modules ---

class RocketControlAPI {
  constructor(private api: RocketAPI) { }

  /**
   * Set engine throttle. 0.0 to 1.0.
   * Requires at least one Engine.
   */
  throttle(value: number): void {
    if (this.api.rocket.engines.length === 0) throw new Error("Control.throttle: No engines installed");
    this.api.charge(this.api.getCostModel().setEnginePower);
    this.api.cmdQueue.enqueue({ type: "setEnginePower", value: Math.max(0, Math.min(1, Number(value))) });
  }

  /**
   * Set desired turn rate in radians per second.
   * Requires Reaction Wheels or Fins (aerodynamic control not fully impl yet, usually RW).
   */
  turn(rateRadPerS: number): void {
    // Check for ability to turn?
    // Reaction wheels or Fins.
    const hasRW = this.api.rocket.reactionWheels.length > 0;
    const hasFins = this.api.rocket.fins.length > 0; // Fins might provide passive stability or active control? Assuming active for now if we want to allow it.
    // Actually, let's strictly require Reaction Wheels for precise "setTurnRate" in space.
    // Fins only work in atmo.
    // Using a generic check:
    if (!hasRW && !hasFins) throw new Error("Control.turn: No reaction wheels or fins installed");

    this.api.charge(this.api.getCostModel().turn);
    const r = Number(rateRadPerS);
    if (!Number.isFinite(r)) return;
    const mag = Math.max(0, Math.min(Math.abs(r), Math.PI / 8));
    if (mag === 0) {
      this.api.cmdQueue.enqueue({ type: "turnRight", value: 0 }); // stop
      return;
    }
    if (r > 0) this.api.cmdQueue.enqueue({ type: "turnRight", value: mag });
    else this.api.cmdQueue.enqueue({ type: "turnLeft", value: mag });
  }

  deployParachute(): void {
    if (this.api.rocket.parachutes.length === 0) throw new Error("Control.deployParachute: No parachutes installed");
    this.api.charge(10);
    this.api.cmdQueue.enqueue({ type: "deployParachute" });
  }

  deploySolar(): void {
    if (this.api.rocket.solarPanels.length === 0) throw new Error("Control.deploySolar: No solar panels installed");
    this.api.charge(10);
    this.api.cmdQueue.enqueue({ type: "deploySolar" });
  }

  retractSolar(): void {
    const panels = this.api.rocket.solarPanels;
    if (panels.length === 0) throw new Error("Control.retractSolar: No solar panels installed");
    // Check if any retractable
    if (!panels.some(p => p.retractable)) throw new Error("Control.retractSolar: Installed panels are not retractable");
    this.api.charge(10);
    this.api.cmdQueue.enqueue({ type: "retractSolar" });
  }
}

class RocketTelemetryAPI {
  constructor(private api: RocketAPI) { }

  private _checkSensor(key: string, name: string) {
    const keys = this.api.rocket.snapshot().exposedKeys || [];
    if (!keys.includes(key)) {
      throw new Error(`Telemetry.${name}: Sensor for '${key}' not found or installed.`);
    }
  }

  private _checkTier(tier: CPUTier, name: string) {
    const installed = this.api.rocket.cpu ? getCPUTier(this.api.rocket.cpu.id) : CPUTier.BASIC;
    if (installed < tier) {
      throw new Error(`Telemetry.${name}: Requires CPU Tier ${tier} (installed: ${installed}). Upgrade Guidance System.`);
    }
  }

  get altitude(): number {
    this.api.charge(1);
    this._checkTier(CPUTier.TELEMETRY, 'altitude'); // Altitude usually needs basic telemetry or altimeter
    // Actually, 'altitude' is a sensor key.
    this._checkSensor('altitude', 'altitude');
    return this.api.rocket.snapshot().altitude;
  }

  get velocity(): { x: number; y: number } {
    this.api.charge(1);
    this._checkTier(CPUTier.TELEMETRY, 'velocity');
    this._checkSensor('velocity', 'velocity');
    const s = this.api.rocket.snapshot();
    return { x: s.velocity.x, y: s.velocity.y };
  }

  get position(): { x: number; y: number } {
    this.api.charge(1);
    this._checkTier(CPUTier.TELEMETRY, 'position');
    this._checkSensor('position', 'position');
    const s = this.api.rocket.snapshot();
    return { x: s.position.x, y: s.position.y };
  }

  get speed(): number {
    const v = this.velocity; // pays charge & checks
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  get apoapsis(): number {
    this.api.charge(5);
    this._checkTier(CPUTier.ORBITAL, 'apoapsis');
    // Using checkSensor for 'apAltitude' matching existing logic
    this._checkSensor('apAltitude', 'apoapsis');
    return this.api.rocket.snapshot().apAltitude ?? Number.NaN;
  }

  get periapsis(): number {
    this.api.charge(5);
    this._checkTier(CPUTier.ORBITAL, 'periapsis');
    this._checkSensor('peAltitude', 'periapsis');
    return this.api.rocket.snapshot().peAltitude ?? Number.NaN;
  }
}

class RocketNavigationAPI {
  constructor(private api: RocketAPI) { }

  private _checkTier(tier: CPUTier, name: string) {
    const installed = this.api.rocket.cpu ? getCPUTier(this.api.rocket.cpu.id) : CPUTier.BASIC;
    if (installed < tier) {
      throw new Error(`Navigation.${name}: Requires CPU Tier ${tier}`);
    }
  }

  private _checkSensor(key: string, name: string) {
    if (!(this.api.rocket.snapshot().exposedKeys || []).includes(key))
      throw new Error(`Navigation.${name}: Missing sensor for '${key}'`);
  }

  get heading(): number {
    this.api.charge(1);
    this._checkTier(CPUTier.TELEMETRY, 'heading');
    this._checkSensor('orientationRad', 'heading');
    return this.api.rocket.snapshot().orientationRad;
  }

  angleDiff(a: number, b: number): number {
    this.api.charge(this.api.getCostModel().assistBase);
    const TWO = Math.PI * 2;
    let d = (a - b) % TWO;
    if (d < 0) d += TWO;
    if (d > Math.PI) d -= TWO;
    return d;
  }

  /**
   * Helper to steer the rocket towards a target angle.
   * Uses a simple P-controller to command a turn rate.
   */
  alignTo(targetRad: number): void {
    const current = this.heading; // charges cost
    const diff = this.angleDiff(targetRad, current); // charges cost
    // Simple P-controller
    // Kp = 2.0 means if we are 1 rad away, we ask for 2 rad/s turn.
    // Rocket physics limits max turn rate anyway.
    const Kp = 2.0;
    const cmd = diff * Kp;
    this.api.control.turn(cmd); // charges cost
  }

  get prograde(): number {
    // Re-use functionality via api access?
    // Logic from before:
    // Requires velocity.
    const v = this.api.telemetry.velocity; // this will charge & check
    return Math.atan2(v.y, v.x);
  }

  get retrograde(): number {
    const v = this.api.telemetry.velocity;
    const a = Math.atan2(v.y, v.x) + Math.PI;
    return a % (Math.PI * 2);
  }
}

class RocketCommsAPI {
  constructor(private api: RocketAPI) { }

  get state(): { connected: boolean; signal: number } {
    this.api.charge(2);
    // Requires network tier?
    // Using existing logic:
    const installed = this.api.rocket.cpu ? getCPUTier(this.api.rocket.cpu.id) : CPUTier.BASIC;
    if (installed < CPUTier.NETWORK) return { connected: false, signal: 0 };

    const s = this.api.rocket.commState;
    return { connected: !!s?.connected, signal: s?.signalStrength ?? 0 };
  }

  send(type: string, sizeKb: number, data: any): void {
    this.api.charge(10);
    this.api.rocket.packetQueue.push({
      id: Math.random().toString(36).slice(2),
      type: type as any,
      sizeKb,
      progressKb: 0,
      sourceId: this.api.rocket.id,
      targetId: 'base',
      data
    });
    this.api.log(`[Comms] Queued packet ${type}`);
  }

  deployPayload(payloadId: string): string | null {
    this.api.charge(50);
    const newId = this.api.rocket.deployPayload(payloadId);
    if (newId) {
      this.api.log(`[System] Deployed payload: ${newId}`);
    } else {
      this.api.log(`[System] Failed to deploy payload: ${payloadId} not found`);
    }
    return newId;
  }
}

