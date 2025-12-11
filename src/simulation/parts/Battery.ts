/**
 * Battery parts.
 * Provides a simple SmallBattery implementation.
 */
import { BatteryPart } from "../Rocket";

export class SmallBattery implements BatteryPart {
  readonly id = "battery.small";
  readonly name = "Small Battery";
  readonly massKg = 10;
  energyJoules = 50_000; // 50 kJ placeholder
  readonly capacityJoules = 50_000;
  readonly exposes = ["batteryJoules", "batteryCapacityJoules", "batteryPercent"];

  drawEnergy(requestJ: number): number {
    const drawn = Math.min(this.energyJoules, Math.max(0, requestJ));
    this.energyJoules -= drawn;
    return drawn;
  }
}
