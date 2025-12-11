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
import { Rocket, RocketCommand, RocketCommandQueue, RocketSnapshot } from "../simulation/Rocket";
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

  constructor(
    private readonly rocket: Rocket,
    private readonly cmdQueue: { enqueue(cmd: RocketCommand): void } & RocketCommandQueue,
    opts?: RocketAPICreationOptions
  ) {
    this.cost = opts?.costModel ?? DefaultCostModel;
  }

  /** Called by the ScriptRunner/Sandbox at the start of a script tick. */
  beginTick(budget: TickBudgetContext): void { this.currentBudget = budget; }
  /** Called after the user update function returns (or throws). */
  endTick(): void { this.currentBudget = null; }

  /** Internal: set logger callback for current slot. */
  _setLogger(fn: ((msg: string) => void) | null) { this.logger = fn; }

  private charge(cost: number): void {
    const b = this.currentBudget;
    if (!b) throw new Error("RocketAPI used outside of a script tick context");
    b.charge(cost);
  }

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

  /**
   * Returns a filtered snapshot limited by installed sensors.
   */
  getSnapshot(): FilteredSnapshot {
    this.charge(this.cost.getSnapshotBase);
    const snap: RocketSnapshot = this.rocket.snapshot();

    const allowed = new Set<string>();
    // Exposes from sensors (e.g., navigation)
    for (const s of this.rocket.sensors) for (const k of s.exposes) allowed.add(k);
    // Exposes from parts
    for (const e of this.rocket.engines) if (e.exposes) for (const k of e.exposes) allowed.add(k);
    for (const t of this.rocket.fuelTanks) if (t.exposes) for (const k of t.exposes) allowed.add(k);
    for (const b of this.rocket.batteries) if (b.exposes) for (const k of b.exposes) allowed.add(k);
    const rws: any[] = (this.rocket as any).reactionWheels ?? [];
    for (const rw of rws) if ((rw as any).exposes) for (const k of (rw as any).exposes) allowed.add(k);
    if (this.rocket.cpu?.exposes) for (const k of this.rocket.cpu.exposes) allowed.add(k);

    const filtered: Record<string, unknown> = {};
    for (const key of allowed) {
      // Only copy known keys from snapshot
      if ((snap as any)[key] !== undefined) {
        // Deep copy for objects
        const val = (snap as any)[key];
        filtered[key] = typeof val === "object" ? JSON.parse(JSON.stringify(val)) : val;
      }
    }
    return { data: filtered };
  }

  /**
   * Set engine power (throttle).
   * - For basic engines, value is clamped to 0 or 1.
   * - For advanced engines, value is clamped between 0 and 1.
   */
  setEnginePower(value: number): void {
    this.charge(this.cost.setEnginePower);
    this.cmdQueue.enqueue({ type: "setEnginePower", value: Math.max(0, Math.min(1, Number(value))) });
  }

  /**
   * Turn left by a small angle (radians). Positive values only; clamped.
   * Note: In this simulation, turning commands set a persistent angular rate (rad/s)
   * capped by reaction wheels. This method is kept for compatibility.
   * @deprecated Use setTurnRate(rateRadPerS) instead to set a persistent angular velocity.
   */
  turnLeft(deltaRad: number): void {
    this.charge(this.cost.turn);
    const v = Math.max(0, Math.min(Math.abs(deltaRad), Math.PI / 8));
    this.cmdQueue.enqueue({ type: "turnLeft", value: v });
  }

  /**
   * Turn right by a small angle (radians). Positive values only; clamped.
   * Note: In this simulation, turning commands set a persistent angular rate (rad/s)
   * capped by reaction wheels. This method is kept for compatibility.
   */
  turnRight(deltaRad: number): void {
    this.charge(this.cost.turn);
    const v = Math.max(0, Math.min(Math.abs(deltaRad), Math.PI / 8));
    this.cmdQueue.enqueue({ type: "turnRight", value: v });
  }

  /**
   * Set desired turn rate in radians per second. Positive = right (clockwise), negative = left.
   * Pass 0 to stop turning. Magnitude is clamped to a safe maximum.
   */
  setTurnRate(rateRadPerS: number): void {
    this.charge(this.cost.turn);
    const r = Number(rateRadPerS);
    if (!Number.isFinite(r)) return;
    const mag = Math.max(0, Math.min(Math.abs(r), Math.PI / 8));
    if (mag === 0) {
      // send a zero right command to explicitly stop
      this.cmdQueue.enqueue({ type: "turnRight", value: 0 });
      return;
    }
    if (r > 0) this.cmdQueue.enqueue({ type: "turnRight", value: mag });
    else this.cmdQueue.enqueue({ type: "turnLeft", value: mag });
  }

  // --- Tier 1: Telemetry (Requires Advanced Guidance or better) ---

  private _checkTier(tier: CPUTier, name: string) {
    const installed = this.rocket.cpu ? getCPUTier(this.rocket.cpu.id) : CPUTier.BASIC;
    if (installed < tier) {
      // For now, return NaN or log warning. Throwing might crash user script loop hard.
      // Spec says: "return NaN or throw/log"
      this.log(`[System] Error: ${name} requires CPU Tier ${tier} (installed: ${installed}). Upgrade Guidance System.`);
      return false;
    }
    return true;
  }

  private _checkSensor(key: string, name: string) {
    const keys = this.rocket.snapshot().exposedKeys || [];
    if (!keys.includes(key)) {
      // Sensor not installed or doesn't expose this metric
      // We don't log here to avoid spamming logs per tick, just return false
      return false;
    }
    return true;
  }

  getAltitude(): number {
    this.charge(1);
    if (!this._checkTier(CPUTier.TELEMETRY, 'getAltitude')) return Number.NaN;
    if (!this._checkSensor('altitude', 'getAltitude')) return Number.NaN;
    return this.rocket.snapshot().altitude;
  }

  getVelocity(): { x: number; y: number } {
    this.charge(1);
    if (!this._checkTier(CPUTier.TELEMETRY, 'getVelocity')) return { x: NaN, y: NaN };
    if (!this._checkSensor('velocity', 'getVelocity')) return { x: NaN, y: NaN };
    const s = this.rocket.snapshot();
    return { x: s.velocity.x, y: s.velocity.y };
  }

  getPosition(): { x: number; y: number } {
    this.charge(1);
    if (!this._checkTier(CPUTier.TELEMETRY, 'getPosition')) return { x: NaN, y: NaN };
    if (!this._checkSensor('position', 'getPosition')) return { x: NaN, y: NaN };
    const s = this.rocket.snapshot();
    return { x: s.position.x, y: s.position.y };
  }

  getHeading(): number {
    this.charge(1);
    if (!this._checkTier(CPUTier.TELEMETRY, 'getHeading')) return Number.NaN;
    if (!this._checkSensor('orientationRad', 'getHeading')) return Number.NaN;
    return this.rocket.snapshot().orientationRad;
  }

  // --- Tier 2: Orbital (Requires Orbital Computer) ---

  getApoapsis(): number {
    this.charge(5);
    if (!this._checkTier(CPUTier.ORBITAL, 'getApoapsis')) return Number.NaN;
    // Ap/Pe might not be "sensors" but "CPU" calculations. 
    // However, we can say the CPU "exposes" them.
    if (!this._checkSensor('apAltitude', 'getApoapsis')) return Number.NaN;
    return this.rocket.snapshot().apAltitude ?? Number.NaN;
  }

  getPeriapsis(): number {
    this.charge(5);
    if (!this._checkTier(CPUTier.ORBITAL, 'getPeriapsis')) return Number.NaN;
    if (!this._checkSensor('peAltitude', 'getPeriapsis')) return Number.NaN;
    return this.rocket.snapshot().peAltitude ?? Number.NaN;
  }

  // --- Tier 3: Network (Requires Comm Network / Advanced) ---

  getCommState(): { connected: boolean; signal: number } {
    this.charge(2);
    if (!this._checkTier(CPUTier.NETWORK, 'getCommState')) return { connected: false, signal: 0 };
    const s = (this.rocket as any).commState; // Accessed via any for now or need to update Rocket typings imported
    return { connected: !!s?.connected, signal: s?.signalStrength ?? 0 };
  }

  sendDataPacket(type: string, sizeKb: number, data: any): void {
    this.charge(10);
    // Spec says: Rockets can queue data packets when disconnected.
    // But maybe we need Tier 3 to *initiate* complex transmission?
    // Let's assume sending basic packets needs basic comms but special types need Network tier?
    // Spec says "Tier 3: Comm network status...".
    // "Send Atmospheric Profile Data Packet" is Tier 1 Mission.
    // So sendDataPacket should probably be available earlier?
    // Let's set it to Tier 1 for basic packets, or check based on type?
    // Actually, "Transmit first telemetry packet" is Tier 0 mission.
    // Wait, "Tier 0... Transmit first telemetry packet".
    // But Tier 0 is "Blind Flight".
    // Maybe the mission triggers automatically? Or user script does it?
    // If user script does it, it needs API.
    // If Tier 0 has NO data, how can it send packet?
    // Maybe `sendDataPacket` is allowed in Tier 0 but it sends "blind" data?
    // Let's implement it as Tier 0 accessible but dependent on Comm System connection (which manages the queue).
    // Actually, let's stick to the prompt's explicit list:
    // Tier 1: "Send Atmospheric Profile Data Packet".
    // Tier 0: "Reach 100m... Transmit first telemetry packet".
    // This implies Tier 0 needs `sendDataPacket`. 
    // I will allow `sendDataPacket` at Tier 0/Basic, but `getCommState` (checking if connected) is Tier 3 (Advanced).
    // This creates fun gameplay: "Blindly send data and hope you are in range".

    // Check connection first? "Rockets can queue data packets when disconnected" - existing design.
    this.rocket.packetQueue.push({
      id: Math.random().toString(36).slice(2),
      type: type as any,
      sizeKb,
      progressKb: 0,
      sourceId: this.rocket.id,
      targetId: 'base',
      data
    });
    this.log(`[Comms] Queued packet ${type} (${sizeKb}kb)`);
  }

  /**
   * Deploy a payload by ID.
   * Returns the ID of the new rocket if successful, or null/empty if failed.
   */
  deployPayload(payloadId: string): string | null {
    this.charge(50); // Expensive operation
    const newId = this.rocket.deployPayload(payloadId);
    if (newId) {
      this.log(`[System] Deployed payload: ${newId}`);
    } else {
      this.log(`[System] Failed to deploy payload: ${payloadId} not found`);
    }
    return newId;
  }
}

