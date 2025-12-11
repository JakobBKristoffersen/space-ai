/**
 * Fuel tank parts.
 * Provides SmallFuelTank and LargeFuelTank implementations.
 */
import { FuelTankPart } from "../Rocket";

export class SmallFuelTank implements FuelTankPart {
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
