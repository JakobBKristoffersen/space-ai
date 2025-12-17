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

      // Heating
      const heatRate2 = this.heatingModel.heatingRate(atm.density, speed2);
      r.state.temperature += heatRate2 * dt;
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

  /** Encapsulated physics for the active rocket (thrust, reaction wheels, etc.). */
  private tickActiveRocketPhysics(dt: number, primary: BodyState): void {
    const rocket = this.rocket!; // Assumed valid when called

    // 1.5) Determine actual angular velocity from reaction wheels and available battery, then integrate orientation.
    {
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
        const r = Math.hypot(rocket.state.position.x, rocket.state.position.y);
        const alt = r - primary.radiusMeters;
        const atm = this.atmosphere.getProperties(alt); // Use props

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
        const needPerSec = Math.abs(target) * energyPerRadPerS; // J/s needed to sustain target
        const need = needPerSec * dt; // J this tick
        if (need > 0) {
          const drawn = rocket.drawEnergy(need);
          const scale = Math.max(0, Math.min(1, drawn / need));
          actual = target * scale;
        } else {
          actual = 0;
        }
      } else {
        actual = 0; // no wheels or zero capability -> no turning
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

    // 2) Compute gravity vector from all bodies using inverse-square falloff from surface gravity.
    const rx = rocket.state.position.x;
    const ry = rocket.state.position.y;
    let ax_g = 0, ay_g = 0;
    const perBodyGrav: { id: string; name: string; fx: number; fy: number }[] = [];
    // Track body with strongest gravitational acceleration (SOI approximation)
    let soiBody: BodyState | null = null;
    let soiG = -Infinity;
    for (const b of this.bodies) {
      const dx = b.position.x - rx;
      const dy = b.position.y - ry;
      const r2 = dx * dx + dy * dy;
      const r = Math.max(1e-3, Math.sqrt(r2));
      const nx = dx / r, ny = dy / r;
      const g = b.surfaceGravity * (b.radiusMeters / Math.max(b.radiusMeters, r)) ** 2; // clamp inside
      if (g > soiG) { soiG = g; soiBody = b; }
      ax_g += g * nx;
      ay_g += g * ny;
      perBodyGrav.push({ id: b.id, name: b.name, fx: g * nx, fy: g * ny });
    }
    // Persist per-rocket SOI id for snapshot consumers
    try { (rocket as any).setSoIForSnapshot?.(soiBody?.id ?? this.system.primaryId); } catch { }

    // Altitude over primary
    const dxp = primary.position.x - rx;
    const dyp = primary.position.y - ry;
    const rp = Math.sqrt(dxp * dxp + dyp * dyp);
    const altitude = rp - primary.radiusMeters;
    rocket.setAltitudeForSnapshot(altitude);

    // 2.5) Orbital analysis relative to strongest-gravity (SOI) body
    try {
      const body = soiBody ?? primary;
      const rxRel = rx - body.position.x;
      const ryRel = ry - body.position.y;
      const vxRel = rocket.state.velocity.x;
      const vyRel = rocket.state.velocity.y;
      const r = Math.hypot(rxRel, ryRel);
      const v2 = vxRel * vxRel + vyRel * vyRel;
      const mu = body.surfaceGravity * body.radiusMeters * body.radiusMeters;
      if (mu > 0 && r > 0) {
        const eps = 0.5 * v2 - mu / r;
        const rv = rxRel * vxRel + ryRel * vyRel;
        const ex = ((v2 - mu / r) * rxRel - rv * vxRel) / mu;
        const ey = ((v2 - mu / r) * ryRel - rv * vyRel) / mu;
        const e = Math.hypot(ex, ey);
        if (eps < 0 && e < 1) {
          const a = -mu / (2 * eps);
          const rp_orb = a * (1 - e);
          const ra_orb = a * (1 + e);
          const peAlt = rp_orb - body.radiusMeters;
          const apAlt = ra_orb - body.radiusMeters;
          (rocket as any).setApPeForSnapshot?.(apAlt, peAlt);
        } else {
          (rocket as any).setApPeForSnapshot?.(Number.NaN, Number.NaN);
        }
      }
    } catch {
      // ignore
    }

    // 3) Atmospheric properties
    const atm = this.atmosphere.getProperties(altitude);

    // Expose properties to rocket snapshot for scripts/UI
    try { (rocket as any).setAirDensityForSnapshot?.(atm.density); } catch { }
    try { (rocket as any).setAtmospherePropertiesForSnapshot?.(atm.temperature, atm.pressure); } catch { }
    try { (rocket as any).setAtmosphereCutoffForSnapshot?.((this.atmosphere as any).cutoffAlt); } catch { }

    // Determine cutoff and in-atmosphere flag
    try { (rocket as any).setInAtmosphereForSnapshot?.(((atm.density ?? 0) > 0)); } catch { }

    // 4) Drag force magnitude
    const speed = Math.hypot(rocket.state.velocity.x, rocket.state.velocity.y);
    const dragMag = this.dragModel.computeDrag(atm.density, speed, rocket.dragCoefficient, rocket.referenceArea);

    // Direction of drag opposes velocity.
    const dragFx = speed > 0 ? -dragMag * (rocket.state.velocity.x / speed) : 0;
    const dragFy = speed > 0 ? -dragMag * (rocket.state.velocity.y / speed) : 0;

    // 5) Thrust from engines (each engine applies its own vacuum bonus based on air density).
    const rho0 = (this.atmosphere as any)?.rho0 ?? 1.225;
    const thrust = rocket.currentThrust(atm.density, rho0);
    const thrustFx = thrust * Math.cos(rocket.state.orientationRad);
    const thrustFy = thrust * Math.sin(rocket.state.orientationRad);

    // 6) Sum accelerations: gravity, drag, thrust/mass
    const mass = rocket.totalMass();
    // Build forces (Newtons) for UI: thrust, drag, gravity (total + per-body)
    const gravFx = mass * ax_g;
    const gravFy = mass * ay_g;
    const perBodyForces = perBodyGrav.map(g => ({ id: g.id, name: g.name, fx: g.fx * mass, fy: g.fy * mass }));
    try {
      (rocket as any).setForcesForSnapshot?.({
        thrust: { fx: thrustFx, fy: thrustFy },
        drag: { fx: dragFx, fy: dragFy },
        gravity: { fx: gravFx, fy: gravFy, perBody: perBodyForces },
      });
    } catch { }

    const ax = ax_g + (dragFx + thrustFx) / Math.max(1e-6, mass);
    const ay = ay_g + (dragFy + thrustFy) / Math.max(1e-6, mass);

    // 7) Integrate acceleration -> velocity -> position (semi-implicit Euler).
    rocket.state.velocity.x += ax * dt;
    rocket.state.velocity.y += ay * dt;
    rocket.state.position.x += rocket.state.velocity.x * dt;
    rocket.state.position.y += rocket.state.velocity.y * dt;

    // 7.5) Determine Terrain
    const primaryBodyForTerrain = this.bodies.find(b => b.id === this.system.primaryId);
    if (primaryBodyForTerrain && primaryBodyForTerrain.terrain) {
      // Angle from center of primary to rocket
      const dx = rocket.state.position.x - primaryBodyForTerrain.position.x;
      const dy = rocket.state.position.y - primaryBodyForTerrain.position.y;
      let angle = Math.atan2(dy, dx); // -PI to PI
      if (angle < 0) angle += Math.PI * 2; // 0 to 2PI

      const segment = primaryBodyForTerrain.terrain.find(t => angle >= t.startRad && angle < t.endRad);
      rocket.currentTerrain = segment?.type;
    }

    // 8) Heating.
    const heatRate = this.heatingModel.heatingRate(atm.density, speed);
    rocket.state.temperature += heatRate * dt;

    // 9) Rocket internal updates (fuel usage, mass changes, energy/battery).
    rocket.tickInternal(dt);

    // 10) Spherical ground collision with primary; destroy on hard impact, otherwise stop.
    const dxpc = rocket.state.position.x - primary.position.x;
    const dypc = rocket.state.position.y - primary.position.y;
    const rnow = Math.sqrt(dxpc * dxpc + dypc * dypc);
    if (rnow < primary.radiusMeters) {
      const nx = dxpc / Math.max(1e-6, rnow);
      const ny = dypc / Math.max(1e-6, rnow);
      // impact speed (component along normal inward)
      const v = Math.hypot(rocket.state.velocity.x, rocket.state.velocity.y);
      const impactSpeed = v; // simple
      if (impactSpeed > 25) {
        this.destroyed = true;
      }
      // place on surface
      rocket.state.position.x = primary.position.x + nx * primary.radiusMeters;
      rocket.state.position.y = primary.position.y + ny * primary.radiusMeters;
      // stop
      rocket.state.velocity.x = 0;
      rocket.state.velocity.y = 0;
    }
  }

  /** Simple gravity model kept for reference (unused now). */
  private computeGravityLegacy(altitudeMeters: number, planetRadius: number, g0: number): number {
    const factor = (planetRadius / Math.max(1, planetRadius + altitudeMeters)) ** 2;
    return g0 * factor;
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
