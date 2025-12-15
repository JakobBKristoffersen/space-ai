/**
 * MissionData.ts
 * Defines the progression of missions.
 */

export interface MissionObjective {
    type: 'reach_altitude' | 'orbit' | 'packet_sent' | 'coverage' | 'landing' | 'duration';
    targetValue: number; // e.g., 1000 (meters)
    currentValue?: number;
    completed: boolean;
    description?: string;
}

export interface MissionRewards {
    money: number;
    rp: number;
    unlocks?: string[]; // IDs of specific items or blueprints unlocked
}

export interface MissionDef {
    id: string;
    tier: number;
    title: string;
    briefingId: string; // Key into Briefings.ts
    objectives: MissionObjective[];
    rewards: MissionRewards;
    prerequisites: string[];
    state: 'locked' | 'available' | 'active' | 'completed';
}

export const MissionList: MissionDef[] = [
    // --- TIER 0: Bootstrap ---
    {
        id: "mission.bootstrap.1",
        tier: 0,
        title: "First Hop",
        briefingId: "bootstrap_hop",
        objectives: [
            { type: 'reach_altitude', targetValue: 100, completed: false, description: "Reach 100m altitude" }
        ],
        rewards: { money: 1000, rp: 10 },
        prerequisites: [],
        state: 'available',
    },
    {
        id: "mission.bootstrap.2",
        tier: 0,
        title: "Higher Ground",
        briefingId: "bootstrap_high",
        objectives: [
            { type: 'reach_altitude', targetValue: 500, completed: false, description: "Reach 500m altitude" }
        ],
        rewards: { money: 1500, rp: 20 },
        prerequisites: ["mission.bootstrap.1"],
        state: 'locked',
    },

    // --- TIER 1: Atmospheric Mastery ---
    {
        id: "mission.atmo.space",
        tier: 1,
        title: "Touching the Void",
        briefingId: "atmo_space",
        objectives: [
            { type: 'reach_altitude', targetValue: 10_000, completed: false, description: "Reach 10km (Space)" }
        ],
        rewards: { money: 5000, rp: 50 },
        prerequisites: ["mission.bootstrap.2"],
        state: 'locked',
    },
    {
        id: "mission.atmo.data",
        tier: 1,
        title: "Atmospheric Profile",
        briefingId: "atmo_data",
        objectives: [
            { type: 'packet_sent', targetValue: 100, completed: false, description: "Transmit 100kb Atmospheric Data" }
        ],
        rewards: { money: 3000, rp: 40 },
        prerequisites: ["mission.atmo.space"],
        state: 'locked',
    },

    // --- TIER 2: Orbital Operations ---
    {
        id: "mission.orbit.first",
        tier: 2,
        title: "Stay Awhile",
        briefingId: "orbit_first",
        objectives: [
            { type: 'orbit', targetValue: 1, completed: false, description: "Enter Orbit (Ecc < 1, Pe > 10km)" }
        ],
        rewards: { money: 10000, rp: 150 },
        prerequisites: ["mission.atmo.space"],
        state: 'locked',
    },
    {
        id: "mission.orbit.sat",
        tier: 2,
        title: "The Lonely Satellite",
        briefingId: "orbit_sat",
        objectives: [
            { type: 'orbit', targetValue: 1, completed: false, description: "Deploy a Satellite in Orbit" }
        ],
        rewards: { money: 12000, rp: 200 },
        prerequisites: ["mission.orbit.first"],
        state: 'locked',
    },

    // --- TIER 3: Relay Network ---
    {
        id: "mission.relay.coverage",
        tier: 3,
        title: "Can You Hear Me Now?",
        briefingId: "relay_basic",
        objectives: [
            { type: 'coverage', targetValue: 2, completed: false, description: "Establish Relay Network (2+ connected nodes)" }
        ],
        rewards: { money: 20000, rp: 400 },
        prerequisites: ["mission.orbit.sat"],
        state: 'locked',
    },

    // --- TIER 4: Lunar Operations ---
    {
        id: "mission.luna.flyby",
        tier: 4,
        title: "Shooting the Moon",
        briefingId: "luna_flyby",
        objectives: [
            { type: 'reach_altitude', targetValue: 300_000, completed: false, description: "Approach Moon (SoI)" }
        ],
        rewards: { money: 50000, rp: 1000 },
        prerequisites: ["mission.relay.coverage"],
        state: 'locked',
    },
];
