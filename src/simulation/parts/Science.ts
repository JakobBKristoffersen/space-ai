import { SciencePart } from "../Rocket";
import { PartIds } from "../../game/GameIds";

export class TemperatureScanner implements SciencePart {
    readonly id = PartIds.SCIENCE_TEMP;
    readonly name = "Temperature Scanner";
    readonly massKg = 5;
    readonly scienceValue = 10;
}

export class AtmosphereScanner implements SciencePart {
    readonly id = PartIds.SCIENCE_ATMOS;
    readonly name = "Barometer";
    readonly massKg = 5;
    readonly scienceValue = 15;
}

export class SurfaceScanner implements SciencePart {
    readonly id = PartIds.SCIENCE_SURFACE;
    readonly name = "Surface Scanner";
    readonly massKg = 30; // Heavy optics
    readonly powerDrawW = 10;
    readonly scienceValue = 25;
}

export class BiosampleContainer implements SciencePart {
    readonly id = PartIds.SCIENCE_BIO;
    readonly name = "Biological Sample Container";
    readonly massKg = 50; // Heavy shielding
    readonly powerDrawW = 5; // Life support
    readonly scienceValue = 50;
}
