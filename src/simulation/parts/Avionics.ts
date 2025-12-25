/**
 * Avionics parts: CPUs, Sensors, Reaction Wheels, Antennas.
 */
import { ProcessingUnitPart, SensorPart, ReactionWheelsPart, AntennaPart } from "../Rocket";
import { PartIds, TelemetryIds } from "../../game/GameIds";

// --- CPUs ---

export class BasicCPU implements ProcessingUnitPart {
    readonly id = PartIds.CPU_BASIC;
    readonly name = "Basic CPU";
    readonly massKg = 2;
    readonly maxScriptChars = 10000;
    readonly processingBudgetPerTick = 50;
    readonly energyPerTickJ = 2;
    readonly scriptSlots = 1;
    readonly processingIntervalSeconds = 0.5; // Slow updates
    readonly exposes = [TelemetryIds.MASS];
}

export class AdvancedCPU implements ProcessingUnitPart {
    readonly id = PartIds.CPU_ADVANCED;
    readonly name = "Advanced CPU";
    readonly massKg = 2;
    readonly maxScriptChars = 32000;
    readonly processingBudgetPerTick = 100;
    readonly energyPerTickJ = 5;
    readonly scriptSlots = 1;
    readonly processingIntervalSeconds = 0.2;
    readonly exposes = [TelemetryIds.MASS];
}

export class OrbitalProcessingUnit implements ProcessingUnitPart {
    readonly id = PartIds.CPU_ORBITAL;
    readonly name = "Orbital Computer";
    readonly massKg = 3;
    readonly maxScriptChars = 64000;
    readonly processingBudgetPerTick = 250;
    readonly energyPerTickJ = 25; // High power
    readonly scriptSlots = 1;
    readonly processingIntervalSeconds = 0.1; // Fast updates

    readonly exposes = [
        TelemetryIds.MASS,
        TelemetryIds.APOAPSIS,
        TelemetryIds.PERIAPSIS,
        TelemetryIds.SOI_BODY,
    ];
}

// --- Sensors ---

export class BasicNavigationSensor implements SensorPart {
    readonly id = PartIds.SENSOR_NAV_BASIC;
    readonly name = "Basic Navigation Sensor";
    readonly massKg = 1;
    readonly exposes = [
        TelemetryIds.ALTITUDE,
        TelemetryIds.VELOCITY,
        TelemetryIds.ORIENTATION,
        TelemetryIds.POSITION,
        // Basic stuff
    ];
}

export class AdvancedNavigationSensor implements SensorPart {
    readonly id = PartIds.SENSOR_NAV_ADV;
    readonly name = "Advanced Navigation Sensor";
    readonly massKg = 15;
    readonly exposes = [
        TelemetryIds.ALTITUDE, TelemetryIds.FUEL, TelemetryIds.BATTERY, TelemetryIds.MASS, TelemetryIds.TEMPERATURE,
        TelemetryIds.POSITION,
        TelemetryIds.VELOCITY,
        TelemetryIds.ORIENTATION,
        TelemetryIds.AIR_DENSITY,
        TelemetryIds.RW_OMEGA,
        TelemetryIds.RW_DESIRED_OMEGA,
    ];
}

export class LidarSensor implements SensorPart {
    readonly id = PartIds.SENSOR_LIDAR;
    readonly name = "Laser Altimeter (LIDAR)";
    readonly massKg = 10;
    readonly exposes = [
        TelemetryIds.RADAR_ALT,
        TelemetryIds.VERTICAL_SPEED // Precision doppler
    ];
}

// --- Reaction Wheels ---

export class SmallReactionWheels implements ReactionWheelsPart {
    readonly id = PartIds.RW_SMALL;
    readonly name = "Small Reaction Wheels";
    readonly massKg = 5;
    /** Max sustainable angular velocity this unit can provide (rad/s) */
    readonly maxOmegaRadPerS = 0.5;
    /** Energy cost per (rad/s) per second. Example: 40 J/s at 1 rad/s. */
    readonly energyPerRadPerS = 40;
    readonly exposes = [TelemetryIds.RW_OMEGA, TelemetryIds.RW_MAX_OMEGA, TelemetryIds.RW_DESIRED_OMEGA];
}

// --- Antennas ---

const AntennaParts: Record<string, AntennaPart> = {
    "antenna.small": {
        id: PartIds.ANTENNA_SMALL,
        name: "Comm 16",
        rangeMeters: 500,
        bandwidth: 60, // 60 Bytes/s
        power: 0.5, // 0.5 Watts
        massKg: 1
    },
    "antenna.medium": {
        id: PartIds.ANTENNA_MEDIUM,
        name: "Comm DTS-M1",
        rangeMeters: 50_000_000, // interplanetary-ish
        bandwidth: 120, // Faster
        power: 2.5,
        massKg: 20
    },
    "antenna.relay": {
        id: PartIds.ANTENNA_RELAY,
        name: "Relay Dish",
        rangeMeters: 50_000_000, // 50,000 km (Full GEO+)
        bandwidth: 500,
        power: 10,
        massKg: 100
    },
    "antenna.deep": {
        id: PartIds.ANTENNA_DEEP,
        name: "Deep Space Dish",
        rangeMeters: 500_000_000, // 500,000 km (Moon+)
        bandwidth: 2000,
        power: 50,
        massKg: 250
    }
};

export class SmallAntenna implements AntennaPart {
    readonly id = AntennaParts["antenna.small"].id;
    readonly name = AntennaParts["antenna.small"].name;
    readonly massKg = AntennaParts["antenna.small"].massKg;
    readonly rangeMeters = AntennaParts["antenna.small"].rangeMeters;
    readonly bandwidth = AntennaParts["antenna.small"].bandwidth;
    readonly power = AntennaParts["antenna.small"].power;
    readonly exposes = [TelemetryIds.COMMS_RANGE];
}

export class MediumAntenna implements AntennaPart {
    readonly id = AntennaParts["antenna.medium"].id;
    readonly name = AntennaParts["antenna.medium"].name;
    readonly massKg = AntennaParts["antenna.medium"].massKg;
    readonly rangeMeters = AntennaParts["antenna.medium"].rangeMeters;
    readonly bandwidth = AntennaParts["antenna.medium"].bandwidth;
    readonly power = AntennaParts["antenna.medium"].power;
    readonly exposes = [TelemetryIds.COMMS_RANGE];
}

export class RelayAntenna implements AntennaPart {
    readonly id = AntennaParts["antenna.relay"].id;
    readonly name = AntennaParts["antenna.relay"].name;
    readonly massKg = AntennaParts["antenna.relay"].massKg;
    readonly rangeMeters = AntennaParts["antenna.relay"].rangeMeters;
    readonly bandwidth = AntennaParts["antenna.relay"].bandwidth;
    readonly power = AntennaParts["antenna.relay"].power;
    readonly exposes = [TelemetryIds.COMMS_RANGE];
}

export class DeepSpaceAntenna implements AntennaPart {
    readonly id = AntennaParts["antenna.deep"].id;
    readonly name = AntennaParts["antenna.deep"].name;
    readonly massKg = AntennaParts["antenna.deep"].massKg;
    readonly rangeMeters = AntennaParts["antenna.deep"].rangeMeters;
    readonly bandwidth = AntennaParts["antenna.deep"].bandwidth;
    readonly power = AntennaParts["antenna.deep"].power;
    readonly exposes = [TelemetryIds.COMMS_RANGE];
}
