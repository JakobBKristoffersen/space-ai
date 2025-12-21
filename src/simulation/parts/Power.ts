/**
 * Power parts: Batteries and Solar Panels.
 */
import { BatteryPart, SolarPanelPart } from "../Rocket";
import { PartIds, TelemetryIds } from "../../game/GameIds";

// --- Batteries ---

export class SmallBattery implements BatteryPart {
    readonly id = PartIds.BATTERY_SMALL;
    readonly name = "Small Battery";
    readonly massKg = 1.0;
    energyJoules = 2_000; // 2 kJ
    readonly capacityJoules = 2_000;
    readonly exposes = [TelemetryIds.BATTERY, TelemetryIds.BATTERY_CAPACITY, TelemetryIds.BATTERY_PERCENT];

    drawEnergy(requestJ: number): number {
        const drawn = Math.min(this.energyJoules, Math.max(0, requestJ));
        this.energyJoules -= drawn;
        return drawn;
    }
}

export class MediumBattery implements BatteryPart {
    readonly id = PartIds.BATTERY_MEDIUM;
    readonly name = "Medium Battery";
    readonly massKg = 7.0;
    energyJoules = 15_000; // 15 kJ
    readonly capacityJoules = 15_000;
    readonly exposes = [TelemetryIds.BATTERY, TelemetryIds.BATTERY_CAPACITY, TelemetryIds.BATTERY_PERCENT];

    drawEnergy(requestJ: number): number {
        const drawn = Math.min(this.energyJoules, Math.max(0, requestJ));
        this.energyJoules -= drawn;
        return drawn;
    }
}

// --- Solar Panels ---

export class BasicSolarPanel implements SolarPanelPart {
    readonly id = PartIds.SOLAR_BASIC;
    readonly name = "Basic Solar Panel";
    readonly massKg = 15;
    readonly generationWatts = 500; // 50 J/s
    deployed = false;
    readonly retractable = false;
    readonly exposes = [TelemetryIds.SOLAR_INPUT];
}
