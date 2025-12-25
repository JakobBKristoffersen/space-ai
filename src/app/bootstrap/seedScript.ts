// Default example user script used to seed the session Scripts Library.
// Keep this in sync with the current RocketAPI and telemetry fields.

export const ORBIT_UTIL = `// Types for our state machine
export enum Phase {
    PRELAUNCH = 0,
    ASCENT = 1,
    GRAVITY_TURN = 2,
    COAST = 3,
    CIRCULARIZE = 4,
    ORBIT = 5
}

export interface State {
    phase: Phase;
    targetAlt: number; // meters
}

// Persist state in rocket memory so it survives between ticks
export function getState(api: RocketAPI): State {
    const s = api.memory.get("state") as State;
    if (s) return s;
    const initial = { phase: Phase.PRELAUNCH, targetAlt: 3000 };
    api.memory.set("state", initial);
    return initial;
}

export function setState(api: RocketAPI, s: State) {
    api.memory.set("state", s);
}

// Simple PID Controller
export class PID {
    kp: number; ki: number; kd: number;
    sum: number = 0;
    lastErr: number = 0;

    constructor(kp: number, ki: number, kd: number) {
        this.kp = kp; this.ki = ki; this.kd = kd;
    }

    update(error: number, dt: number): number {
        this.sum += error * dt;
        const dErr = (error - this.lastErr) / dt;
        this.lastErr = error;
        return this.kp * error + this.ki * this.sum + this.kd * dErr;
    }

`;

export const ORBIT_MAIN = `import { Phase, getState, setState, PID } from "./Utils";

// Main Launch Script using Modular RocketAPI

function update(api: RocketAPI) {
    const state = getState(api);
    
    // Telemetry access
    // Note: These will fail if sensors are not installed!
    const alt = api.telemetry.altitude;
    const vel = api.telemetry.velocity;
    const speed = api.telemetry.speed;
    const ap = api.telemetry.apoapsis;
    const pe = api.telemetry.periapsis;

    api.log(\`Phase: \${Phase[state.phase]} Alt: \${Math.floor(alt)} Ap: \${Math.floor(ap)}\`);

    switch (state.phase) {
        case Phase.PRELAUNCH:
            api.control.throttle(1.0);
            if (speed > 10) {
                state.phase = Phase.ASCENT;
                setState(api, state);
            }
            break;

        case Phase.ASCENT:
            api.control.throttle(1.0);
            api.control.turn(0); // Keep vertical
            
            // Start turn at 1km or 100m/s
            if (alt > 400 || speed > 100) {
                state.phase = Phase.GRAVITY_TURN;
                setState(api, state);
            }
            break;

        case Phase.GRAVITY_TURN:
            // Gradual turn
            const progress = Math.min(1.0, ap / state.targetAlt);
            const targetAngleDeg = 90 * (1.0 - progress);
            const targetRad = targetAngleDeg * (Math.PI / 180);
            
            // Align to target
            // Requires Guidance Computer & Reaction Wheels
            api.nav.alignTo(targetRad);
            
            api.control.throttle(1.0);

            if (ap >= state.targetAlt) {
                state.phase = Phase.COAST;
                setState(api, state);
                api.control.throttle(0);
            }
            break;

        case Phase.COAST:
            api.control.throttle(0);
            // Point Prograde for efficiency
            api.nav.alignTo(api.nav.getOrbitalPrograde('apoapsis'));

            if (alt > state.targetAlt * 0.98 && Math.abs(vel.y) < 100) {
                 state.phase = Phase.CIRCULARIZE;
                 api.control.deploySolar()
                 setState(api, state);
            }
            break;

        case Phase.CIRCULARIZE:
            api.nav.alignTo(api.nav.prograde);
            
            if (pe < state.targetAlt * 0.9) {
                api.control.throttle(0.4);
            } else {
                api.control.throttle(0);
                if (pe > state.targetAlt * 0.95) {
                    state.phase = Phase.ORBIT;
                    setState(api, state);
                }
            }
            break;

        case Phase.ORBIT:
            api.control.throttle(0);
            api.log("Orbit Achieved!");
            break;
    }
}

`;

export const DEFAULT_EXAMPLE = `/**
 * Base Line Script (TypeScript)
 * - Logs status to console
 * - Sets throttle to 100%
 */
function update(api: RocketAPI) {
  // Log message only once (using memory to track)
  if (!api.memory.get("welcome_shown")) {
    api.log("System nominal. Throttle set to maximum.");
    api.memory.set("welcome_shown", true);
  }
  
  // Full throttle
  api.control.throttle(1.0);
}
`;

/**
 * Pre-compiled JS version of DEFAULT_EXAMPLE to ensure immediate execution 
 * without requiring the in-browser compiler to handle the types.
 */
export const DEFAULT_EXAMPLE_COMPILED = `"use strict";
// JS Version for Execution
function update(api) {
  if (!api.memory.get("welcome_shown")) {
    api.log("System nominal. Throttle set to maximum.");
    api.memory.set("welcome_shown", true);
  }
  api.control.throttle(1.0);
}`;

