/**
 * Processing unit parts.
 * BasicProcessingUnit limits script size and per-tick processing.
 */
import { ProcessingUnitPart } from "../Rocket";

export class BasicProcessingUnit implements ProcessingUnitPart {
  readonly id = "cpu.basic";
  readonly name = "Basic Guidance System";
  readonly massKg = 8;
  readonly maxScriptChars = 40_000; // characters
  readonly processingBudgetPerTick = 100; // abstract cost units
  readonly energyPerTickJ = 50; // joules per tick per running script
  readonly scriptSlots = 1;
  /** Run user scripts once every N seconds. */
  readonly processingIntervalSeconds = 2;
  readonly exposes = [
    "cpuName",
    "cpuProcessingBudgetPerTick",
    "cpuMaxScriptChars",
    "cpuSlotCount",
    "cpuCostUsedLastTick",
    "cpuEnergyUsedLastTick",
    "cpuProcessingIntervalSeconds",
  ];
  // TODO: Add thermal throttling and error handling features.
}
