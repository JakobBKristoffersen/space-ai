import { SciencePart } from "../Rocket";



export class TemperatureScanner implements SciencePart {
    readonly id = "science.temp";
    readonly name = "Temperature Scanner";
    readonly massKg = 5;
    readonly scienceValue = 10;
    readonly cost = 100;
}

export class AtmosphereScanner implements SciencePart {
    readonly id = "science.atmos";
    readonly name = "Barometer";
    readonly massKg = 5;
    readonly scienceValue = 15;
    readonly cost = 200;
}

export class SurfaceScanner implements SciencePart {
    readonly id = "science.surface";
    readonly name = "Surface Scanner";
    readonly massKg = 30; // Heavy optics
    readonly powerDrawW = 10;
    readonly scienceValue = 25;
    readonly cost = 500;
}

export class BiosampleContainer implements SciencePart {
    readonly id = "science.bio_sample";
    readonly name = "Biological Sample Container";
    readonly massKg = 50; // Heavy shielding
    readonly powerDrawW = 5; // Life support
    readonly scienceValue = 50;
    readonly cost = 1000;
}

