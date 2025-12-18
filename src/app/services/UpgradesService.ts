import { SessionKeys } from "./SessionKeys";

export type FacilityType = "launchPad" | "vab" | "trackingStation" | "missionControl" | "researchCenter";

export interface FacilityLevels {
  launchPad: number;      // Determines Max Mass
  vab: number;            // Determines Max Template Tier
  trackingStation: number;// Determines Max Active Rockets
  missionControl: number;
  researchCenter: number;
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
      launchPad: 1,
      vab: 1,
      trackingStation: 1,
      missionControl: 1, // Unused for now
      researchCenter: 1  // Unused for now
    };
  }

  save(levels: FacilityLevels): void {
    try { sessionStorage.setItem(KEY, JSON.stringify(levels)); } catch { }
  }

  getLevel(type: FacilityType): number {
    return this.load()[type];
  }

  upgrade(type: FacilityType): void {
    const s = this.load();
    s[type] = (s[type] || 1) + 1;
    this.save(s);
  }

  // --- Game Logic / Stats ---

  getUpgradeCost(type: FacilityType, currentLevel: number): number | null {
    const maxLevels: Record<string, number> = { launchPad: 4, vab: 3, trackingStation: 3 };
    if (currentLevel >= (maxLevels[type] || 1)) return null;

    // RP Costs
    switch (type) {
      case "vab":
        if (currentLevel === 1) return 100; // to lvl 2
        if (currentLevel === 2) return 300; // to lvl 3
        break;
      case "launchPad":
        if (currentLevel === 1) return 50;
        if (currentLevel === 2) return 150;
        if (currentLevel === 3) return 300;
        break;
      case "trackingStation":
        if (currentLevel === 1) return 100;
        if (currentLevel === 2) return 250;
        break;
    }
    return 0;
  }

  getUpgradeDescription(type: FacilityType, nextLevel: number): string {
    switch (type) {
      case "launchPad": return `Increases Max Launch Mass to ${(this.getMaxLaunchMass(nextLevel) / 1000).toFixed(0)}t`;
      case "vab": return `Unlocks Tier ${nextLevel} Rocket Templates`;
      case "trackingStation": return nextLevel === 2 ? "Support up to 3 active missions" : "Support Unlimited missions";
    }
    return "";
  }

  // Capability lookups
  getMaxLaunchMass(level: number): number {
    // kg
    switch (level) {
      case 1: return 20_000;
      case 2: return 100_000;
      case 3: return 500_000;
      case 4: return 2_000_000;
      default: return 20_000 + (level * 500_000);
    }
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
}
