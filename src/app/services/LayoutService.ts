import { Rocket } from "../../simulation/Rocket";
import { SmallEngine } from "../../simulation/parts/Engine";
import { SmallFuelTank } from "../../simulation/parts/FuelTank";
import { SmallBattery } from "../../simulation/parts/Battery";
import { BasicProcessingUnit } from "../../simulation/parts/ProcessingUnit";
import { BasicNavigationSensor } from "../../simulation/parts/Sensor";
import { SmallReactionWheels } from "../../simulation/parts/ReactionWheels";
import { SmallAntenna } from "../../simulation/parts/Antenna";
import { DefaultCatalog } from "../../game/PartStore";
import { SessionKeys } from "./SessionKeys";

export type StoredLayout = {
  engines: string[];
  fuelTanks: string[];
  batteries: string[];
  sensors: string[];
  reactionWheels: string[];
  antennas: string[];
  cpu?: string | null;
};

export class LayoutService {
  buildDefaultRocket(): Rocket {
    const r = new Rocket();
    r.engines.push(new SmallEngine());
    r.fuelTanks.push(new SmallFuelTank());
    r.batteries.push(new SmallBattery());
    r.reactionWheels.push(new SmallReactionWheels());
    // Starter comms antenna
    (r as any).antennas?.push?.(new SmallAntenna());
    r.cpu = new BasicProcessingUnit();
    r.sensors.push(new BasicNavigationSensor());
    return r;
    }

  getLayoutFromRocket(r: Rocket): StoredLayout {
    return {
      engines: r.engines.map(e => e.id),
      fuelTanks: r.fuelTanks.map(t => t.id),
      batteries: r.batteries.map(b => b.id),
      sensors: r.sensors.map(s => s.id),
      reactionWheels: r.reactionWheels.map(rw => rw.id),
      antennas: ((r as any).antennas ?? []).map((a: any) => a.id),
      cpu: r.cpu?.id ?? null,
    };
  }

  private findMake<T>(id: string | undefined | null, all: { id: string; make: () => T }[]): T | null {
    if (!id) return null;
    const p = all.find(x => x.id === id);
    return p ? p.make() : null;
  }

  buildRocketFromLayout(layout: StoredLayout | null | undefined): Rocket {
    if (!layout) return this.buildDefaultRocket();
    const r = new Rocket();
    // Engines
    for (const id of layout.engines || []) {
      const inst = this.findMake(id, DefaultCatalog.engines);
      if (inst) (r.engines as any).push(inst);
    }
    // Fuel tanks
    for (const id of layout.fuelTanks || []) {
      const inst = this.findMake(id, DefaultCatalog.fuelTanks);
      if (inst) (r.fuelTanks as any).push(inst);
    }
    // Batteries
    for (const id of layout.batteries || []) {
      const inst = this.findMake(id, DefaultCatalog.batteries);
      if (inst) (r.batteries as any).push(inst);
    }
    // Reaction wheels
    for (const id of layout.reactionWheels || []) {
      const inst = this.findMake(id, (DefaultCatalog as any).reactionWheels);
      if (inst) (r.reactionWheels as any).push(inst);
    }
    // Antennas
    for (const id of (layout as any).antennas || []) {
      const inst = this.findMake(id, (DefaultCatalog as any).antennas);
      if (inst) (r as any).antennas.push(inst as any);
    }
    // Fallback: ensure reaction wheels exist for attitude control if layout missing them
    if (r.reactionWheels.length === 0) {
      r.reactionWheels.push(new SmallReactionWheels());
    }
    // CPU
    r.cpu = this.findMake(layout.cpu ?? null, DefaultCatalog.cpus) as any;
    // Sensors
    for (const id of layout.sensors || []) {
      const inst = this.findMake(id, DefaultCatalog.sensors);
      if (inst) (r.sensors as any).push(inst);
    }
    // Ensure at least a nav sensor exists
    if (r.sensors.length === 0) {
      r.sensors.push(new BasicNavigationSensor());
    }
    // If nothing important installed, fall back to default starter kit
    if (r.engines.length === 0 && r.fuelTanks.length === 0 && r.batteries.length === 0 && r.reactionWheels.length === 0 && !r.cpu) {
      return this.buildDefaultRocket();
    }
    return r;
  }

  // --- Per-rocket layout storage (index-aware) ---
  private keyFor(index: number): string {
    const idx = Math.max(0, Math.floor(index));
    return `${SessionKeys.LAYOUT}:${idx}`;
  }

  saveLayoutFor(index: number, r: Rocket): void {
    try { sessionStorage.setItem(this.keyFor(index), JSON.stringify(this.getLayoutFromRocket(r))); } catch {}
  }
  loadLayoutFor(index: number): StoredLayout | null {
    try {
      // Back-compat: index 0 can read legacy key if namespaced missing
      const raw = sessionStorage.getItem(this.keyFor(index)) ?? (index === 0 ? sessionStorage.getItem(SessionKeys.LAYOUT) : null);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // Legacy wrappers (default to index 0)
  saveLayout(r: Rocket): void { this.saveLayoutFor(0, r); }
  loadLayout(): StoredLayout | null { return this.loadLayoutFor(0); }
}
