import { AntennaPart } from "../Rocket";

export class SimpleAntenna implements AntennaPart {
  readonly id = "antenna.small";
  readonly name = "Small Antenna";
  readonly massKg = 3;
  readonly rangeMeters = 15000; // 15 km starter
  readonly exposes = ["commsRocketRangeMeters"];
}
// Alias for compatibility if needed
export { SimpleAntenna as SmallAntenna };

export class MediumAntenna implements AntennaPart {
  readonly id = "antenna.medium";
  readonly name = "Medium Gain Antenna";
  readonly massKg = 20;
  readonly rangeMeters = 5000000; // 5,000 km (MEO/GEO-ish)
  readonly exposes = ["commsDistanceMeters", "commsSignalStrength"];
}

export class RelayAntenna implements AntennaPart {
  readonly id = "antenna.relay";
  readonly name = "Relay Dish";
  readonly massKg = 100;
  readonly rangeMeters = 50000000; // 50,000 km (Full GEO+)
  readonly exposes = ["commsDistanceMeters", "commsSignalStrength", "connectedRelays"];
}

export class DeepSpaceAntenna implements AntennaPart {
  readonly id = "antenna.deep";
  readonly name = "Deep Space Dish";
  readonly massKg = 250;
  readonly rangeMeters = 500000000; // 500,000 km (Moon+)
  readonly exposes = ["commsDistanceMeters", "commsSignalStrength"];
}
