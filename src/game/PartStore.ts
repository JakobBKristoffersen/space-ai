/**
 * PartStore and simple economy framework.
 * - Exposes available parts based on progression (e.g., completed missions).
 * - Allows purchasing parts using in-game money.
 * - Independent from rendering and physics.
 */

import { Money } from "./MissionManager";
import { BatteryPart, EnginePart, FuelTankPart, ProcessingUnitPart, SensorPart, ReactionWheelsPart, PayloadPart, AntennaPart, SolarPanelPart } from "../simulation/Rocket";
import { SmallEngine } from "../simulation/parts/Engine";
import { PrecisionEngine } from "../simulation/parts/PrecisionEngine";
import { BasicFuelTank, MediumFuelTank, LargeFuelTank, SmallFuelTank } from "../simulation/parts/FuelTank";
import { SmallBattery, MediumBattery } from "../simulation/parts/Battery";
import { BasicCPU, AdvancedCPU, OrbitalProcessingUnit } from "../simulation/parts/ProcessingUnit";
import { BasicNavigationSensor, AdvancedNavigationSensor } from "../simulation/parts/Sensor";
import { SmallReactionWheels } from "../simulation/parts/ReactionWheels";
import { SmallAntenna, MediumAntenna, RelayAntenna, DeepSpaceAntenna } from "../simulation/parts/Antenna";
import { PartUnlockData } from "../parts/Unlocks";
import { VacuumEngine } from "../simulation/parts/VacuumEngine";
import { IonEngine } from "../simulation/parts/IonEngine";
import { BasicSatellitePayload } from "../simulation/parts/Payloads";
import { BasicSolarPanel } from "../simulation/parts/SolarPanels";

export type PartCategory = "engine" | "fuel" | "battery" | "cpu" | "sensor" | "reactionWheels" | "antenna" | "payload" | "solar";

export interface StorePart<T> {
  readonly id: string;
  readonly name: string;
  readonly category: PartCategory;
  readonly price: Money;
  /** Factory to instantiate a fresh part when purchased. */
  make(): T;
  /** Unlock predicate: given completed missions and unlocked techs, is this part unlocked? */
  isUnlocked(completed: readonly string[], techs: readonly string[]): boolean;
}

export interface Catalog {
  engines: StorePart<EnginePart>[];
  fuelTanks: StorePart<FuelTankPart>[];
  batteries: StorePart<BatteryPart>[];
  cpus: StorePart<ProcessingUnitPart>[];
  sensors: StorePart<SensorPart>[];
  reactionWheels: StorePart<ReactionWheelsPart>[];
  antennas: StorePart<AntennaPart>[];
  payloads: StorePart<PayloadPart>[];
  solarPanels: StorePart<SolarPanelPart>[];
}

export class PartStore {
  constructor(private readonly catalog: Catalog) { }

  /** Return all parts available to purchase given progression. */
  listAvailable(completed: readonly string[], techs: readonly string[]): StorePart<any>[] {
    return [
      ...this.catalog.engines,
      ...this.catalog.fuelTanks,
      ...this.catalog.batteries,
      ...this.catalog.cpus,
      ...this.catalog.sensors,
      ...this.catalog.reactionWheels,
      ...this.catalog.antennas,
      ...this.catalog.payloads,
      ...this.catalog.solarPanels,
    ].filter(p => p.isUnlocked(completed, techs));
  }

  /** Attempts to purchase a part; returns the instance and new balance, or null if insufficient funds. */
  purchase<T>(
    partId: string,
    balance: Money,
    completed: readonly string[],
    techs: readonly string[],
  ): { instance: T; newBalance: Money } | null {
    const all = this.listAvailable(completed, techs);
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
      price: PartUnlockData["engine.small"]?.moneyCost ?? 500,
      make: () => new SmallEngine(),
      isUnlocked: () => true,
    },
    {
      id: "engine.precision",
      name: "Precision Engine",
      category: "engine",
      price: PartUnlockData["engine.precision"]?.moneyCost ?? 1500,
      make: () => new PrecisionEngine(),
      isUnlocked: (_c, t) => t.includes("tech.propulsion_prec"),
    },
    {
      id: "engine.vacuum",
      name: "Vacuum Engine",
      category: "engine",
      price: 2500,
      make: () => new VacuumEngine(),
      isUnlocked: (_c, t) => t.includes("tech.propulsion_adv"),
    },
    {
      id: "engine.ion",
      name: "Ion Thruster",
      category: "engine",
      price: 5000,
      make: () => new IonEngine(),
      isUnlocked: (_c, t) => t.includes("tech.ion"),
    },
  ],
  fuelTanks: [
    {
      id: "fueltank.small",
      name: "Small Fuel Tank",
      category: "fuel",
      price: PartUnlockData["fueltank.small"]?.moneyCost ?? 200,
      make: () => new SmallFuelTank(),
      isUnlocked: () => true,
    },
    {
      id: "fueltank.medium",
      name: "Medium Fuel Tank",
      category: "fuel",
      price: 500,
      make: () => new MediumFuelTank(),
      isUnlocked: (_c, t) => t.includes("tech.batteries_med"), // Reusing logic or new tech?
    },
    {
      id: "fueltank.large",
      name: "Large Fuel Tank",
      category: "fuel",
      price: PartUnlockData["fueltank.large"]?.moneyCost ?? 800,
      make: () => new LargeFuelTank(),
      isUnlocked: (_c, t) => t.includes("tech.batteries_med"),
    },
  ],
  batteries: [
    {
      id: "battery.small",
      name: "Small Battery",
      category: "battery",
      price: PartUnlockData["battery.small"]?.moneyCost ?? 150,
      make: () => new SmallBattery(),
      isUnlocked: () => true,
    },
    {
      id: "battery.medium",
      name: "Medium Battery",
      category: "battery",
      price: 400,
      make: () => new MediumBattery(),
      isUnlocked: (_c, t) => t.includes("tech.batteries_med"),
    },
  ],
  cpus: [
    {
      id: "cpu.basic",
      name: "Basic Guidance System",
      category: "cpu",
      price: PartUnlockData["cpu.basic"]?.moneyCost ?? 400,
      make: () => new BasicCPU(),
      isUnlocked: () => true,
    },
    {
      id: "cpu.advanced",
      name: "Advanced Guidance System",
      category: "cpu",
      price: PartUnlockData["cpu.advanced"]?.moneyCost ?? 1200,
      make: () => new AdvancedCPU(),
      isUnlocked: (_c, t) => t.includes(PartUnlockData["cpu.advanced"]?.techRequired || "tech.guidance_adv"),
    },
    {
      id: "cpu.orbital",
      name: "Orbital Computer",
      category: "cpu",
      price: 3000,
      make: () => new OrbitalProcessingUnit(),
      isUnlocked: (_c, t) => t.includes("tech.cpu_orbital"),
    },
  ],
  sensors: [
    {
      id: "sensor.nav.basic",
      name: "Basic Navigation Sensor",
      category: "sensor",
      price: PartUnlockData["sensor.nav.basic"]?.moneyCost ?? 100,
      make: () => new BasicNavigationSensor(),
      isUnlocked: () => true,
    },
    {
      id: "sensor.nav.adv",
      name: "Advanced Navigation Sensor",
      category: "sensor",
      price: 500,
      make: () => new AdvancedNavigationSensor(),
      isUnlocked: (_c, t) => t.includes("tech.guidance_adv"),
    },
  ],
  reactionWheels: [
    {
      id: "rw.small",
      name: "Small Reaction Wheels",
      category: "reactionWheels",
      price: PartUnlockData["rw.small"]?.moneyCost ?? 300,
      make: () => new SmallReactionWheels(),
      isUnlocked: () => true,
    },
  ],
  antennas: [
    {
      id: "antenna.small",
      name: "Small Antenna",
      category: "antenna",
      price: PartUnlockData["antenna.small"]?.moneyCost ?? 250,
      make: () => new SmallAntenna(),
      isUnlocked: () => true,
    },
    {
      id: "antenna.medium",
      name: "Medium Antenna",
      category: "antenna",
      price: 600,
      make: () => new MediumAntenna(),
      isUnlocked: (_c, t) => t.includes("tech.comms_tracking"),
    },
    {
      id: "antenna.relay",
      name: "Relay Dish",
      category: "antenna",
      price: 1500,
      make: () => new RelayAntenna(),
      isUnlocked: (_c, t) => t.includes("tech.comms_tracking"),
    },
    {
      id: "antenna.deep",
      name: "Deep Space Dish",
      category: "antenna",
      price: 3000,
      make: () => new DeepSpaceAntenna(),
      isUnlocked: (_c, t) => t.includes("tech.comms_deep"),
    },
  ],
  payloads: [
    {
      id: "payload.sat.basic",
      name: "CubeSat Deployer",
      category: "payload",
      price: 1000,
      make: () => new BasicSatellitePayload(),
      isUnlocked: (_c, t) => t.includes("tech.satellite"),
    }
  ],
  solarPanels: [
    {
      id: "solar.basic",
      name: "Basic Solar Panel",
      category: "solar",
      price: 300,
      make: () => new BasicSolarPanel(),
      isUnlocked: (_c, t) => t.includes("tech.solar_basic"),
    }
  ]
};
