import { NoseConePart, FinPart, ParachutePart, HeatShieldPart, StructurePart, PayloadPart } from "../Rocket";
import { BasicNavigationSensor } from "./Avionics";
import { SmallAntenna } from "./Avionics";
import { SmallBattery } from "./Power";
import { PartIds } from "../../game/GameIds";

// --- Aerodynamics ---

export class NoseCone implements NoseConePart {
    readonly id = PartIds.CONE_BASIC;
    name = "Nose Cone";
    massKg = 50;
    dragCoefficient = 0.2;
    heatTolerance = 2400;
}

export class Fin implements FinPart {
    readonly id = PartIds.FIN_BASIC;
    name = "Aerodynamic Fin";
    massKg = 25;
    dragCoefficient = 0.5;
}

export class Parachute implements ParachutePart {
    readonly id = PartIds.PARACHUTE_BASIC;
    name = "Parachute";
    massKg = 30;
    deployed = false;
    deployedDrag = 50.0;
}

export class HeatShield implements HeatShieldPart {
    readonly id = PartIds.HEATSHIELD_BASIC;
    name = "Heat Shield";
    massKg = 100;
    maxTemp = 3000;
    heatTolerance = 3400;
}

// --- Structure ---

export class LandingLegs implements StructurePart {
    readonly id = PartIds.LEG_LANDING_FIXED;
    readonly name = "Landing Legs";
    readonly massKg = 25;
    readonly category = "structure";

    // State
    deploymentState = 0; // 0=retracted, 1=extended
    deployed = false;

    // Physics
    dragCoefficient = 0.1;
    deployedDrag = 0.5;
}

// --- Payloads ---

export class BasicSatellitePayload implements PayloadPart {
    readonly id = PartIds.PAYLOAD_SAT_BASIC;
    readonly name = "CubeSat Deployer";
    readonly massKg = 50;

    // The deployed satellite config
    readonly satelliteConfig = {
        name: "CubeSat",
        parts: {
            sensors: [new BasicNavigationSensor()],
            antennas: [new SmallAntenna()],
            batteries: [new SmallBattery()],
            solar: [],
        }
    };

    readonly exposes = ["payloadDeployCount"];
}
