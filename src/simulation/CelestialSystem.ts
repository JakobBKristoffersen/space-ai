import { Vec2 } from "./RocketTypes";

export interface OrbitDefinition {
    aroundId: string;
    radiusMeters: number;
    angularSpeedRadPerS: number;
    phaseRad: number;
}

// Terrain Segment for colors
export interface TerrainSegment {
    type: string;
    color: string;
    startRad: number;
    endRad: number;
}

export interface PlanetModel {
    id?: string; // e.g. "planet"
    name: string;
    radiusMeters: number;
    surfaceGravity: number;
    color?: string;
    atmosphereScaleHeightMeters?: number; // e.g. 7000 or 200 (toy scale)
    atmosphereHeightMeters?: number; // Explicit visual cap if desired
    atmosphereColor?: string;
    orbit?: OrbitDefinition;
    terrain?: TerrainSegment[];
}

export interface CelestialSystemDef {
    primaryId: string;
    bodies: PlanetModel[];
}


export interface OrbitState {
    a: number; // semi-major axis (meters), >0
    e: number; // eccentricity, 0..1
    i: number; // inclination (radians)
    node: number; // long of asc node
    peri: number; // argument of periapsis
    M: number; // mean anomaly (radians)
    n: number; // mean motion (rad/s)
    period: number; // seconds
    apoapsisAlt: number; // meters AGL
    periapsisAlt: number; // meters AGL
    trueAnomaly: number; // radians
    radius: number; // current distance from center (meters)
    speed: number; // current speed (m/s)
}

/**
 * Runtime class for a celestial body
 */
export class CelestialBody {
    id: string;
    name: string;
    radiusMeters: number;
    surfaceGravity: number;
    position: Vec2 = { x: 0, y: 0 };
    velocity: Vec2 = { x: 0, y: 0 };

    // Appearance
    color: string;
    atmosphereScaleHeight: number;
    atmosphereHeight: number;
    atmosphereColor: string;
    terrain: TerrainSegment[];

    // Orbit info (if not primary)
    orbitDef?: OrbitDefinition;

    // Cached mu (G * M)
    mu: number; // m^3 / s^2

    constructor(model: PlanetModel) {
        this.id = model.id || "planet";
        this.name = model.name;
        this.radiusMeters = model.radiusMeters;
        this.surfaceGravity = model.surfaceGravity;
        this.mu = this.surfaceGravity * this.radiusMeters * this.radiusMeters;

        this.color = model.color || "#888";
        this.atmosphereScaleHeight = model.atmosphereScaleHeightMeters || 0;
        this.atmosphereHeight = model.atmosphereHeightMeters || (this.atmosphereScaleHeight * 7);
        this.atmosphereColor = model.atmosphereColor || "rgba(100,150,255,0.3)";
        this.terrain = model.terrain || [];

        this.orbitDef = model.orbit;
    }

    update(t: number) {
        if (this.orbitDef) {
            const { radiusMeters, angularSpeedRadPerS, phaseRad } = this.orbitDef;
            const angle = phaseRad + angularSpeedRadPerS * t;
            this.position.x = Math.cos(angle) * radiusMeters;
            this.position.y = Math.sin(angle) * radiusMeters;

            // V = r * omega (circular approximation for the body itself)
            // Tangent to circle (-sin, cos)
            const vMag = radiusMeters * angularSpeedRadPerS;
            this.velocity.x = -Math.sin(angle) * vMag;
            this.velocity.y = Math.cos(angle) * vMag;
        } else {
            // Primary is static at 0,0
            this.position.x = 0;
            this.position.y = 0;
            this.velocity.x = 0;
            this.velocity.y = 0;
        }
    }

    getGravityAt(r: number): number {
        // g = mu / r^2
        const r2 = r * r;
        if (r2 < 1) return this.surfaceGravity;
        return this.mu / r2;
    }

    getAtmosphereDensity(altitudeMeters: number): number {
        if (this.atmosphereScaleHeight <= 0) return 0;
        // Standard exponential model: rho = rho0 * exp(-h/H)
        // We tune rho0 so that at surface density is ~1.2 kg/m^3 (earth-like) for simplicity,
        // or just strictly follow scale height. 
        // Given toy scale: surface gravity 12 m/s, various tweaks.
        // Let's assume standard P0/T0 implies rho0 ~ 1.2 at h=0.
        if (altitudeMeters > this.atmosphereHeight) return 0;
        if (altitudeMeters < 0) return 1.225;
        return 1.225 * Math.exp(-altitudeMeters / this.atmosphereScaleHeight);
    }
}
