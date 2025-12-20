import { CelestialBody } from "./CelestialSystem";

/**
 * Pure physics calculations for orbital mechanics and thermodynamics.
 */
export class PhysicsMath {

    /**
     * Compute orbital elements from state vectors.
     * @param rPos Relative position vector {x, y}
     * @param rVel Relative velocity vector {x, y}
     * @param primary The celestial body acting as the gravitational center
     */
    static calculateOrbitalElements(rPos: { x: number, y: number }, rVel: { x: number, y: number }, primary: CelestialBody): any | undefined {
        const muSOI = primary.mu;
        const rxRel = rPos.x - primary.position.x;
        const ryRel = rPos.y - primary.position.y;
        const vxRel = rVel.x - primary.velocity.x;
        const vyRel = rVel.y - primary.velocity.y;

        const rRelMag = Math.hypot(rxRel, ryRel);
        const v2 = vxRel * vxRel + vyRel * vyRel;

        // Energy & Eccentricity
        const eps = 0.5 * v2 - muSOI / rRelMag;
        const rvDot = rxRel * vxRel + ryRel * vyRel;
        const ex = ((v2 - muSOI / rRelMag) * rxRel - rvDot * vxRel) / muSOI;
        const ey = ((v2 - muSOI / rRelMag) * ryRel - rvDot * vyRel) / muSOI;
        const e = Math.hypot(ex, ey);

        if (Math.abs(eps) < 1e-10) return undefined; // Parabolic/Invalid?
        const a = -muSOI / (2 * eps);

        // Argument of Periapsis (w)
        const w = Math.atan2(ey, ex);

        // Mean Motion
        let n = Math.sqrt(muSOI / Math.abs(a * a * a));
        const h = rxRel * vyRel - ryRel * vxRel;
        if (h < 0) n = -n;

        return { a, e, w, n, mu: muSOI, soiId: primary.id, i: 0 };
    }

    /**
     * Calculate velocity vector (in perifocal frame -> rotated) at a specific true anomaly.
     */
    static getOrbitVelocityAtTrueAnomaly(state: any, nu: number): { x: number, y: number } {
        const { a, e, w, n, mu } = state;

        // Velocity in Perifocal Frame
        if (a <= 0) return { x: 0, y: 0 };

        const p = a * (1 - e * e);
        const v_scale = Math.sqrt(mu / p);

        const vx_p = -v_scale * Math.sin(nu);
        const vy_p = v_scale * (e + Math.cos(nu));

        // Rotate by w
        const cw = Math.cos(w);
        const sw = Math.sin(w);

        const vx = vx_p * cw - vy_p * sw;
        const vy = vx_p * sw + vy_p * cw;

        const finalScale = (n < 0) ? -1 : 1;
        return { x: vx * finalScale, y: vy * finalScale };
    }

    /**
     * Exponential decay for thermal equilibrium.
     * T_new = T_eq + (T_old - T_eq) * exp(-dt / tau)
     */
    static updateTemperature(currentT: number, flux: number, thermalMass: number, dissipation: number, ambientT: number, dt: number): number {
        const tau = thermalMass / dissipation;
        const T_eq = ambientT + (flux / dissipation);
        return T_eq + (currentT - T_eq) * Math.exp(-dt / tau);
    }
}
