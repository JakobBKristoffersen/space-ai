/**
 * PartStore and simple economy framework.
 * - Exposes available parts based on progression (e.g., completed missions).
 * - Allows purchasing parts using in-game money.
 * - Independent from rendering and physics.
 */

import { Money } from "./MissionManager";
import { BatteryPart, EnginePart, FuelTankPart, ProcessingUnitPart, SensorPart, ReactionWheelsPart } from "../simulation/Rocket";
import { SmallEngine } from "../simulation/parts/Engine";
import { SmallFuelTank, LargeFuelTank } from "../simulation/parts/FuelTank";
import { SmallBattery } from "../simulation/parts/Battery";
import { BasicProcessingUnit } from "../simulation/parts/ProcessingUnit";
import { BasicNavigationSensor } from "../simulation/parts/Sensor";
import { SmallReactionWheels } from "../simulation/parts/ReactionWheels";
import { SmallAntenna } from "../simulation/parts/Antenna";

export type PartCategory = "engine" | "fuel" | "battery" | "cpu" | "sensor" | "reactionWheels" | "antenna";

export interface StorePart<T> {
  readonly id: string;
  readonly name: string;
  readonly category: PartCategory;
  readonly price: Money;
  /** Factory to instantiate a fresh part when purchased. */
  make(): T;
  /** Unlock predicate: given completed missions, is this part unlocked? */
  isUnlocked(completedMissionIds: readonly string[]): boolean;
}

export interface Catalog {
  engines: StorePart<EnginePart>[];
  fuelTanks: StorePart<FuelTankPart>[];
  batteries: StorePart<BatteryPart>[];
  cpus: StorePart<ProcessingUnitPart>[];
  sensors: StorePart<SensorPart>[];
  reactionWheels: StorePart<ReactionWheelsPart>[];
  antennas: StorePart<any>[];
}

export class PartStore {
  constructor(private readonly catalog: Catalog) {}

  /** Return all parts available to purchase given progression. */
  listAvailable(completed: readonly string[]): StorePart<any>[] {
    return [
      ...this.catalog.engines,
      ...this.catalog.fuelTanks,
      ...this.catalog.batteries,
      ...this.catalog.cpus,
      ...this.catalog.sensors,
      ...this.catalog.reactionWheels,
      ...this.catalog.antennas,
    ].filter(p => p.isUnlocked(completed));
  }

  /** Attempts to purchase a part; returns the instance and new balance, or null if insufficient funds. */
  purchase<T>(
    partId: string,
    balance: Money,
    completed: readonly string[],
  ): { instance: T; newBalance: Money } | null {
    const all = this.listAvailable(completed);
    const part = all.find(p => p.id === partId) as StorePart<T> | undefined;
    if (!part) return null;
    if (balance < part.price) return null;
    return { instance: part.make(), newBalance: balance - part.price };
  }
}

/**
 * Default catalog with one example upgrade path.
 */
export const DefaultCatalog: Catalog = {
  engines: [
    {
      id: "engine.small",
      name: "Small Engine",
      category: "engine",
      price: 500,
      make: () => new SmallEngine(),
      isUnlocked: () => true, // starter engine
    },
  ],
  fuelTanks: [
    {
      id: "fueltank.small",
      name: "Small Fuel Tank",
      category: "fuel",
      price: 200,
      make: () => new SmallFuelTank(),
      isUnlocked: () => true,
    },
    {
      id: "fueltank.large",
      name: "Large Fuel Tank",
      category: "fuel",
      price: 800,
      make: () => new LargeFuelTank(),
      isUnlocked: (completed) => completed.includes("mission.reach.500m"),
    },
  ],
  batteries: [
    {
      id: "battery.small",
      name: "Small Battery",
      category: "battery",
      price: 150,
      make: () => new SmallBattery(),
      isUnlocked: () => true,
    },
  ],
  cpus: [
    {
      id: "cpu.basic",
      name: "Basic Guidance System",
      category: "cpu",
      price: 400,
      make: () => new BasicProcessingUnit(),
      isUnlocked: () => true,
    },
    // Example upgrade unlocked by mission completion
    {
      id: "cpu.advanced",
      name: "Advanced Guidance System",
      category: "cpu",
      price: 1200,
      make: () => ({
        id: "cpu.advanced",
        name: "Advanced Guidance System",
        massKg: 10,
        maxScriptChars: 12_000,
        processingBudgetPerTick: 350,
        energyPerTickJ: 120,
        scriptSlots: 2,
        processingIntervalSeconds: 1,
        exposes: [
          "cpuName",
          "cpuProcessingBudgetPerTick",
          "cpuMaxScriptChars",
          "cpuSlotCount",
          "cpuCostUsedLastTick",
          "cpuEnergyUsedLastTick",
          "cpuProcessingIntervalSeconds",
        ],
      } as ProcessingUnitPart),
      isUnlocked: (completed) => completed.includes("mission.reach.1km"),
    },
  ],
  sensors: [
    {
      id: "sensor.nav.basic",
      name: "Basic Navigation Sensor",
      category: "sensor",
      price: 100,
      make: () => new BasicNavigationSensor(),
      isUnlocked: () => true,
    },
  ],
  reactionWheels: [
    {
      id: "rw.small",
      name: "Small Reaction Wheels",
      category: "reactionWheels",
      price: 300,
      make: () => new SmallReactionWheels(),
      isUnlocked: () => true,
    },
  ],
  antennas: [
    {
      id: "antenna.small",
      name: "Small Antenna",
      category: "antenna",
      price: 250,
      make: () => new SmallAntenna(),
      isUnlocked: () => true,
    },
  ],
};
