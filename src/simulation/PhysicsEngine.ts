import { Rocket } from "./Rocket";
import { CelestialBody } from "./CelestialSystem";

export class PhysicsEngine {

    static updateRocket(
        dt: number,
        rocket: Rocket,
        bodies: CelestialBody[],
        timeSeconds: number,
        systemPrimaryId: string,
        onCrash: () => void
    ): void {

        const rPos = rocket.state.position;
        const rVel = rocket.state.velocity;

        // Find Primary SOI
        let primary = bodies[0];
        let maxG = -1;
        for (const b of bodies) {
            const dx = rPos.x - b.position.x;
            const dy = rPos.y - b.position.y;
            const r2 = dx * dx + dy * dy;
            const g = b.mu / Math.max(1, r2);
            if (g > maxG) { maxG = g; primary = b; }
        }

        // Altitude
        const dx = rPos.x - primary.position.x;
        const dy = rPos.y - primary.position.y;
        const dist = Math.hypot(dx, dy);
        const altitude = dist - primary.radiusMeters;

        // Atmosphere
        const density = primary.getAtmosphereDensity(altitude);
        const atmCutoff = primary.atmosphereHeight;
        const inVacuum = altitude > atmCutoff;

        // Snapshots
        rocket.setAltitudeForSnapshot(altitude);
        rocket.setAirDensityForSnapshot(density);
        rocket.setAtmosphereCutoffForSnapshot(atmCutoff);
        try { (rocket as any).setInAtmosphereForSnapshot?.(!inVacuum); } catch { }
        try { (rocket as any).setSoIForSnapshot?.(primary.id); } catch { }

        // --- RAILS CHECK ---
        const engines = rocket.engines || [];
        const isThrottleZero = engines.length === 0 || engines.every((e: any) => (e.power ?? 0) <= 0.001);
        const isEnginesOff = isThrottleZero && (!rocket.currentThrust || rocket.currentThrust(0, 1.225) <= 1e-3);

        if (rocket._railsState && inVacuum && isEnginesOff) {
            const rs = rocket._railsState;
            const soi = bodies.find(b => b.id === rs.soiId);
            if (soi) {
                // Propagate Rails
                let dtOrbit = timeSeconds - rs.t0;
                let M = rs.M0 + rs.n * dtOrbit;
                let E = M;
                for (let iter = 0; iter < 15; iter++) {
                    const f = E - rs.e * Math.sin(E) - M;
                    const df = 1 - rs.e * Math.cos(E);
                    E -= f / df;
                    if (Math.abs(f) < 1e-7) break;
                }

                const cosE = Math.cos(E);
                const sinE = Math.sin(E);
                const beta = Math.sqrt(Math.max(0, 1 - rs.e * rs.e));
                const xp = rs.a * (cosE - rs.e);
                const yp = rs.a * beta * sinE;
                const cw = Math.cos(rs.w);
                const sw = Math.sin(rs.w);
                const rxNew = xp * cw - yp * sw;
                const ryNew = xp * sw + yp * cw;

                // Velocity
                const r_dist = rs.a * (1 - rs.e * cosE);
                const muUsed = rs.mu || (Math.abs(rs.n) * Math.abs(rs.n) * rs.a * rs.a * rs.a);
                const v_scale = Math.sqrt(muUsed * rs.a) / r_dist;
                const vx_p = -v_scale * sinE;
                const vy_p = v_scale * beta * cosE;
                const vxNew = vx_p * cw - vy_p * sw;
                const vyNew = vx_p * sw + vy_p * cw;

                rocket.state.position.x = soi.position.x + rxNew;
                rocket.state.position.y = soi.position.y + ryNew;
                rocket.state.velocity.x = vxNew + soi.velocity.x;
                rocket.state.velocity.y = vyNew + soi.velocity.y;

                const rp = rs.a * (1 - rs.e);
                const ra = rs.a * (1 + rs.e);
                (rocket as any).setApPeForSnapshot?.(ra - soi.radiusMeters, rp - soi.radiusMeters);

                PhysicsEngine.tickRotation(dt, rocket, density);

                // Common Updates (Fuel, etc) - Must call even on rails
                rocket.tickInternal(dt);

                return;
            }
        }

        // Enter Rails Condition
        let canEnterRails = false;
        const muSOI = primary.mu;
        const rxRel = rPos.x - primary.position.x;
        const ryRel = rPos.y - primary.position.y;
        // Relative Velocity to Body Surface (if body moving)
        const vxRel = rVel.x - primary.velocity.x;
        const vyRel = rVel.y - primary.velocity.y;

        const rRelMag = Math.hypot(rxRel, ryRel);
        const v2 = vxRel * vxRel + vyRel * vyRel;
        const eps = 0.5 * v2 - muSOI / rRelMag;

        const rvDot = rxRel * vxRel + ryRel * vyRel;
        const ex = ((v2 - muSOI / rRelMag) * rxRel - rvDot * vxRel) / muSOI;
        const ey = ((v2 - muSOI / rRelMag) * ryRel - rvDot * vyRel) / muSOI;
        const e = Math.hypot(ex, ey);

        let a = 0;
        if (Math.abs(eps) > 1e-10) {
            a = -muSOI / (2 * eps);
        }

        if (inVacuum && isEnginesOff && e < 0.999 && muSOI > 0) {
            if (a > 0) {
                const soiCutoff = (primary.id === systemPrimaryId) ? atmCutoff : 0;
                const periapsis = a * (1 - e);
                if (periapsis > (primary.radiusMeters + soiCutoff + 100)) {
                    canEnterRails = true;
                    let n = Math.sqrt(muSOI / (a * a * a));
                    const h = rxRel * vyRel - ryRel * vxRel;
                    if (h < 0) n = -n;
                    const w = Math.atan2(ey, ex);
                    const phi = Math.atan2(ryRel, rxRel);
                    let nu = phi - w;
                    while (nu > Math.PI) nu -= 2 * Math.PI;
                    while (nu <= -Math.PI) nu += 2 * Math.PI;
                    const tanE2 = Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2);
                    const E0 = 2 * Math.atan(tanE2);
                    const M0 = E0 - e * Math.sin(E0);

                    rocket._railsState = {
                        a, e, i: 0, w, M0, n, t0: timeSeconds,
                        mu: muSOI, soiId: primary.id
                    };
                }
            }
        }

        if (!canEnterRails) rocket._railsState = undefined;

        // --- NUMERICAL ---
        if (!rocket._railsState) {
            let fx_g = 0, fy_g = 0;
            const gForces = [];
            const m = rocket.totalMass();

            for (const b of bodies) {
                const dx = b.position.x - rPos.x;
                const dy = b.position.y - rPos.y;
                const r2 = Math.max(1e-1, dx * dx + dy * dy);
                const r = Math.sqrt(r2);
                // Newton!
                const F = (b.mu * m) / r2;
                const fx = F * (dx / r);
                const fy = F * (dy / r);
                fx_g += fx;
                fy_g += fy;
                gForces.push({ id: b.id, name: b.name, fx, fy });
            }

            let dragFx = 0, dragFy = 0;
            let heatingPower = 0;
            const speed = Math.hypot(rVel.x, rVel.y);

            if (!inVacuum) {
                // Drag
                const cd = rocket.snapshot().totalDragCoefficient ?? 0.5;
                const q = 0.5 * density * speed * speed;
                const Fd = q * cd; // area=1?
                if (speed > 0.01) {
                    dragFx = -Fd * (rVel.x / speed);
                    dragFy = -Fd * (rVel.y / speed);
                }

                // Heating (Legacy Logic)
                // Use active Drag Coeff for heating (includes nose cones, excludes fins/chutes)
                let activeCd = rocket.dragCoefficient;
                if (rocket.noseCones) {
                    for (const n of rocket.noseCones) {
                        if (n.dragModifier) activeCd += n.dragModifier;
                    }
                }
                if (activeCd < 0.1) activeCd = 0.1;

                if (speed > 100) {
                    const K_thermal = 1.0; // Calibrated: fast burn up at >260 m/s
                    heatingPower = 0.5 * density * Math.pow(speed, 3.0) * activeCd * K_thermal;
                }
            }

            // Thrust
            const thrustN = rocket.currentThrust ? rocket.currentThrust(altitude, 1.225) : 0;
            let fx_thrust = 0, fy_thrust = 0;
            if (thrustN > 0) {
                fx_thrust = Math.cos(rocket.state.orientationRad) * thrustN;
                fy_thrust = Math.sin(rocket.state.orientationRad) * thrustN;
            }

            // Integrate
            const ax = (fx_g + dragFx + fx_thrust) / m;
            const ay = (fy_g + dragFy + fy_thrust) / m;

            rVel.x += ax * dt;
            rVel.y += ay * dt;
            rPos.x += rVel.x * dt;
            rPos.y += rVel.y * dt;

            // Thermal Physics
            const ambientT = inVacuum ? 4 : 288;
            const Cp = 50; // Low Heat Capacity (Gameplay-optimized) to allow ~3s thermal response time
            const DissipationWPerK = 1000; // Constant cooling power (Watts/Kelvin)

            // Distribute Heat Limits
            const noseLimit = rocket.noseCones.length > 0 ? (rocket.noseCones[0].heatTolerance ?? 2400) : 1200;
            const tailLimit = rocket.heatShields.length > 0 ? (rocket.heatShields[0].heatTolerance ?? 3400) : 1200;

            let noseFlux = 0;
            let tailFlux = 0;
            let skinFlux = 0;

            if (heatingPower > 0) {
                const vx = rVel.x; const vy = rVel.y;
                const ox = Math.cos(rocket.state.orientationRad);
                const oy = Math.sin(rocket.state.orientationRad);
                const align = (vx * ox + vy * oy) / speed;

                const noseFac = Math.max(0, align);
                const tailFac = Math.max(0, -align);
                const skinFac = (1 - Math.abs(align)) * 0.2;

                noseFlux = heatingPower * noseFac;
                tailFlux = heatingPower * tailFac;
                skinFlux = heatingPower * skinFac;
            }

            // Calculate Thermal Masses (J/K)
            const noseThermalMass = (rocket.noseCones.reduce((m, p) => m + p.massKg, 0) + 50) * Cp;
            const tailThermalMass = (rocket.engines.reduce((m, p) => m + p.dryMassKg, 0) + rocket.heatShields.reduce((m, p) => m + p.massKg, 0) + 50) * Cp;
            const skinThermalMass = Math.max(10, rocket.totalMass()) * Cp;

            // Universal Analytical Integration
            // Model: M*Cp * dT/dt = Flux - Dissipation * (T - Ambient)
            // Time Constant tau = (M*Cp) / Dissipation
            // Equilibrium T_eq = Ambient + Flux / Dissipation
            // T_new = T_eq + (T_old - T_eq) * exp(-dt / tau)

            const updateTemp = (currentT: number, flux: number, thermalMass: number) => {
                const tau = thermalMass / DissipationWPerK;
                const T_eq = ambientT + (flux / DissipationWPerK);
                return T_eq + (currentT - T_eq) * Math.exp(-dt / tau);
            };

            rocket.state.noseTemperature = updateTemp(rocket.state.noseTemperature, noseFlux, noseThermalMass);
            rocket.state.tailTemperature = updateTemp(rocket.state.tailTemperature, tailFlux, tailThermalMass);
            rocket.state.temperature = updateTemp(rocket.state.temperature, skinFlux, skinThermalMass);

            // Clamp min
            if (rocket.state.noseTemperature < ambientT) rocket.state.noseTemperature = ambientT;
            if (rocket.state.tailTemperature < ambientT) rocket.state.tailTemperature = ambientT;
            if (rocket.state.temperature < ambientT) rocket.state.temperature = ambientT;

            // Destruction Logic
            if (rocket.state.noseTemperature > noseLimit || rocket.state.tailTemperature > tailLimit) {
                onCrash();
            }

            PhysicsEngine.tickRotation(dt, rocket, density);

            // Calculate Orbital Elements for API & Snapshot
            const elements = PhysicsEngine.calculateOrbitalElements(rocket.state.position, rocket.state.velocity, primary);
            rocket._orbitalElements = elements;

            // Ap/Pe snapshot
            if (elements && elements.e < 1 && elements.a > 0) {
                const rp = elements.a * (1 - elements.e);
                const ra = elements.a * (1 + elements.e);
                (rocket as any).setApPeForSnapshot?.(ra - primary.radiusMeters, rp - primary.radiusMeters);
            } else {
                (rocket as any).setApPeForSnapshot?.(NaN, NaN);
            }

            // Collision
            if (dist < primary.radiusMeters) {
                // Impact
                const speed = Math.hypot(rVel.x, rVel.y);
                const vx = rVel.x; const vy = rVel.y;
                const ox = Math.cos(rocket.state.orientationRad);
                const oy = Math.sin(rocket.state.orientationRad);
                const align = (vx * ox + vy * oy) / speed;
                const isRetrograde = align < -0.8;

                if (speed > 10) onCrash();
                else if (speed > 5 && !isRetrograde) onCrash();
                else {
                    // Land
                    const nx = dx / dist; const ny = dy / dist;
                    rPos.x = primary.position.x + nx * primary.radiusMeters;
                    rPos.y = primary.position.y + ny * primary.radiusMeters;
                    rVel.x = 0; rVel.y = 0;
                }
            }
            // Report Forces
            rocket.setForcesForSnapshot({
                thrust: { fx: fx_thrust, fy: fy_thrust },
                drag: { fx: dragFx, fy: dragFy },
                gravity: {
                    fx: fx_g,
                    fy: fy_g,
                    perBody: gForces
                }
            });
        }

        rocket.tickInternal(dt);
    }

    static tickRotation(dt: number, rocket: Rocket, airDensity: number) {
        const desired = rocket.desiredAngularVelocityRadPerS || 0;

        // 1. Calculate Max Omega & Energy Cost from Reaction Wheels
        let maxOmega = 0;
        let energyPerRadPerS = 0;
        const wheels = rocket.reactionWheels;
        if (wheels.length > 0) {
            for (const rw of wheels) {
                const m = Number((rw as any).maxOmegaRadPerS) || 0;
                const c = Number((rw as any).energyPerRadPerS) || 0;
                maxOmega += Math.max(0, m);
                energyPerRadPerS += Math.max(0, c);
            }
        }

        // 2. Add Aero Fin Authority
        const fins = rocket.fins;
        if (airDensity > 0.001 && fins.length > 0) {
            const scale = Math.min(1.0, airDensity / 0.1);
            // Original logic: 0.5 * count * scale
            const finAuthority = 0.5 * fins.length * scale;
            maxOmega += finAuthority;
        }

        // 3. Determine Actual Omega
        let actual = 0;
        if (maxOmega > 0 && Number.isFinite(desired) && dt > 0) {
            const target = Math.max(-maxOmega, Math.min(maxOmega, desired));

            // Energy Consumption
            const needPerSec = Math.abs(target) * energyPerRadPerS;
            const need = needPerSec * dt;

            if (need > 0) {
                const drawn = rocket.drawEnergy(need);
                // Scale performance if low on power
                const scale = Math.max(0, Math.min(1, drawn / need));
                actual = target * scale;
            } else {
                actual = target;
            }
        }

        // 4. Update State
        rocket._activeOmega = actual;

        if (Number.isFinite(actual) && dt > 0) {
            rocket.state.orientationRad += actual * dt;
            // Normalize to [0, 2PI)
            const TWO_PI = Math.PI * 2;
            let a = rocket.state.orientationRad % TWO_PI;
            if (a < 0) a += TWO_PI;
            rocket.state.orientationRad = a;
        }

        // 5. Update Snapshot Stats
        (rocket as any).setTurnStatsForSnapshot?.(maxOmega);
        if ((rocket as any)._setActualAngularVelocityRadPerS) {
            (rocket as any)._setActualAngularVelocityRadPerS(actual);
        }
    }

    /**
     * compute orbital elements from state vectors.
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
}
