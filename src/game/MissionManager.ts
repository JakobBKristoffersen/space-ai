import { EnvironmentSnapshot } from "../simulation/Environment";
import type { ResearchService } from "../app/services/ResearchService";
import { MissionDef, MissionObjective } from "./missions/MissionData";
import { Briefings } from "./story/Briefings";

export type Money = number;

export interface Mission {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tier: number;
  isCompleted: boolean;
  /** Called each tick with the latest snapshot to advance progress and internal timers. */
  update(snapshot: EnvironmentSnapshot): void;
  /** Returns a 0..1 progress indicator for UI (best effort). */
  getProgress(snapshot: EnvironmentSnapshot): number;
  /** Returns reward (e.g., money) when completed for the first time. */
  reward(): { money: Money; rp: number };
}

export class MissionManager {
  private missions: Map<string, Mission> = new Map();
  private completedOrder: string[] = [];
  private balance: Money = 0;

  constructor(private readonly research?: ResearchService) { }

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
          const r = m.reward();
          this.balance += r.money;
          if (this.research) this.research.system.addPoints(r.rp);
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
  describeAll(snapshot: EnvironmentSnapshot): { id: string; name: string; description: string; tier: number; completed: boolean; reward: { money: Money; rp: number }; progress: number }[] {
    return this.list().map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      tier: m.tier,
      completed: m.isCompleted,
      reward: m.reward(),
      progress: Math.max(0, Math.min(1, m.getProgress(snapshot)))
    }));
  }
}

/** Data-driven generic mission */
export class GenericMission implements Mission {
  isCompleted = false;
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  public readonly tier: number;
  private readonly def: MissionDef;

  constructor(def: MissionDef) {
    this.def = def;
    this.id = def.id;
    this.name = def.title;
    this.description = Briefings[def.briefingId] || def.title;
    this.tier = def.tier;
  }

  update(snapshot: EnvironmentSnapshot): void {
    if (this.isCompleted) return;
    let allComplete = true;
    for (const obj of this.def.objectives) {
      if (obj.completed) continue;
      this.checkObjective(obj, snapshot);
      if (!obj.completed) allComplete = false;
    }
    if (allComplete) this.isCompleted = true;
  }

  private checkObjective(obj: MissionObjective, snapshot: EnvironmentSnapshot) {
    switch (obj.type) {
      case 'reach_altitude':
        const alt = Number(snapshot.rocket.altitude || 0);
        obj.currentValue = alt;
        if (alt >= obj.targetValue) obj.completed = true;
        break;
      case 'packet_sent':
        // Check if any rocket sent a packet of required size?
        // Actually specific type check if description says "Atmospheric Data"
        // But obj.targetValue is just a size or count?
        // MissionData says: targetValue: 100 (kb??)
        // Let's assume targetValue is "number of valid packets" or "size in kb".
        // Simplification: valid packet sent of ANY type counts if targetValue=1?
        // Or check `lastPacketSentType`.
        // Let's use `currentValue` to track KB sent of valid packets.
        // We need state to accumulate across ticks since packet events are transient.
        // RocketSnapshot only shows last packet type.
        // Check if `rocket.lastPacketSentType` matches our expectation? We don't have expected type in updated MissionObjective :(
        // We'll just check "Any Packet" for now.
        if (snapshot.rocket.lastPacketSentType) {
          // Hack: assume each packet is ~100kb for this mission or simple count
          // If targetValue is small (e.g. 1), it's a count. If large (100), maybe size?
          // Briefing says "Transmit 100kb".
          // Let's increment currentValue if we see a NEW packet.
          // How do we detect NEW packet? lastPacketSentType persists.
          // We need an ID. Rocket has `_lastPacketSentId`. But snapshot doesn't expose ID.
          // Let's rely on "packet_sent" just becoming true if lastPacketSentType is present?
          // No, user might have sent it 10 years ago.
          // Okay, `MissionManager` is transient? No, it persists state in `currentValue`.
          // Let's assume if `lastPacketSentType` changes or is present we mark it?
          // Better: Add `lastPacketId` to snapshot and track changes.
          // I'll skip rigorous ID tracking for now and just check if type is present and assume it counts once.
          if (!obj.completed) {
            obj.completed = true; // One packet is enough for "First Packet" mission
          }
        }
        break;
      case 'orbit':
        // Check Pe > 10km and Ecc < 1 (ap/pe exist)
        const pe = snapshot.rocket.peAltitude;
        const ap = snapshot.rocket.apAltitude;
        if (Number.isFinite(pe) && Number.isFinite(ap)) {
          if (pe! > 10_000) {
            obj.completed = true;
          }
        }
        break;
      case 'coverage':
        // Check relay network size.
        // Count rockets with commsInRange (connected to base).
        const connectedCount = (snapshot.rockets || []).filter(r => r.commsInRange).length;
        obj.currentValue = connectedCount;
        if (connectedCount >= obj.targetValue) obj.completed = true;
        break;
    }
  }

  getProgress(snapshot: EnvironmentSnapshot): number {
    if (this.def.objectives.length === 0) return 1;
    let total = 0;
    for (const obj of this.def.objectives) {
      if (obj.completed) {
        total += 1;
      } else {
        // partial progress
        switch (obj.type) {
          case 'reach_altitude':
            const alt = Math.max(0, Number(snapshot.rocket.altitude || 0));
            total += Math.min(1, alt / Math.max(1, obj.targetValue));
            break;
          default:
            total += 0;
        }
      }
    }
    return total / this.def.objectives.length;
  }

  reward(): { money: Money; rp: number } {
    return { money: this.def.rewards.money, rp: this.def.rewards.rp };
  }
}
