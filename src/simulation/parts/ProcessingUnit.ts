/**
 * Processing Units
 * - Basic: Low power, slow
 * - Advanced: Better
 * - Orbital CPU: High memory, fast interval, exposes orbital elements.
 */
import { ProcessingUnitPart } from "../Rocket";

export class BasicCPU implements ProcessingUnitPart {
  readonly id = "cpu.basic";
  readonly name = "Basic CPU";
  readonly massKg = 5;
  readonly maxScriptChars = 2000;
  readonly processingBudgetPerTick = 50;
  readonly energyPerTickJ = 2;
  readonly scriptSlots = 1;
  readonly processingIntervalSeconds = 0.5; // Slow updates
}
export { BasicCPU as BasicProcessingUnit };

export class AdvancedCPU implements ProcessingUnitPart {
  readonly id = "cpu.advanced";
  readonly name = "Advanced CPU";
  readonly massKg = 10;
  readonly maxScriptChars = 8000;
  readonly processingBudgetPerTick = 100;
  readonly energyPerTickJ = 5;
  readonly scriptSlots = 2;
  readonly processingIntervalSeconds = 0.2;
}

export class OrbitalProcessingUnit implements ProcessingUnitPart {
  readonly id = "cpu.orbital";
  readonly name = "Orbital Computer";
  readonly massKg = 20;
  readonly maxScriptChars = 32000;
  readonly processingBudgetPerTick = 250;
  readonly energyPerTickJ = 25; // High power
  readonly scriptSlots = 4;
  readonly processingIntervalSeconds = 0.1; // Fast updates

  readonly exposes = [
    "apAltitude",
    "peAltitude",
    "soiBodyId",
  ];
}
