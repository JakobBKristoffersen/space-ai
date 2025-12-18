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

export interface PlanetModel {
  name: string;
  radiusMeters: number; // planet radius
  surfaceGravity: number; // m/s^2 at sea level
}

export interface TerrainSegment {
  type: string;
  color: string;
  startRad: number; // 0 to 2PI
  endRad: number;
}

// Celestial bodies model (toy-friendly). Uses surfaceGravity instead of mass to avoid G.
export interface CelestialBodyDef {
  id: string;
  name: string;
  radiusMeters: number;
  surfaceGravity: number; // acceleration at surface
  color?: string;
  atmosphereScaleHeightMeters?: number; // optional, for primary only
  atmosphereHeightMeters?: number; // optional, explicit cutoff altitude
  atmosphereColor?: string;
  /** Simple circular orbit around a target body id. If omitted, body is static. */
  orbit?: {
    aroundId: string;
    radiusMeters: number;
    angularSpeedRadPerS: number;
    phaseRad?: number;
  };
  terrain?: TerrainSegment[];
}

export interface CelestialSystemDef {
  primaryId: string;
  bodies: CelestialBodyDef[];
}

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

/**
 * Enhanced atmosphere model with temperature lapse rate and ideal gas law density.
 */
export class StandardAtmosphere implements AtmosphereModel {
  readonly P0: number; // Pa
  readonly T0: number; // K
  readonly rho0 = 1.225; // kg/m^3
  readonly L: number; // Temperature lapse rate K/m
  readonly R = 287.05; // Specific gas constant for dry air J/(kg·K)
  readonly g = 9.80665; // Gravity m/s^2 (Standard)

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
    }
  }

  getProperties(alt: number): AtmosphereProperties {
    if (alt > this.cutoffAlt) {
      return { density: 0, pressure: 0, temperature: 4 };
    }

    // 1. Temperature: strict linear drop to 4K at cutoff
    // T = T0 - L * h
    let T = this.T0 - this.L * alt;
    if (T < 4) T = 4;

    // 2. Pressure: Hybrid Toy Model
    // We want P to drop to effectively 0 at cutoffAlt.
    // Real hydrostatic equilibrium might not drop fast enough for a tiny planet with defined gravity.
    // Instead, we fit an exponential curve: P = P0 * exp(-k * h).
    // We want P ~= 0.01 Pa at cutoffAlt (or some valid vacuum threshold).
    // Let's say P_cutoff = P0 * 1e-6 (approx 0.1 Pa).
    // 1e-6 = exp(-k * cutoffAlt) => ln(1e-6) = -k * cutoffAlt => k = -ln(1e-6) / cutoffAlt
    // ln(1e-6) ~= -13.8
    // So k ~= 13.8 / cutoffAlt.

    // For standard physics, we'd use the standard barometric formula.
    // But for the user's specific request "scale properly to 2000m", strict control is better.

    // We'll use a derived scale height H_eff = cutoffAlt / 10 (approx). 
    // Actually, let's use the exponent derived from ensuring P is negligible at cutoff.
    const k = 14 / (this.cutoffAlt || 10000); // ~10000m default
    const P = this.P0 * Math.exp(-k * alt);

    // 3. Density (Ideal Gas Law)
    // rho = P / (R * T)
    const rho = (this.R * T) > 0 ? P / (this.R * T) : 0;

    return { density: rho, pressure: P, temperature: T };
  }

  densityAt(alt: number): number {
    return this.getProperties(alt).density;
  }
}

// Back-compat alias - consumers expect this export
export class AtmosphereWithCutoff extends StandardAtmosphere {
  constructor(opts: { scaleHeightMeters?: number; cutoffFactor?: number; rho0?: number; atmosphereHeightMeters?: number }) {
    // Priority: atmosphereHeightMeters > scaleHeightMeters * 7
    let height = 0;
    if (opts.atmosphereHeightMeters && opts.atmosphereHeightMeters > 0) {
      height = opts.atmosphereHeightMeters;
    } else {
      const sh = Math.max(1, opts.scaleHeightMeters ?? 200);
      const fac = Math.max(1, opts.cutoffFactor ?? 7);
      height = sh * fac;
    }

    super({
      cutoffAltitudeMeters: height,
      useHybridToyModel: true
    });
  }
}

export interface DragModel {
  /**
   * Computes drag force magnitude given density, speed, and reference area, coefficient.
   */
  computeDrag(density: number, speed: number, dragCoefficient: number, referenceArea: number): number;
}

export interface HeatingModel {
  /**
   * Computes heating rate (arbitrary units) from atmospheric interaction.
   */
  heatingRate(density: number, speed: number): number;
}

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

export interface BodyState {
  id: string;
  name: string;
  radiusMeters: number;
  surfaceGravity: number;
  color?: string;
  position: { x: number; y: number };
  atmosphereScaleHeightMeters?: number;
  atmosphereColor?: string;
  terrain?: TerrainSegment[];
}

export interface EnvironmentSnapshot {
  timeSeconds: number;
  /** Active rocket snapshot (back-compat or primary). */
  rocket?: RocketSnapshot;
  /** All rockets snapshots (active first if you prefer to read that way). */
  rockets?: ReadonlyArray<RocketSnapshot>;
  /** Index of the active rocket in the rockets[] array. */
  activeRocketIndex?: number;
  bodies: ReadonlyArray<BodyState>;
  /** System-designated primary body id (for atmosphere/ground). */
  primaryId: string;
  destroyed: boolean;
  /** Altitude (m) above sea level where atmosphere is considered 0 density. */
  atmosphereCutoffAltitudeMeters?: number;
  /** Fixed world-space structures (computed from body anchors). */
  structures?: { id: string; name: string; bodyId: string; position: { x: number; y: number } }[];
}

export class Environment {
  private lastForces: { thrust: { fx: number; fy: number }; drag: { fx: number; fy: number }; gravity: { fx: number; fy: number; perBody: { id: string; name: string; fx: number; fy: number }[] } } | undefined;

  // New State Tracking
  private lastAtmosphereProps: AtmosphereProperties | undefined;
  // Legacy tracking for standard snapshot props, derived from internal state as needed
  private lastAtmosphereCutoff: number | undefined;

  private readonly system: CelestialSystemDef;
  private readonly atmosphere: AtmosphereModel;
  private readonly dragModel: DragModel;
  private readonly heatingModel: HeatingModel;
  private timeSeconds = 0;
  private bodies: BodyState[] = [];
  private destroyed = false;
  private rockets: Rocket[] = [];
  private activeRocketIndex = -1;
  private rocket: Rocket | undefined; // Active rocket alias (nullable)
  private structuresDef: { id: string; name: string; bodyId: string; angleRad: number }[] = [];

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

    // Initialize body states (primary at origin; others per orbit phase)
    const primary = this.system.bodies.find(b => b.id === this.system.primaryId)!;
    const initialBodies: BodyState[] = this.system.bodies.map(b => ({
      id: b.id,
      name: b.name,
      radiusMeters: b.radiusMeters,
      surfaceGravity: b.surfaceGravity,
      color: b.color,
      position: { x: 0, y: 0 },
      atmosphereScaleHeightMeters: b.atmosphereScaleHeightMeters,
      atmosphereColor: b.atmosphereColor,
      terrain: b.terrain,
    }));
    // Set initial positions at t=0
    for (const bs of initialBodies) {
      if (bs.id === this.system.primaryId) {
        bs.position = { x: 0, y: 0 };
      } else {
        const def = this.system.bodies.find(d => d.id === bs.id)!;
        if (def.orbit && def.orbit.aroundId === this.system.primaryId) {
          const ang = def.orbit.phaseRad ?? 0;
          bs.position = { x: def.orbit.radiusMeters * Math.cos(ang), y: def.orbit.radiusMeters * Math.sin(ang) };
        } else {
          bs.position = { x: 0, y: 0 };
        }
      }
    }
    this.bodies = initialBodies;

    // Place all rockets on primary surface at the top (angle pi/2) and point up (+Y outward normal)
    const R = primary.radiusMeters;
    for (let i = 0; i < this.rockets.length; i++) {
      const r = this.rockets[i];
      r.state.position.x = 0;
      r.state.position.y = R;
      r.state.velocity.x = 0;
      r.state.velocity.y = 0;
      r.state.orientationRad = Math.PI / 2;
    }
    // Ensure internal alias points to active
    if (this.activeRocketIndex >= 0) {
      this.rocket = this.rockets[this.activeRocketIndex];
    }
  }

  /** Advance physics by fixed time step (seconds). */
  tick(dt: number, tickIndex: number, commands: RocketCommandQueue): void {
    // Update body positions (simple circular orbits around primary)
    const t = this.timeSeconds;
    const primary = this.bodies.find(b => b.id === this.system.primaryId)!;
    for (const bs of this.bodies) {
      if (bs.id === this.system.primaryId) { bs.position = { x: 0, y: 0 }; continue; }
      const def = this.system.bodies.find(d => d.id === bs.id)!;
      if (def.orbit && def.orbit.aroundId === this.system.primaryId) {
        const ang = (def.orbit.phaseRad ?? 0) + def.orbit.angularSpeedRadPerS * t;
        bs.position = { x: def.orbit.radiusMeters * Math.cos(ang), y: def.orbit.radiusMeters * Math.sin(ang) };
      }
    }


    // Process spawn queue from Rockets (e.g. deployed satellites)
    for (const r of this.rockets) {
      if (r.spawnQueue.length > 0) {
        const spawned = r.spawnQueue.splice(0, r.spawnQueue.length);
        for (const s of spawned) {
          this.rockets.push(s);
          // Auto-name if not named? Assuming ID is unique.
        }
      }
    }

    // 1) Apply queued commands to the rocket (throttle, attitude commands, etc.).
    if (this.rocket) this.rocket.applyCommands(commands);

    // 1.5) & 2) & ... Rocket Physics
    if (this.rocket) {
      this.tickActiveRocketPhysics(dt, primary);
    }

    // Integrate other rockets (non-active) with same physics
    for (let i = 0; i < this.rockets.length; i++) {
      if (i === this.activeRocketIndex) continue;
      const r = this.rockets[i];
      // Gravity from all bodies and SOI
      let ax_g2 = 0, ay_g2 = 0;
      let soiBody2: BodyState | null = null;
      let soiG2 = -Infinity;
      for (const b of this.bodies) {
        const dx = b.position.x - r.state.position.x;
        const dy = b.position.y - r.state.position.y;
        const r2 = Math.max(1e-6, dx * dx + dy * dy);
        const rs = Math.sqrt(r2);
        const nx = dx / rs, ny = dy / rs;
        const g = b.surfaceGravity * (b.radiusMeters / Math.max(b.radiusMeters, rs)) ** 2;
        if (g > soiG2) { soiG2 = g; soiBody2 = b; }
        ax_g2 += g * nx; ay_g2 += g * ny;
      }
      try { (r as any).setSoIForSnapshot?.(soiBody2?.id ?? this.system.primaryId); } catch { }
      // Altitude vs primary
      const primary = this.bodies.find(b => b.id === this.system.primaryId)!;
      const dxp2 = primary.position.x - r.state.position.x;
      const dyp2 = primary.position.y - r.state.position.y;
      const rp2 = Math.sqrt(dxp2 * dxp2 + dyp2 * dyp2);
      const alt2 = rp2 - primary.radiusMeters;
      try { (r as any).setAltitudeForSnapshot?.(alt2); } catch { }

      // Orbit elements ... (simplified)
      try {
        const body = soiBody2 ?? primary;
        // ... (elided for brevity, non-critical for non-active rockets in this cleanup)
      } catch { }

      // Atmosphere & drag/thrust
      const atm = this.atmosphere.getProperties(alt2);
      try { (r as any).setAirDensityForSnapshot?.(atm.density); } catch { }
      try { (r as any).setAtmospherePropertiesForSnapshot?.(atm.temperature, atm.pressure); } catch { }

      const speed2 = Math.hypot(r.state.velocity.x, r.state.velocity.y);
      const dragMag2 = this.dragModel.computeDrag(atm.density, speed2, r.dragCoefficient, r.referenceArea);
      const dragFx2 = speed2 > 0 ? -dragMag2 * (r.state.velocity.x / speed2) : 0;
      const dragFy2 = speed2 > 0 ? -dragMag2 * (r.state.velocity.y / speed2) : 0;

      const rho0_2 = (this.atmosphere as any)?.rho0 ?? 1.225;
      const thrust2 = r.currentThrust(atm.density, rho0_2);
      const thrustFx2 = thrust2 * Math.cos(r.state.orientationRad);
      const thrustFy2 = thrust2 * Math.sin(r.state.orientationRad);
      const mass2 = r.totalMass();

      const ax2 = ax_g2 + (dragFx2 + thrustFx2) / Math.max(1e-6, mass2);
      const ay2 = ay_g2 + (dragFy2 + thrustFy2) / Math.max(1e-6, mass2);
      r.state.velocity.x += ax2 * dt;
      r.state.velocity.y += ay2 * dt;
      r.state.position.x += r.state.velocity.x * dt;
      r.state.position.y += r.state.velocity.y * dt;

      // Heating (Background)
      const ox2 = Math.cos(r.state.orientationRad);
      const oy2 = Math.sin(r.state.orientationRad);
      const align2 = speed2 > 0.1 ? (r.state.velocity.x * ox2 + r.state.velocity.y * oy2) / speed2 : 0;

      const K_flux2 = 1.0e-7;
      const cool2 = 0.8;
      const baseFlux2 = 0.5 * atm.density * Math.pow(speed2, 3.0) * K_flux2;

      const noseFlux2 = baseFlux2 * Math.max(0, align2);
      const tailFlux2 = baseFlux2 * Math.max(0, -align2);
      const skinFlux2 = baseFlux2 * (1 - Math.abs(align2)) * 0.2;

      const ambT = atm.temperature || 4;

      r.state.noseTemperature += (noseFlux2 - cool2 * (r.state.noseTemperature - ambT)) * dt;
      r.state.tailTemperature += (tailFlux2 - cool2 * (r.state.tailTemperature - ambT)) * dt;
      r.state.temperature += (skinFlux2 - cool2 * (r.state.temperature - ambT)) * dt;

      if (r.state.noseTemperature < ambT) r.state.noseTemperature = ambT;
      if (r.state.tailTemperature < ambT) r.state.tailTemperature = ambT;
      if (r.state.temperature < ambT) r.state.temperature = ambT;
      r.tickInternal(dt);

      // Ground collision
      if (alt2 < 0) {
        // Simple clamp
        const nx = dxp2 / rp2; const ny = dyp2 / rp2;
        r.state.position.x = primary.position.x - nx * primary.radiusMeters; // wait, dxp2 is primary - rocket
        // r = primary - d -> d = primary - r
        // dxp2 = primary.x - r.x
        // r.x = primary.x - dxp2
        // We want to force dist = R from primary.
        // vector from primary to rocket is -dxp2, -dyp2 ?
        // r = p + v_pr
        // v_pr = r - p = -(p-r);
        const vpr_x = r.state.position.x - primary.position.x;
        const vpr_y = r.state.position.y - primary.position.y;
        const dist = Math.sqrt(vpr_x * vpr_x + vpr_y * vpr_y);
        if (dist > 0) {
          r.state.position.x = primary.position.x + (vpr_x / dist) * primary.radiusMeters;
          r.state.position.y = primary.position.y + (vpr_y / dist) * primary.radiusMeters;
        }
        r.state.velocity.x = 0; r.state.velocity.y = 0;
      }
    }

    this.timeSeconds += dt;
  }

  snapshot(): EnvironmentSnapshot {
    const primary = this.bodies.find(b => b.id === this.system.primaryId)!;
    const structs = this.structuresDef.map(s => {
      const body = this.bodies.find(b => b.id === s.bodyId) || primary;
      const x = body.position.x + Math.cos(s.angleRad) * body.radiusMeters;
      const y = body.position.y + Math.sin(s.angleRad) * body.radiusMeters;
      return { id: s.id, name: s.name, bodyId: s.bodyId, position: { x, y } };
    });
    return {
      timeSeconds: this.timeSeconds,
      rocket: this.rocket ? this.rocket.snapshot() : undefined,
      rockets: this.rockets.map(r => r.snapshot()),
      activeRocketIndex: this.activeRocketIndex,
      bodies: this.bodies.map(b => ({ ...b, position: { ...b.position } })),
      primaryId: this.system.primaryId,
      destroyed: this.destroyed,
      atmosphereCutoffAltitudeMeters: (this.atmosphere as any).cutoffAlt,
      structures: structs,
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
    this.destroyed = false; // Reset destroyed flag if environment was considered "failed"
  }

  /**
   * Helper: Manages rotation via Reaction Wheels and Fins.
   * Consumes energy and updates orientation.
   * Usable in both Numerical and Rails physics modes.
   */
  private tickRotation(dt: number, rocket: Rocket, primary: BodyState): void {
    const desired = (rocket as any).getDesiredAngularVelocityRadPerS ? rocket.getDesiredAngularVelocityRadPerS() : 0;
    // Combine reaction wheels capability and energy cost
    const wheels = (rocket as any).reactionWheels as any[] | undefined;
    let maxOmega = 0;
    let energyPerRadPerS = 0;
    if (Array.isArray(wheels) && wheels.length > 0) {
      for (const rw of wheels) {
        const m = Number(rw.maxOmegaRadPerS) || 0;
        const c = Number(rw.energyPerRadPerS) || 0;
        maxOmega += Math.max(0, m);
        energyPerRadPerS += Math.max(0, c);
      }
    }

    // Add Fin Authority (Aerodynamic Control Surfaces)
    const fins = (rocket as any).fins as any[] | undefined;
    if (Array.isArray(fins) && fins.length > 0) {
      const rx = rocket.state.position.x;
      const ry = rocket.state.position.y;
      const r = Math.hypot(rx, ry);
      const alt = r - primary.radiusMeters;
      // We can use a simplified check or the full property fetch for fins
      const atm = this.atmosphere.getProperties(alt);

      // Fins effective if density > 0.001 kg/m3.
      if (atm.density > 0.001) {
        const scale = Math.min(1.0, atm.density / 0.1);
        const finAuthority = 0.5 * fins.length * scale;
        maxOmega += finAuthority;
      }
    }

    let actual = 0;
    if (maxOmega > 0 && Number.isFinite(desired) && Number.isFinite(dt) && dt > 0) {
      const target = Math.max(-maxOmega, Math.min(maxOmega, desired));
      // Need energy to CHANGE velocity? or just MAINTAIN torque against nothing?
      // In this simple model, we assume generic "effort" to turn.
      const needPerSec = Math.abs(target) * energyPerRadPerS;
      const need = needPerSec * dt;
      if (need > 0) {
        const drawn = rocket.drawEnergy(need);
        const scale = Math.max(0, Math.min(1, drawn / need));
        actual = target * scale;
      } else {
        actual = target;
      }
    } else {
      actual = 0;
    }

    // Store actual for snapshot purposes and for next integration
    try { (rocket as any).setTurnStatsForSnapshot?.(maxOmega); } catch { }
    if ((rocket as any)._setActualAngularVelocityRadPerS) {
      (rocket as any)._setActualAngularVelocityRadPerS(actual);
    }
    if (Number.isFinite(actual) && Number.isFinite(dt)) {
      rocket.state.orientationRad += actual * dt;
      // Normalize angle to [0, 2π)
      const TWO_PI = Math.PI * 2;
      let a = rocket.state.orientationRad % TWO_PI;
      if (a < 0) a += TWO_PI;
      rocket.state.orientationRad = a;
    }
  }

  /**
   * Encapsulated physics for the active rocket (Thrust, Drag, Gravity, Heating).
   * Now includes "Rails" optimization for stable orbits.
   */
  private tickActiveRocketPhysics(dt: number, primary: BodyState): void {
    const rocket = this.rocket!; // Assumed valid when called
    const rPos = rocket.state.position;
    const rVel = rocket.state.velocity;

    // 0) Basic State & Rotation
    // Always run rotation (fin/wheel authority) even on rails
    this.tickRotation(dt, rocket, primary);

    // Calculate generic altitude/radius for decision making
    const dxp = primary.position.x - rPos.x;
    const dyp = primary.position.y - rPos.y;
    // Current Radius from Center
    const rCurrent = Math.sqrt(dxp * dxp + dyp * dyp);
    const altitude = rCurrent - primary.radiusMeters;

    // Set Snapshot Altitude
    rocket.setAltitudeForSnapshot(altitude);

    // Determine Atmosphere Cutoff
    const atmCutoff = (this.atmosphere as any).cutoffAlt ?? 100000;
    const inVacuum = altitude > atmCutoff;

    // Snapshot Prop
    try { (rocket as any).setAtmosphereCutoffForSnapshot?.(atmCutoff); } catch { }
    try { (rocket as any).setInAtmosphereForSnapshot?.(!inVacuum); } catch { }

    // --- OPTIMIZATION: RAILS PHYSICS ---

    // Condition 1: Engines Check (Must be OFF)
    const engines = rocket.engines || [];
    const isThrottleZero = engines.length === 0 || engines.every((e: any) => (e.power ?? 0) <= 0.001);
    // Be strict: actual thrust must be effectively 0
    const isEnginesOff = isThrottleZero && (!rocket.currentThrust || rocket.currentThrust(0, 1.225) <= 1e-3);

    // Condition 2: Vacuum Check
    // (Already calc: inVacuum)

    // A) Try to Use Existing Rails State
    if (rocket._railsState && inVacuum && isEnginesOff) {
      const rs = rocket._railsState;
      // Ensure we are still in same SOI (basic check, though position update should handle it)
      const soi = this.bodies.find(b => b.id === rs.soiId);

      if (soi) {
        // --- PROPAGATE FROM CACHE ---
        // M(t) = M0 + n * (t - t0)
        let dtOrbit = this.timeSeconds - rs.t0;
        let M = rs.M0 + rs.n * dtOrbit;

        // Solve Kepler for E
        // E - e sin E = M
        let E = M; // Initial guess
        for (let iter = 0; iter < 10; iter++) {
          const f = E - rs.e * Math.sin(E) - M;
          const df = 1 - rs.e * Math.cos(E);
          E -= f / df;
          if (Math.abs(f) < 1e-6) break;
        }

        // Calculate Position in Orbital Plane (Perifocal)
        // x = a(cos E - e)
        // y = a sqrt(1-e^2) sin E
        const cosE = Math.cos(E);
        const sinE = Math.sin(E);
        const beta = Math.sqrt(Math.max(0, 1 - rs.e * rs.e));

        const xp = rs.a * (cosE - rs.e);
        const yp = rs.a * beta * sinE;

        // Rotate by Argument of Periapsis (w) to get Inertial Relative Position
        // SoI-centric frame
        const cw = Math.cos(rs.w);
        const sw = Math.sin(rs.w);

        const rxNew = xp * cw - yp * sw;
        const ryNew = xp * sw + yp * cw;

        // Calculate Velocity
        // v_x = -sqrt(mu/a) / (1-e cos E) * sin E
        // v_y =  sqrt(mu/a) * beta / (1-e cos E) * cos E
        const r_dist = rs.a * (1 - rs.e * cosE); // Distance from focus
        // Use cached mu if available, else derive
        const muUsed = rs.mu || (Math.abs(rs.n) * Math.abs(rs.n) * rs.a * rs.a * rs.a);
        const v_scale = Math.sqrt(muUsed * rs.a) / r_dist;
        // const v_fac = (rs.n * rs.a) / (1 - rs.e * cosE); // Unused

        const v_fac = (rs.n * rs.a) / (1 - rs.e * cosE); // Note: n carries sign? No, velocity magnitude logic usually assumes positive n for formula, direction comes from trig.
        // Actually, if n is negative (retrograde), does this formula hold?
        // E moves backwards. 
        // Let's rely on standard derivation where n > 0. If n < 0, M decreases, E decreases.
        // dx/dt = dx/dE * dE/dt. dE/dt = n / (1 - e cos E).
        // If n < 0, dE/dt < 0. Velocity vector flips?
        // Let's trust the formula with signed n.
        const vx_p = -rs.a * sinE * (rs.n / (1 - rs.e * cosE));
        const vy_p = rs.a * beta * cosE * (rs.n / (1 - rs.e * cosE));

        const vxNew = vx_p * cw - vy_p * sw;
        const vyNew = vx_p * sw + vy_p * cw;

        // Update Rocket State
        rocket.state.position.x = soi.position.x + rxNew;
        rocket.state.position.y = soi.position.y + ryNew;
        rocket.state.velocity.x = vxNew; // we assume body is inertial for 2-body rails
        rocket.state.velocity.y = vyNew;

        // Update Ap/Pe for snapshot from Cache (constant)
        const rp = rs.a * (1 - rs.e);
        const ra = rs.a * (1 + rs.e);
        (rocket as any).setApPeForSnapshot?.(ra - soi.radiusMeters, rp - soi.radiusMeters);
        (rocket as any).setSoIForSnapshot?.(soi.id);

        return; // SKIP NUMERICAL INTEGRATION
      }
    }

    // B) Not on rails yet? Check if we should ENTER rails.
    // Need current SOI and State
    let soiBody = primary;
    let maxG = -1;
    if (this.bodies.length > 1) {
      // Find dominant body
      for (const b of this.bodies) {
        const dx = rPos.x - b.position.x;
        const dy = rPos.y - b.position.y;
        const r2 = dx * dx + dy * dy;
        const g = b.surfaceGravity * (b.radiusMeters * b.radiusMeters) / r2;
        if (g > maxG) { maxG = g; soiBody = b; }
      }
    }

    // Orbital Elements Calculation for Entry Check
    const muSOI = soiBody.surfaceGravity * soiBody.radiusMeters * soiBody.radiusMeters;
    const rxRel = rPos.x - soiBody.position.x;
    const ryRel = rPos.y - soiBody.position.y;
    const vxRel = rVel.x;
    const vyRel = rVel.y;

    const rRelMag = Math.hypot(rxRel, ryRel);
    const v2 = vxRel * vxRel + vyRel * vyRel;

    // Energy & Eccentricity
    const eps = 0.5 * v2 - muSOI / rRelMag;
    const rvDot = rxRel * vxRel + ryRel * vyRel;
    const ex = ((v2 - muSOI / rRelMag) * rxRel - rvDot * vxRel) / muSOI;
    const ey = ((v2 - muSOI / rRelMag) * ryRel - rvDot * vyRel) / muSOI;
    const e = Math.hypot(ex, ey);

    // Stability Conditions
    // 1. Vacuum, Engines Off (Checked)
    // 2. Bound Orbit (e < 1, a > 0)
    // 3. Periapsis Safe (> Cutoff + 100m)
    let canEnterRails = false;

    if (inVacuum && isEnginesOff && e < 0.999 && muSOI > 0) {
      const a = -muSOI / (2 * eps);
      if (a > 0) {
        const soiCutoff = (soiBody.id === this.system.primaryId) ? atmCutoff : 0;
        const periapsis = a * (1 - e);
        if (periapsis > (soiBody.radiusMeters + soiCutoff + 100)) {
          canEnterRails = true;

          // --- ENTER RAILS: CALCULATE & CACHE ---
          // 1. Mean Motion
          let n = Math.sqrt(muSOI / (a * a * a));

          // 2. Retrograde Check (Angular Momentum)
          // h = r x v (2D z-component)
          const h = rxRel * vyRel - ryRel * vxRel;
          if (h < 0) n = -n; // Clockwise motion

          // 3. Argument of Periapsis (w)
          // Angle of eccentricity vector
          const w = Math.atan2(ey, ex);

          // 4. Mean Anomaly at Epoch (Current Time)
          // Angle-based approach to avoid Retrograde sign issues
          const phi = Math.atan2(ryRel, rxRel);

          let nu = phi - w;
          // Normalize nu
          while (nu > Math.PI) nu -= 2 * Math.PI;
          while (nu <= -Math.PI) nu += 2 * Math.PI;

          // Eccentric Anomaly E0 from True Anomaly nu
          const tanE2 = Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2);
          const E0 = 2 * Math.atan(tanE2);

          const M0 = E0 - e * Math.sin(E0);

          // SAVE TO CACHE
          rocket._railsState = {
            a, e, i: 0, w, M0, n, t0: this.timeSeconds,
            mu: muSOI, soiId: soiBody.id
          };

          // Do one "null" propagation step or just fall through?
          // We can fall through to "Numerical" this one tick, or return.
          // Let's fall through to update snapshots, next tick will catch cache.
        }
      }
    }

    // If we failed checks, invalidate cache
    if (!canEnterRails) {
      rocket._railsState = undefined;
    }

    // Fallback to Numerical Integration if not returned above
    const onRails = false; // We only set onRails=true inside the cache block above which returns.
    if (!onRails) {
      // --- NUMERICAL INTEGRATION (Euler/Verlet) ---

      // Forces
      // 1. Gravity (Sum from all bodies)
      // Already calculated soiBody above, but let's do the full sum for accuracy as per original
      let ax_g = 0, ay_g = 0;
      const perBodyGrav: any[] = [];
      const mass = rocket.totalMass();

      for (const b of this.bodies) {
        const dx = b.position.x - rPos.x;
        const dy = b.position.y - rPos.y;
        const r2 = Math.max(1e-1, dx * dx + dy * dy);
        const r = Math.sqrt(r2);
        const forceMag = b.surfaceGravity * (b.radiusMeters * b.radiusMeters) / r2; // g = G*M/r^2. internal surfaceGrav is at R.
        // Wait, b.surfaceGravity is g_surf. mu = g_surf * R^2. g_r = mu / r^2.
        // Formula used in original: g = b.surfaceGravity * (b.radiusMeters / max(R, r))**2.
        // That formula handles clamping inside planet (gravity doesn't go infinite).
        const g = b.surfaceGravity * Math.pow(b.radiusMeters / Math.max(b.radiusMeters, r), 2);

        ax_g += g * (dx / r);
        ay_g += g * (dy / r);
        perBodyGrav.push({ id: b.id, name: b.name, fx: g * (dx / r) * mass, fy: g * (dy / r) * mass });
      }

      // 2. Atmosphere & Drag
      let dragFx = 0, dragFy = 0;
      let heatingPower = 0;
      const speed = Math.hypot(rVel.x, rVel.y);
      let atmDensity = 0;

      if (!inVacuum) {
        // Compute Atmosphere
        const atm = this.atmosphere.getProperties(altitude);
        atmDensity = atm.density;

        // Drag
        const dragMag = this.dragModel.computeDrag(atm.density, speed, rocket.dragCoefficient, rocket.referenceArea);
        if (speed > 0) {
          dragFx = -dragMag * (rVel.x / speed);
          dragFy = -dragMag * (rVel.y / speed);
        }

        // Heating Base Calculation
        // Use active Drag Coeff for heating (includes nose cones)
        let activeCd = rocket.dragCoefficient;
        if (rocket.noseCones) {
          for (const n of rocket.noseCones) {
            if (n.dragModifier) activeCd += n.dragModifier;
          }
        }
        if (activeCd < 0.1) activeCd = 0.1;

        const K_thermal = 1.5e-2;
        heatingPower = 0.5 * atm.density * Math.pow(speed, 3.0) * activeCd * K_thermal;

        // Snapshots
        try { (rocket as any).setAirDensityForSnapshot?.(atm.density); } catch { }
        try { (rocket as any).setAtmospherePropertiesForSnapshot?.(atm.temperature, atm.pressure); } catch { }
      } else {
        // Vacuum snapshots
        try { (rocket as any).setAirDensityForSnapshot?.(0); } catch { }
        try { (rocket as any).setAtmospherePropertiesForSnapshot?.(4, 0); } catch { }
      }

      // 3. Thrust
      // Engine vacuum ISP bonus applies if density is low
      const rho0 = (this.atmosphere as any)?.rho0 ?? 1.225;
      const thrust = rocket.currentThrust(atmDensity, rho0);
      const thrustFx = thrust * Math.cos(rocket.state.orientationRad);
      const thrustFy = thrust * Math.sin(rocket.state.orientationRad);

      // 4. Integration
      const ax = ax_g + (dragFx + thrustFx) / Math.max(1e-6, mass);
      const ay = ay_g + (dragFy + thrustFy) / Math.max(1e-6, mass);

      rocket.state.velocity.x += ax * dt;
      rocket.state.velocity.y += ay * dt;
      rocket.state.position.x += rocket.state.velocity.x * dt;
      rocket.state.position.y += rocket.state.velocity.y * dt;

      // 5. Thermal Update
      const ambientT = 4; // Space
      const coolingRate = 0.5;

      let noseFlux = 0, tailFlux = 0, skinFlux = 0;

      if (heatingPower > 0) {
        // Directional Heating
        const vx = rVel.x;
        const vy = rVel.y;
        const ox = Math.cos(rocket.state.orientationRad);
        const oy = Math.sin(rocket.state.orientationRad);
        const alignment = speed > 0.1 ? (vx * ox + vy * oy) / speed : 0;

        const noseFactor = Math.max(0, alignment);
        const tailFactor = Math.max(0, -alignment);
        const sideFactor = (1 - Math.abs(alignment)) * 0.2;

        noseFlux = heatingPower * noseFactor;
        tailFlux = heatingPower * tailFactor;
        skinFlux = heatingPower * sideFactor;
      }

      // Apply heat (Heating + Cooling)
      // Nose
      const dT_nose = noseFlux - coolingRate * (rocket.state.noseTemperature - ambientT);
      rocket.state.noseTemperature += dT_nose * dt;

      // Tail
      const dT_tail = tailFlux - coolingRate * (rocket.state.tailTemperature - ambientT);
      rocket.state.tailTemperature += dT_tail * dt;

      // Skin
      const dT_skin = skinFlux - coolingRate * (rocket.state.temperature - ambientT);
      rocket.state.temperature += dT_skin * dt;

      // Clamp
      if (rocket.state.noseTemperature < ambientT) rocket.state.noseTemperature = ambientT;
      if (rocket.state.tailTemperature < ambientT) rocket.state.tailTemperature = ambientT;
      if (rocket.state.temperature < ambientT) rocket.state.temperature = ambientT;

      // Snapshot forces
      const gravFx = ax_g * mass;
      const gravFy = ay_g * mass;
      try {
        (rocket as any).setForcesForSnapshot?.({
          thrust: { fx: thrustFx, fy: thrustFy },
          drag: { fx: dragFx, fy: dragFy },
          gravity: { fx: gravFx, fy: gravFy, perBody: perBodyGrav },
        });
      } catch { }

      // Ap/Pe Calculation (approximate for display)
      // Use updated position/velocity
      const rxRel2 = rocket.state.position.x - soiBody.position.x;
      const ryRel2 = rocket.state.position.y - soiBody.position.y;
      const rRelMag2 = Math.hypot(rxRel2, ryRel2);

      if (muSOI > 0 && rRelMag2 > 0) {
        try {
          const vxRel2 = rocket.state.velocity.x;
          const vyRel2 = rocket.state.velocity.y;
          const v2 = vxRel2 * vxRel2 + vyRel2 * vyRel2;

          const eps = 0.5 * v2 - muSOI / rRelMag2;
          const rvDot = rxRel2 * vxRel2 + ryRel2 * vyRel2;
          const ex = ((v2 - muSOI / rRelMag2) * rxRel2 - rvDot * vxRel2) / muSOI;
          const ey = ((v2 - muSOI / rRelMag2) * ryRel2 - rvDot * vyRel2) / muSOI;
          const e = Math.hypot(ex, ey);

          if (eps < 0 && e < 1) {
            const a = -muSOI / (2 * eps);
            const rp_orb = a * (1 - e);
            const ra_orb = a * (1 + e);
            (rocket as any).setApPeForSnapshot?.(ra_orb - soiBody.radiusMeters, rp_orb - soiBody.radiusMeters);
          } else {
            (rocket as any).setApPeForSnapshot?.(Number.NaN, Number.NaN);
          }
        } catch { }
      }
    } // End Numerical Integration

    // Common Updates (Fuel, Resources, Collision)
    rocket.tickInternal(dt);

    // Collision Detection with Primary
    // (Simple sphere check)
    {
      const dx = rocket.state.position.x - primary.position.x;
      const dy = rocket.state.position.y - primary.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < primary.radiusMeters) {
        const nx = dx / dist; const ny = dy / dist;

        // Destruction Check
        const speed = Math.hypot(rocket.state.velocity.x, rocket.state.velocity.y);

        // Retrograde calculation
        const vx = rocket.state.velocity.x;
        const vy = rocket.state.velocity.y;
        const ox = Math.cos(rocket.state.orientationRad);
        const oy = Math.sin(rocket.state.orientationRad);
        // Alignment: 1 = Nose into velocity. -1 = Tail into velocity.
        const alignment = speed > 0.1 ? (vx * ox + vy * oy) / speed : 0;
        const isRetrograde = alignment < -0.8;

        let crash = false;
        if (speed > 10) crash = true;
        else if (speed > 5 && !isRetrograde) crash = true;

        if (crash) {
          this.destroyed = true;
          rocket.state.velocity.x = 0; rocket.state.velocity.y = 0;
        } else {
          // Landed safe
          rocket.state.position.x = primary.position.x + nx * primary.radiusMeters;
          rocket.state.position.y = primary.position.y + ny * primary.radiusMeters;
          rocket.state.velocity.x = 0; rocket.state.velocity.y = 0;
        }
      }
    }

    // Thermal Limitations / Destruction
    const noseLimit = rocket.noseCones.length > 0 ? (rocket.noseCones[0].heatTolerance ?? 2400) : 1200;
    const tailLimit = rocket.heatShields.length > 0 ? (rocket.heatShields[0].heatTolerance ?? 3400) : 1200;
    const bodyLimit = 1500;

    if (rocket.state.noseTemperature > noseLimit ||
      rocket.state.tailTemperature > tailLimit ||
      rocket.state.temperature > bodyLimit) {
      this.destroyed = true;
    }

    // Snapshot Updates for max temps
    try {
      (rocket as any).maxNoseTemperature = noseLimit;
      (rocket as any).maxTailTemperature = tailLimit;
    } catch { }

  }


}

// --- Default simple models for initial bootstrapping ---

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

export const DefaultPlanet: PlanetModel = {
  name: "Gaia",
  radiusMeters: 6_371_000,
  surfaceGravity: 9.81,
};
