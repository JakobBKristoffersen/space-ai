import { isApiFeatureUnlocked } from "../../game/GameProgression";
import { ApiFeatures } from "../../game/GameIds";

export function generateRocketApiDts(unlockedTechs: string[] = []): string {
    // Dynamic permissions from Central Config
    const showTemp = true; // Still a placeholder as per design/implicit
    const showAtmos = isApiFeatureUnlocked(ApiFeatures.SCIENCE_ATMOSPHERE, unlockedTechs);
    const showSurface = isApiFeatureUnlocked(ApiFeatures.SCIENCE_SURFACE, unlockedTechs);
    const showOrbital = isApiFeatureUnlocked(ApiFeatures.TELEMETRY_ORBITAL, unlockedTechs);

    // Check for ANY nav unlock (prograde/retrograde OR alignTo)
    const showNavPrograde = isApiFeatureUnlocked(ApiFeatures.NAV_PROGRADE, unlockedTechs);
    const showNavAlign = isApiFeatureUnlocked(ApiFeatures.NAV_ALIGN_TO, unlockedTechs);


    // Core API always present
    let dts = `
/**
 * RocketAPI is the ONLY interface the user script can use to interact with the rocket.
 */
declare interface RocketAPI {
    /**
     * Access to a small per-CPU memory store, cleared on simulation reset.
     * Values must be JSON-serializable. Total size limited to ~64KB.
     */
    readonly memory: {
        get(key: string): unknown;
        set(key: string, value: unknown): void;
        remove(key: string): void;
        clear(): void;
    };
    /** Log a message associated with the current script slot. */
    log(msg: unknown): void;

    /** Control systems (Actuators) */
    readonly control: {
        /** Set engine throttle (0.0 to 1.0). Requires Engine. */
        throttle(value: number): void;
        /** Turn rocket (rad/s). Requires Reaction Wheels (Space/Atmo) OR Fins (Atmo). */
        turn(rateRadPerS: number): void;
        /** Deploy parachutes. Requires Parachutes. */
        deployParachute(): void;
        /** Deploy solar panels. Requires Solar Panels. */
        deploySolar(): void;
        /** Retract solar panels. Requires retractable Solar Panels. */
        retractSolar(): void;
    };

    /** Telemetry sensors */
    readonly telemetry: {
        /** Current altitude (meters). Requires Altimeter/Basic Telemetry. */
        readonly altitude: number;
        /** Velocity vector (m/s). Requires GPS/Nav. */
        readonly velocity: { x: number; y: number };
        /** Position vector (m). Requires GPS/Nav. */
        readonly position: { x: number; y: number };
        /** Scalar speed (m/s). */
        readonly speed: number;
        
        /** Fuel remaining (kg). Returns 0 if no fuel tanks. */
        readonly fuel: number;
        /** Max fuel capacity (kg). */
        readonly maxFuel: number;
        /** Total mass (kg). */
        readonly mass: number;
        /** Current thrust (N). */
        readonly thrust: number;

`;

    // Dynamic Telemetry
    if (showOrbital) {
        dts += `
        /** Predicted Apoapsis (m). Requires Orbital Computer. */
        readonly apoapsis: number;
        /** Predicted Periapsis (m). Requires Orbital Computer. */
        readonly periapsis: number;
        /** True Anomaly (radians). Requires Orbital Computer. */
        readonly trueAnomaly: number;
        /** Eccentricity. Requires Orbital Computer. */
        readonly eccentricity: number;
        /** Inclination (radians). Requires Orbital Computer. */
        readonly inclination: number;
`;
    }

    // Close Telemetry
    dts += `    };\n`;

    // Navigation
    dts += `
    /** Navigation helpers */
    readonly nav: {
        /** Current heading (radians). */
        readonly heading: number;
        /** Calculate diff between angles [-PI, PI]. */
        angleDiff(a: number, b: number): number;
`;

    if (showOrbital) {
        dts += `
        /** Calculate prograde angle at specific orbital node. */
        getOrbitalPrograde(location: "apoapsis" | "periapsis"): number;
`;
    }

    if (showNavPrograde) {
        dts += `
        /** Angle of prograde vector (radians). */
        readonly prograde: number;
        /** Angle of retrograde vector (radians). */
        readonly retrograde: number;
`;
    }

    if (showNavAlign) {
        dts += `
        /** Steer rocket to target angle (radians). Requires Reaction Wheels/Fins. */
        alignTo(targetRad: number): void;
`;
    }

    dts += `    };\n`;

    // Comms (Static for now)
    dts += `
    /** Communications & Payload */
    readonly comms: {
        /** Connection state. Requires Network Tier. */
        readonly state: { connected: boolean; signal: number };
        /** Send a text message to base (0.1 KB). */
        transmitMessage(message: string): void;
        /** Transmit a key-value data point to the Mission Data store. */
        transmitData(key: string, value: number | string | boolean): void;
    };
`;

    // Science
    dts += `
    /** Science Experiments */
    readonly science: {
`;

    if (showTemp) {
        dts += `        readonly temperature: {
            /** Measure and store current temperature. data[int(altitude)] = temp. Requires Thermometer. */
            collect(): void;
            /** Transmit collected temperature data to base. (Clears buffer). */
            transmit(): void;
        };\n`;
    }

    if (showAtmos) {
        dts += `        readonly atmosphere: {
            /** Measure and store air density. data[int(altitude)] = rho. Requires Barometer. */
            collect(): void;
            /** Transmit collected density data. */
            transmit(): void;
        };\n`;
    }

    if (showSurface) {
        dts += `        readonly surface: {
            /** Scan surface terrain type. data[int(lat)] = type. Requires Surface Scanner. */
            collect(): void;
            /** Transmit collected surface data. */
            transmit(): void;
        };\n`;
    }

    dts += `    };\n`;

    // Close interface
    dts += `}\n`;
    dts += `declare function update(api: RocketAPI): void;\n`;

    return dts;
}
