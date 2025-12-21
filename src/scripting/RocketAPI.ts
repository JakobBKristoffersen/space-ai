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
import { Rocket, RocketCommand, RocketCommandQueue, RocketSnapshot, ParachutePart, SolarPanelPart } from "../simulation/Rocket";
import { PhysicsEngine } from "../simulation/PhysicsEngine";
import { CPUTier, getCPUTier } from "../simulation/CPUTier";
import { PartIds, TelemetryIds } from "../game/GameIds";

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
  constructor(public remainingCost: number) { }
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

  // --- Modules ---
  readonly control: RocketControlAPI;
  readonly telemetry: RocketTelemetryAPI;
  readonly nav: RocketNavigationAPI;
  readonly comms: RocketCommsAPI;
  readonly science: RocketScienceAPI;
  readonly payload: RocketPayloadAPI;
  readonly staging: RocketStagingAPI;

  constructor(
    public readonly rocket: Rocket,
    public readonly cmdQueue: { enqueue(cmd: RocketCommand): void } & RocketCommandQueue,
    opts?: RocketAPICreationOptions
  ) {
    this.cost = opts?.costModel ?? DefaultCostModel;

    // Initialize modules
    this.control = new RocketControlAPI(this);
    this.telemetry = new RocketTelemetryAPI(this);
    this.nav = new RocketNavigationAPI(this);
    this.comms = new RocketCommsAPI(this);
    this.science = new RocketScienceAPI(this);
    this.payload = new RocketPayloadAPI(this);
    this.staging = new RocketStagingAPI(this);
  }

  /** Called by the ScriptRunner/Sandbox at the start of a script tick. */
  beginTick(budget: TickBudgetContext): void { this.currentBudget = budget; }
  /** Called after the user update function returns (or throws). */
  endTick(): void { this.currentBudget = null; }

  /** Internal: set logger callback for current slot. */
  _setLogger(fn: ((msg: string) => void) | null) { this.logger = fn; }

  charge(cost: number): void {
    const b = this.currentBudget;
    if (!b) throw new Error("RocketAPI used outside of a script tick context");
    b.charge(cost);
  }

  getCostModel() { return this.cost; }

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
}

// --- Sub-Modules ---

class RocketControlAPI {
  constructor(private api: RocketAPI) { }

  /**
   * Set engine throttle. 0.0 to 1.0.
   * Requires at least one Engine.
   */
  throttle(value: number): void {
    if (this.api.rocket.engines.length === 0) throw new Error("Control.throttle: No engines installed");
    this.api.charge(this.api.getCostModel().setEnginePower);
    this.api.cmdQueue.enqueue({ type: "setEnginePower", value: Math.max(0, Math.min(1, Number(value))) });
  }

  /**
   * Set desired turn rate in radians per second.
   * Requires Reaction Wheels or Fins (aerodynamic control not fully impl yet, usually RW).
   */
  turn(rateRadPerS: number): void {
    // Check for ability to turn?
    // Reaction wheels or Fins.
    const hasRW = this.api.rocket.reactionWheels.length > 0;
    const hasFins = this.api.rocket.fins.length > 0; // Fins might provide passive stability or active control? Assuming active for now if we want to allow it.
    // Actually, let's strictly require Reaction Wheels for precise "setTurnRate" in space.
    // Fins only work in atmo.
    // Using a generic check:
    if (!hasRW && !hasFins) throw new Error("Control.turn: No reaction wheels or fins installed");

    this.api.charge(this.api.getCostModel().turn);
    const r = Number(rateRadPerS);
    if (!Number.isFinite(r)) return;
    const mag = Math.max(0, Math.min(Math.abs(r), Math.PI / 8));
    if (mag === 0) {
      this.api.cmdQueue.enqueue({ type: "turnRight", value: 0 }); // stop
      return;
    }
    if (r > 0) this.api.cmdQueue.enqueue({ type: "turnRight", value: mag });
    else this.api.cmdQueue.enqueue({ type: "turnLeft", value: mag });
  }

  deployParachute(): void {
    if (this.api.rocket.parachutes.length === 0) throw new Error("Control.deployParachute: No parachutes installed");
    this.api.charge(10);
    this.api.cmdQueue.enqueue({ type: "deployParachute" });
  }

  deploySolar(): void {
    if (this.api.rocket.solarPanels.length === 0) throw new Error("Control.deploySolar: No solar panels installed");
    this.api.charge(10);
    this.api.cmdQueue.enqueue({ type: "deploySolar" });
  }

  retractSolar(): void {
    const panels = this.api.rocket.solarPanels;
    if (panels.length === 0) throw new Error("Control.retractSolar: No solar panels installed");
    // Check if any retractable
    if (!panels.some(p => p.retractable)) throw new Error("Control.retractSolar: Installed panels are not retractable");
    this.api.charge(10);
    this.api.cmdQueue.enqueue({ type: "retractSolar" });
  }

  /**
   * Helper to steer the rocket to a specific compass heading (0=North, 90=East).
   * Note: This uses degrees, whereas nav.heading is in radians.
   * Requires CPU Tier 2 (for math) + Reaction Wheels.
   */
  setHeading(deg: number): void {
    this.api.charge(5); // Higher cost helper
    // Convert compass degrees to standard math radians
    // Compass: 0=N (+Y), 90=E (+X) -> Standard: 0=(+X), 90=(+Y) ??
    // Wait, standard map:
    // Lat/Lon usually: North is +Y?
    // If 0=North, 90=East.
    // Game uses: Math.atan2(y, x).
    // So East is 0 rad. North is PI/2 (90 deg).
    // If input is "Compass Heading" (0=N, 90=E), then:
    // Deg -> Rad:
    // 0 -> 90 (PI/2)
    // 90 -> 0 (0)
    // 180 -> -90 (-PI/2)
    // 270 -> 180 (PI)

    // Formula: rad = (90 - deg) * DG2RAD
    const rad = (90 - deg) * (Math.PI / 180);
    this.api.nav.alignTo(rad);
  }
}

class RocketTelemetryAPI {
  constructor(private api: RocketAPI) { }

  private _checkSensor(key: string, name: string) {
    const keys = this.api.rocket.snapshot().exposedKeys || [];
    if (!keys.includes(key)) {
      throw new Error(`Telemetry.${name}: Sensor for '${key}' not found or installed.`);
    }
  }

  private _checkTier(tier: CPUTier, name: string) {
    const installed = this.api.rocket.cpu ? getCPUTier(this.api.rocket.cpu.id) : CPUTier.BASIC;
    if (installed < tier) {
      throw new Error(`Telemetry.${name}: Requires CPU Tier ${tier} (installed: ${installed}). Upgrade Guidance System.`);
    }
  }

  get altitude(): number {
    this.api.charge(1);
    this._checkTier(CPUTier.BASIC, 'altitude'); // User requested basic access
    // Actually, 'altitude' is a sensor key.
    this._checkSensor(TelemetryIds.ALTITUDE, 'altitude');
    return this.api.rocket.snapshot().altitude;
  }

  get velocity(): { x: number; y: number } {
    this.api.charge(1);
    this._checkTier(CPUTier.TELEMETRY, 'velocity');
    this._checkSensor(TelemetryIds.VELOCITY, 'velocity');
    const s = this.api.rocket.snapshot();
    return { x: s.velocity.x, y: s.velocity.y };
  }

  get position(): { x: number; y: number } {
    this.api.charge(1);
    this._checkTier(CPUTier.TELEMETRY, 'position');
    this._checkSensor(TelemetryIds.POSITION, 'position');
    const s = this.api.rocket.snapshot();
    return { x: s.position.x, y: s.position.y };
  }

  get speed(): number {
    const v = this.velocity; // pays charge & checks
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  get apoapsis(): number {
    this.api.charge(5);
    this._checkTier(CPUTier.ORBITAL, 'apoapsis'); // Requires Math
    // Requires physical data to calculate
    this._checkSensor(TelemetryIds.POSITION, 'apoapsis');
    this._checkSensor(TelemetryIds.VELOCITY, 'apoapsis');
    return this.api.rocket.snapshot().apAltitude ?? Number.NaN;
  }

  get periapsis(): number {
    this.api.charge(5);
    this._checkTier(CPUTier.ORBITAL, 'periapsis');
    this._checkSensor(TelemetryIds.POSITION, 'periapsis');
    this._checkSensor(TelemetryIds.VELOCITY, 'periapsis');
    return this.api.rocket.snapshot().peAltitude ?? Number.NaN;
  }

  get radarAltitude(): number {
    this.api.charge(2);
    this._checkSensor(TelemetryIds.RADAR_ALT, 'radarAltitude');
    const alt = this.api.rocket.snapshot().altitude;
    return alt > 5000 ? Infinity : alt;
  }

  get verticalSpeed(): number {
    this.api.charge(2);
    this._checkSensor(TelemetryIds.VERTICAL_SPEED, 'verticalSpeed');

    // Calculate vertical speed (radial velocity)
    const s = this.api.rocket.snapshot();
    const pos = s.position;
    const vel = s.velocity;
    const r = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
    if (r === 0) return 0;

    // v_radial = (v . p) / |p|
    return (vel.x * pos.x + vel.y * pos.y) / r;
  }
}

class RocketNavigationAPI {
  constructor(private api: RocketAPI) { }

  private _checkTier(tier: CPUTier, name: string) {
    const installed = this.api.rocket.cpu ? getCPUTier(this.api.rocket.cpu.id) : CPUTier.BASIC;
    if (installed < tier) {
      throw new Error(`Navigation.${name}: Requires CPU Tier ${tier}`);
    }
  }

  private _checkSensor(key: string, name: string) {
    if (!(this.api.rocket.snapshot().exposedKeys || []).includes(key))
      throw new Error(`Navigation.${name}: Missing sensor for '${key}'`);
  }

  get heading(): number {
    this.api.charge(1);
    this._checkTier(CPUTier.BASIC, 'heading');
    this._checkSensor(TelemetryIds.ORIENTATION, 'heading');
    return this.api.rocket.snapshot().orientationRad;
  }

  angleDiff(a: number, b: number): number {
    this.api.charge(this.api.getCostModel().assistBase);
    const TWO = Math.PI * 2;
    let d = (a - b) % TWO;
    if (d < 0) d += TWO;
    if (d > Math.PI) d -= TWO;
    return d;
  }

  /**
   * Helper to steer the rocket towards a target angle.
   * Uses a simple P-controller to command a turn rate.
   */
  alignTo(targetRad: number): void {
    // Requires Advanced Guidance (Tier 1) for auto-alignment
    this._checkTier(CPUTier.TELEMETRY, 'alignTo');

    const current = this.heading; // charges cost
    const diff = this.angleDiff(targetRad, current); // charges cost
    // Simple P-controller
    // Kp = 2.0 means if we are 1 rad away, we ask for 2 rad/s turn.
    // Rocket physics limits max turn rate anyway.
    const Kp = 2.0;
    const cmd = diff * Kp;
    this.api.control.turn(cmd); // charges cost
  }

  get prograde(): number {
    // Re-use functionality via api access?
    // Logic from before:
    // Requires velocity.
    const v = this.api.telemetry.velocity; // this will charge & check
    return Math.atan2(v.y, v.x);
  }

  get retrograde(): number {
    const v = this.api.telemetry.velocity;
    const a = Math.atan2(v.y, v.x) + Math.PI;
    return a % (Math.PI * 2);
  }

  getOrbitalPrograde(location: "apoapsis" | "periapsis"): number {
    this.api.charge(5);
    this._checkTier(CPUTier.ORBITAL, 'orbitalPrograde');

    const rs = (this.api.rocket as any)._orbitalElements || (this.api.rocket as any)._railsState;
    if (!rs) {
      // If not detailed rails, fallback to current prograde for safety
      return this.prograde;
    }

    // Nu: 0 for Pe, PI for Ap
    const nu = location === "periapsis" ? 0 : Math.PI;
    const v = PhysicsEngine.getOrbitVelocityAtTrueAnomaly(rs, nu);

    const angle = Math.atan2(v.y, v.x);
    // Normalize 0..2PI
    const TWO = Math.PI * 2;
    return (angle % TWO + TWO) % TWO;
  }

  getOrbitalRetrograde(location: "apoapsis" | "periapsis"): number {
    const a = this.getOrbitalPrograde(location) + Math.PI;
    return a % (Math.PI * 2);
  }
}

class RocketCommsAPI {
  constructor(private api: RocketAPI) { }

  get state(): { connected: boolean; signal: number } {
    this.api.charge(2);
    // Delegate to CommSystem state on rocket
    const s = this.api.rocket.commState;
    return { connected: !!s?.connected, signal: s?.signalStrength ?? 0 };
  }

  /**
   * Send a text message to base.
   * Cost: 8 bytes per character.
   */
  transmitMessage(content: string): void {
    const bytes = content.length * 8;
    const sizeKb = Math.max(0.01, bytes / 1024);

    // Allow queuing even if disconnected; simulation handles the queue
    this.api.charge(10);
    this.api.rocket.packetQueue.push({
      id: Math.random().toString(36).slice(2),
      type: "message",
      sizeKb: sizeKb,
      progressKb: 0,
      sourceId: this.api.rocket.id,
      targetId: 'base',
      data: content
    });
    this.api.log(`[Comms] Queued message "${content.substring(0, 20)}..." (${sizeKb.toFixed(3)} KB)`);
  }

  transmitData(key: string, value: number | string | boolean): void {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new Error("transmitData: Value must be a string, number, or boolean.");
    }

    let bytes = 0;
    // Key cost (string)
    bytes += key.length * 8;

    // Value cost
    if (typeof value === 'string') {
      bytes += value.length * 8;
    } else if (typeof value === 'number') {
      bytes += 16;
    } else if (typeof value === 'boolean') {
      bytes += 1;
    }

    const sizeKb = Math.max(0.01, bytes / 1024);

    this.api.charge(5);
    this.api.rocket.packetQueue.push({
      id: Math.random().toString(36).slice(2),
      type: "kv_update",
      sizeKb: sizeKb,
      progressKb: 0,
      sourceId: this.api.rocket.id,
      targetId: 'base',
      data: { key, value }
    });
    this.api.log(`[Comms] Transmitting data: ${key}=${value} (${sizeKb.toFixed(3)} KB)`);
  }

}

class RocketScienceAPI {
  private _buffers: {
    temp: Map<number, number>;
    atmo: Map<number, number>;
    surf: Map<number, string>;
  } = {
      temp: new Map(),
      atmo: new Map(),
      surf: new Map(),
    };

  // Track transmitted keys per session to avoid sending duplicate data
  private _transmitted: {
    temp: Set<number>;
    atmo: Set<number>;
    surf: Set<number>;
  } = {
      temp: new Set(),
      atmo: new Set(),
      surf: new Set(),
    };

  constructor(private api: RocketAPI) { }

  readonly temperature = {
    collect: (): void => {
      if (this.api.rocket.science.findIndex(p => p.id === PartIds.SCIENCE_TEMP) === -1) {
        throw new Error("Science.temperature: Thermometer not installed");
      }
      this.api.charge(1);
      this.api.charge(1);

      const snap = this.api.rocket.snapshot();
      let alt = Math.round(this.api.telemetry.altitude);

      // Check atmosphere cutoff
      // If we are above atmosphere, we clamp to cutoff + 1 to represent "Space" as a single data bucket.
      const cutoff = snap.atmosphereCutoffAltitudeMeters ?? 100000;
      if (alt > cutoff) {
        alt = Math.floor(cutoff) + 1;
      }

      // Use actual ambient temperature from physics or fall back to 4K
      const temp = snap.ambientTemperature ?? 4;
      this._buffers.temp.set(alt, temp);
    },
    transmit: (): void => {
      // Filter out values already transmitted
      const toSend: Record<string, number> = {};
      let count = 0;
      for (const [alt, val] of this._buffers.temp) {
        if (!this._transmitted.temp.has(alt)) {
          toSend[alt] = val;
          count++;
        }
      }

      if (count === 0) {
        this._buffers.temp.clear();
        return;
      }

      this.api.charge(10);
      const sizeKb = (JSON.stringify(toSend).length * 8) / 1024;

      this.api.rocket.packetQueue.push({
        id: Math.random().toString(36).slice(2),
        type: "science_data_bulk",
        sizeKb: sizeKb,
        progressKb: 0,
        sourceId: this.api.rocket.id,
        targetId: 'base',
        data: { type: "temperature", values: toSend }
      });
      this.api.log(`[Science] Transmitting ${count} temperature readings`);

      // Mark as transmitted
      for (const altStr of Object.keys(toSend)) {
        this._transmitted.temp.add(Number(altStr));
      }

      // Buffer clear (even if filtered out, we clear buffer so we don't re-check them next time if they were old)
      // Actually we iterate buffer. If we filtered, it means we sent it or it was sent before.
      // So clearing buffer is correct.
      this._buffers.temp.clear();
    }
  };

  readonly atmosphere = {
    collect: (): void => {
      if (this.api.rocket.science.findIndex(p => p.id === PartIds.SCIENCE_ATMOS) === -1) {
        throw new Error("Science.atmosphere: Barometer not installed");
      }
      this.api.charge(1);
      this.api.charge(1);
      const snap = this.api.rocket.snapshot();
      let alt = Math.round(this.api.telemetry.altitude);

      // Check atmosphere cutoff
      const cutoff = snap.atmosphereCutoffAltitudeMeters ?? 100000;
      if (alt > cutoff) {
        alt = Math.floor(cutoff) + 1;
      }

      // Use actual atmospheric pressure (Barometer)
      const pressure = snap.ambientPressure ?? 0;

      this._buffers.atmo.set(alt, pressure);
    },
    transmit: (): void => {
      // Filter out values already transmitted
      const toSend: Record<string, number> = {};
      let count = 0;
      for (const [alt, val] of this._buffers.atmo) {
        if (!this._transmitted.atmo.has(alt)) {
          toSend[alt] = val;
          count++;
        }
      }

      if (count === 0) {
        this._buffers.atmo.clear();
        return;
      }

      this.api.charge(10);
      const sizeKb = (JSON.stringify(toSend).length * 8) / 1024;

      this.api.rocket.packetQueue.push({
        id: Math.random().toString(36).slice(2),
        type: "science_data_bulk",
        sizeKb: sizeKb,
        progressKb: 0,
        sourceId: this.api.rocket.id,
        targetId: 'base',
        data: { type: "atmosphere", values: toSend }
      });
      this.api.log(`[Science] Transmitting ${count} atmosphere readings`);

      // Mark as transmitted
      for (const altStr of Object.keys(toSend)) {
        this._transmitted.atmo.add(Number(altStr));
      }
      this._buffers.atmo.clear();
    }
  };

  readonly surface = {
    collect: (): void => {
      if (this.api.rocket.science.findIndex(p => p.id === PartIds.SCIENCE_SURFACE) === -1) {
        throw new Error("Science.surface: Surface Scanner not installed");
      }
      this.api.charge(2);

      // Calculate latitude index for the map key
      const pos = this.api.telemetry.position;
      const angleRad = Math.atan2(pos.y, pos.x); // -PI to PI
      let latDeg = angleRad * (180 / Math.PI);
      const latInt = Math.floor(latDeg);

      // Use actual terrain type from the physics simulation
      const terrain = this.api.rocket.currentTerrain || "Unknown";

      this._buffers.surf.set(latInt, terrain);
    },
    transmit: (): void => {
      // Filter out values already transmitted
      const toSend: Record<string, string> = {};
      let count = 0;
      for (const [lat, val] of this._buffers.surf) {
        if (!this._transmitted.surf.has(lat)) {
          toSend[lat] = val;
          count++;
        }
      }

      if (count === 0) {
        this._buffers.surf.clear();
        return;
      }

      this.api.charge(10);
      const sizeKb = (JSON.stringify(toSend).length * 8) / 1024;

      this.api.rocket.packetQueue.push({
        id: Math.random().toString(36).slice(2),
        type: "science_data_bulk",
        sizeKb: sizeKb,
        progressKb: 0,
        sourceId: this.api.rocket.id,
        targetId: 'base',
        data: { type: "surface", values: toSend }
      });
      this.api.log(`[Science] Transmitting ${count} surface scans`);

      // Mark as transmitted
      for (const k of Object.keys(toSend)) {
        this._transmitted.surf.add(Number(k));
      }
      this._buffers.surf.clear();
    }
  };

  readonly biosample = {
    collect: (): void => {
      const part = this.api.rocket.science.find(p => p.id === PartIds.SCIENCE_BIO);
      if (!part) {
        throw new Error("Science.biosample: Biosample Container not installed");
      }
      if (part.hasData) {
        throw new Error("Science.biosample: Container already full");
      }

      this.api.charge(10); // Mechanical actuation
      const alt = this.api.telemetry.altitude;

      // Req: > 500m
      if (alt < 500) {
        this.api.log("[Science] Failed to collect sample: Altitude too low (< 500m)");
        return;
      }

      part.hasData = true;
      part.data = { altitude: alt }; // Metadata
      this.api.log(`[Science] Biosample collected at ${Math.round(alt)}m! Return to earth to claim value.`);
    }
  };
}

class RocketPayloadAPI {
  constructor(private api: RocketAPI) { }

  get count(): number {
    this.api.charge(1);
    return this.api.rocket.payloads.length;
  }

  deploy(): string | null {
    if (this.api.rocket.payloads.length === 0) throw new Error("Payload.deploy: No payloads installed");
    this.api.charge(50);
    const p = this.api.rocket.payloads[0];
    const id = this.api.rocket.deployPayload(p.id);
    if (id) {
      this.api.log(`[Payload] Deployed ${p.name}`);
    } else {
      this.api.log(`[Payload] Failed to deploy ${p.name}`);
    }
    return id;
  }
}

class RocketStagingAPI {
  constructor(private api: RocketAPI) { }

  get stage(): number {
    this.api.charge(1);
    return this.api.rocket.activeStageIndex;
  }

  separate(): void {
    if (this.api.rocket.activeStageIndex <= 0) {
      throw new Error("Staging.separate: No more stages to separate");
    }
    this.api.charge(20);
    this.api.cmdQueue.enqueue({ type: "separateStage" });
    this.api.log("[Staging] Separation sequence initiated");
  }
}
