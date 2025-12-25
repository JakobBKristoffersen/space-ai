/**
 * Fuel tank parts.
 * Provides SmallFuelTank, MediumFuelTank, and LargeFuelTank implementations.
 */
import { FuelTankPart } from "../Rocket";
import { PartIds, TelemetryIds } from "../../game/GameIds";

export class SmallFuelTank implements FuelTankPart {
    readonly id = PartIds.FUEL_SMALL;
    readonly name = "Small Fuel Tank";
    readonly dryMassKg = 20;
    fuelKg = 80; // initial fuel load
    readonly capacityKg = 80;
    readonly exposes = [TelemetryIds.FUEL];

    drawFuel(requestKg: number): number {
        const drawn = Math.min(this.fuelKg, Math.max(0, requestKg));
        this.fuelKg -= drawn;
        return drawn;
    }
}
// Alias for compatibility if needed, but we used SmallFuelTank in PartDefinitions
export { SmallFuelTank as BasicFuelTank };

export class MediumFuelTank implements FuelTankPart {
    readonly id = PartIds.FUEL_MEDIUM;
    readonly name = "Medium Fuel Tank";
    readonly dryMassKg = 40;
    fuelKg = 120;
    readonly capacityKg = 120;
    readonly exposes = [TelemetryIds.FUEL];

    drawFuel(requestKg: number): number {
        const drawn = Math.min(this.fuelKg, Math.max(0, requestKg));
        this.fuelKg -= drawn;
        return drawn;
    }
}

export class LargeFuelTank implements FuelTankPart {
    readonly id = PartIds.FUEL_LARGE;
    readonly name = "Large Fuel Tank";
    readonly dryMassKg = 60;
    fuelKg = 200; // initial fuel load
    readonly capacityKg = 200;
    readonly exposes = [TelemetryIds.FUEL];

    drawFuel(requestKg: number): number {
        const drawn = Math.min(this.fuelKg, Math.max(0, requestKg));
        this.fuelKg -= drawn;
        return drawn;
    }
}
