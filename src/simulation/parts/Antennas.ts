/**
 * Antennas
 * - Medium: Better range (GEO)
 * - Relay: High power, relay capability (future)
 * - Deep Space: Moon/Mars range
 */
import { AntennaPart } from "../Rocket";

// Base Range reference: 
// Low Orbit (Leo): ~2,000 km (2,000,000 m)
// Geo: ~35,000 km
// Moon: ~384,000 km

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
