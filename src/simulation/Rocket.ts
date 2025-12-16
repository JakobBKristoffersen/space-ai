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
  name?: string;
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
  maxTurnRateRadPerS?: number;
  angularVelocityRadPerS?: number;
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
  /** Average engine throttle (0-1). */
  avgEngineThrustPct?: number;
  /** True if any parachute is currently deployed. */
  parachuteDeployed?: boolean;
  /** True if the rocket has any parachutes installed. */
  hasParachutes?: boolean;
  /** Estimated total drag coefficient of the vehicle. */
  totalDragCoefficient?: number;
  /** Name of the terrain currently below the rocket. */
  currentTerrain?: string;
}

export type RocketCommand =
  | { type: "setEnginePower"; value: number }
  | { type: "turnLeft"; value: number }
  | { type: "turnRight"; value: number }
  | { type: "deployParachute" }
  | { type: "deploySolar" }
  | { type: "retractSolar" };

export interface RocketCommandQueue {
  drain(): RocketCommand[];
}

export class SimpleQueue implements RocketCommandQueue {
  private items: RocketCommand[] = [];
  enqueue(cmd: RocketCommand) { this.items.push(cmd); }
  drain(): RocketCommand[] {
    const ret = this.items;
    this.items = [];
    return ret;
  }
}

// --- PART INTERFACES ---

export interface EnginePart {
  readonly id: string;
  readonly name: string;
  readonly dryMassKg: number;
  readonly maxThrustN: number;
  power: number; // 0..1
  readonly fuelBurnRateKgPerS: number;
  readonly vacuumBonusAtVacuum?: number;
  readonly exposes?: string[];
  currentThrust(rho: number, rho0: number): number;
}

export interface FuelTankPart {
  readonly id: string;
  readonly name: string;
  readonly dryMassKg: number;
  fuelKg: number;
  readonly capacityKg?: number;
  readonly exposes?: string[];
  drawFuel(amount: number): number;
}

export interface BatteryPart {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  energyJoules: number;
  readonly capacityJoules: number;
  readonly exposes?: string[];
  drawEnergy(amountJ: number): number;
}

export interface ProcessingUnitPart { // Alias for CPUPart
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  readonly scriptSlots: number;
  readonly processingBudgetPerTick: number;
  readonly maxScriptChars: number;
  readonly processingIntervalSeconds?: number;
  readonly exposes?: string[];
}
export type CPUPart = ProcessingUnitPart;

export interface SensorPart {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  readonly exposes?: string[];
}

export interface ReactionWheelPart { // Alias ReactionWheelsPart
  readonly id: string;
  readonly name: string;
  readonly maxOmegaRadPerS: number;
  readonly energyPerRadPerS: number;
  readonly exposes?: string[];
}
export type ReactionWheelsPart = ReactionWheelPart;

export interface AntennaPart {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  readonly rangeMeters?: number;
  readonly antennaPower?: number;
  readonly exposes?: string[];
}

export interface SolarPanelPart {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  readonly generationWatts: number;
  deployed: boolean;
  readonly retractable: boolean;
  readonly exposes?: string[];
}

export interface ParachutePart {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  deployed: boolean;
  readonly deployedDrag: number;
  readonly exposes?: string[];
}

export interface PayloadPart {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  // Minimal config to allow deploying
  readonly satelliteConfig: {
    parts: {
      sensors: SensorPart[];
      antennas: AntennaPart[];
      batteries: BatteryPart[];
    };
  };
  readonly exposes?: string[];
}

// Simple parts
export interface NoseConePart { readonly id: string; readonly name: string; readonly massKg: number; readonly dragCoefficient?: number; }
export interface FinPart { readonly id: string; readonly name: string; readonly massKg: number; readonly dragCoefficient?: number; }
export interface HeatShieldPart { readonly id: string; readonly name: string; readonly massKg: number; readonly maxTemp: number; }
export interface SciencePart { readonly id: string; readonly name: string; readonly massKg: number; readonly scienceValue?: number; }


// --- ROCKET CLASS ---

export class Rocket {
  id: string = "rocket-1";
  name: string = "Rocket";
  state: RocketState = {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    orientationRad: 0,
    temperature: 0,
  };

  currentTerrain: string | undefined;

  // Config/Physics
  dragCoefficient = 0.5;
  referenceArea = 10; // m^2

  // Parts
  engines: EnginePart[] = [];
  fuelTanks: FuelTankPart[] = [];
  batteries: BatteryPart[] = [];
  cpu: CPUPart | null = null;
  sensors: SensorPart[] = [];
  reactionWheels: ReactionWheelPart[] = [];
  antennas: AntennaPart[] = [];
  parachutes: ParachutePart[] = [];
  solarPanels: SolarPanelPart[] = [];
  payloads: PayloadPart[] = [];
  noseCones: NoseConePart[] = [];
  fins: FinPart[] = [];
  heatShields: HeatShieldPart[] = [];
  science: SciencePart[] = [];

  // Runtime
  spawnQueue: Rocket[] = [];
  packetQueue: { id: string; type: string; sizeKb: number; progressKb: number; sourceId: string; targetId: string; data: any }[] = [];
  commState: { connected: boolean; signalStrength: number } = { connected: false, signalStrength: 0 };

  desiredAngularVelocityRadPerS = 0;
  private _lastFuelBurnKgPerS = 0;

  // Snapshot internal buffers
  private _altitudeForSnapshot = 0;
  private _airDensityForSnapshot: number | undefined = undefined;
  private _apAltitudeForSnapshot: number = Number.NaN;
  private _peAltitudeForSnapshot: number = Number.NaN;
  private _soiBodyIdForSnapshot: string | undefined = undefined;
  private _inAtmosphereForSnapshot: boolean | undefined = undefined;
  private _forcesForSnapshot: { thrust: { fx: number; fy: number }; drag: { fx: number; fy: number }; gravity: { fx: number; fy: number; perBody: { id: string; name: string; fx: number; fy: number }[] } } | undefined = undefined;
  private _commsInRange: boolean | undefined = undefined;
  private _commsDistanceM: number | undefined = undefined;
  private _commsBaseRangeM: number | undefined = undefined;
  private _commsRocketRangeM: number | undefined = undefined;
  private _commsSentPerS: number | undefined = undefined;
  private _commsRecvPerS: number | undefined = undefined;
  private _maxTurnRateForSnapshot: number | undefined = undefined;

  // Setters for Environment
  setAltitudeForSnapshot(alt: number): void { this._altitudeForSnapshot = alt; }
  setAirDensityForSnapshot(rho: number | undefined): void { this._airDensityForSnapshot = (typeof rho === 'number') ? rho : undefined; }
  setApPeForSnapshot(apAlt: number, peAlt: number): void { this._apAltitudeForSnapshot = Number(apAlt); this._peAltitudeForSnapshot = Number(peAlt); }
  setSoIForSnapshot(id: string | undefined): void { this._soiBodyIdForSnapshot = id; }
  setInAtmosphereForSnapshot(v: boolean | undefined): void { this._inAtmosphereForSnapshot = typeof v === 'boolean' ? v : undefined; }
  setForcesForSnapshot(forces: any): void {
    this._forcesForSnapshot = forces ? {
      thrust: { ...forces.thrust },
      drag: { ...forces.drag },
      gravity: { fx: forces.gravity.fx, fy: forces.gravity.fy, perBody: forces.gravity.perBody.map((g: any) => ({ ...g })) },
    } : undefined;
  }
  setCommsForSnapshot(params: any): void {
    this._commsInRange = !!params.inRange;
    this._commsDistanceM = Number(params.distanceM);
    this._commsBaseRangeM = Number(params.baseRangeM);
    this._commsRocketRangeM = Number(params.rocketRangeM);
    this._commsSentPerS = Number(params.sentPerS);
    this._commsRecvPerS = Number(params.recvPerS);
  }
  setTurnStatsForSnapshot(maxOmega: number): void { this._maxTurnRateForSnapshot = Number(maxOmega); }
  // setCurrentTerrainForSnapshot removed, using public property this.currentTerrain

  // --- Logic ---

  applyCommands(queue: RocketCommandQueue): void {
    for (const cmd of queue.drain()) {
      switch (cmd.type) {
        case "setEnginePower":
          for (const e of this.engines) e.power = cmd.value;
          break;
        case "turnLeft": {
          const v = Math.max(0, Math.abs(cmd.value));
          this.desiredAngularVelocityRadPerS = -v;
          break;
        }
        case "turnRight": {
          const v = Math.max(0, Math.abs(cmd.value));
          this.desiredAngularVelocityRadPerS = v;
          break;
        }
        case "deployParachute":
          for (const p of this.parachutes) p.deployed = true;
          break;
        case "deploySolar":
          for (const s of this.solarPanels) s.deployed = true;
          break;
        case "retractSolar":
          for (const s of this.solarPanels) if (s.retractable) s.deployed = false;
          break;
      }
    }
  }

  tickInternal(dt: number): void {
    // Solar Generation
    let solarJ = 0;
    for (const s of this.solarPanels) {
      if (s.deployed) solarJ += s.generationWatts * dt;
    }
    // Distribute solar energy to batteries
    if (solarJ > 0) {
      for (const b of this.batteries) {
        if (solarJ <= 0) break;
        const space = b.capacityJoules - b.energyJoules;
        if (space > 0) {
          const add = Math.min(space, solarJ);
          b.energyJoules += add;
          solarJ -= add;
        }
      }
    }

    // Burn fuel proportional to engine power and dt.
    let requiredFuel = 0;
    for (const e of this.engines) {
      if (e.power > 0) requiredFuel += e.fuelBurnRateKgPerS * dt * e.power;
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
    const antennas = this.antennas.reduce((m, a) => m + a.massKg, 0);
    const payloads = this.payloads.reduce((m, p) => m + p.massKg, 0);
    const cones = this.noseCones.reduce((m, p) => m + p.massKg, 0);
    const fins = this.fins.reduce((m, p) => m + p.massKg, 0);
    const chutes = this.parachutes.reduce((m, p) => m + p.massKg, 0);
    const shields = this.heatShields.reduce((m, p) => m + p.massKg, 0);
    const sci = this.science.reduce((m, p) => m + p.massKg, 0);
    return enginesMass + tanksDry + fuel + bat + cpu + sensors + antennas + payloads + cones + fins + chutes + shields + sci;
  }

  currentThrust(rho: number, rho0: number): number {
    return this.engines.reduce((sum, e) => sum + e.currentThrust(rho, rho0), 0);
  }

  getAngularVelocityRadPerS(): number {
    // Only used for snapshot actual omega reporting from Environment; Rocket just stores rotation
    // But since Environment computes it, we might not technically know it here unless we differentiate orientation.
    // Environment uses this field to report back?
    // Let's assume Environment writes a "rwOmegaRadPerS" to snapshot directly or we store it.
    return (this as any)._rwOmegaRadPerS ?? 0;
  }
  // Internal setter for Environment
  _setActualAngularVelocityRadPerS(w: number) { (this as any)._rwOmegaRadPerS = w; }

  getDesiredAngularVelocityRadPerS() { return this.desiredAngularVelocityRadPerS; }

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

    // Calculate telemetry
    const engines = this.engines;
    const throttleSum = engines.reduce((sum, e) => sum + e.power, 0);
    const throttleAvg = engines.length > 0 ? throttleSum / engines.length : 0;

    const parachuteDeployed = this.parachutes.some(p => p.deployed);

    // Estimate total drag coefficient (Cd)
    // Base shape
    let cd = this.dragCoefficient;
    // Addtional parts
    for (const p of this.parachutes) if (p.deployed) cd += p.deployedDrag;
    for (const f of this.fins) cd += (f.dragCoefficient ?? 0);
    for (const n of this.noseCones) cd += (n.dragCoefficient ?? 0);

    return {
      name: this.name,
      position: { ...this.state.position },
      velocity: { ...this.state.velocity },
      orientationRad: this.state.orientationRad,
      temperature: this.state.temperature,
      massKg: this.totalMass(),
      altitude: this._altitudeForSnapshot,
      airDensity: this._airDensityForSnapshot,
      soiBodyId: this._soiBodyIdForSnapshot,
      inAtmosphere: this._inAtmosphereForSnapshot,
      maxTurnRateRadPerS: this._maxTurnRateForSnapshot,
      angularVelocityRadPerS: this.getAngularVelocityRadPerS(),
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
      // New fields
      avgEngineThrustPct: throttleAvg,
      parachuteDeployed,
      hasParachutes: this.parachutes.length > 0,
      totalDragCoefficient: cd,
      currentTerrain: this.currentTerrain,
    };
  }
}
