
import { PYTHON_SEED_SCRIPT } from "../../app/bootstrap/pythonSeedScript";
import { RocketAPI } from "../../scripting/RocketAPI"; // Import strictly for type usage if needed, but strings are just strings here

export interface ScriptServiceRef {
    list: () => any[];
    upsertByName: (name: string, code: string) => any;
    saveAll?: (list: any[]) => void;
}

// Helper to find unique name
const getUniqueName = (base: string, existing: any[]) => {
    let name = base;
    let n = 1;
    while (existing.some((s: any) => s.name === name)) {
        name = base.replace(/(\.\w+)?$/, (m: string) => ` (${n++})${m}`);
    }
    return name;
};

export const TemplateService = {
    createNew(lib: ScriptServiceRef, lang: "typescript" | "python"): any {
        const ext = lang === "python" ? ".py" : ".ts";
        const base = "Untitled" + ext;
        const name = getUniqueName(base, lib.list());

        const initialCode = lang === "python"
            ? "from rocket_api import RocketAPI\n\ndef update(api: RocketAPI):\n  api.log('Hello from Python')\n"
            : "function update(api: RocketAPI) {\n  api.log('Hello from TS');\n}\n";

        return lib.upsertByName(name, initialCode);
    },

    createPythonSeed(lib: ScriptServiceRef): any {
        const base = "OrbitInsertion.py";
        const name = getUniqueName(base, lib.list());
        return lib.upsertByName(name, PYTHON_SEED_SCRIPT);
    },

    createMultiSeed(lib: ScriptServiceRef): any {
        const existing = lib.list();

        // Local helper reusing the closure logic from before
        const unique = (n: string) => getUniqueName(n, existing);

        const utilsName = unique("SeedUtils.ts");

        // --- UTILS: PID, State, Math ---
        const utilsCode = `
// Types for our state machine
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
    const initial = { phase: Phase.PRELAUNCH, targetAlt: 150000 };
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
}
`;
        lib.upsertByName(utilsName, utilsCode);

        const mainName = unique("SeedMain.ts");

        // --- MAIN: Launch Logic ---
        const importPath = `./${utilsName.replace(/\.ts$/, "")}`;
        const mainCode = `
import { Phase, getState, setState, PID } from "${importPath}";

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
            if (alt > 1000 || speed > 100) {
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
            if ( !isNaN(api.nav.prograde) ) {
                api.nav.alignTo(api.nav.prograde);
            }

            if (alt > state.targetAlt * 0.95 && Math.abs(vel.y) < 100) {
                 state.phase = Phase.CIRCULARIZE;
                 setState(api, state);
            }
            break;

        case Phase.CIRCULARIZE:
            api.nav.alignTo(api.nav.prograde);
            
            if (pe < state.targetAlt * 0.9) {
                api.control.throttle(1.0);
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
        return lib.upsertByName(mainName, mainCode);
    }
};
