/**
 * GameProgression.ts
 *
 * Single Source of Truth for the Game's Progression System.
 * Defines the Tech Tree, including costs, dependencies, and exactly what each node unlocks (Parts & API).
 */

import { ApiFeatures, PartIds, TechIds } from "./GameIds";

export interface ProgressionNode {
    id: string;
    name: string;
    description: string;
    costRP: number;
    parentIds: string[];

    // Visual layout
    tier: number;
    row: number; // 0 = middle, -1 = up, 1 = down

    /** List of Part IDs unlocked by this tech (Must match PartStore IDs) */
    parts: string[];

    /** List of RocketAPI features enabled by this tech */
    apiFeatures: string[];
}

export const GameProgression: ProgressionNode[] = [
    // --- Tier 0 (Starter) ---
    {
        id: TechIds.START,
        name: "Start",
        description: "Basic rocketry components.",
        costRP: 0,
        parentIds: [],
        tier: 0,
        row: 0,
        parts: [
            PartIds.ENGINE_SMALL,
            PartIds.FUEL_SMALL,
            //PartIds.BATTERY_SMALL,
            //PartIds.CPU_BASIC,
            //PartIds.SENSOR_NAV_BASIC,
            //PartIds.RW_SMALL,
            //PartIds.ANTENNA_SMALL,
            //PartIds.SCIENCE_TEMP
        ],
        apiFeatures: [
            ApiFeatures.CONTROL_THROTTLE,
            //ApiFeatures.CONTROL_TURN,
            //ApiFeatures.TELEMETRY_BASIC
        ]
    },

    // --- Tier 1 ---
    {
        id: TechIds.BASIC_NAV,
        name: "Basic Navigation",
        description: "Navigation & Attitude Control.",
        costRP: 2,
        parentIds: [TechIds.START],
        tier: 1,
        row: 2,
        parts: [
            PartIds.SENSOR_NAV_BASIC,
            PartIds.RW_SMALL,
        ],
        apiFeatures: [ApiFeatures.TELEMETRY_BASIC]
    },
    {
        id: TechIds.BASIC_COMPUTING,
        name: "Basic Computing",
        description: "Guidance system",
        costRP: 2,
        parentIds: [TechIds.START],
        tier: 1,
        row: 1,
        parts: [
            PartIds.BATTERY_SMALL,
            PartIds.CPU_BASIC
        ],
        apiFeatures: [
            //ApiFeatures.CONTROL_SOLAR
        ]
    },
    {
        id: TechIds.SCIENCE_BASIC,
        name: "Basic Science",
        description: "Sensors to collect data.",
        costRP: 15,
        parentIds: [TechIds.START],
        tier: 1,
        row: -1,
        parts: [
            PartIds.SCIENCE_TEMP,
            PartIds.SCIENCE_ATMOS,
            PartIds.SCIENCE_SURFACE
        ],
        apiFeatures: [
            ApiFeatures.SCIENCE_ATMOSPHERE,
            ApiFeatures.SCIENCE_SURFACE
        ]
    },
    {
        id: TechIds.ELECTRICS,
        name: "Basic Electrics",
        description: "Batteries and Solar Panels.",
        costRP: 15,
        parentIds: [TechIds.START],
        tier: 1,
        row: -2,
        parts: [
            PartIds.BATTERY_MEDIUM,
            PartIds.SOLAR_BASIC,
        ],
        apiFeatures: [ApiFeatures.CONTROL_SOLAR]
    },
    {
        id: TechIds.COMMS_BASIC,
        name: "Basic Communication",
        description: "Transmit data back home.",
        costRP: 15,
        parentIds: [TechIds.START],
        tier: 1,
        row: -1,
        parts: [
            PartIds.ANTENNA_SMALL,
        ],
        apiFeatures: [
            ApiFeatures.COMMS_DEEP_SPACE,
        ]
    },

    // --- Tier 2 ---
    {
        id: TechIds.GUIDANCE_ADV,
        name: "Adv. Guidance",
        description: "Better flight computers.",
        costRP: 25,
        parentIds: [TechIds.BASIC_ROCKETRY],
        tier: 2,
        row: 0,
        parts: [
            PartIds.ENGINE_PRECISION,
            PartIds.CPU_ADVANCED,
            PartIds.SENSOR_NAV_ADV
        ],
        apiFeatures: [
            ApiFeatures.NAV_PROGRADE,
            ApiFeatures.NAV_RETROGRADE,
            ApiFeatures.NAV_ALIGN_TO
        ]
    },
    {
        id: TechIds.COMMS_ADV,
        name: "Advanced Comms",
        description: "Transmit data back home with more range.",
        costRP: 20,
        parentIds: [TechIds.COMMS_BASIC, TechIds.ELECTRICS],
        tier: 2,
        row: 1,
        parts: [
            PartIds.ANTENNA_MEDIUM
        ],
        apiFeatures: []
    },
    {
        id: TechIds.AERODYNAMICS,
        name: "Aerodynamics",
        description: "Fins and nose cones.",
        costRP: 20,
        parentIds: [TechIds.BASIC_ROCKETRY, TechIds.SCIENCE_BASIC],
        tier: 2,
        row: -1,
        parts: [
            PartIds.CONE_BASIC,
            PartIds.PARACHUTE_BASIC,
            //PartIds.FIN_BASIC,
            PartIds.HEATSHIELD_BASIC
        ],
        apiFeatures: []
    },
    {
        id: TechIds.LANDING_SYSTEMS,
        name: "Landing Systems",
        description: "Hardware for controlled descent.",
        costRP: 30,
        parentIds: [TechIds.BASIC_ROCKETRY],
        tier: 2,
        row: 2,
        parts: [
            PartIds.SENSOR_LIDAR,
            PartIds.LEG_LANDING_FIXED,
            PartIds.SCIENCE_BIO
        ],
        apiFeatures: [
            ApiFeatures.TELEMETRY_LIDAR
        ]
    },

    // --- Tier 3 ---
    {
        id: TechIds.STAGING,
        name: "Staging",
        description: "Heavy tanks and payload systems.",
        costRP: 50,
        parentIds: [TechIds.GUIDANCE_ADV],
        tier: 3,
        row: 0,
        parts: [
            PartIds.FUEL_MEDIUM,
            PartIds.FUEL_LARGE,
            PartIds.PAYLOAD_SAT_BASIC
        ],
        apiFeatures: []
    },
    {
        id: TechIds.SOLAR_ADV,
        name: "Adv. Electrics",
        description: "Deployable solar panels.",
        costRP: 45,
        parentIds: [TechIds.COMMS_BASIC],
        tier: 3,
        row: 1,
        parts: [
            // PartIds.BATTERY_LARGE // Not in PartStore yet
        ],
        apiFeatures: []
    },
    {
        id: TechIds.ORBITAL_SCI,
        name: "Orbital Science",
        description: "Space-grade sensors.",
        costRP: 50,
        parentIds: [TechIds.AERODYNAMICS],
        tier: 3,
        row: -1,
        parts: [
            PartIds.CPU_ORBITAL
        ],
        apiFeatures: [
            ApiFeatures.TELEMETRY_ORBITAL,
            ApiFeatures.NAV_ALIGN_TO // Also enables alignTo
        ]
    },

    // --- Tier 4 ---
    {
        id: TechIds.PROPULSION_VAC,
        name: "Vacuum Propulsion",
        description: "Engines optimized for space.",
        costRP: 100,
        parentIds: [TechIds.STAGING],
        tier: 4,
        row: 0,
        parts: [
            PartIds.ENGINE_VACUUM
        ],
        apiFeatures: []
    },
    {
        id: TechIds.COMMS_RELAY,
        name: "Relay Comms",
        description: "Long-range dishes.",
        costRP: 90,
        parentIds: [TechIds.SOLAR_ADV],
        tier: 4,
        row: 1,
        parts: [
            PartIds.ANTENNA_RELAY,
            PartIds.ANTENNA_DEEP
        ],
        apiFeatures: [
            ApiFeatures.COMMS_DEEP_SPACE
        ]
    },

    // --- Tier 5 ---
    {
        id: TechIds.ION_PROPULSION,
        name: "Ion Propulsion",
        description: "High efficiency, low thrust.",
        costRP: 300,
        parentIds: [TechIds.PROPULSION_VAC, TechIds.COMMS_RELAY],
        tier: 5,
        row: 0,
        parts: [
            PartIds.ENGINE_ION
        ],
        apiFeatures: []
    },
];

// --- Helpers for Fast Lookup ---

// Map: PartID -> TechID
const _partToTechMap: Record<string, string> = {};
// Map: TechID -> ApiFeatures[]
const _techToApiMap: Record<string, string[]> = {};

// Initialize Lookups
for (const node of GameProgression) {
    for (const partId of node.parts) {
        if (_partToTechMap[partId]) {
            console.warn(`Part ${partId} is unlocked by multiple techs! (Last one wins: ${node.id})`);
        }
        _partToTechMap[partId] = node.id;
    }
    _techToApiMap[node.id] = node.apiFeatures;
}

/** 
 * Returns the Tech ID required to unlock a part. 
 * If undefined, the part might be missing from the tree (or dev only).
 */
export function getTechForPart(partId: string): string | undefined {
    return _partToTechMap[partId];
}

/**
 * Returns list of API feature flags enabled by a specific tech.
 */
export function getApiFeaturesForTech(techId: string): string[] {
    return _techToApiMap[techId] || [];
}

/** Check if a specific API feature is unlocked given a set of completed techs */
export function isApiFeatureUnlocked(feature: string, unlockedTechs: string[]): boolean {
    // Brute force check or optimized? 
    // Given usage frequency, iterating unlocked techs is fine (usually < 20 unlocked)
    for (const t of unlockedTechs) {
        const features = _techToApiMap[t];
        if (features && features.includes(feature)) return true;
    }
    return false;
}
