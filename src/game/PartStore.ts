/**
 * PartStore and simple economy framework.
 * - Exposes available parts based on progression (e.g., completed missions).
 * - Parts are free to purchase once unlocked via Tech Tree.
 * - Independent from rendering and physics.
 */


import { EnginePart, FuelTankPart, BatteryPart, ProcessingUnitPart, SensorPart, ReactionWheelsPart, AntennaPart, PayloadPart, SolarPanelPart } from "../simulation/Rocket";
import { getTechForPart } from "./GameProgression";

// Helper to centralize unlock logic
function isPartUnlocked(partId: string, unlockedTechs: readonly string[]): boolean {
  const techId = getTechForPart(partId);
  if (!techId) return true; // Default unlocked (starter parts usually mapped to start, but dev parts might be undefined)
  // Logic: The tech ID returned is the requirement.
  return unlockedTechs.includes(techId);
}

export type PartCategory = "engine" | "fuel" | "battery" | "cpu" | "sensor" | "reactionWheels" | "antenna" | "payload" | "solar" | "cone" | "fin" | "parachute" | "heatShield" | "science" | "science_large" | "structure";

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
  structures: StorePart<any>[];
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

import { PartDefinitions } from "./PartDefinitions";

// Helper to build catalog from definitions
function buildCatalog(): Catalog {
  const catalog: Catalog = {
    engines: [],
    fuelTanks: [],
    batteries: [],
    cpus: [],
    sensors: [],
    reactionWheels: [],
    antennas: [],
    payloads: [],
    solarPanels: [],
    cones: [],
    fins: [],
    parachutes: [],
    heatShields: [],
    science: [],
    structures: []
  };

  for (const def of Object.values(PartDefinitions)) {
    const storePart: StorePart<any> = {
      id: def.id,
      name: def.name,
      category: def.category,
      make: def.factory,
      isUnlocked: (c, t) => isPartUnlocked(def.id, t)
    };

    switch (def.category) {
      case "engine": catalog.engines.push(storePart); break;
      case "fuel": catalog.fuelTanks.push(storePart); break;
      case "battery": catalog.batteries.push(storePart); break;
      case "cpu": catalog.cpus.push(storePart); break;
      case "sensor": catalog.sensors.push(storePart); break;
      case "reactionWheels": catalog.reactionWheels.push(storePart); break;
      case "antenna": catalog.antennas.push(storePart); break;
      case "payload": catalog.payloads.push(storePart); break;
      case "solar": catalog.solarPanels.push(storePart); break;
      case "cone": catalog.cones.push(storePart); break;
      case "fin": catalog.fins.push(storePart); break;
      case "parachute": catalog.parachutes.push(storePart); break;
      case "heatShield": catalog.heatShields.push(storePart); break;
      case "science": catalog.science.push(storePart); break;
      case "science_large": catalog.science.push(storePart); break; // Add large science to same tab? Or new? Assuming science tab for now
      case "structure": catalog.structures.push(storePart); break;
    }
  }

  return catalog;
}

export const DefaultCatalog: Catalog = buildCatalog();
