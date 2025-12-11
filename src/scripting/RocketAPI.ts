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
  constructor(public remainingCost: number) {}
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
   * Set engine power to 0 or 1 (binary throttle per spec).
   */
  setEnginePower(value: 0 | 1): void {
    this.charge(this.cost.setEnginePower);
    this.cmdQueue.enqueue({ type: "setEnginePower", value });
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
}
