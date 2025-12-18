/**
 * PartStore and simple economy framework.
 * - Exposes available parts based on progression (e.g., completed missions).
 * - Parts are free to purchase once unlocked via Tech Tree.
 * - Independent from rendering and physics.
 */


import { BatteryPart, EnginePart, FuelTankPart, ProcessingUnitPart, SensorPart, ReactionWheelsPart, PayloadPart, AntennaPart, SolarPanelPart } from "../simulation/Rocket";
import { SmallEngine } from "../simulation/parts/Engine";
import { PrecisionEngine } from "../simulation/parts/PrecisionEngine";
import { BasicFuelTank, MediumFuelTank, LargeFuelTank, SmallFuelTank } from "../simulation/parts/FuelTank";
import { SmallBattery, MediumBattery } from "../simulation/parts/Battery";
import { BasicCPU, AdvancedCPU, OrbitalProcessingUnit } from "../simulation/parts/ProcessingUnit";
import { BasicNavigationSensor, AdvancedNavigationSensor } from "../simulation/parts/Sensor";
import { SmallReactionWheels } from "../simulation/parts/ReactionWheels";
import { SmallAntenna, MediumAntenna, RelayAntenna, DeepSpaceAntenna } from "../simulation/parts/Antenna";
import { PartUnlockData } from "./Unlocks";
import { VacuumEngine } from "../simulation/parts/VacuumEngine";
import { IonEngine } from "../simulation/parts/IonEngine";
import { BasicSatellitePayload } from "../simulation/parts/Payloads";
import { BasicSolarPanel } from "../simulation/parts/SolarPanels";
import { NoseCone, Fin, Parachute, HeatShield } from "../simulation/parts/Aerodynamics";
import { TemperatureScanner, AtmosphereScanner, SurfaceScanner } from "../simulation/parts/Science";

export type PartCategory = "engine" | "fuel" | "battery" | "cpu" | "sensor" | "reactionWheels" | "antenna" | "payload" | "solar" | "cone" | "fin" | "parachute" | "heatShield" | "science";

export interface StorePart<T> {
  readonly id: string;
  readonly name: string;
  readonly category: PartCategory;

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
  cones: StorePart<any>[];
  fins: StorePart<any>[];
  parachutes: StorePart<any>[];
  heatShields: StorePart<any>[];
  science: StorePart<any>[];
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
      ...this.catalog.cones,
      ...this.catalog.fins,
      ...this.catalog.parachutes,
      ...this.catalog.heatShields,
      ...this.catalog.science,
    ].filter(p => p.isUnlocked(completed, techs));
  }

  /** Attempts to purchase a part; returns the instance if allowed. */
  purchase<T>(
    partId: string,
    completed: readonly string[],
    techs: readonly string[],
  ): { instance: T } | null {
    const all = this.listAvailable(completed, techs);
    const part = all.find(p => p.id === partId) as StorePart<T> | undefined;
    if (!part) return null;
    // No money check
    return { instance: part.make() };
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

      make: () => new SmallEngine(),
      isUnlocked: () => true,
    },
    {
      id: "engine.precision",
      name: "Precision Engine",
      category: "engine",

      make: () => new PrecisionEngine(),
      isUnlocked: (_c, t) => t.includes("tech.propulsion_prec"),
    },
    {
      id: "engine.vacuum",
      name: "Vacuum Engine",
      category: "engine",

      make: () => new VacuumEngine(),
      isUnlocked: (_c, t) => t.includes("tech.propulsion_adv"),
    },
    {
      id: "engine.ion",
      name: "Ion Thruster",
      category: "engine",

      make: () => new IonEngine(),
      isUnlocked: (_c, t) => t.includes("tech.ion"),
    },
  ],
  fuelTanks: [
    {
      id: "fueltank.small",
      name: "Small Fuel Tank",
      category: "fuel",

      make: () => new SmallFuelTank(),
      isUnlocked: () => true,
    },
    {
      id: "fueltank.medium",
      name: "Medium Fuel Tank",
      category: "fuel",

      make: () => new MediumFuelTank(),
      isUnlocked: (_c, t) => t.includes("tech.batteries_med"), // Reusing logic or new tech?
    },
    {
      id: "fueltank.large",
      name: "Large Fuel Tank",
      category: "fuel",

      make: () => new LargeFuelTank(),
      isUnlocked: (_c, t) => t.includes("tech.batteries_med"),
    },
  ],
  batteries: [
    {
      id: "battery.small",
      name: "Small Battery",
      category: "battery",

      make: () => new SmallBattery(),
      isUnlocked: () => true,
    },
    {
      id: "battery.medium",
      name: "Medium Battery",
      category: "battery",

      make: () => new MediumBattery(),
      isUnlocked: (_c, t) => t.includes("tech.batteries_med"),
    },
  ],
  cpus: [
    {
      id: "cpu.basic",
      name: "Basic Guidance System",
      category: "cpu",

      make: () => new BasicCPU(),
      isUnlocked: () => true,
    },
    {
      id: "cpu.advanced",
      name: "Advanced Guidance System",
      category: "cpu",

      make: () => new AdvancedCPU(),
      isUnlocked: (_c, t) => t.includes(PartUnlockData["cpu.advanced"]?.techRequired || "tech.guidance_adv"),
    },
    {
      id: "cpu.orbital",
      name: "Orbital Computer",
      category: "cpu",

      make: () => new OrbitalProcessingUnit(),
      isUnlocked: (_c, t) => t.includes("tech.cpu_orbital"),
    },
  ],
  sensors: [
    {
      id: "sensor.nav.basic",
      name: "Basic Navigation Sensor",
      category: "sensor",

      make: () => new BasicNavigationSensor(),
      isUnlocked: () => true,
    },
    {
      id: "sensor.nav.adv",
      name: "Advanced Navigation Sensor",
      category: "sensor",

      make: () => new AdvancedNavigationSensor(),
      isUnlocked: (_c, t) => t.includes("tech.guidance_adv"),
    },
  ],
  reactionWheels: [
    {
      id: "rw.small",
      name: "Small Reaction Wheels",
      category: "reactionWheels",

      make: () => new SmallReactionWheels(),
      isUnlocked: () => true,
    },
  ],
  antennas: [
    {
      id: "antenna.small",
      name: "Small Antenna",
      category: "antenna",

      make: () => new SmallAntenna(),
      isUnlocked: () => true,
    },
    {
      id: "antenna.medium",
      name: "Medium Antenna",
      category: "antenna",

      make: () => new MediumAntenna(),
      isUnlocked: (_c, t) => t.includes("tech.comms_tracking"),
    },
    {
      id: "antenna.relay",
      name: "Relay Dish",
      category: "antenna",

      make: () => new RelayAntenna(),
      isUnlocked: (_c, t) => t.includes("tech.comms_tracking"),
    },
    {
      id: "antenna.deep",
      name: "Deep Space Dish",
      category: "antenna",

      make: () => new DeepSpaceAntenna(),
      isUnlocked: (_c, t) => t.includes("tech.comms_deep"),
    },
  ],
  payloads: [
    {
      id: "payload.sat.basic",
      name: "CubeSat Deployer",
      category: "payload",

      make: () => new BasicSatellitePayload(),
      isUnlocked: (_c, t) => t.includes("tech.satellite"),
    }
  ],
  solarPanels: [
    {
      id: "solar.basic",
      name: "Basic Solar Panel",
      category: "solar",

      make: () => new BasicSolarPanel(),
      isUnlocked: (_c, t) => t.includes("tech.solar_basic"),
    }
  ],
  cones: [
    {
      id: "cone.basic",
      name: "Nose Cone",
      category: "cone",

      make: () => ({ ...new NoseCone(), dragModifier: -0.2, heatTolerance: 2400 }) as unknown as NoseCone,
      isUnlocked: () => true,
    }
  ],
  fins: [
    {
      id: "fin.basic",
      name: "Aerodynamic Fin",
      category: "fin",

      make: () => new Fin(),
      isUnlocked: () => true,
    }
  ],
  parachutes: [
    {
      id: "parachute.basic",
      name: "Parachute",
      category: "parachute",

      make: () => new Parachute(),
      isUnlocked: () => true,
    }
  ],
  heatShields: [
    {
      id: "heatshield.basic",
      name: "Heat Shield",
      category: "heatShield",

      make: () => ({ ...new HeatShield(), heatTolerance: 3400 }) as unknown as HeatShield,
      isUnlocked: () => true,
    }
  ],
  science: [
    {
      id: "science.temp",
      name: "Temperature Scanner",
      category: "science",
      make: () => new TemperatureScanner(),
      isUnlocked: () => true,
    },
    {
      id: "science.atmos",
      name: "Atmosphere Scanner",
      category: "science",
      make: () => new AtmosphereScanner(),
      isUnlocked: (_c, t) => t.includes("tech.science_basic"),
    },
    {
      id: "science.surface",
      name: "Surface Scanner",
      category: "science",
      make: () => new SurfaceScanner(),
      isUnlocked: (_c, t) => t.includes("tech.science_basic"),
    }
  ]
};
