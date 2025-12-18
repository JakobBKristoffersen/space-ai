/**
 * Unlocks.ts
 * Defines cost and research requirements for parts.
 */

export interface PartUnlockInfo {
    techRequired?: string; // Tech ID from ResearchSystem
}

export interface TechNode {
    id: string;
    name: string;
    description: string;
    costRP: number;
    parentIds: string[];
    // Visual layout hint (tier/column, row)
    tier: number;
    row: number; // 0 = middle, -1 = up, 1 = down

    // Detailed unlocks for UI
    unlockedComponents?: string[];
    unlockedMethods?: string[]; // RocketAPI methods or capabilities

    // Optional compatibility with legacy system if needed
    unlocksParts?: string[];
}

export const TechTreeDefinition: TechNode[] = [
    // --- Tier 0 (Starter) ---
    {
        id: "tech.start",
        name: "Start",
        description: "Basic rocketry components.",
        costRP: 0,
        parentIds: [],
        tier: 0,
        row: 0,
        unlockedComponents: ["Small Engine", "Small Tank", "Basic CPU", "Parachute", "Nav Sensor"],
        unlockedMethods: ["throttle()", "turn()", "alignTo()", "altitude", "velocity"]
    },

    // --- Tier 1 ---
    {
        id: "tech.basic_rocketry",
        name: "Basic Rocketry",
        description: "Larger fuel tanks and engines.",
        costRP: 10,
        parentIds: ["tech.start"],
        tier: 1,
        row: 0,
        unlockedComponents: ["Medium Tank", "Medium Battery"]
    },
    {
        id: "tech.electrics",
        name: "Electrics",
        description: "Batteries and solar power.",
        costRP: 10,
        parentIds: ["tech.start"],
        tier: 1,
        row: 1,
        unlockedComponents: ["Basic Solar Panel"]
    },
    {
        id: "tech.science_basic",
        name: "Basic Science",
        description: "Sensors to collect data.",
        costRP: 15,
        parentIds: ["tech.start"],
        tier: 1,
        row: -1,
        unlockedComponents: ["Atmos Scanner", "Surface Scanner"],
        unlockedMethods: ["science.atmosphere", "science.surface"]
    },

    // --- Tier 2 ---
    {
        id: "tech.guidance_adv",
        name: "Adv. Guidance",
        description: "Better flight computers.",
        costRP: 25,
        parentIds: ["tech.basic_rocketry"],
        tier: 2,
        row: 0,
        unlockedComponents: ["Precision Engine", "Adv. CPU"],
        unlockedMethods: ["32KB Memory", "Fast Loop (0.2s)", "Smoother Control"]
    },
    {
        id: "tech.comms_basic",
        name: "Basic Comms",
        description: "Transmit data back home.",
        costRP: 20,
        parentIds: ["tech.electrics"],
        tier: 2,
        row: 1,
        unlockedComponents: ["Medium Antenna"],
        unlockedMethods: ["Longer Range"]
    },
    {
        id: "tech.aerodynamics",
        name: "Aerodynamics",
        description: "Fins and nose cones.",
        costRP: 20,
        parentIds: ["tech.basic_rocketry", "tech.science_basic"],
        tier: 2,
        row: -1,
        unlockedComponents: ["Nose Cone", "Fins", "Heat Shield"]
    },

    // --- Tier 3 ---
    {
        id: "tech.staging",
        name: "Staging",
        description: "Heavy tanks.",
        costRP: 50,
        parentIds: ["tech.guidance_adv"],
        tier: 3,
        row: 0,
        unlockedComponents: ["Large Fuel Tank"]
    },
    {
        id: "tech.solar_adv",
        name: "Adv. Electrics",
        description: "Deployable solar panels.",
        costRP: 45,
        parentIds: ["tech.comms_basic"],
        tier: 3,
        row: 1,
        unlockedComponents: ["Large Battery"]
    },
    {
        id: "tech.orbital_sci",
        name: "Orbital Science",
        description: "Space-grade sensors.",
        costRP: 50,
        parentIds: ["tech.aerodynamics"],
        tier: 3,
        row: -1,
        unlockedComponents: ["Orbital Processor", "Adv. Sensors"],
        unlockedMethods: ["apoapsis", "periapsis", "64KB Memory"]
    },

    // --- Tier 4 ---
    {
        id: "tech.propulsion_vac",
        name: "Vacuum Propulsion",
        description: "Engines optimized for space.",
        costRP: 100,
        parentIds: ["tech.staging"],
        tier: 4,
        row: 0,
        unlockedComponents: ["Vacuum Engine"]
    },
    {
        id: "tech.comms_relay",
        name: "Relay Comms",
        description: "Long-range dishes.",
        costRP: 90,
        parentIds: ["tech.solar_adv"],
        tier: 4,
        row: 1,
        unlockedComponents: ["Relay Dish", "Deep Space Dish"],
        unlockedMethods: ["Deep Space Range"]
    },

    // --- Tier 5 ---
    {
        id: "tech.ion",
        name: "Ion Propulsion",
        description: "High efficiency, low thrust.",
        costRP: 300,
        parentIds: ["tech.propulsion_vac", "tech.comms_relay"],
        tier: 5,
        row: 0,
        unlockedComponents: ["Ion Thruster"]
    },
];

// Map PartID -> Unlock Info
// This maps specific parts to the Tech Tree nodes above
export const PartUnlockData: Record<string, PartUnlockInfo> = {
    // Starters
    "engine.small": { techRequired: "tech.start" },
    "fueltank.small": { techRequired: "tech.start" },
    "battery.small": { techRequired: "tech.start" },
    "cpu.basic": { techRequired: "tech.start" },
    "sensor.nav.basic": { techRequired: "tech.start" },
    "rw.small": { techRequired: "tech.start" },
    "antenna.small": { techRequired: "tech.start" },
    "cone.basic": { techRequired: "tech.aerodynamics" },
    "fin.basic": { techRequired: "tech.aerodynamics" },

    // Rocketry Branch
    "battery.medium": { techRequired: "tech.basic_rocketry" },
    "fueltank.medium": { techRequired: "tech.basic_rocketry" },
    "engine.precision": { techRequired: "tech.guidance_adv" },
    "fueltank.large": { techRequired: "tech.staging" },

    // Electrics/Comms
    "solar.basic": { techRequired: "tech.electrics" },
    "antenna.medium": { techRequired: "tech.comms_basic" },
    "battery.large": { techRequired: "tech.solar_adv" }, // imaginary part for now

    // Science
    "science.atmos": { techRequired: "tech.science_basic" },
    "science.surface": { techRequired: "tech.science_basic" },
    "science.temp": { techRequired: "tech.start" },

    // Advanced
    "engine.vacuum": { techRequired: "tech.propulsion_vac" },
    "antenna.relay": { techRequired: "tech.comms_relay" },
    "antenna.deep": { techRequired: "tech.comms_relay" },
    "engine.ion": { techRequired: "tech.ion" },

    "heatshield.basic": { techRequired: "tech.aerodynamics" },
};
