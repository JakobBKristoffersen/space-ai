/**
 * Environment orchestrates the physics simulation for the world and the rocket.
 * Responsibilities:
 * - Advance physics with a fixed tick (gravity, drag, heat, fuel usage, mass changes).
 * - Keep planet and atmosphere models pluggable and extensible.
 * - Emit read-only snapshots for other systems (scripting, missions, rendering).
 * - Apply commands queued by the scripting layer via the Rocket API.
 *
 * This file intentionally contains no rendering code.
 */
import { Rocket, RocketCommandQueue, RocketSnapshot } from "./Rocket";
import { CelestialBody, CelestialSystemDef, TerrainSegment } from "./CelestialSystem";
import { PhysicsEngine } from "./PhysicsEngine";

// --- Legacy / Shared Interfaces maintained for compatibility with main.ts ---

export interface AtmosphereProperties {
  density: number;      // kg/m^3
  pressure: number;     // Pascals
  temperature: number;  // Kelvin
}

export interface AtmosphereModel {
  /**
   * Returns atmospheric properties at the given altitude (meters above sea level).
   */
  getProperties(altitudeMeters: number): AtmosphereProperties;

  /** Legacy/Helper for just density */
  densityAt(altitudeMeters: number): number;
}

export class StandardAtmosphere implements AtmosphereModel {
  readonly P0: number; // Pa
  readonly T0: number; // K
  readonly rho0 = 1.225; // kg/m^3
  readonly L: number; // Temperature lapse rate K/m
  readonly R = 287.05; // Specific gas constant for dry air J/(kg·K)
  readonly g = 9.80665; // Gravity m/s^2 (Standard)
  readonly k: number | undefined;
  readonly cutoffAlt: number;

  constructor(opts: {
    cutoffAltitudeMeters?: number;
    baseTemperature?: number;
    basePressure?: number;
    lapseRate?: number;
    useHybridToyModel?: boolean;
  } = {}) {
    this.cutoffAlt = opts.cutoffAltitudeMeters ?? 100000;
    this.T0 = opts.baseTemperature ?? 288.15;
    this.P0 = opts.basePressure ?? 101325;
    this.L = opts.lapseRate ?? 0.0065;

    // Recalculate L if we are in toy model mode and have a cutoff
    if (opts.useHybridToyModel && this.cutoffAlt > 0) {
      // Force T to drop to 4K at cutoff
      this.L = (this.T0 - 4) / this.cutoffAlt;
      // Exponential falloff factor for pressure
      this.k = 14 / this.cutoffAlt;
    }
  }

  getProperties(alt: number): AtmosphereProperties {
    if (alt > this.cutoffAlt) {
      return { density: 0, pressure: 0, temperature: 4 };
    }

    // 1. Temperature
    let T = this.T0 - this.L * alt;
    if (T < 4) T = 4;

    let pressure = 0;
    if (this.k) {
      // Hybrid Toy Model: exponential drop
      pressure = this.P0 * Math.exp(-this.k * alt);
    } else {
      // Standard Troposphere
      // T = T0 - L * h
      const T_clamped = Math.max(4, this.T0 - this.L * alt); // separate clamp for formula stability?
      // Actually legacy used linear T then exponential P.
      // Standard uses formula:
      pressure = this.P0 * Math.pow(1 - (this.L * alt) / this.T0, (this.g) / (this.R * this.L));
    }

    // 3. Density (Ideal Gas Law)
    const density = (this.R * T) > 0 ? pressure / (this.R * T) : 0;

    return { density, pressure, temperature: T };
  }

  densityAt(alt: number): number {
    return this.getProperties(alt).density;
  }
}

export interface DragModel {
  computeDrag(density: number, speed: number, dragCoefficient: number, referenceArea: number): number;
}

export interface HeatingModel {
  heatingRate(density: number, speed: number): number;
}

// --- Environment Options ---

export interface EnvironmentOptions {
  system: CelestialSystemDef;
  atmosphere: AtmosphereModel; // used for primary body; moon assumed none for density
  drag: DragModel;
  heating: HeatingModel;
  /** Optional additional rockets besides the primary active rocket. */
  rockets?: Rocket[];
  /** Optional active rocket index (defaults to 0). */
  activeRocketIndex?: number;
  /** Optional fixed structures anchored to celestial bodies. */
  structures?: { id: string; name: string; bodyId: string; /** angle around body in radians */ angleRad: number }[];
}

// UI Snapshot for Rendering
export interface EnvironmentSnapshot {
  timeSeconds: number;
  /** Active rocket snapshot (back-compat or primary). */
  rocket?: RocketSnapshot;
  /** All rockets snapshots (active first if you prefer to read that way). */
  rockets?: ReadonlyArray<RocketSnapshot>;
  /** Index of the active rocket in the rockets[] array. */
  activeRocketIndex?: number;
  bodies: ReadonlyArray<BodySnapshot>;
  /** System-designated primary body id (for atmosphere/ground). */
  primaryId: string;
  destroyed: boolean;
  /** Altitude (m) above sea level where atmosphere is considered 0 density. */
  atmosphereCutoffAltitudeMeters?: number;
  /** Fixed world-space structures (computed from body anchors). */
  structures?: { id: string; name: string; bodyId: string; position: { x: number; y: number } }[];
  timeWarpFactor: number;
}

export interface BodySnapshot {
  id: string;
  name: string;
  radiusMeters: number;
  surfaceGravity: number;
  color?: string;
  position: { x: number; y: number };
  type: "planet" | "moon";
  atmosphereScaleHeightMeters?: number;
  atmosphereColor?: string;
  terrain?: TerrainSegment[];
  angle?: number;
}


// --- Main Environment Class ---

export class Environment {
  private readonly system: CelestialSystemDef;
  private readonly atmosphere: AtmosphereModel;
  private readonly dragModel: DragModel;
  private readonly heatingModel: HeatingModel;
  private timeSeconds = 0;
  private bodies: CelestialBody[] = [];
  private destroyed = false;
  private rockets: Rocket[] = [];
  private activeRocketIndex = -1;
  private rocket: Rocket | undefined; // Active rocket alias (nullable)
  private structuresDef: { id: string; name: string; bodyId: string; angleRad: number }[] = [];

  timeWarpFactor: number = 1;

  constructor(rocket: Rocket | undefined, opts: EnvironmentOptions) {
    this.system = opts.system;
    this.atmosphere = opts.atmosphere;
    this.dragModel = opts.drag;
    this.heatingModel = opts.heating;

    // Rockets management
    if (rocket) {
      this.rockets = [rocket, ...(opts.rockets ?? [])];
    } else {
      this.rockets = [...(opts.rockets ?? [])];
    }

    if (this.rockets.length > 0) {
      this.activeRocketIndex = Math.max(0, Math.min(opts.activeRocketIndex ?? 0, this.rockets.length - 1));
      this.rocket = this.rockets[this.activeRocketIndex];
    } else {
      this.activeRocketIndex = -1;
      this.rocket = undefined;
    }
    this.structuresDef = [...(opts.structures ?? [])];

    // Initialize Celestial Bodies
    this.bodies = this.system.bodies.map(b => new CelestialBody(b));

    // Initial Tick to set positions
    this.bodies.forEach(b => b.update(0));

    // Place all rockets on primary surface at the top (angle pi/2)
    const primary = this.bodies.find(b => b.id === this.system.primaryId);
    if (primary) {
      const R = primary.radiusMeters;
      for (let i = 0; i < this.rockets.length; i++) {
        const r = this.rockets[i];
        // Only place if 0,0? Or always reset? 
        if (r.state.position.x === 0 && r.state.position.y === 0) {
          r.state.position.x = 0;
          r.state.position.y = R;
          r.state.velocity.x = 0;
          r.state.velocity.y = 0;
          r.state.orientationRad = Math.PI / 2;
        }
      }
    }
  }

  /** Advance physics by fixed time step (seconds). */
  tick(dt: number, tickIndex: number, commands: RocketCommandQueue): void {

    // Update Bodies
    for (const b of this.bodies) {
      b.update(this.timeSeconds);
    }

    // Spawn Queue
    for (const r of this.rockets) {
      if (r.spawnQueue.length > 0) {
        const spawned = r.spawnQueue.splice(0, r.spawnQueue.length);
        this.rockets.push(...spawned);
      }
    }

    // Apply Commands (Active Rocket)
    if (this.rocket) {
      this.rocket.applyCommands(commands);
    }

    // Update Rocket Physics (Active)
    if (!this.destroyed && this.rocket) {
      PhysicsEngine.updateRocket(
        dt,
        this.rocket,
        this.bodies,
        this.timeSeconds,
        this.system.primaryId,
        () => { this.destroyed = true; }
      );
    }

    // Integrate other rockets (non-active) with same physics
    for (let i = 0; i < this.rockets.length; i++) {
      if (i === this.activeRocketIndex) continue;
      PhysicsEngine.updateRocket(
        dt,
        this.rockets[i],
        this.bodies,
        this.timeSeconds,
        this.system.primaryId,
        () => { } // Silent destroy or log?
      );
    }

    this.timeSeconds += dt;
  }

  // --- Snapshot ---

  snapshot(): EnvironmentSnapshot {
    // Generate snapshot
    const rSnap = this.rocket ? this.rocket.snapshot() : undefined;
    const bSnap: BodySnapshot[] = this.bodies.map(b => ({
      id: b.id,
      name: b.name,
      position: { x: b.position.x, y: b.position.y },
      radiusMeters: b.radiusMeters,
      surfaceGravity: b.surfaceGravity,
      color: b.color,
      type: (b.id === this.system.primaryId ? "planet" : "moon") as "planet" | "moon",
      angle: 0, // TODO: Body rotation if needed
      atmosphereScaleHeightMeters: b.atmosphereScaleHeight,
      atmosphereColor: b.atmosphereColor,
      terrain: b.terrain
    }));

    const structs = this.structuresDef.map(s => {
      const body = this.bodies.find(b => b.id === s.bodyId);
      let x = 0, y = 0;
      if (body) {
        x = body.position.x + Math.cos(s.angleRad) * body.radiusMeters;
        y = body.position.y + Math.sin(s.angleRad) * body.radiusMeters;
      }
      return { id: s.id, name: s.name, bodyId: s.bodyId, position: { x, y } };
    });

    return {
      timeSeconds: this.timeSeconds,
      timeWarpFactor: this.timeWarpFactor,
      rocket: rSnap,
      rockets: this.rockets.map(r => r.snapshot()),
      activeRocketIndex: this.activeRocketIndex,
      bodies: bSnap,
      primaryId: this.system.primaryId,
      destroyed: this.destroyed,
      atmosphereCutoffAltitudeMeters: (this.atmosphere as any).cutoffAlt,
      structures: structs
    };
  }

  // --- Multi-rocket management ---
  getRockets(): ReadonlyArray<Rocket> { return this.rockets; }
  getActiveRocket(): Rocket | undefined { return this.rocket; }
  getActiveRocketIndex(): number { return this.activeRocketIndex; }

  setActiveRocketIndex(i: number): void {
    if (this.rockets.length === 0) {
      this.activeRocketIndex = -1;
      this.rocket = undefined;
      return;
    }
    const idx = Math.max(0, Math.min(Math.floor(i), this.rockets.length - 1));
    this.activeRocketIndex = idx;
    this.rocket = this.rockets[this.activeRocketIndex];
  }

  /** Replace the active rocket instance (e.g., after reset/upgrades). */
  replaceActiveRocket(r: Rocket): void {
    const primary = this.bodies.find(b => b.id === this.system.primaryId)!;
    // Place new rocket at the top of the primary, stationary and pointing up
    r.state.position.x = 0;
    r.state.position.y = primary.radiusMeters;
    r.state.velocity.x = 0;
    r.state.velocity.y = 0;
    r.state.orientationRad = Math.PI / 2;
    // Replace and set active alias
    if (this.rockets.length > 0) {
      this.rockets[this.activeRocketIndex] = r;
    } else {
      this.rockets = [r];
      this.activeRocketIndex = 0;
    }
    this.rocket = r;
  }

  /**
   * Clears all existing rockets (including debris/stages) and sets the environment
   * to contain ONLY the provided rocket as the single active rocket.
   */
  resetToSingleRocket(r: Rocket): void {
    const primary = this.bodies.find(b => b.id === this.system.primaryId)!;
    // Place new rocket at the top of the primary, stationary and pointing up
    r.state.position.x = 0;
    r.state.position.y = primary.radiusMeters;
    r.state.velocity.x = 0;
    r.state.velocity.y = 0;
    r.state.orientationRad = Math.PI / 2;

    // Clear array and set single entry
    this.rockets = [r];
    this.activeRocketIndex = 0;
    this.rocket = r;
    this.destroyed = false; // Reset destroyed flag
  }
}

// --- Default simple models from original file (kept for compatibility) ---

export const SimpleAtmosphere: AtmosphereModel = new StandardAtmosphere();

export const QuadraticDrag: DragModel = {
  computeDrag(density, speed, Cd, A) {
    return 0.5 * density * speed * speed * Cd * A;
  },
};

export const SimpleHeating: HeatingModel = {
  heatingRate(density, speed) {
    // Very rough placeholder: proportional to dynamic pressure times speed
    const q = 0.5 * density * speed * speed;
    return q * speed * 1e-6; // TODO: tune constant
  },
};

export { StandardAtmosphere as AtmosphereWithCutoff };
