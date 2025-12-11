/**
 * Battery parts.
 * Provides SmallBattery and MediumBattery implementations.
 */
import { BatteryPart } from "../Rocket";

export class SmallBattery implements BatteryPart {
  readonly id = "battery.small";
  readonly name = "Small Battery";
  readonly massKg = 10;
  energyJoules = 50_000; // 50 kJ
  readonly capacityJoules = 50_000;
  readonly exposes = ["batteryJoules", "batteryCapacityJoules", "batteryPercent"];

  drawEnergy(requestJ: number): number {
    const drawn = Math.min(this.energyJoules, Math.max(0, requestJ));
    this.energyJoules -= drawn;
    return drawn;
  }
}

export class MediumBattery implements BatteryPart {
  readonly id = "battery.medium";
  readonly name = "Medium Battery";
  readonly massKg = 25;
  energyJoules = 150_000; // 150 kJ
  readonly capacityJoules = 150_000;
  readonly exposes = ["batteryJoules", "batteryCapacityJoules", "batteryPercent"];

  drawEnergy(requestJ: number): number {
    const drawn = Math.min(this.energyJoules, Math.max(0, requestJ));
    this.energyJoules -= drawn;
    return drawn;
  }
}
