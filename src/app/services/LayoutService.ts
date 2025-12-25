import { Rocket } from "../../simulation/Rocket";
import { SmallEngine } from "../../simulation/parts/Engines";
import { SmallFuelTank } from "../../simulation/parts/FuelTanks";
import { SmallBattery } from "../../simulation/parts/Power";
import { BasicCPU } from "../../simulation/parts/Avionics";
import { BasicNavigationSensor } from "../../simulation/parts/Avionics";
import { SmallReactionWheels } from "../../simulation/parts/Avionics";
import { SmallAntenna } from "../../simulation/parts/Avionics";
import { DefaultCatalog, PartCategory } from "../../game/PartStore";
import { SessionKeys } from "./SessionKeys";
import { ROCKET_TEMPLATES, RocketTemplate } from "../../game/RocketTemplates";
import { DefaultRocketLayout } from "../../config/DefaultRocket";

export type StoredLayout = {
  templateId?: string;
  name?: string;
  slots: Record<string, string>; // slotId -> partId
  // Legacy fields for backward compatibility (optional)
  engines?: string[];
  fuelTanks?: string[];
  batteries?: string[];
  sensors?: string[];
  reactionWheels?: string[];
  antennas?: string[];
  cpu?: string | null;
  scriptId?: string; // ID of script to run on the main CPU
};

import { ScienceManager } from "../../game/ScienceManager";

export class LayoutService {
  private scienceManager: ScienceManager;

  constructor(scienceManager?: ScienceManager) {
    this.scienceManager = scienceManager || new ScienceManager(null);
  }

  getScienceManager(): ScienceManager {
    return this.scienceManager;
  }

  buildDefaultRocket(): Rocket {
    // Default to Basic template with basic parts
    const r = new Rocket();
    // Use the new template logic to build default if possible, or manual fallback
    const layout: StoredLayout = { ...DefaultRocketLayout };
    this.saveLayout(layout);
    return this.buildRocketFromLayout(layout);
  }

  getLayoutFromRocket(r: Rocket): StoredLayout {
    // Attempt to reverse-engineer the layout.
    // Heuristic: Try all templates, pick the one that accommodates the most installed parts.

    let bestLayout: StoredLayout = { templateId: "template.basic", slots: {} };
    let bestScore = -1;

    for (const template of ROCKET_TEMPLATES) {
      // Clone available inventory from rocket
      const inventory: Record<PartCategory, any[]> = {
        engine: [...r.engines],
        fuel: [...r.fuelTanks],
        battery: [...r.batteries],
        cpu: r.cpu ? [r.cpu] : [],
        sensor: [...r.sensors],
        reactionWheels: [...r.reactionWheels],
        antenna: [...r.antennas],
        payload: [...r.payloads],
        solar: [...r.solarPanels],
        cone: [...r.noseCones],
        fin: [...r.fins],
        parachute: [...r.parachutes],
        heatShield: [...r.heatShields],
        science: [...r.science],
        science_large: [], // Re-engineering larger science is complex as they are just in 'science', simple workaround for type
        structure: [...r.structures],
      };

      const slots: Record<string, string> = {};
      let score = 0;

      // Fill slots
      for (const stage of template.stages) {
        for (const slot of stage.slots) {
          // Try to find a part for this slot
          for (const cat of slot.allowedCategories) {
            const available = inventory[cat];
            if (available && available.length > 0) {
              // Take first
              const p = available.shift();
              slots[slot.id] = p.id;
              score++;
              break; // Filled slot
            }
          }
        }
      }

      // Score = number of filled slots
      // Tie-breaker: prefer template with fewer total slots (simpler) to avoid picking Tier 2 for a basic rocket
      // or penalize empty slots?

      const filledCount = score;
      const totalSlots = template.stages.reduce((acc, s) => acc + s.slots.length, 0);
      const percentFilled = totalSlots > 0 ? filledCount / totalSlots : 0;

      // We prefer high completion percentage.
      // If I have 4 parts, and Basic has 9 slots (44%), and Tier 2 has 13 slots (30%).
      // Basic wins.

      if (percentFilled > bestScore) {
        bestScore = percentFilled;
        bestLayout = { templateId: template.id, slots };
      }
    }

    // Preserve script ID if possible (from CPU? Rocket doesn't store script ID directly, usually scriptLib manages running scripts)
    // We can't easily recover script ID unless we store it on Rocket.
    // But we can check running scripts? 
    // Rocket doesn't persist script ID string, it has `cpu` with memory. 
    // We'll leave scriptId blank or undefined.
    return bestLayout;
  }

  private findMake<T>(id: string | undefined | null, all: { id: string; make: () => T }[]): T | null {
    if (!id) return null;
    const p = all.find(x => x.id === id);
    return p ? p.make() : null;
  }

  private getCategoryParts(cat: PartCategory): { id: string, make: () => any }[] {
    switch (cat) {
      case "engine": return DefaultCatalog.engines;
      case "fuel": return DefaultCatalog.fuelTanks;
      case "battery": return DefaultCatalog.batteries;
      case "cpu": return DefaultCatalog.cpus;
      case "sensor": return DefaultCatalog.sensors;
      case "reactionWheels": return DefaultCatalog.reactionWheels;
      case "antenna": return DefaultCatalog.antennas;
      case "payload": return DefaultCatalog.payloads;
      case "solar": return DefaultCatalog.solarPanels;
      case "cone": return DefaultCatalog.cones;
      case "fin": return DefaultCatalog.fins;
      case "parachute": return DefaultCatalog.parachutes;
      case "heatShield": return DefaultCatalog.heatShields;
      case "science": return DefaultCatalog.science;
      case "science_large": return DefaultCatalog.science;
    }
    return [];
  }

  buildRocketFromLayout(layout: StoredLayout | null | undefined): Rocket {
    if (!layout) return this.buildDefaultRocket();

    // 1. Identify Template
    const templateId = layout.templateId || "template.basic";
    const template = ROCKET_TEMPLATES.find(t => t.id === templateId) || ROCKET_TEMPLATES[0];

    const r = new Rocket();

    // 2. Iterate Template Slots and fill
    for (let i = 0; i < template.stages.length; i++) {
      const stage = template.stages[i];
      for (const slot of stage.slots) {
        const assignedId = (layout.slots || {})[slot.id];
        if (!assignedId) continue; // Empty slot

        // We assume single part assignment per slot as per current design
        for (const cat of slot.allowedCategories) {
          const partDef = this.findMake(assignedId, this.getCategoryParts(cat));
          if (partDef) {
            this.installPart(r, partDef, cat, i);
            break; // Found matching part in this category
          }
        }
      }
    }

    // 3. Backward compatibility (Legacy arrays)
    // If we have legacy arrays and NO template slots filled (migration), maybe add them?
    // For now, let's assume legacy is dead or migrated via default.
    // But if explicit arrays exist, we might want to respect them if the slot system failed.
    if (!layout.slots || Object.keys(layout.slots).length === 0) {
      if (layout.engines?.length) layout.engines.forEach(id => this.installPart(r, this.findMake(id, DefaultCatalog.engines), "engine"));
      if (layout.fuelTanks?.length) layout.fuelTanks.forEach(id => this.installPart(r, this.findMake(id, DefaultCatalog.fuelTanks), "fuel"));
      if (layout.batteries?.length) layout.batteries.forEach(id => this.installPart(r, this.findMake(id, DefaultCatalog.batteries), "battery"));
      if (layout.sensors?.length) layout.sensors.forEach(id => this.installPart(r, this.findMake(id, DefaultCatalog.sensors), "sensor"));
      if (layout.cpu) this.installPart(r, this.findMake(layout.cpu, DefaultCatalog.cpus), "cpu");
    }

    // Default fallbacks - REMOVED to ensure VAB vs Runtime parity
    // if (r.reactionWheels.length === 0) r.reactionWheels.push(new SmallReactionWheels());
    // if (r.sensors.length === 0) r.sensors.push(new BasicNavigationSensor());
    // if (!r.cpu) r.cpu = new BasicCPU();

    // Hotfix: Ensure Basic Rocket always has an antenna (fixes legacy layouts missing it)
    // if (templateId === "template.basic" && r.antennas.length === 0) {
    //   r.antennas.push(new SmallAntenna());
    // }

    // Initialize active stage to the bottom-most stage (highest index)
    r.activeStageIndex = Math.max(0, template.stages.length - 1);

    return r;
  }

  private installPart(r: Rocket, part: any, category: PartCategory, stageIndex?: number) {
    if (!part) return;
    if (stageIndex !== undefined) part.stageIndex = stageIndex;
    switch (category) {
      case "engine": r.engines.push(part); break;
      case "fuel": r.fuelTanks.push(part); break;
      case "battery": r.batteries.push(part); break;
      case "cpu": r.cpu = part; break;
      case "sensor": r.sensors.push(part); break;
      case "reactionWheels": r.reactionWheels.push(part); break;
      case "antenna": r.antennas.push(part); break;
      case "payload": r.payloads.push(part); break;
      case "solar": r.solarPanels.push(part); break;
      case "cone": r.noseCones.push(part); break;
      case "fin": r.fins.push(part); break;
      case "parachute": r.parachutes.push(part); break;
      case "heatShield": r.heatShields.push(part); break;
      case "science": r.science.push(part); break;
      case "science_large": r.science.push(part); break;
    }
  }

  // --- Per-rocket layout storage (index-aware) ---
  private keyFor(index: number): string {
    const idx = Math.max(0, Math.floor(index));
    return `${SessionKeys.LAYOUT}:${idx}`;
  }

  saveLayoutFor(index: number, layout: StoredLayout): void {
    try { localStorage.setItem(this.keyFor(index), JSON.stringify(layout)); } catch { }
  }
  // Changed signature to take layout object instead of Rocket, because Rocket doesn't store slot info anymore
  saveLayout(layout: StoredLayout): void { this.saveLayoutFor(0, layout); }

  loadLayoutFor(index: number): StoredLayout | null {
    try {
      const raw = localStorage.getItem(this.keyFor(index)) ?? (index === 0 ? localStorage.getItem(SessionKeys.LAYOUT) : null);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  loadLayout(): StoredLayout | null { return this.loadLayoutFor(0); }
}
