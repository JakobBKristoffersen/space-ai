/**
 * Unlocks.ts
 * Defines cost and research requirements for parts.
 */

export interface PartUnlockInfo {
    moneyCost: number;
    researchCost?: number; // Optional direct RP cost
    techRequired?: string; // Tech ID from ResearchSystem
}

// Map PartID -> Unlock Info
export const PartUnlockData: Record<string, PartUnlockInfo> = {
    // Starters
    "engine.small": { moneyCost: 500 },
    "fueltank.small": { moneyCost: 200 },
    "battery.small": { moneyCost: 150 },
    "cpu.basic": { moneyCost: 400 },
    "sensor.nav.basic": { moneyCost: 100 },
    "rw.small": { moneyCost: 300 },
    "antenna.small": { moneyCost: 250 },

    // Tier 1 / Tech: Enhanced Storage
    "battery.medium": { moneyCost: 400, techRequired: "tech.batteries_med" },
    "fueltank.medium": { moneyCost: 500, techRequired: "tech.batteries_med" },

    // Tier 1 / Tech: Advanced Guidance
    "cpu.advanced": { moneyCost: 1200, techRequired: "tech.guidance_adv" },
    "sensor.nav.adv": { moneyCost: 500, techRequired: "tech.guidance_adv" },

    // Tier 1 / Tech: Precision Propulsion
    "engine.precision": { moneyCost: 800, techRequired: "tech.propulsion_prec" },
    "rw.medium": { moneyCost: 600, techRequired: "tech.propulsion_prec" },

    // Tier 1 / Tech: Basic Comms
    "antenna.medium": { moneyCost: 600, techRequired: "tech.comms_basic" },

    // Tier 2
    "solar.basic": { moneyCost: 1500, techRequired: "tech.solar" },
    "cpu.orbital": { moneyCost: 2500, techRequired: "tech.orbital_comp" },

    // Tier 3
    "antenna.relay": { moneyCost: 2000, techRequired: "tech.comms_relay" },
    "engine.vacuum": { moneyCost: 1800, techRequired: "tech.propulsion_vac" },

    // Tier 4
    "antenna.deep": { moneyCost: 5000, techRequired: "tech.deep_space" },

    // Tier 5
    "engine.ion": { moneyCost: 8000, techRequired: "tech.ion" },
};
