import { SessionKeys } from "./SessionKeys";

export interface UpgradesState {
  heatProtectionLevel: number; // 0..N
}

const KEY = "session:upgrades";

export class UpgradesService {
  private keyFor(index: number): string { return `${KEY}:${Math.max(0, Math.floor(index))}`; }

  /** Load upgrades for a specific rocket index (default 0 for back-compat). */
  load(index: number = 0): UpgradesState {
    try {
      const raw = sessionStorage.getItem(this.keyFor(index)) ?? (index === 0 ? sessionStorage.getItem(KEY) : null);
      return raw ? JSON.parse(raw) : { heatProtectionLevel: 0 };
    } catch {
      return { heatProtectionLevel: 0 };
    }
  }
  /** Save upgrades for a specific rocket index. */
  save(index: number, state: UpgradesState): void {
    try { sessionStorage.setItem(this.keyFor(index), JSON.stringify(state)); } catch {}
  }
  /** Clear all saved upgrades (all rockets). */
  clearAll(): void {
    try {
      const toDel: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i)!;
        if (k && (k === KEY || k.startsWith(KEY + ":"))) toDel.push(k);
      }
      for (const k of toDel) sessionStorage.removeItem(k);
    } catch {}
  }
  getHeatProtectionLevel(index: number = 0): number { return this.load(index).heatProtectionLevel; }
  setHeatProtectionLevel(level: number, index: number = 0): void {
    const s = this.load(index); s.heatProtectionLevel = Math.max(0, Math.floor(level)); this.save(index, s);
  }
  // Derive a max survivable temperature from the level (placeholder mapping)
  getMaxTemperature(index: number = 0): number {
    // Base 1000 units; +250 per level
    return 1000 + 250 * this.getHeatProtectionLevel(index);
  }
}