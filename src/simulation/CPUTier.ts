/**
 * CPUTier.ts
 * Defines the capabilities of different CPU tiers.
 */

export enum CPUTier {
    BASIC = 0,    // Blind fire
    TELEMETRY = 1, // Basic altitude/velocity
    ORBITAL = 2,   // Orbital parameters
    NETWORK = 3,   // Full network access
}

export const CPUTierDefs = {
    [CPUTier.BASIC]: {
        name: "Basic",
        description: "Blind control only. No sensor data.",
        api: ["setThrottle", "setSteering", "setSlotEnabled"],
    },
    [CPUTier.TELEMETRY]: {
        name: "Telemetry",
        description: "Access to altitude, velocity, and heating data.",
        api: ["getAltitude", "getVelocity", "getPosition", "getHeading", "getMaxHeat", "getHeat"],
    },
    [CPUTier.ORBITAL]: {
        name: "Orbital",
        description: "Orbital parameter calculation.",
        api: ["getApoapsis", "getPeriapsis", "getOrbitalPeriod", "getTimeToApoapsis", "getTimeToPeriapsis"],
    },
    [CPUTier.NETWORK]: {
        name: "Network",
        description: "Full network connectivity and advanced state.",
        api: ["getCommState", "sendDataPacket", "getPeers"],
    },
};

/**
 * Returns the highest unlocked tier for a given CPU Part ID.
 */
export function getCPUTier(partId: string): CPUTier {
    if (partId === "cpu.basic") return CPUTier.BASIC;
    if (partId === "cpu.advanced") return CPUTier.TELEMETRY;
    if (partId === "cpu.orbital") return CPUTier.ORBITAL;
    if (partId === "cpu.network") return CPUTier.NETWORK;
    return CPUTier.BASIC; // Default
}
