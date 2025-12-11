export interface BaseState {
  /** Maximum allowed rocket mass for takeoff from the base (kg). */
  maxRocketMassKg: number;
  /** Base-side antenna max communication range (meters). */
  baseAntennaRangeM: number;
  /** Global memory capacity in bytes. */
  memoryCapacityBytes: number;
}

export interface TxRates {
  sentBytesPerS: number;
  recvBytesPerS: number;
}

const KEY = "session:base-state";
const MEM_KEY = "session:base-memory";

/**
 * BaseService stores base upgrades and a simple global memory that rockets can read/write when in range.
 * It also keeps lightweight transmit/receive byte rates per rocket for UI.
 */
export class BaseService {
  private state: BaseState;
  private store: Record<string, unknown> = {};
  // Per-rocket rolling accounting over ~1s window
  private accSent: Map<number, number> = new Map();
  private accRecv: Map<number, number> = new Map();
  private lastRateSent: Map<number, number> = new Map();
  private lastRateRecv: Map<number, number> = new Map();
  private accTime = 0;

  constructor() {
    this.state = this.load();
    this.store = this.loadMemory();
  }

  // --- Persistence ---
  load(): BaseState {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      maxRocketMassKg: 500, // starter pad
      baseAntennaRangeM: 15000,
      memoryCapacityBytes: 64 * 1024, // 64 KB
    };
  }
  save(): void { try { sessionStorage.setItem(KEY, JSON.stringify(this.state)); } catch {} }

  private loadMemory(): Record<string, unknown> {
    try { const raw = sessionStorage.getItem(MEM_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  }
  private saveMemory(): void { try { sessionStorage.setItem(MEM_KEY, JSON.stringify(this.store)); } catch {} }
  clearAll(): void {
    try { sessionStorage.removeItem(KEY); sessionStorage.removeItem(MEM_KEY); } catch {}
    this.state = this.load();
    this.store = {};
    this.accSent.clear(); this.accRecv.clear(); this.lastRateRecv.clear(); this.lastRateSent.clear(); this.accTime = 0;
  }

  // --- Upgrades/state getters ---
  getMaxRocketMassKg(): number { return this.state.maxRocketMassKg; }
  getBaseAntennaRangeM(): number { return this.state.baseAntennaRangeM; }
  getMemoryCapacityBytes(): number { return this.state.memoryCapacityBytes; }
  getMemoryUsedBytes(): number { try { return JSON.stringify(this.store).length; } catch { return 0; } }

  // Simple upgrade helpers (caller should subtract money and then call these)
  upgradeMassCap(deltaKg: number): void { this.state.maxRocketMassKg = Math.max(0, this.state.maxRocketMassKg + Math.floor(deltaKg)); this.save(); }
  upgradeBaseRange(deltaM: number): void { this.state.baseAntennaRangeM = Math.max(0, this.state.baseAntennaRangeM + Math.floor(deltaM)); this.save(); }
  upgradeMemoryCapacity(deltaBytes: number): void { this.state.memoryCapacityBytes = Math.max(1024, this.state.memoryCapacityBytes + Math.floor(deltaBytes)); this.save(); }

  // --- Link utility ---
  canReach(distanceM: number, rocketRangeM: number): boolean {
    const eff = Math.min(Math.max(0, rocketRangeM), Math.max(0, this.state.baseAntennaRangeM));
    return distanceM <= eff;
  }

  // --- Memory operations (return bytes sent/received) ---
  private ensureCapacity(additionalBytes: number): boolean {
    const used = this.getMemoryUsedBytes();
    return used + additionalBytes <= this.state.memoryCapacityBytes;
  }

  get(key: string): { bytesSent: number; bytesRecv: number; value: unknown } {
    const k = String(key);
    const val = this.store[k];
    const payload = safeSize(val);
    // Model: reading incurs receiving payload and sending a small header
    return { bytesSent: 16 + k.length, bytesRecv: payload, value: clone(val) };
  }

  set(key: string, value: unknown): { ok: boolean; bytesSent: number; bytesRecv: number; reason?: string } {
    const k = String(key);
    const enc = safeSize(value);
    if (!this.ensureCapacity(enc + k.length)) return { ok: false, bytesSent: 0, bytesRecv: 0, reason: "capacity" };
    this.store[k] = clone(value);
    this.saveMemory();
    // Model: writing sends payload up and gets small ack
    return { ok: true, bytesSent: enc + k.length, bytesRecv: 8 };
  }

  remove(key: string): { bytesSent: number; bytesRecv: number; removed: boolean } {
    const k = String(key);
    const existed = Object.prototype.hasOwnProperty.call(this.store, k);
    if (existed) delete this.store[k];
    this.saveMemory();
    return { bytesSent: k.length + 8, bytesRecv: 8, removed: existed };
  }

  clear(): { bytesSent: number; bytesRecv: number } {
    const used = this.getMemoryUsedBytes();
    this.store = {};
    this.saveMemory();
    return { bytesSent: 16, bytesRecv: used };
  }

  // --- Rates accounting ---
  recordTx(rocketIndex: number, bytesSent: number, bytesRecv: number): void {
    this.accSent.set(rocketIndex, (this.accSent.get(rocketIndex) || 0) + Math.max(0, bytesSent));
    this.accRecv.set(rocketIndex, (this.accRecv.get(rocketIndex) || 0) + Math.max(0, bytesRecv));
  }

  /** Call once per simulation tick with dt seconds to update per-second rates. */
  tick(dt: number): void {
    this.accTime += Math.max(0, dt);
    if (this.accTime >= 1) {
      // Emit rates once per ~1s
      const factor = 1 / this.accTime;
      for (const [idx, val] of this.accSent.entries()) this.lastRateSent.set(idx, val * factor);
      for (const [idx, val] of this.accRecv.entries()) this.lastRateRecv.set(idx, val * factor);
      this.accSent.clear(); this.accRecv.clear(); this.accTime = 0;
    }
  }

  getRates(rocketIndex: number): TxRates {
    return {
      sentBytesPerS: this.lastRateSent.get(rocketIndex) || 0,
      recvBytesPerS: this.lastRateRecv.get(rocketIndex) || 0,
    };
  }
}

function safeSize(v: unknown): number {
  try { return JSON.stringify(v)?.length ?? 0; } catch { return 0; }
}
function clone<T>(v: T): T {
  try { return JSON.parse(JSON.stringify(v)); } catch { return v; }
}
