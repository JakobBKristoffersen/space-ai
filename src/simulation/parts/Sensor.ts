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
    "position",
    "velocity",
    // Orientation and simple orbital elements for autopilot logic
    "orientationRad",
    "apAltitude",
    "peAltitude",
    // Atmosphere density for liftoff logic
    "airDensity",
  ];
  // TODO: In a future 3D/world model, expose latitude/longitude specifically.
}
