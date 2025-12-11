import type { AntennaPart } from "../Rocket";

export class SmallAntenna implements AntennaPart {
  readonly id = "antenna.small";
  readonly name = "Small Antenna";
  readonly massKg = 3;
  readonly rangeMeters = 15000; // 15 km starter
  readonly exposes = ["commsRocketRangeMeters"];
}
