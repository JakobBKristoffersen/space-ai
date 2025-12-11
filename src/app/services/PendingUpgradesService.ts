import type { StoredLayout } from "./LayoutService";

export interface PendingUpgradesState {
  cpu?: string;
  sensors?: string[];
  batteries?: string[];
  fuelTanks?: string[];
  engines?: string[];
  reactionWheels?: string[];
  antennas?: string[];
}

const KEY = "session:pending-upgrades";

export class PendingUpgradesService {
  private keyFor(index: number): string { return `${KEY}:${Math.max(0, Math.floor(index))}`; }

  load(index: number = 0): PendingUpgradesState {
    try {
      const raw = sessionStorage.getItem(this.keyFor(index)) ?? (index === 0 ? sessionStorage.getItem(KEY) : null);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return {
        cpu: parsed.cpu ?? undefined,
        sensors: Array.isArray(parsed.sensors) ? Array.from(new Set(parsed.sensors)) : undefined,
        batteries: Array.isArray(parsed.batteries) ? Array.from(new Set(parsed.batteries)) : undefined,
        fuelTanks: Array.isArray(parsed.fuelTanks) ? Array.from(new Set(parsed.fuelTanks)) : undefined,
        engines: Array.isArray(parsed.engines) ? Array.from(new Set(parsed.engines)) : undefined,
        reactionWheels: Array.isArray(parsed.reactionWheels) ? Array.from(new Set(parsed.reactionWheels)) : undefined,
      };
    } catch {
      return {};
    }
  }
  save(index: number, state: PendingUpgradesState): void {
    try { sessionStorage.setItem(this.keyFor(index), JSON.stringify(state)); } catch {}
  }
  clear(index?: number): void {
    try {
      if (typeof index === 'number') sessionStorage.removeItem(this.keyFor(index));
      else {
        // clear all known keys by simple scan of sessionStorage
        const keys: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i)!; if (k && k.startsWith(KEY+":")) keys.push(k);
        }
        for (const k of keys) sessionStorage.removeItem(k);
        sessionStorage.removeItem(KEY);
      }
    } catch {}
  }

  /** Queue a replacement or addition depending on category semantics. */
  queueUpgrade(category: "cpu" | "sensors" | "batteries" | "fuelTanks" | "engines" | "reactionWheels" | "antennas", id: string, index: number = 0): void {
    const s = this.load(index);
    switch (category) {
      case "cpu":
        s.cpu = id;
        break;
      case "sensors": {
        const arr = new Set(s.sensors ?? []);
        arr.add(id);
        s.sensors = Array.from(arr);
        break; }
      case "batteries": {
        // For now treat as replace-all with a single selected id
        s.batteries = [id];
        break; }
      case "fuelTanks": {
        s.fuelTanks = [id];
        break; }
      case "engines": {
        s.engines = [id];
        break; }
      case "reactionWheels": {
        s.reactionWheels = [id];
        break; }
      case "antennas": {
        (s as any).antennas = [id];
        break; }
    }
    this.save(index, s);
  }

  /** Merge pending upgrades into a base layout without clearing the queue. */
  mergeIntoLayout(base: StoredLayout, index: number = 0): StoredLayout {
    const s = this.load(index);
    const merged: StoredLayout = { ...base, engines: [...(base.engines ?? [])], fuelTanks: [...(base.fuelTanks ?? [])], batteries: [...(base.batteries ?? [])], sensors: [...(base.sensors ?? [])], reactionWheels: [...(base.reactionWheels ?? [])] } as any;
    if (s.cpu) merged.cpu = s.cpu;
    if (s.sensors?.length) {
      const set = new Set([...(merged.sensors ?? []), ...s.sensors]);
      merged.sensors = Array.from(set);
    }
    if (s.batteries?.length) merged.batteries = [...s.batteries];
    if (s.fuelTanks?.length) merged.fuelTanks = [...s.fuelTanks];
    if (s.engines?.length) merged.engines = [...s.engines];
    if (s.reactionWheels?.length) merged.reactionWheels = [...s.reactionWheels];
    if ((s as any).antennas?.length) (merged as any).antennas = [...(s as any).antennas];
    return merged;
  }

  /** Merge pending upgrades into base layout and then clear the pending state. */
  consumeIntoLayout(base: StoredLayout, index: number = 0): StoredLayout {
    const merged = this.mergeIntoLayout(base, index);
    this.clear(index);
    return merged;
  }
}
