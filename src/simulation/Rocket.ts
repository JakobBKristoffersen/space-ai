/**
 * Rocket aggregates modular parts and exposes a minimal state for the simulation.
 * - No rendering logic
 * - Handles mass changes, fuel consumption, battery drain, CPU budgets
 * - Applies commands coming from the scripting layer via a queue
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface RocketState {
  position: Vec2; // meters
  velocity: Vec2; // m/s
  orientationRad: number; // radians; 0 points along +X, pi/2 along +Y
  temperature: number; // arbitrary units
}

export interface RocketSnapshot {
  position: Readonly<Vec2>;
  velocity: Readonly<Vec2>;
  orientationRad: number;
  temperature: number;
  massKg: number;
  altitude: number;
  /** Current atmospheric density at rocket altitude (kg/m^3), if available. */
  airDensity?: number;
  /** Body currently exerting the strongest gravitational acceleration on this rocket (SOI approximation). */
  soiBodyId?: string;
  /** Convenience flag: true when airDensity > 0. */
  inAtmosphere?: boolean;
  /** Per-tick force breakdown (Newtons). */
  forces?: {
    thrust: { fx: number; fy: number };
    drag: { fx: number; fy: number };
    gravity: { fx: number; fy: number; perBody: { id: string; name: string; fx: number; fy: number }[] };
  };
  /** Orbital apoapsis altitude over primary, if bound ellipse; else NaN. */
  apAltitude?: number;
  /** Orbital periapsis altitude over primary, if bound ellipse; else NaN. */
  peAltitude?: number;
  fuelKg: number;
  /** instantaneous fuel consumption rate in kg/s based on last tick */
  fuelConsumptionKgPerS: number;
  /** Total stored battery energy across all batteries (J). */
  batteryJoules: number;
  /** Total battery capacity across all batteries (J). */
  batteryCapacityJoules: number;
  /** 0..100 percentage of stored energy vs capacity. */
  batteryPercent: number;
  /** CPU part name, if installed. */
  cpuName?: string;
  /** CPU per-tick processing budget, if installed. */
  cpuProcessingBudgetPerTick?: number;
  /** CPU max script chars, if installed. */
  cpuMaxScriptChars?: number;
  /** CPU runtime/config: minimum interval between script runs (s). */
  cpuProcessingIntervalSeconds?: number;
  /** CPU runtime: number of slots supported by CPU. */
  cpuSlotCount?: number;
  /** CPU runtime: how many scripts executed last tick. */
  cpuScriptsRunning?: number;
  /** CPU runtime: total processing cost used last tick. */
  cpuCostUsedLastTick?: number;
  /** CPU runtime: total energy consumed by scripts last tick (J). */
  cpuEnergyUsedLastTick?: number;
  /** CPU runtime: seconds remaining until the next scheduled script run. */
  cpuNextRunInSeconds?: number;
  /** Reaction wheels: current angular velocity (rad/s), if turning. */
  rwOmegaRadPerS?: number;
  /** Reaction wheels: combined maximum angular velocity capability (rad/s). */
  rwMaxOmegaRadPerS?: number;
  /** Reaction wheels: desired angular velocity commanded by scripts (rad/s), signed. */
  rwDesiredOmegaRadPerS?: number;
  /** Communications with Base: whether antenna link is in range. */
  commsInRange?: boolean;
  /** Distance from rocket to base (meters). */
  commsDistanceMeters?: number;
  /** Base antenna range (meters). */
  commsBaseRangeMeters?: number;
  /** Rocket antenna effective range (meters). */
  commsRocketRangeMeters?: number;
  /** Measured bytes sent to base per second. */
  commsBytesSentPerS?: number;
  /** Measured bytes received from base per second. */
  commsBytesRecvPerS?: number;
  /** Type of the last packet successfully sent (persists until next packet). */
  lastPacketSentType?: string;
  /** List of keys that are actively exposed by installed sensors/parts. */
  exposedKeys?: string[];
}

export type RocketCommand =
  | { type: "setEnginePower"; value: number }
  | { type: "turnLeft"; value: number }
  | { type: "turnRight"; value: number };

export interface RocketCommandQueue {
  drain(): RocketCommand[];
}

// --- Part interfaces ---

export interface EnginePart {
  readonly id: string;
  readonly name: string;
  readonly dryMassKg: number;
  /** maximum thrust in Newtons at full power */
  readonly maxThrustN: number;
  /** Throttle level 0.0 to 1.0 */
  power: number;
  /** fuel consumption rate (kg/s) at full power */
  readonly fuelBurnRateKgPerS: number;
  /** Additional thrust fraction at vacuum relative to sea level (e.g., 0.25 => +25% at vacuum). */
  readonly vacuumBonusAtVacuum?: number;
  /** Optional list of Rocket snapshot keys this part exposes to scripts/UI. */
  readonly exposes?: string[];
  /** Returns current thrust (N) based on power and atmosphere. */
  currentThrust(airDensity: number, seaLevelDensity?: number): number;
}

export interface FuelTankPart {
  readonly id: string;
  readonly name: string;
  readonly dryMassKg: number;
  fuelKg: number;
  readonly capacityKg: number;
  /** Optional list of Rocket snapshot keys this part exposes to scripts/UI. */
  readonly exposes?: string[];
  drawFuel(requestKg: number): number; // returns actual drawn
}

export interface BatteryPart {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  energyJoules: number;
  readonly capacityJoules: number;
  /** Optional list of Rocket snapshot keys this part exposes to scripts/UI. */
  readonly exposes?: string[];
  drawEnergy(requestJ: number): number; // returns actual drawn
}

export interface ProcessingUnitPart {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  /** Maximum script size in characters. */
  readonly maxScriptChars: number;
  /** Per tick processing budget in cost units. */
  readonly processingBudgetPerTick: number;
  /** Battery energy cost per tick when one script runs for a tick. */
  readonly energyPerTickJ: number;
  /** Number of concurrent script slots this CPU can run per tick. */
  readonly scriptSlots: number;
  /** Minimum interval between script executions, in seconds. If <= 0, runs every tick. */
  readonly processingIntervalSeconds: number;
  /** Optional list of Rocket snapshot keys this part exposes to scripts/UI. */
  readonly exposes?: string[];
}

export interface SensorPart {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  /**
   * Names of Rocket API fields this sensor allows scripts to read.
   * Kept as plain strings to decouple simulation from scripting types.
   */
  readonly exposes: string[];
}

/** Reaction wheels provide attitude control by consuming battery energy. */
export interface ReactionWheelsPart {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  /** Max continuous angular velocity this unit can support (rad/s). */
  readonly maxOmegaRadPerS: number;
  /** Energy required per (rad/s) per second (J / (rad/s) / s) ≡ J/s per rad/s. */
  readonly energyPerRadPerS: number;
  /** Optional list of snapshot keys this part exposes. */
  readonly exposes?: string[];
}

/** Simple antenna part for communications. */
export interface AntennaPart {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  /** Maximum line-of-sight range to base in meters. */
  readonly rangeMeters: number;
  readonly exposes?: string[];
}

/** Payload part that can be deployed as a separate entity. */
export interface PayloadPart {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  /** Config for the new rocket spawned from this payload. */
  readonly satelliteConfig: {
    name: string;
    parts: {
      sensors: SensorPart[];
      antennas: AntennaPart[];
      batteries: BatteryPart[];
      solar: any[]; // future proof
    }
  };
  readonly exposes?: string[];
}

export class SimpleQueue implements RocketCommandQueue {
  private q: RocketCommand[] = [];
  enqueue(cmd: RocketCommand): void { this.q.push(cmd); }
  drain(): RocketCommand[] { const c = this.q; this.q = []; return c; }
}

export interface SolarPanelPart {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  readonly generationWatts: number;
  readonly exposes?: string[];
}

export class Rocket {
  // Public physical properties for environment calculations
  readonly referenceArea = 0.8; // m^2 exposed area, placeholder
  readonly dragCoefficient = 0.5; // Cd placeholder

  readonly state: RocketState = {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    orientationRad: Math.PI / 2, // initially pointing up
    temperature: 293, // ~20 C in K-ish units
  };

  /** Unique identifier for this rocket (assigned by SimulationManager). */
  id: string = "";

  /** Communication State (updated by CommSystem). */
  commState: {
    connected: boolean;
    hops: number;
    path: string[];
    latencyMs: number;
    signalStrength: number;
  } = { connected: false, hops: 0, path: [], latencyMs: 0, signalStrength: 0 };

  /** Data packets waiting to be sent. */
  packetQueue: any[] = []; // Typed as DataPacket[] in CommSystem context

  /** Queue of new rockets spawned this tick (handled by Environment). */
  spawnQueue: Rocket[] = [];

  // Composition
  engines: EnginePart[] = [];
  fuelTanks: FuelTankPart[] = [];
  batteries: BatteryPart[] = [];
  /** Attitude control units */
  reactionWheels: ReactionWheelsPart[] = [];
  /** Communications antennas */
  antennas: AntennaPart[] = [];
  cpu: ProcessingUnitPart | null = null;
  sensors: SensorPart[] = [];
  payloads: PayloadPart[] = [];
  solarPanels: SolarPanelPart[] = [];

  // Internal state derived from commands
  private angularVelocityRadPerS = 0; // actual angular rate applied (rad/s)
  private desiredAngularVelocityRadPerS = 0; // user-commanded target (rad/s), signed

  /**
   * Apply queued commands; called by Environment before force integration.
   * For turning commands, the value is interpreted as an angular velocity (rad/s).
   * The angular velocity persists until set to zero again.
   */
  applyCommands(queue: RocketCommandQueue): void {
    for (const cmd of queue.drain()) {
      switch (cmd.type) {
        case "setEnginePower":
          for (const e of this.engines) e.power = cmd.value;
          break;
        case "turnLeft": {
          const v = Math.max(0, Math.abs(cmd.value));
          this.desiredAngularVelocityRadPerS = -v;
          if (v === 0) this.desiredAngularVelocityRadPerS = 0;
          break;
        }
        case "turnRight": {
          const v = Math.max(0, Math.abs(cmd.value));
          this.desiredAngularVelocityRadPerS = v;
          if (v === 0) this.desiredAngularVelocityRadPerS = 0;
          break;
        }
      }
    }
    // Actual angular velocity will be computed in Environment based on reaction wheels and available energy.
  }

  /** Current angular turn rate in radians per second (can be negative). */
  getAngularVelocityRadPerS(): number { return this.angularVelocityRadPerS; }
  /** Desired angular rate set by commands (rad/s), signed. */
  getDesiredAngularVelocityRadPerS(): number { return this.desiredAngularVelocityRadPerS; }
  /** Internal: set actual angular velocity after control system evaluation. */
  _setActualAngularVelocityRadPerS(v: number): void { this.angularVelocityRadPerS = Number(v) || 0; }

  /**
   * Returns current thrust in Newtons summing all engines.
   * Air density parameters allow engines to apply atmosphere-specific scaling (e.g., vacuum bonus).
   */
  currentThrust(airDensity: number = 0, seaLevelDensity: number = 1.225): number {
    return this.engines.reduce((sum, e) => sum + e.currentThrust(airDensity, seaLevelDensity), 0);
  }

  /**
   * Must be called once per tick after force integration to update internal resources.
   * - Burns fuel according to engine power
   * - Drains battery as needed (external systems should request drawEnergy)
   */
  // Track last-tick fuel burn to expose consumption rate
  private _lastFuelBurnKgPerS = 0;

  tickInternal(dt: number): void {
    // Burn fuel proportional to engine power and dt.
    let requiredFuel = 0;
    for (const e of this.engines) {
      if (e.power === 1) requiredFuel += e.fuelBurnRateKgPerS * dt;
    }
    // Draw fuel from tanks in order.
    let remaining = requiredFuel;
    let drawnTotal = 0;
    for (const t of this.fuelTanks) {
      if (remaining <= 0) break;
      const drawn = t.drawFuel(remaining);
      drawnTotal += drawn;
      remaining -= drawn;
    }
    // If not enough fuel, reduce engine power accordingly.
    if (remaining > 1e-9) {
      // Not enough fuel this tick -> cut engines
      for (const e of this.engines) e.power = 0;
    }
    // Update last fuel burn rate (kg/s)
    this._lastFuelBurnKgPerS = dt > 0 ? drawnTotal / dt : 0;
  }

  /** Total mass including dry mass, fuel, and batteries. */
  totalMass(): number {
    const enginesMass = this.engines.reduce((m, e) => m + e.dryMassKg, 0);
    const tanksDry = this.fuelTanks.reduce((m, t) => m + t.dryMassKg, 0);
    const fuel = this.fuelTanks.reduce((m, t) => m + t.fuelKg, 0);
    const bat = this.batteries.reduce((m, b) => m + b.massKg, 0);
    const cpu = this.cpu?.massKg ?? 0;
    const sensors = this.sensors.reduce((m, s) => m + s.massKg, 0);
    const antennas = (this as any).antennas ? (this as any).antennas.reduce((m: number, a: any) => m + (a?.massKg || 0), 0) : 0;
    const payloads = this.payloads.reduce((m, p) => m + p.massKg, 0);
    return enginesMass + tanksDry + fuel + bat + cpu + sensors + antennas + payloads;
  }

  /**
   * Deploy a payload part as a new separate rocket entity.
   * Returns the ID of the new rocket if successful, or null if failed.
   */
  deployPayload(payloadId: string): string | null {
    const idx = this.payloads.findIndex(p => p.id === payloadId);
    if (idx === -1) return null;
    const payload = this.payloads[idx];

    // Create new rocket with payload config
    const sat = new Rocket();
    // Assign a temp ID (Environment/Manager should re-assign unique ID or we use random)
    sat.id = `sat-${Math.floor(Math.random() * 1000000)}`;

    // Copy kinematic state
    sat.state.position = { ...this.state.position };
    sat.state.velocity = { ...this.state.velocity };
    sat.state.orientationRad = this.state.orientationRad;
    sat.state.temperature = this.state.temperature;

    // Apply small separation impulse (0.5 m/s forward)
    const sepSpeed = 0.5;
    sat.state.velocity.x += Math.cos(this.state.orientationRad) * sepSpeed;
    sat.state.velocity.y += Math.sin(this.state.orientationRad) * sepSpeed;

    // Install parts from payload config
    sat.sensors = [...payload.satelliteConfig.parts.sensors];
    sat.antennas = [...payload.satelliteConfig.parts.antennas];
    sat.batteries = [...payload.satelliteConfig.parts.batteries];
    // sat.solar = ...

    // Remove payload from this rocket
    this.payloads.splice(idx, 1);

    // Queue for spawning
    this.spawnQueue.push(sat);
    return sat.id;
  }

  availableFuelKg(): number {
    return this.fuelTanks.reduce((m, t) => m + t.fuelKg, 0);
  }

  availableEnergyJ(): number {
    return this.batteries.reduce((e, b) => e + b.energyJoules, 0);
  }

  /** Draw energy from batteries in order; returns actual draw. */
  drawEnergy(requestJ: number): number {
    let remaining = requestJ;
    let drawnTotal = 0;
    for (const b of this.batteries) {
      if (remaining <= 0) break;
      const d = b.drawEnergy(remaining);
      drawnTotal += d;
      remaining -= d;
    }
    return drawnTotal;
  }

  private _altitudeForSnapshot = 0;
  private _airDensityForSnapshot: number | undefined = undefined;
  private _apAltitudeForSnapshot: number = Number.NaN;
  private _peAltitudeForSnapshot: number = Number.NaN;
  private _soiBodyIdForSnapshot: string | undefined = undefined;
  private _inAtmosphereForSnapshot: boolean | undefined = undefined;
  private _forcesForSnapshot: { thrust: { fx: number; fy: number }; drag: { fx: number; fy: number }; gravity: { fx: number; fy: number; perBody: { id: string; name: string; fx: number; fy: number }[] } } | undefined = undefined;
  // Communications snapshot fields
  private _commsInRange: boolean | undefined = undefined;
  private _commsDistanceM: number | undefined = undefined;
  private _commsBaseRangeM: number | undefined = undefined;
  private _commsRocketRangeM: number | undefined = undefined;
  private _commsSentPerS: number | undefined = undefined;
  private _commsRecvPerS: number | undefined = undefined;
  /** Set by Environment each tick to reflect altitude over primary body. */
  setAltitudeForSnapshot(alt: number): void {
    this._altitudeForSnapshot = alt;
  }
  /** Set by Environment each tick to reflect atmospheric density (kg/m^3). */
  setAirDensityForSnapshot(rho: number | undefined): void {
    this._airDensityForSnapshot = (typeof rho === 'number') ? rho : undefined;
  }
  /** Set by Environment each tick when orbit analysis is available. Use NaN if not elliptical. */
  setApPeForSnapshot(apAlt: number, peAlt: number): void {
    this._apAltitudeForSnapshot = Number(apAlt);
    this._peAltitudeForSnapshot = Number(peAlt);
  }
  /** Set by Environment: body id with strongest gravity (SOI approx). */
  setSoIForSnapshot(id: string | undefined): void {
    this._soiBodyIdForSnapshot = id;
  }
  /** Set by Environment: whether currently inside atmosphere (rho>0). */
  setInAtmosphereForSnapshot(v: boolean | undefined): void {
    this._inAtmosphereForSnapshot = typeof v === 'boolean' ? v : undefined;
  }
  /** Set by Environment: force breakdown this tick (Newtons). */
  setForcesForSnapshot(forces: { thrust: { fx: number; fy: number }; drag: { fx: number; fy: number }; gravity: { fx: number; fy: number; perBody: { id: string; name: string; fx: number; fy: number }[] } } | undefined): void {
    this._forcesForSnapshot = forces ? {
      thrust: { fx: forces.thrust.fx, fy: forces.thrust.fy },
      drag: { fx: forces.drag.fx, fy: forces.drag.fy },
      gravity: {
        fx: forces.gravity.fx,
        fy: forces.gravity.fy,
        perBody: forces.gravity.perBody.map(g => ({ id: g.id, name: g.name, fx: g.fx, fy: g.fy })),
      },
    } : undefined;
  }
  /** Set by SimulationManager: communications link metrics for UI. */
  setCommsForSnapshot(params: { inRange: boolean; distanceM: number; baseRangeM: number; rocketRangeM: number; sentPerS: number; recvPerS: number }): void {
    this._commsInRange = !!params.inRange;
    this._commsDistanceM = Number(params.distanceM);
    this._commsBaseRangeM = Number(params.baseRangeM);
    this._commsRocketRangeM = Number(params.rocketRangeM);
    this._commsSentPerS = Number(params.sentPerS);
    this._commsRecvPerS = Number(params.recvPerS);
  }

  snapshot(): RocketSnapshot {
    const energy = this.availableEnergyJ();
    const capacity = this.batteries.reduce((e, b) => e + b.capacityJoules, 0);
    const pct = capacity > 0 ? Math.max(0, Math.min(100, (energy / capacity) * 100)) : 0;
    const cpuSlotCount = (this as any)._cpuSlotCount ?? this.cpu?.scriptSlots;
    const cpuScriptsRunning = (this as any)._cpuScriptsRunning ?? 0;
    const cpuCostUsedLastTick = (this as any)._cpuCostUsedLastTick ?? 0;
    const cpuEnergyUsedLastTick = (this as any)._cpuEnergyUsedLastTick ?? 0;
    // Reaction wheels snapshot fields
    let rwMax = 0;
    for (const rw of this.reactionWheels) rwMax += Math.max(0, (rw as any).maxOmegaRadPerS || 0);
    const rwOmega = this.getAngularVelocityRadPerS();
    return {
      position: { ...this.state.position },
      velocity: { ...this.state.velocity },
      orientationRad: this.state.orientationRad,
      temperature: this.state.temperature,
      massKg: this.totalMass(),
      altitude: this._altitudeForSnapshot,
      airDensity: this._airDensityForSnapshot,
      soiBodyId: this._soiBodyIdForSnapshot,
      inAtmosphere: this._inAtmosphereForSnapshot,
      forces: this._forcesForSnapshot ? {
        thrust: { ...this._forcesForSnapshot.thrust },
        drag: { ...this._forcesForSnapshot.drag },
        gravity: {
          fx: this._forcesForSnapshot.gravity.fx,
          fy: this._forcesForSnapshot.gravity.fy,
          perBody: this._forcesForSnapshot.gravity.perBody.map(g => ({ ...g })),
        },
      } : undefined,
      apAltitude: this._apAltitudeForSnapshot,
      peAltitude: this._peAltitudeForSnapshot,
      fuelKg: this.availableFuelKg(),
      fuelConsumptionKgPerS: this._lastFuelBurnKgPerS,
      batteryJoules: energy,
      batteryCapacityJoules: capacity,
      batteryPercent: pct,
      cpuName: this.cpu?.name,
      cpuProcessingBudgetPerTick: this.cpu?.processingBudgetPerTick,
      cpuMaxScriptChars: this.cpu?.maxScriptChars,
      cpuProcessingIntervalSeconds: this.cpu?.processingIntervalSeconds,
      cpuSlotCount,
      cpuScriptsRunning,
      cpuCostUsedLastTick,
      cpuEnergyUsedLastTick,
      cpuNextRunInSeconds: (this as any)._cpuNextRunInSeconds ?? (this.cpu?.processingIntervalSeconds ?? 0),
      rwOmegaRadPerS: rwOmega,
      rwMaxOmegaRadPerS: rwMax,
      rwDesiredOmegaRadPerS: this.getDesiredAngularVelocityRadPerS(),
      commsInRange: this._commsInRange,
      commsDistanceMeters: this._commsDistanceM,
      commsBaseRangeMeters: this._commsBaseRangeM,
      commsRocketRangeMeters: this._commsRocketRangeM,
      commsBytesSentPerS: this._commsSentPerS,
      commsBytesRecvPerS: this._commsRecvPerS,
      lastPacketSentType: (this as any)._lastPacketSentType,
      exposedKeys: Array.from(new Set([
        ...(this.sensors.flatMap(s => s.exposes || [])),
        ...(this.engines.flatMap(e => e.exposes || [])),
        ...(this.fuelTanks.flatMap(t => t.exposes || [])),
        ...(this.batteries.flatMap(b => b.exposes || [])),
        ...(this.cpu?.exposes || []),
        ...(this.reactionWheels.flatMap(r => r.exposes || [])),
        ...(this.antennas.flatMap(a => a.exposes || [])),
        ...(this.payloads.flatMap(p => p.exposes || [])),
        ...(this.solarPanels.flatMap(s => s.exposes || [])),
      ])),
    };
  }
}
