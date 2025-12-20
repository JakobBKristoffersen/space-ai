
import { StructurePart } from "../Rocket";

export class LandingLegs implements StructurePart {
    readonly id = "leg.landing.fixed";
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
