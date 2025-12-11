/**
 * Mission system
 * - Missions define goals (reach altitude, achieve speed, etc.)
 * - MissionManager tracks mission progress over time using environment snapshots.
 * - Rewards (money) are granted when missions complete.
 *
 * This module has no rendering and does not mutate physics state.
 */
import { EnvironmentSnapshot } from "../simulation/Environment";

export type Money = number;

export interface Mission {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  isCompleted: boolean;
  /** Called each tick with the latest snapshot to advance progress and internal timers. */
  update(snapshot: EnvironmentSnapshot): void;
  /** Returns a 0..1 progress indicator for UI (best effort). */
  getProgress(snapshot: EnvironmentSnapshot): number;
  /** Returns reward (e.g., money) when completed for the first time. */
  reward(): Money;
}

export class MissionManager {
  private missions: Map<string, Mission> = new Map();
  private completedOrder: string[] = [];
  private balance: Money = 0;

  /** Add a mission. If already present, replaces it. */
  addMission(mission: Mission): void {
    this.missions.set(mission.id, mission);
  }

  /** List all missions (unspecified order). */
  list(): Mission[] { return Array.from(this.missions.values()); }

  /**
   * Advance missions with the latest environment snapshot.
   * Returns newly completed missions for this tick.
   */
  tick(snapshot: EnvironmentSnapshot): Mission[] {
    const newlyCompleted: Mission[] = [];
    for (const m of this.missions.values()) {
      if (!m.isCompleted) {
        m.update(snapshot);
        if (m.isCompleted) {
          this.balance += m.reward();
          this.completedOrder.push(m.id);
          newlyCompleted.push(m);
        }
      }
    }
    return newlyCompleted;
  }

  getMoney(): Money { return this.balance; }
  getCompletedMissionIds(): readonly string[] { return this.completedOrder; }

  /** Describe missions for UI in a stable shape. */
  describeAll(snapshot: EnvironmentSnapshot): { id: string; name: string; description: string; completed: boolean; reward: Money; progress: number }[] {
    return this.list().map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      completed: m.isCompleted,
      reward: m.reward(),
      progress: Math.max(0, Math.min(1, m.getProgress(snapshot)))
    }));
  }
}

/**
 * Example mission: Reach a target altitude.
 */
export class ReachAltitudeMission implements Mission {
  isCompleted = false;
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    private readonly targetAltitudeMeters: number,
    private readonly rewardMoney: Money,
  ) {}

  update(snapshot: EnvironmentSnapshot): void {
    if (this.isCompleted) return;
    if (snapshot.rocket.altitude >= this.targetAltitudeMeters) {
      this.isCompleted = true;
    }
  }

  getProgress(snapshot: EnvironmentSnapshot): number {
    const alt = Math.max(0, Number(snapshot.rocket.altitude) || 0);
    return Math.min(1, alt / Math.max(1, this.targetAltitudeMeters));
  }

  reward(): Money {
    return this.rewardMoney;
  }
}

/** Reach a target speed magnitude (m/s). */
export class ReachSpeedMission implements Mission {
  isCompleted = false;
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    private readonly targetSpeed: number,
    private readonly rewardMoney: Money,
  ) {}
  update(snapshot: EnvironmentSnapshot): void {
    if (this.isCompleted) return;
    const vx = Number(snapshot.rocket.velocity?.x || 0);
    const vy = Number(snapshot.rocket.velocity?.y || 0);
    const v = Math.hypot(vx, vy);
    if (v >= this.targetSpeed) this.isCompleted = true;
  }
  getProgress(snapshot: EnvironmentSnapshot): number {
    const vx = Number(snapshot.rocket.velocity?.x || 0);
    const vy = Number(snapshot.rocket.velocity?.y || 0);
    const v = Math.hypot(vx, vy);
    return Math.min(1, v / Math.max(1, this.targetSpeed));
  }
  reward(): Money { return this.rewardMoney; }
}

/** Reach space: air density becomes zero (out of atmosphere). */
export class ReachSpaceMission implements Mission {
  isCompleted = false;
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    private readonly rewardMoney: Money,
  ) {}
  update(snapshot: EnvironmentSnapshot): void {
    if (this.isCompleted) return;
    const rho = Number((snapshot.rocket as any).airDensity ?? 0);
    if (!(rho > 0)) this.isCompleted = true;
  }
  getProgress(snapshot: EnvironmentSnapshot): number {
    const rho = Number((snapshot.rocket as any).airDensity ?? 0);
    // Treat sea-level ~1.225 as 0% and 0 density as 100%
    return Math.max(0, Math.min(1, 1 - rho / 1.225));
  }
  reward(): Money { return this.rewardMoney; }
}

/** Achieve approximately circular orbit: both Ap and Pe above thresholds. */
export class CircularizeOrbitMission implements Mission {
  isCompleted = false;
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    private readonly targetAp: number,
    private readonly targetPe: number,
    private readonly rewardMoney: Money,
    private readonly tolerance: number = 0.1,
  ) {}
  update(snapshot: EnvironmentSnapshot): void {
    if (this.isCompleted) return;
    const ap = Number((snapshot.rocket as any).apAltitude ?? NaN);
    const pe = Number((snapshot.rocket as any).peAltitude ?? NaN);
    if (isFinite(ap) && isFinite(pe) && ap >= this.targetAp * (1 - this.tolerance) && pe >= this.targetPe * (1 - this.tolerance)) {
      this.isCompleted = true;
    }
  }
  getProgress(snapshot: EnvironmentSnapshot): number {
    const ap = Number((snapshot.rocket as any).apAltitude ?? 0);
    const pe = Number((snapshot.rocket as any).peAltitude ?? 0);
    const pa = Math.min(1, ap / Math.max(1, this.targetAp));
    const pp = Math.min(1, pe / Math.max(1, this.targetPe));
    return Math.min(1, 0.5 * (pa + pp));
  }
  reward(): Money { return this.rewardMoney; }
}

/** Enter the sphere of influence of a specific body id (e.g., "moon"). */
export class EnterSoIMission implements Mission {
  isCompleted = false;
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    private readonly bodyId: string,
    private readonly rewardMoney: Money,
  ) {}
  update(snapshot: EnvironmentSnapshot): void {
    if (this.isCompleted) return;
    const soi = (snapshot.rocket as any).soiBodyId as string | undefined;
    if (soi === this.bodyId) this.isCompleted = true;
  }
  getProgress(_snapshot: EnvironmentSnapshot): number { return this.isCompleted ? 1 : 0; }
  reward(): Money { return this.rewardMoney; }
}

/** Stay above a minimum altitude for a continuous duration. */
export class StayAloftMission implements Mission {
  isCompleted = false;
  private acc: number = 0; // accumulated seconds while above threshold
  private lastT: number | null = null;
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    private readonly minAltitude: number,
    private readonly durationSeconds: number,
    private readonly rewardMoney: Money,
  ) {}
  update(snapshot: EnvironmentSnapshot): void {
    if (this.isCompleted) return;
    const t = Number(snapshot.timeSeconds || 0);
    const alt = Number(snapshot.rocket.altitude || 0);
    if (this.lastT == null) { this.lastT = t; return; }
    const dt = Math.max(0, t - this.lastT);
    this.lastT = t;
    if (alt >= this.minAltitude) this.acc += dt; else this.acc = 0;
    if (this.acc >= this.durationSeconds) this.isCompleted = true;
  }
  getProgress(_snapshot: EnvironmentSnapshot): number {
    return Math.min(1, this.acc / Math.max(1, this.durationSeconds));
  }
  reward(): Money { return this.rewardMoney; }
}
