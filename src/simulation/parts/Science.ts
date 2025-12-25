import { SciencePart } from "../Rocket";
import { PartIds } from "../../game/GameIds";

export class TemperatureScanner implements SciencePart {
    readonly id = PartIds.SCIENCE_TEMP;
    readonly name = "Temperature Scanner";
    readonly massKg = 1;
    readonly buffer = new Map<number, number>();
}

export class AtmosphereScanner implements SciencePart {
    readonly id = PartIds.SCIENCE_ATMOS;
    readonly name = "Barometer";
    readonly massKg = 1;
    readonly buffer = new Map<number, number>();
}

export class SurfaceScanner implements SciencePart {
    readonly id = PartIds.SCIENCE_SURFACE;
    readonly name = "Surface Scanner";
    readonly massKg = 10; // Heavy optics
    readonly powerDrawW = 10;
    readonly buffer = new Map<number, string>();
}

export class BiosampleContainer implements SciencePart {
    readonly id = PartIds.SCIENCE_BIO;
    readonly name = "Biological Sample Container";
    readonly massKg = 50; // Heavy shielding
    readonly powerDrawW = 5; // Life support
}
