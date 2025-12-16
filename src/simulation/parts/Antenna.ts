export interface AntennaPart {
  id: string;
  name: string;
  range: number; // in meters
  // Bandwidth in BYTES per second
  bandwidth: number;
  /** Power consumption in Watts (Joules/sec) while transmitting. */
  power: number;
  cost: number;
  mass: number;
}

export const AntennaParts: Record<string, AntennaPart> = {
  "antenna.small": {
    id: "antenna.small",
    name: "Comm 16",
    range: 500_000,
    bandwidth: 20, // 20 Bytes/s
    power: 0.5, // 0.5 Watts
    cost: 300,
    mass: 5
  },
  "antenna.medium": {
    id: "antenna.medium",
    name: "Comm DTS-M1",
    range: 50_000_000, // interplanetary-ish
    bandwidth: 120, // Faster
    power: 2.5,
    cost: 900,
    mass: 20
  },
  "antenna.relay": {
    id: "antenna.relay",
    name: "Relay Dish",
    range: 50_000_000, // 50,000 km (Full GEO+)
    bandwidth: 500,
    power: 10,
    cost: 5000,
    mass: 100
  },
  "antenna.deep": {
    id: "antenna.deep",
    name: "Deep Space Dish",
    range: 500_000_000, // 500,000 km (Moon+)
    bandwidth: 2000,
    power: 50,
    cost: 15000,
    mass: 250
  }
};

// Class wrappers for PartStore compatibility
export class SmallAntenna implements AntennaPart {
  readonly id = AntennaParts["antenna.small"].id;
  readonly name = AntennaParts["antenna.small"].name;
  readonly massKg = AntennaParts["antenna.small"].mass;
  readonly rangeMeters = AntennaParts["antenna.small"].range;
  readonly bandwidth = AntennaParts["antenna.small"].bandwidth;
  readonly power = AntennaParts["antenna.small"].power;
  readonly cost = AntennaParts["antenna.small"].cost;
  readonly mass = AntennaParts["antenna.small"].mass;
  readonly range = AntennaParts["antenna.small"].range;
  readonly exposes = ["commsRocketRangeMeters"];
}

export class MediumAntenna implements AntennaPart {
  readonly id = AntennaParts["antenna.medium"].id;
  readonly name = AntennaParts["antenna.medium"].name;
  readonly massKg = AntennaParts["antenna.medium"].mass;
  readonly rangeMeters = AntennaParts["antenna.medium"].range;
  readonly bandwidth = AntennaParts["antenna.medium"].bandwidth;
  readonly power = AntennaParts["antenna.medium"].power;
  readonly cost = AntennaParts["antenna.medium"].cost;
  readonly mass = AntennaParts["antenna.medium"].mass;
  readonly range = AntennaParts["antenna.medium"].range;
  readonly exposes = ["commsRocketRangeMeters"];
}

export class RelayAntenna implements AntennaPart {
  readonly id = AntennaParts["antenna.relay"].id;
  readonly name = AntennaParts["antenna.relay"].name;
  readonly massKg = AntennaParts["antenna.relay"].mass;
  readonly rangeMeters = AntennaParts["antenna.relay"].range;
  readonly bandwidth = AntennaParts["antenna.relay"].bandwidth;
  readonly power = AntennaParts["antenna.relay"].power;
  readonly cost = AntennaParts["antenna.relay"].cost;
  readonly mass = AntennaParts["antenna.relay"].mass;
  readonly range = AntennaParts["antenna.relay"].range;
  readonly exposes = ["commsRocketRangeMeters"];
}

export class DeepSpaceAntenna implements AntennaPart {
  readonly id = AntennaParts["antenna.deep"].id;
  readonly name = AntennaParts["antenna.deep"].name;
  readonly massKg = AntennaParts["antenna.deep"].mass;
  readonly rangeMeters = AntennaParts["antenna.deep"].range;
  readonly bandwidth = AntennaParts["antenna.deep"].bandwidth;
  readonly power = AntennaParts["antenna.deep"].power;
  readonly cost = AntennaParts["antenna.deep"].cost;
  readonly mass = AntennaParts["antenna.deep"].mass;
  readonly range = AntennaParts["antenna.deep"].range;
  readonly exposes = ["commsRocketRangeMeters"];
}
