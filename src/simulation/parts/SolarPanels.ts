/**
 * Solar Panels
 * Generate energy based on... sunlight?
 * For now, just a constant trickle or simple day/night check if possible.
 * Rocket.ts needs to support 'Generator' parts.
 * Currently it has Engines, Tanks, Batteries, CPU, Sensors, RW, Antennas, Payloads.
 * No 'Generators'.
 * 
 * I should probably add 'Generators' or 'SolarPanels' array to Rocket.ts.
 * Or make them a type of 'Battery' that has negative draw? No, hacky.
 * 
 * Plan:
 * 1. Add `solarPanels: SolarPanelPart[]` to Rocket.ts
 * 2. In `tickInternal`, iterate solar panels and add energy to batteries.
 */

export interface SolarPanelPart {
    readonly id: string;
    readonly name: string;
    readonly massKg: number;
    readonly generationWatts: number;
    readonly exposes?: string[];
}

export class BasicSolarPanel implements SolarPanelPart {
    readonly id = "solar.basic";
    readonly name = "Basic Solar Panel";
    readonly massKg = 15;
    readonly generationWatts = 50; // 50 J/s
    readonly exposes = ["solarInputWatts"];
}
