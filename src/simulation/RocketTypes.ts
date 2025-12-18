export interface Vec2 {
    x: number;
    y: number;
}

export interface RocketState {
    position: Vec2; // meters
    velocity: Vec2; // m/s
    orientationRad: number; // radians; 0 points along +X, pi/2 along +Y
    temperature: number; // internal/average
    noseTemperature: number;
    tailTemperature: number;
}

export interface RocketSnapshot {
    name?: string;
    position: Readonly<Vec2>;
    velocity: Readonly<Vec2>;
    orientationRad: number;
    temperature: number;
    noseTemperature: number;
    tailTemperature: number;
    maxNoseTemperature?: number;
    maxTailTemperature?: number;
    massKg: number;
    altitude: number;
    /** Current atmospheric density at rocket altitude (kg/m^3), if available. */
    airDensity?: number;
    /** Ambient temperature (Kelvin), if available. */
    ambientTemperature?: number;
    /** Ambient pressure (Pascals), if available. */
    ambientPressure?: number;
    /** Body currently exerting the strongest gravitational acceleration on this rocket (SOI approximation). */
    soiBodyId?: string;
    /** Convenience flag: true when airDensity > 0. */
    inAtmosphere?: boolean;
    /** Altitude where atmosphere ends (useful for science/scaling). */
    atmosphereCutoffAltitudeMeters?: number;
    /** Per-tick force breakdown (Newtons). */
    forces?: {
        thrust: { fx: number; fy: number };
        drag: { fx: number; fy: number };
        gravity: { fx: number; fy: number; perBody: { id: string; name: string; fx: number; fy: number }[] };
    };
    /** Orbital apoapsis altitude over primary, if bound ellipse; else NaN. */
    apAltitude?: number;
    /** Orbital periapsis altitude over primary, if bound ellipse; else NaN. */
    peAltitude?: number;
    fuelKg: number;
    /** instantaneous fuel consumption rate in kg/s based on last tick */
    fuelConsumptionKgPerS: number;
    maxTurnRateRadPerS?: number;
    angularVelocityRadPerS?: number;
    /** Total stored battery energy across all batteries (J). */
    batteryJoules: number;
    /** Total battery capacity across all batteries (J). */
    batteryCapacityJoules: number;
    /** 0..100 percentage of stored energy vs capacity. */
    batteryPercent: number;
    /** Energy production rate (Watts or J/s) */
    energyGainJPerS: number;
    /** Energy consumption rate (Watts or J/s) */
    energyDrawJPerS: number;
    /** CPU part name, if installed. */
    cpuName?: string;
    /** CPU per-tick processing budget, if installed. */
    cpuProcessingBudgetPerTick?: number;
    /** CPU max script chars, if installed. */
    cpuMaxScriptChars?: number;
    /** CPU runtime/config: minimum interval between script runs (s). */
    cpuProcessingIntervalSeconds?: number;
    /** CPU runtime: number of slots supported by CPU. */
    cpuSlotCount?: number;
    /** CPU runtime: how many scripts executed last tick. */
    cpuScriptsRunning?: number;
    /** CPU runtime: total processing cost used last tick. */
    cpuCostUsedLastTick?: number;
    /** CPU runtime: total energy consumed by scripts last tick (J). */
    cpuEnergyUsedLastTick?: number;
    /** CPU runtime: seconds remaining until the next scheduled script run. */
    cpuNextRunInSeconds?: number;
    /** Reaction wheels: current angular velocity (rad/s), if turning. */
    rwOmegaRadPerS?: number;
    /** Reaction wheels: combined maximum angular velocity capability (rad/s). */
    rwMaxOmegaRadPerS?: number;
    /** Reaction wheels: desired angular velocity commanded by scripts (rad/s), signed. */
    rwDesiredOmegaRadPerS?: number;
    /** Communications with Base: whether antenna link is in range. */
    commsInRange?: boolean;
    /** Distance from rocket to base (meters). */
    commsDistanceMeters?: number;
    /** Base antenna range (meters). */
    commsBaseRangeMeters?: number;
    /** Rocket antenna effective range (meters). */
    commsRocketRangeMeters?: number;
    /** Measured bytes sent to base per second. */
    commsBytesSentPerS?: number;
    /** Measured bytes received from base per second. */
    commsBytesRecvPerS?: number;
    /** Type of the last packet successfully sent (persists until next packet). */
    lastPacketSentType?: string;
    /** List of keys that are actively exposed by installed sensors/parts. */
    exposedKeys?: string[];
    /** Average engine throttle (0-1). */
    avgEngineThrustPct?: number;
    /** True if any parachute is currently deployed. */
    parachuteDeployed?: boolean;
    /** True if the rocket has any parachutes installed. */
    hasParachutes?: boolean;
    /** True if any solar panel is deployed. */
    solarDeployed?: boolean;
    /** True if the rocket has any solar panels. */
    hasSolarPanels?: boolean;
    /** Estimated total drag coefficient of the vehicle. */
    totalDragCoefficient?: number;
    /** Name of the terrain currently below the rocket. */
    currentTerrain?: string;
    /** Number of packets waiting in the comms queue. */
    packetQueueLength?: number;
    /** Total size of waiting packets in KB. */
    packetQueueSizeKb?: number;
    /** Installed science experiments. */
    science?: { id: string; name: string; hasData?: boolean }[];
}


export type RocketCommand =
    | { type: "setEnginePower"; value: number }
    | { type: "turnLeft"; value: number }
    | { type: "turnRight"; value: number }
    | { type: "deployParachute" }
    | { type: "deploySolar" }
    | { type: "retractSolar" };

/**
 * Cached orbital state for "Rails" physics.
 * Allows analytical propagation without recalculating elements every frame.
 */
export interface RailsState {
    a: number;        // Semi-major axis (meters)
    e: number;        // Eccentricity
    i: number;        // Inclination (2D: usually 0 or PI)
    w: number;        // Argument of Periapsis (radians)
    M0: number;       // Mean Anomaly at epoch t0 (radians)
    n: number;        // Mean Motion (rad/s), signed for retrograde
    t0: number;       // Epoch time (seconds)
    soiId: string;    // ID of the body we are orbiting
    mu: number;       // Gravitational parameter for velocity storage
}

export interface RocketCommandQueue {
    drain(): RocketCommand[];
}

export class SimpleQueue implements RocketCommandQueue {
    private items: RocketCommand[] = [];
    enqueue(cmd: RocketCommand) { this.items.push(cmd); }
    drain(): RocketCommand[] {
        const ret = this.items;
        this.items = [];
        return ret;
    }
}

// --- PART INTERFACES ---

export interface EnginePart {
    readonly id: string;
    readonly name: string;
    readonly dryMassKg: number;
    readonly maxThrustN: number;
    power: number; // 0..1
    readonly fuelBurnRateKgPerS: number;
    readonly vacuumBonusAtVacuum?: number;
    readonly exposes?: string[];
    currentThrust(rho: number, rho0: number): number;
}

export interface FuelTankPart {
    readonly id: string;
    readonly name: string;
    readonly dryMassKg: number;
    readonly capacityKg?: number;
    fuelKg: number;
    readonly exposes?: string[];
    drawFuel(amount: number): number;
}

export interface BatteryPart {
    readonly id: string;
    readonly name: string;
    readonly massKg: number;
    energyJoules: number;
    readonly capacityJoules: number;
}

export interface ProcessingUnitPart {
    readonly id: string;
    readonly name: string;
    readonly massKg: number;
    readonly processingBudgetPerTick: number; // "CPU credits" per tick
    readonly maxScriptChars: number;
    readonly scriptSlots: number;
    readonly powerDrawWatts: number;
}

export interface SensorPart {
    readonly id: string;
    readonly name: string;
    readonly massKg: number;
    readonly powerDrawWatts: number;
    readonly exposes: string[];
}

export interface ReactionWheelsPart {
    readonly id: string;
    readonly name: string;
    readonly massKg: number;
    readonly maxTorque: number;
    readonly powerDrawWatts: number;
    readonly maxOmegaRadPerS?: number; // Saturation limit
}

export interface AntennaPart {
    readonly id: string;
    readonly name: string;
    readonly massKg: number;
    readonly rangeMeters: number;
    readonly powerDrawWatts: number;
    readonly transmitRateBytesPerS: number;
}

export interface PayloadPart {
    readonly id: string;
    readonly name: string;
    readonly massKg: number;
    readonly description?: string;
}

export interface SolarPanelPart {
    readonly id: string;
    readonly name: string;
    readonly massKg: number;
    readonly powerOutputWatts: number;
    deployed: boolean;
    readonly retractable: boolean;
    readonly generationWatts: number; // current generation based on sun/angle
}
