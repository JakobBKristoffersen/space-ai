import { SessionKeys } from "./SessionKeys";

export type FacilityType = "vab" | "trackingStation" | "missionControl" | "researchCenter" | "software" | "comms";

export interface FacilityLevels {
  vab: number;            // Determines Max Template Tier
  trackingStation: number;// Determines Max Active Rockets
  missionControl: number;
  researchCenter: number;
  software: number;       // Determines Max Scripts
  comms: number;          // Determines Max KV Storage
}

const KEY = "session:upgrades:facilities";

export class UpgradesService {
  /** Load facility levels. */
  load(): FacilityLevels {
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? { ...this.defaultLevels(), ...JSON.parse(raw) } : this.defaultLevels();
    } catch {
      return this.defaultLevels();
    }
  }

  private defaultLevels(): FacilityLevels {
    return {
      vab: 1,
      trackingStation: 1,
      missionControl: 1, // Unused for now
      researchCenter: 1,  // Unused for now
      software: 1,
      comms: 1
    };
  }

  save(levels: FacilityLevels): void {
    try { sessionStorage.setItem(KEY, JSON.stringify(levels)); } catch { }
  }

  getLevel(type: FacilityType): number {
    return this.load()[type] || 1;
  }

  upgrade(type: FacilityType): void {
    const s = this.load();
    const current = s[type] || 1;
    // Safety clamp
    const maxLevels: Record<string, number> = { vab: 3, trackingStation: 3, software: 4, comms: 4 };
    if (current >= (maxLevels[type] || 99)) return;

    s[type] = current + 1;
    this.save(s);
  }

  // --- Game Logic / Stats ---

  getUpgradeCost(type: FacilityType, currentLevel: number): number | null {
    const maxLevels: Record<string, number> = { vab: 3, trackingStation: 3, software: 4, comms: 4 };
    if (currentLevel >= (maxLevels[type] || 1)) return null;

    // RP Costs
    switch (type) {
      case "vab":
        if (currentLevel === 1) return 200; // to lvl 2
        if (currentLevel === 2) return 500; // to lvl 3
        break;
      case "trackingStation":
        if (currentLevel === 1) return 100;
        if (currentLevel === 2) return 250;
        break;
      case "software":
        if (currentLevel === 1) return 50;  // 3 -> 5 scripts
        if (currentLevel === 2) return 150; // 5 -> 10 scripts
        if (currentLevel === 3) return 500; // 10 -> Unlimited
        break;
      case "comms":
        if (currentLevel === 1) return 50;  // 5 -> 20 keys
        if (currentLevel === 2) return 150; // 20 -> 100 keys
        if (currentLevel === 3) return 400; // 100 -> Unlimited
        break;
    }
    return 0;
  }

  getUpgradeDescription(type: FacilityType, nextLevel: number): string {
    switch (type) {
      case "vab": return `Unlocks Tier ${nextLevel} Chassis Layout (More Stages)`;
      case "trackingStation": return nextLevel === 2 ? "Support up to 3 active missions" : "Support Unlimited missions";
      case "software": return `Increases Script Storage to ${this.getMaxScripts(nextLevel) === 999 ? "Unlimited" : this.getMaxScripts(nextLevel)}`;
      case "comms": return `Increases Data Storage to ${this.getMaxKVKeys(nextLevel) === 999 ? "Unlimited" : this.getMaxKVKeys(nextLevel)} Keys`;
    }
    return "";
  }


  getMaxActiveRockets(level: number): number {
    switch (level) {
      case 1: return 1;
      case 2: return 3;
      default: return 999;
    }
  }

  isTemplateUnlocked(tier: number, vabLevel: number): boolean {
    // Assumption: Template tiers match VAB levels (Basic=1, Tier2=2, Tier3=3)
    return tier <= vabLevel;
  }

  getMaxScripts(level: number): number {
    switch (level) {
      case 1: return 3;
      case 2: return 5;
      case 3: return 10;
      default: return 999;
    }
  }

  getMaxKVKeys(level: number): number {
    switch (level) {
      case 1: return 5;
      case 2: return 20;
      case 3: return 100;
      default: return 999;
    }
  }
}
