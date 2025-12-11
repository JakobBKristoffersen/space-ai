/**
 * Sensor parts.
 * - BasicNavigationSensor exposes minimal navigation fields.
 */
import { SensorPart } from "../Rocket";

export class BasicNavigationSensor implements SensorPart {
  readonly id = "sensor.nav.basic";
  readonly name = "Basic Navigation Sensor";
  readonly massKg = 5;
  readonly exposes = [
    "altitude",
    "fuelKg",
    "batteryJoules",
    "massKg",
    "temperature",
    // Basic stuff
  ];
}

export class AdvancedNavigationSensor implements SensorPart {
  readonly id = "sensor.nav.adv";
  readonly name = "Advanced Navigation Sensor";
  readonly massKg = 15;
  readonly exposes = [
    // Inherits basic? No, explicit list usually better or UI handles merge.
    // Let's duplicate basic fields so installing JUST advanced works.
    "altitude", "fuelKg", "batteryJoules", "massKg", "temperature",
    // Advanced
    "position",
    "velocity",
    "orientationRad",
    "airDensity",
    "rwOmegaRadPerS",
    "rwDesiredOmegaRadPerS", // useful for debugging autopilot
  ];
}
