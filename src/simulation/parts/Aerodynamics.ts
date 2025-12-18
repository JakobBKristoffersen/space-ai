import { NoseConePart, FinPart, ParachutePart, HeatShieldPart } from "../Rocket";

export class NoseCone implements NoseConePart {
    readonly id = "cone.basic";
    name = "Nose Cone";
    massKg = 50;
    dragCoefficient = 0.2;
    heatTolerance = 2400;
}

export class Fin implements FinPart {
    readonly id = "fin.basic";
    name = "Aerodynamic Fin";
    massKg = 25;
    dragCoefficient = 0.5;
}

export class Parachute implements ParachutePart {
    readonly id = "parachute.basic";
    name = "Parachute";
    massKg = 30;
    deployed = false;
    deployedDrag = 50.0;
}

export class HeatShield implements HeatShieldPart {
    readonly id = "heatshield.basic";
    name = "Heat Shield";
    massKg = 100;
    maxTemp = 3000;
    heatTolerance = 3400;
}
