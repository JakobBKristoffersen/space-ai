import { SciencePart } from "../Rocket";

export interface ScienceData {
    experimentId: string;
    description: string;
    dataSizeKb: number;
    value: number; // RP value
}

export class ScienceExperiment implements SciencePart {
    readonly id = "science.basic";
    name = "Science Experiment";
    massKg = 20;

    collect(): ScienceData {
        return {
            experimentId: this.id,
            description: "Basic Experiment Data",
            dataSizeKb: 10,
            value: 5
        };
    }
}

export class TemperatureScanner implements SciencePart {
    readonly id = "science.thermometer";
    readonly name = "Thermometer";
    readonly massKg = 5;
    readonly scienceValue = 10;

    collect(altitude: number): ScienceData {
        // Generate data
        const temp = 288 - 0.006 * altitude; // Simple model
        return {
            experimentId: Math.random().toString(36).slice(2), // Changed from 'id' to 'experimentId'
            description: `Temperature at ${altitude.toFixed(0)}m is ${temp.toFixed(1)}K`, // Removed 'name'
            value: this.scienceValue,
            dataSizeKb: 5, // 5KB
            // Removed 'collectedAt' as it's not in ScienceData
        };
    }
}
