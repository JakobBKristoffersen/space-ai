/**
 * Payload parts.
 * Currently just BasicSatellitePayload.
 */
import { PayloadPart } from "../Rocket";
import { BasicNavigationSensor } from "./Sensor";
import { SmallAntenna } from "./Antenna";
import { SmallBattery } from "./Battery";
// import { BasicSolarPanel } from "./SolarPanels"; // Solar not yet in Rocket definition? 
// No, I added SolarPanelPart to Rocket interface in Rocket.ts, but `Rocket` interface in `Rocket.ts` is circular?
// Actually, `PayloadPart` interface in `Rocket.ts` defines `satelliteConfig`.
// `satelliteConfig` has `parts` which mimics a rocket structure.
// I should keep it simple for now.

export class BasicSatellitePayload implements PayloadPart {
    readonly id = "payload.sat.basic";
    readonly name = "CubeSat Deployer";
    readonly massKg = 50;

    // The deployed satellite config
    readonly satelliteConfig = {
        name: "CubeSat",
        parts: {
            sensors: [new BasicNavigationSensor()],
            antennas: [new SmallAntenna()],
            batteries: [new SmallBattery()],
            solarPanels: [], // Add solar panels if I can import them, otherwise empty
        }
    };

    readonly exposes = ["payloadDeployCount"];
}
