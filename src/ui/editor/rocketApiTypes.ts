export const ROCKET_API_DTS = `
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
        /** Turn rocket (rad/s). Requires Reaction Wheels or Fins. */
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

        /** Predicted Apoapsis (m). Requires Orbital Computer. */
        readonly apoapsis: number;
        /** Predicted Periapsis (m). Requires Orbital Computer. */
        readonly periapsis: number;
    };

    /** Navigation helpers */
    readonly nav: {
        /** Current heading (radians). */
        readonly heading: number;
        /** Angle of prograde vector (radians). */
        readonly prograde: number;
        /** Angle of retrograde vector (radians). */
        readonly retrograde: number;
        /** Calculate diff between angles [-PI, PI]. */
        angleDiff(a: number, b: number): number;
        /** Steer rocket to target angle (radians). Requires Reaction Wheels/Fins. */
        alignTo(targetRad: number): void;
    };

    /** Communications & Payload */
    readonly comms: {
        /** Connection state. Requires Network Tier. */
        readonly state: { connected: boolean; signal: number };
        /** Send a text message to base (0.1 KB). */
        transmitMessage(message: string): void;
        /** Transmit a key-value data point to the Mission Data store. */
        transmitData(key: string, value: number | string | boolean): void;
        /** Transmit science data from an experiment. */
        transmitScience(experimentId: string): void;
    };
}

declare function update(api: RocketAPI): void;
`;
