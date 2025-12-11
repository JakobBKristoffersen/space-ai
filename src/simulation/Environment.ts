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

// Celestial bodies model (toy-friendly). Uses surfaceGravity instead of mass to avoid G.
export interface CelestialBodyDef {
  id: string;
  name: string;
  radiusMeters: number;
  surfaceGravity: number; // acceleration at surface
  color?: string;
  atmosphereScaleHeightMeters?: number; // optional, for primary only
  atmosphereColor?: string;
  /** Simple circular orbit around a target body id. If omitted, body is static. */
  orbit?: {
    aroundId: string;
    radiusMeters: number;
    angularSpeedRadPerS: number;
    phaseRad?: number;
  };
}

export interface CelestialSystemDef {
  primaryId: string;
  bodies: CelestialBodyDef[];
}

export interface AtmosphereModel {
  /**
   * Returns air density (kg/m^3) at the given altitude (meters above sea level).
   */
  densityAt(altitudeMeters: number): number;
}

/**
 * Barometric-like atmosphere with exponential falloff and hard cutoff altitude.
 * rho(h) = rho0 * exp(-h/H) for 0 <= h < H*cutoffFactor; else 0.
 */
export class AtmosphereWithCutoff implements AtmosphereModel {
  readonly rho0: number;
  readonly scaleHeightMeters: number;
  readonly cutoffFactor: number;
  /** Altitude above sea level where density clamps to zero. */
  readonly cutoffAltitudeMeters: number;
  constructor(opts: { rho0?: number; scaleHeightMeters: number; cutoffFactor?: number }) {
    this.rho0 = opts.rho0 ?? 1.225; // kg/m^3 at sea level
    this.scaleHeightMeters = Math.max(1, opts.scaleHeightMeters);
    this.cutoffFactor = Math.max(1, opts.cutoffFactor ?? 7);
    this.cutoffAltitudeMeters = this.scaleHeightMeters * this.cutoffFactor;
  }
  densityAt(alt: number): number {
    if (alt <= 0) return this.rho0;
    if (alt >= this.cutoffAltitudeMeters) return 0;
    return this.rho0 * Math.exp(-alt / this.scaleHeightMeters);
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
}

export interface EnvironmentSnapshot {
  timeSeconds: number;
  /** Active rocket snapshot (back-compat). */
  rocket: RocketSnapshot;
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
  private lastAirDensity: number | undefined;
  private lastAtmosphereCutoff: number | undefined;
  private lastInAtmosphere: boolean | undefined;
  private lastSoIBodyId: string | undefined;
  private readonly system: CelestialSystemDef;
  private readonly atmosphere: AtmosphereModel;
  private readonly dragModel: DragModel;
  private readonly heatingModel: HeatingModel;
  private timeSeconds = 0;
  private bodies: BodyState[] = [];
  private destroyed = false;
  private rockets: Rocket[] = [];
  private activeRocketIndex = 0;
  private structuresDef: { id: string; name: string; bodyId: string; angleRad: number }[] = [];

  constructor(private rocket: Rocket, opts: EnvironmentOptions) {
    this.system = opts.system;
    this.atmosphere = opts.atmosphere;
    this.dragModel = opts.drag;
    this.heatingModel = opts.heating;

    // Rockets management
    this.rockets = [this.rocket, ...(opts.rockets ?? [])];
    this.activeRocketIndex = Math.max(0, Math.min(opts.activeRocketIndex ?? 0, this.rockets.length - 1));
    this.rocket = this.rockets[this.activeRocketIndex];
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
    this.rocket = this.rockets[this.activeRocketIndex];
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
    this.rocket.applyCommands(commands);

    // 1.5) Determine actual angular velocity from reaction wheels and available battery, then integrate orientation.
    {
      const desired = (this.rocket as any).getDesiredAngularVelocityRadPerS ? this.rocket.getDesiredAngularVelocityRadPerS() : 0;
      // Combine reaction wheels capability and energy cost
      const wheels = (this.rocket as any).reactionWheels as any[] | undefined;
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
      let actual = 0;
      if (maxOmega > 0 && Number.isFinite(desired) && Number.isFinite(dt) && dt > 0) {
        const target = Math.max(-maxOmega, Math.min(maxOmega, desired));
        const needPerSec = Math.abs(target) * energyPerRadPerS; // J/s needed to sustain target
        const need = needPerSec * dt; // J this tick
        if (need > 0) {
          const drawn = this.rocket.drawEnergy(need);
          const scale = Math.max(0, Math.min(1, drawn / need));
          actual = target * scale;
        } else {
          actual = 0;
        }
      } else {
        actual = 0; // no wheels or zero capability -> no turning
      }
      // Store actual for snapshot purposes and for next integration
      if ((this.rocket as any)._setActualAngularVelocityRadPerS) {
        (this.rocket as any)._setActualAngularVelocityRadPerS(actual);
      }
      if (Number.isFinite(actual) && Number.isFinite(dt)) {
        this.rocket.state.orientationRad += actual * dt;
        // Normalize angle to [0, 2π)
        const TWO_PI = Math.PI * 2;
        let a = this.rocket.state.orientationRad % TWO_PI;
        if (a < 0) a += TWO_PI;
        this.rocket.state.orientationRad = a;
      }
    }

    // 2) Compute gravity vector from all bodies using inverse-square falloff from surface gravity.
    const rx = this.rocket.state.position.x;
    const ry = this.rocket.state.position.y;
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
      // Per-body gravity force (Newtons) = mass * acceleration contribution
      // We will compute mass shortly (after thrust/drag), so temporarily push components scaled by 1; adjusted later
      // Here we store using current mass approximation later below
      // We'll push placeholder; will fill after mass known
      perBodyGrav.push({ id: b.id, name: b.name, fx: g * nx, fy: g * ny });
    }
    // Persist per-rocket SOI id for snapshot consumers
    try { (this.rocket as any).setSoIForSnapshot?.(soiBody?.id ?? this.system.primaryId); } catch { }

    // Altitude over primary
    const dxp = primary.position.x - rx;
    const dyp = primary.position.y - ry;
    const rp = Math.sqrt(dxp * dxp + dyp * dyp);
    const altitude = rp - primary.radiusMeters;
    this.rocket.setAltitudeForSnapshot(altitude);

    // 2.5) Orbital analysis relative to strongest-gravity (SOI) body to expose Ap/Pe (ellipse only)
    try {
      const body = soiBody ?? primary;
      const rxRel = rx - body.position.x;
      const ryRel = ry - body.position.y;
      const vxRel = this.rocket.state.velocity.x;
      const vyRel = this.rocket.state.velocity.y;
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
          (this.rocket as any).setApPeForSnapshot?.(apAlt, peAlt);
        } else {
          (this.rocket as any).setApPeForSnapshot?.(Number.NaN, Number.NaN);
        }
      }
    } catch {
      // ignore
    }

    // 3) Atmospheric density on primary only
    const rho = this.atmosphere.densityAt(altitude);
    // Expose air density to rocket snapshot for scripts/UI
    try { (this.rocket as any).setAirDensityForSnapshot?.(rho); } catch { }
    // Determine cutoff altitude and in-atmosphere flag (if model supports it)
    const cutoffAlt = (this.atmosphere as any)?.cutoffAltitudeMeters ?? undefined;
    this.lastAtmosphereCutoff = cutoffAlt;
    try { (this.rocket as any).setInAtmosphereForSnapshot?.(((rho ?? 0) > 0)); } catch { }

    // 4) Drag force magnitude using simple quadratic drag.
    const speed = Math.hypot(this.rocket.state.velocity.x, this.rocket.state.velocity.y);
    const dragMag = this.dragModel.computeDrag(rho, speed, this.rocket.dragCoefficient, this.rocket.referenceArea);

    // Direction of drag opposes velocity.
    const dragFx = speed > 0 ? -dragMag * (this.rocket.state.velocity.x / speed) : 0;
    const dragFy = speed > 0 ? -dragMag * (this.rocket.state.velocity.y / speed) : 0;

    // 5) Thrust from engines (each engine applies its own vacuum bonus based on air density).
    const rho0 = (this.atmosphere as any)?.rho0 ?? 1.225;
    const thrust = this.rocket.currentThrust(rho, rho0);
    const thrustFx = thrust * Math.cos(this.rocket.state.orientationRad);
    const thrustFy = thrust * Math.sin(this.rocket.state.orientationRad);

    // 6) Sum accelerations: gravity, drag, thrust/mass
    const mass = this.rocket.totalMass();
    // Build forces (Newtons) for UI: thrust, drag, gravity (total + per-body)
    const gravFx = mass * ax_g;
    const gravFy = mass * ay_g;
    const perBodyForces = perBodyGrav.map(g => ({ id: g.id, name: g.name, fx: g.fx * mass, fy: g.fy * mass }));
    try {
      (this.rocket as any).setForcesForSnapshot?.({
        thrust: { fx: thrustFx, fy: thrustFy },
        drag: { fx: dragFx, fy: dragFy },
        gravity: { fx: gravFx, fy: gravFy, perBody: perBodyForces },
      });
    } catch { }

    const ax = ax_g + (dragFx + thrustFx) / Math.max(1e-6, mass);
    const ay = ay_g + (dragFy + thrustFy) / Math.max(1e-6, mass);

    // 7) Integrate acceleration -> velocity -> position (semi-implicit Euler).
    this.rocket.state.velocity.x += ax * dt;
    this.rocket.state.velocity.y += ay * dt;
    this.rocket.state.position.x += this.rocket.state.velocity.x * dt;
    this.rocket.state.position.y += this.rocket.state.velocity.y * dt;

    // 8) Heating.
    const heatRate = this.heatingModel.heatingRate(rho, speed);
    this.rocket.state.temperature += heatRate * dt;

    // 9) Rocket internal updates (fuel usage, mass changes, energy/battery).
    this.rocket.tickInternal(dt);

    // 10) Spherical ground collision with primary; destroy on hard impact, otherwise stop.
    const dxpc = this.rocket.state.position.x - primary.position.x;
    const dypc = this.rocket.state.position.y - primary.position.y;
    const rnow = Math.sqrt(dxpc * dxpc + dypc * dypc);
    if (rnow < primary.radiusMeters) {
      const nx = dxpc / Math.max(1e-6, rnow);
      const ny = dypc / Math.max(1e-6, rnow);
      // impact speed (component along normal inward)
      const v = Math.hypot(this.rocket.state.velocity.x, this.rocket.state.velocity.y);
      const impactSpeed = v; // simple
      if (impactSpeed > 25) {
        this.destroyed = true;
      }
      // place on surface
      this.rocket.state.position.x = primary.position.x + nx * primary.radiusMeters;
      this.rocket.state.position.y = primary.position.y + ny * primary.radiusMeters;
      // stop
      this.rocket.state.velocity.x = 0;
      this.rocket.state.velocity.y = 0;
    }

    // Integrate other rockets (non-active) with same physics; no command queue
    for (let i = 0; i < this.rockets.length; i++) {
      if (i === this.activeRocketIndex) continue;
      const r = this.rockets[i];
      // Gravity from all bodies and SOI
      let ax_g2 = 0, ay_g2 = 0;
      let soiBody2: BodyState | null = null;
      let soiG2 = -Infinity;
      const perBodyGrav2: { id: string; name: string; fx: number; fy: number }[] = [];
      for (const b of this.bodies) {
        const dx = b.position.x - r.state.position.x;
        const dy = b.position.y - r.state.position.y;
        const r2 = Math.max(1e-6, dx * dx + dy * dy);
        const rs = Math.sqrt(r2);
        const nx = dx / rs, ny = dy / rs;
        const g = b.surfaceGravity * (b.radiusMeters / Math.max(b.radiusMeters, rs)) ** 2;
        if (g > soiG2) { soiG2 = g; soiBody2 = b; }
        ax_g2 += g * nx; ay_g2 += g * ny;
        perBodyGrav2.push({ id: b.id, name: b.name, fx: g * nx, fy: g * ny });
      }
      try { (r as any).setSoIForSnapshot?.(soiBody2?.id ?? this.system.primaryId); } catch { }
      // Altitude vs primary
      const primary = this.bodies.find(b => b.id === this.system.primaryId)!;
      const dxp2 = primary.position.x - r.state.position.x;
      const dyp2 = primary.position.y - r.state.position.y;
      const rp2 = Math.sqrt(dxp2 * dxp2 + dyp2 * dyp2);
      const alt2 = rp2 - primary.radiusMeters;
      try { (r as any).setAltitudeForSnapshot?.(alt2); } catch { }
      // Orbit elements for UI (relative to SOI body)
      try {
        const body = soiBody2 ?? primary;
        const rxRel = r.state.position.x - body.position.x;
        const ryRel = r.state.position.y - body.position.y;
        const vxRel = r.state.velocity.x;
        const vyRel = r.state.velocity.y;
        const rmag = Math.hypot(rxRel, ryRel);
        const v2 = vxRel * vxRel + vyRel * vyRel;
        const mu = body.surfaceGravity * body.radiusMeters * body.radiusMeters;
        if (mu > 0 && rmag > 0) {
          const eps = 0.5 * v2 - mu / rmag;
          const rv = rxRel * vxRel + ryRel * vyRel;
          const ex = ((v2 - mu / rmag) * rxRel - rv * vxRel) / mu;
          const ey = ((v2 - mu / rmag) * ryRel - rv * vyRel) / mu;
          const e = Math.hypot(ex, ey);
          if (eps < 0 && e < 1) {
            const a = -mu / (2 * eps);
            const rp_orb = a * (1 - e);
            const ra_orb = a * (1 + e);
            const peAlt = rp_orb - body.radiusMeters;
            const apAlt = ra_orb - body.radiusMeters;
            (r as any).setApPeForSnapshot?.(apAlt, peAlt);
          } else {
            (r as any).setApPeForSnapshot?.(Number.NaN, Number.NaN);
          }
        }
      } catch { }
      // Atmosphere & drag/thrust
      const rho2 = this.atmosphere.densityAt(alt2);
      try { (r as any).setAirDensityForSnapshot?.(rho2); } catch { }
      try { (r as any).setInAtmosphereForSnapshot?.(((rho2 ?? 0) > 0)); } catch { }
      const speed2 = Math.hypot(r.state.velocity.x, r.state.velocity.y);
      const dragMag2 = this.dragModel.computeDrag(rho2, speed2, r.dragCoefficient, r.referenceArea);
      const dragFx2 = speed2 > 0 ? -dragMag2 * (r.state.velocity.x / speed2) : 0;
      const dragFy2 = speed2 > 0 ? -dragMag2 * (r.state.velocity.y / speed2) : 0;
      const rho0_2 = (this.atmosphere as any)?.rho0 ?? 1.225;
      const thrust2 = r.currentThrust(rho2, rho0_2);
      const thrustFx2 = thrust2 * Math.cos(r.state.orientationRad);
      const thrustFy2 = thrust2 * Math.sin(r.state.orientationRad);
      const mass2 = r.totalMass();
      const gravFx2 = mass2 * ax_g2;
      const gravFy2 = mass2 * ay_g2;
      try {
        (r as any).setForcesForSnapshot?.({
          thrust: { fx: thrustFx2, fy: thrustFy2 },
          drag: { fx: dragFx2, fy: dragFy2 },
          gravity: { fx: gravFx2, fy: gravFy2, perBody: perBodyGrav2.map(g => ({ id: g.id, name: g.name, fx: g.fx * mass2, fy: g.fy * mass2 })) },
        });
      } catch { }
      const ax2 = ax_g2 + (dragFx2 + thrustFx2) / Math.max(1e-6, mass2);
      const ay2 = ay_g2 + (dragFy2 + thrustFy2) / Math.max(1e-6, mass2);
      r.state.velocity.x += ax2 * dt;
      r.state.velocity.y += ay2 * dt;
      r.state.position.x += r.state.velocity.x * dt;
      r.state.position.y += r.state.velocity.y * dt;
      // Heating & internal tick
      const heatRate2 = this.heatingModel.heatingRate(rho2, speed2);
      r.state.temperature += heatRate2 * dt;
      r.tickInternal(dt);
      // Ground collision with primary
      const dxpc2 = r.state.position.x - primary.position.x;
      const dypc2 = r.state.position.y - primary.position.y;
      const rnow2 = Math.sqrt(dxpc2 * dxpc2 + dypc2 * dypc2);
      if (rnow2 < primary.radiusMeters) {
        const nx2 = dxpc2 / Math.max(1e-6, rnow2);
        const ny2 = dypc2 / Math.max(1e-6, rnow2);
        r.state.position.x = primary.position.x + nx2 * primary.radiusMeters;
        r.state.position.y = primary.position.y + ny2 * primary.radiusMeters;
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
      rocket: this.rocket.snapshot(),
      rockets: this.rockets.map(r => r.snapshot()),
      activeRocketIndex: this.activeRocketIndex,
      bodies: this.bodies.map(b => ({ ...b, position: { ...b.position } })),
      primaryId: this.system.primaryId,
      destroyed: this.destroyed,
      atmosphereCutoffAltitudeMeters: this.lastAtmosphereCutoff,
      structures: structs,
    };
  }

  // --- Multi-rocket management ---
  getRockets(): ReadonlyArray<Rocket> { return this.rockets; }
  getActiveRocket(): Rocket { return this.rocket; }
  getActiveRocketIndex(): number { return this.activeRocketIndex; }
  setActiveRocketIndex(i: number): void {
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
    this.rockets[this.activeRocketIndex] = r;
    this.rocket = r;
  }

  /** Simple gravity model kept for reference (unused now). */
  private computeGravityLegacy(altitudeMeters: number, planetRadius: number, g0: number): number {
    const factor = (planetRadius / Math.max(1, planetRadius + altitudeMeters)) ** 2;
    return g0 * factor;
  }
}

// --- Default simple models for initial bootstrapping ---

export const SimpleAtmosphere: AtmosphereModel = {
  densityAt(alt) {
    // Exponential falloff: rho = rho0 * exp(-h / H), H ~ 8,500 m
    const rho0 = 1.225; // kg/m^3 at sea level
    const scaleHeight = 8500; // meters
    return alt <= 0 ? rho0 : rho0 * Math.exp(-alt / scaleHeight);
  },
};

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
