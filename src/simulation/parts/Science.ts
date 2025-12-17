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
    readonly massKg = 15;
    readonly scienceValue = 25;
    readonly cost = 500;
}
