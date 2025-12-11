/**
 * Fuel tank parts.
 * Provides SmallFuelTank, MediumFuelTank, and LargeFuelTank implementations.
 */
import { FuelTankPart } from "../Rocket";

export class BasicFuelTank implements FuelTankPart { // Alias for Small? Or distinct?
  // Let's make Basic = Small for checking compatibility or just rename class
  readonly id = "fueltank.small";
  readonly name = "Small Fuel Tank";
  readonly dryMassKg = 20;
  fuelKg = 60; // initial fuel load
  readonly capacityKg = 60;
  readonly exposes = ["fuelKg"];

  drawFuel(requestKg: number): number {
    const drawn = Math.min(this.fuelKg, Math.max(0, requestKg));
    this.fuelKg -= drawn;
    return drawn;
  }
}
// Alias class if needed for compatibility with old imports?
export { BasicFuelTank as SmallFuelTank };

export class MediumFuelTank implements FuelTankPart {
  readonly id = "fueltank.medium";
  readonly name = "Medium Fuel Tank";
  readonly dryMassKg = 40;
  fuelKg = 120;
  readonly capacityKg = 120;
  readonly exposes = ["fuelKg"];

  drawFuel(requestKg: number): number {
    const drawn = Math.min(this.fuelKg, Math.max(0, requestKg));
    this.fuelKg -= drawn;
    return drawn;
  }
}
// Alias if needed
export { MediumFuelTank as StandardFuelTank }; // Just in case

export class LargeFuelTank implements FuelTankPart {
  readonly id = "fueltank.large";
  readonly name = "Large Fuel Tank";
  readonly dryMassKg = 60;
  fuelKg = 200; // initial fuel load
  readonly capacityKg = 200;
  readonly exposes = ["fuelKg"];

  drawFuel(requestKg: number): number {
    const drawn = Math.min(this.fuelKg, Math.max(0, requestKg));
    this.fuelKg -= drawn;
    return drawn;
  }
}
// End of file
