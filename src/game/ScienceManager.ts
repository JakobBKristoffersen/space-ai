import { EnvironmentSnapshot } from "../simulation/Environment";
import { ResearchService } from "../app/services/ResearchService";
import { ToySystem } from "../config/ToySystem";

export type ScienceType = "temp" | "atmo" | "surface" | "biosample" | "velocity" | "altitude" | "distance";


export type ScienceZone = "lower" | "mid" | "upper" | "space" | "global"; // global for surface
export type MilestoneLevel = "easy" | "medium" | "hard" | "master";

export interface MilestoneDef {
    id: string;
    type: ScienceType;
    zone: ScienceZone;
    level: MilestoneLevel;
    reqCount: number; // For temp/atmo: count of unique altitudes. For surface: count of unique latitudes.
    rewardRp: number;
    title: string;
}

export interface MilestoneStatus extends MilestoneDef {
    currentCount: number;
    progress: number; // 0..1
    isCompleted: boolean;
    isClaimed: boolean;
}

const LEVELS: Record<MilestoneLevel, { label: string, mult: number }> = {
    easy: { label: "I", mult: 1 },
    medium: { label: "II", mult: 5 },
    hard: { label: "III", mult: 10 },
    master: { label: "IV", mult: 25 },
};

export class ScienceManager {
    // Persistent Data
    readonly data = {
        temperature: new Map<number, number>(),
        atmosphere: new Map<number, number>(),
        surface: new Map<number, string>(),
        interactions: {} as Record<string, number>,
    };
    readonly claimedMs = new Set<string>();

    private listeners: (() => void)[] = [];

    // Derived Zones
    private readonly zones: Record<string, { min: number, max: number, label: string }>;

    constructor(private readonly research: ResearchService | null) {
        // Derive zones from Config
        // ToySystem is singleton, so we can read it directly.
        // Default Primary body atmosphere height
        const planet = ToySystem.bodies.find(b => b.id === ToySystem.primaryId);
        const atmHeight = planet?.atmosphereHeightMeters ?? 2000;

        // Zones: Lower (0-33%), Mid (33-66%), Upper (66-100%), Space (>100%)
        const p33 = Math.floor(atmHeight * 0.33);
        const p66 = Math.floor(atmHeight * 0.66);

        this.zones = {
            lower: { min: 0, max: p33, label: `Lower Atmosphere (0-${Math.round(p33 / 1000)}km)` },
            mid: { min: p33, max: p66, label: `Mid Atmosphere (${Math.round(p33 / 1000)}-${Math.round(p66 / 1000)}km)` },
            upper: { min: p66, max: atmHeight, label: `Upper Atmosphere (${Math.round(p66 / 1000)}-${Math.round(atmHeight / 1000)}km)` },
            space: { min: atmHeight, max: 999999999, label: `Space (>${Math.round(atmHeight / 1000)}km)` },
        };

        this.load();
    }

    private load() {
        try {
            const raw = localStorage.getItem("science_data");
            if (!raw) return;
            const json = JSON.parse(raw);

            if (json.temperature) {
                this.data.temperature.clear();
                for (const [k, v] of json.temperature) this.data.temperature.set(Number(k), Number(v));
            }
            if (json.atmosphere) {
                this.data.atmosphere.clear();
                for (const [k, v] of json.atmosphere) this.data.atmosphere.set(Number(k), Number(v));
            }
            if (json.surface) {
                this.data.surface.clear();
                for (const [k, v] of json.surface) this.data.surface.set(Number(k), String(v));
            }
            if (json.interactions) {
                this.data.interactions = json.interactions;
            }
            if (json.claimedMs) {
                this.claimedMs.clear();
                for (const id of json.claimedMs) this.claimedMs.add(String(id));
            }
        } catch (e) {
            console.warn("Failed to load science data", e);
        }
    }

    private save() {
        try {
            const json = {
                temperature: Array.from(this.data.temperature.entries()),
                atmosphere: Array.from(this.data.atmosphere.entries()),
                surface: Array.from(this.data.surface.entries()),
                interactions: this.data.interactions,
                claimedMs: Array.from(this.claimedMs)
            };
            localStorage.setItem("science_data", JSON.stringify(json));
        } catch (e) {
            console.warn("Failed to save science data", e);
        }
    }

    // Definitions
    getZones() { return this.zones; }

    private getDefinitions(): MilestoneDef[] {
        const defs: MilestoneDef[] = [];

        // Helper to gen temp/atmo milestones
        const gen = (type: ScienceType, zone: ScienceZone, baseReward: number) => {
            const tiers = [
                { l: "easy", c: 20, r: 1 },
                { l: "medium", c: 100, r: 2 },
                { l: "hard", c: 250, r: 4 },
                { l: "master", c: 500, r: 8 }
            ] as const;

            for (const t of tiers) {
                defs.push({
                    id: `${type}_${zone}_${t.l}`,
                    type,
                    zone,
                    level: t.l,
                    reqCount: t.c,
                    rewardRp: baseReward * t.r,
                    title: `${type === 'temp' ? 'Temperature' : 'Density'} Scan ${LEVELS[t.l].label}`
                });
            }
        };

        // Temp & Atmo
        gen("temp", "lower", 20);
        gen("temp", "mid", 40);
        gen("temp", "upper", 80);

        defs.push({
            id: `temp_space_easy`,
            type: 'temp', zone: 'space', level: 'easy',
            reqCount: 1, rewardRp: 200, title: "Temperature Scan (Space)"
        });

        gen("atmo", "lower", 20);
        gen("atmo", "mid", 40);
        gen("atmo", "upper", 80);

        defs.push({
            id: `atmo_space_easy`,
            type: 'atmo', zone: 'space', level: 'easy',
            reqCount: 1, rewardRp: 200, title: "Pressure Scan (Space)"
        });

        // Surface (360 total degrees roughly)
        const surfTiers = [
            { l: "easy", c: 90, r: 50 },
            { l: "medium", c: 180, r: 100 },
            { l: "hard", c: 270, r: 200 },
            { l: "master", c: 360, r: 500 }
        ] as const;

        for (const t of surfTiers) {
            defs.push({
                id: `surface_global_${t.l}`,
                type: "surface",
                zone: "global",
                level: t.l,
                reqCount: t.c,
                rewardRp: t.r,
                title: `Planetary Survey ${LEVELS[t.l].label}`
            });
        }

        // Biosample
        defs.push({
            id: `bio_recovery_1`,
            type: "biosample",
            zone: "global",
            level: "medium",
            reqCount: 1,
            rewardRp: 100,
            title: "First Biosample Recovery"
        });
        defs.push({
            id: `bio_recovery_3`,
            type: "biosample",
            zone: "global",
            level: "hard",
            reqCount: 3,
            rewardRp: 250,
            title: "Biosample Analysis III"
        });

        // Passive - Velocity
        const velTiers = [
            { l: "easy", c: 10, r: 10, title: "First Flight (10 m/s)" },
            { l: "medium", c: 100, r: 10, title: "Subsonic Dash (100 m/s)" },
            { l: "hard", c: 340, r: 50, title: "Sound Barrier (340 m/s)" },
            { l: "master", c: 800, r: 100, title: "Orbital Velocity (800 m/s)" },
            { l: "grandmaster", c: 1500, r: 250, title: "Hypersonic Escape (1500 m/s)" }
        ] as const;

        for (const t of velTiers) {
            // Use reqCount as suffix to ensure uniqueness if levels repeat
            defs.push({
                id: `vel_${t.c}`,
                type: "velocity",
                zone: "global",
                level: (t.l === "grandmaster" ? "master" : t.l) as MilestoneLevel,
                reqCount: t.c,
                rewardRp: t.r,
                title: t.title
            });
        }

        // Passive - Altitude
        const altTiers = [
            { l: "easy", c: 1, r: 10, title: "Liftoff (1 m)" },
            { l: "easy", c: 200, r: 10, title: "Low Altitude (200 m)" },
            { l: "medium", c: 1000, r: 10, title: "High Altitude (1km)" },
            { l: "hard", c: 2000, r: 50, title: "Edge of Space (2km)" },
            { l: "hard", c: 2001, r: 50, title: "Space Attitude Research (2km)" },
            { l: "master", c: 25000, r: 100, title: "Moon Orbit (25km)" },
            { l: "grandmaster", c: 50000, r: 250, title: "Deep Space (50km)" }
        ] as const;

        for (const t of altTiers) {
            defs.push({
                id: `alt_${t.c}`,
                type: "altitude",
                zone: "global",
                level: (t.l === "grandmaster" ? "master" : t.l) as MilestoneLevel,
                reqCount: t.c,
                rewardRp: t.r,
                title: t.title
            });
        }

        // Passive - Distance (Latitude from origin)
        const distTiers = [
            { l: "easy", c: 5, r: 20, title: "Neighboring Region (5° from origin)" },
            { l: "medium", c: 20, r: 50, title: "Continental Traveler (20° from origin)" },
            { l: "hard", c: 45, r: 100, title: "Hemisphere Hop (45° from origin)" },
            { l: "master", c: 90, r: 250, title: "Pole to Pole (90° from origin)" }
        ] as const;

        for (const t of distTiers) {
            defs.push({
                id: `dist_${t.c}`,
                type: "distance",
                zone: "global",
                level: t.l,
                reqCount: t.c,
                rewardRp: t.r,
                title: t.title
            });
        }

        return defs;
    }

    getMilestones(): MilestoneStatus[] {
        const defs = this.getDefinitions();

        // Cache counts per zone to avoid potentially expensive loops per milestone
        // Temp
        const tempCounts = { lower: 0, mid: 0, upper: 0, space: 0 };
        for (const alt of this.data.temperature.keys()) {
            if (alt < this.zones.lower.max) tempCounts.lower++;
            else if (alt < this.zones.mid.max) tempCounts.mid++;
            else if (alt < this.zones.upper.max) tempCounts.upper++;
            else tempCounts.space++;
        }

        // Atmo
        const atmoCounts = { lower: 0, mid: 0, upper: 0, space: 0 };
        for (const alt of this.data.atmosphere.keys()) {
            if (alt < this.zones.lower.max) atmoCounts.lower++;
            else if (alt < this.zones.mid.max) atmoCounts.mid++;
            else if (alt < this.zones.upper.max) atmoCounts.upper++;
            else atmoCounts.space++;
        }

        // Surface
        const surfCount = this.data.surface.size;

        return defs.map(d => {
            let count = 0;
            if (d.type === "temp") count = tempCounts[d.zone as keyof typeof tempCounts] || 0;
            else if (d.type === "atmo") count = atmoCounts[d.zone as keyof typeof atmoCounts] || 0;
            else if (d.type === "surface") count = surfCount;
            else if (d.type === "biosample") count = this.data.interactions["biosamples"] || 0;
            else if (d.type === "velocity") count = this.data.interactions["max_velocity"] || 0;
            else if (d.type === "altitude") count = this.data.interactions["max_altitude"] || 0;
            else if (d.type === "distance") count = this.data.interactions["max_distance"] || 0;

            const isCompleted = count >= d.reqCount;
            const isClaimed = this.claimedMs.has(d.id);

            return {
                ...d,
                currentCount: count,
                progress: Math.min(1, count / d.reqCount),
                isCompleted,
                isClaimed
            };
        });
    }

    claim(id: string) {
        if (this.claimedMs.has(id)) return; // Already claimed

        const ms = this.getMilestones().find(m => m.id === id);
        if (!ms || !ms.isCompleted) return; // Not valid or not done

        this.claimedMs.add(id);
        this.save();
        if (this.research) {
            this.research.addPoints(ms.rewardRp);
        }
        this.notify();
    }

    subscribe(fn: () => void) {
        this.listeners.push(fn);
        return () => { this.listeners = this.listeners.filter(l => l !== fn); };
    }

    private notify() {
        this.listeners.forEach(l => l());
    }

    /**
     * Handle bulk science data packets.
     * No longer awards RP directly. Just stores data.
     */
    onBulkDataReceived(type: "temperature" | "atmosphere" | "surface", values: Record<string, any>) {
        if (!values) return;

        let changed = false;

        if (type === "temperature") {
            for (const [k, v] of Object.entries(values)) {
                const alt = parseInt(k);
                if (!this.data.temperature.has(alt)) {
                    this.data.temperature.set(alt, Number(v));
                    changed = true;
                }
            }
        } else if (type === "atmosphere") {
            for (const [k, v] of Object.entries(values)) {
                const alt = parseInt(k);
                if (!this.data.atmosphere.has(alt)) {
                    this.data.atmosphere.set(alt, Number(v));
                    changed = true;
                }
            }
        } else if (type === "surface") {
            for (const [k, v] of Object.entries(values)) {
                const lat = parseInt(k);
                if (!this.data.surface.has(lat)) {
                    this.data.surface.set(lat, String(v));
                    changed = true;
                }
            }
        }

        if (changed) {
            this.save();
            this.notify();
        }
    }

    /**
     * Ticking usually updates mission timers, but achievements are event-driven here.
     * We keep this signature if we need time-based checks later.
     */
    tick(snapshot: EnvironmentSnapshot) {
        // No-op for now unless we add "Maintain orbit for X time"
    }

    // Legacy compat if needed, returns empty
    list() { return []; }
    getCompletedIds(): readonly string[] {
        return Array.from(this.claimedMs);
    }

    // --- Biosample Logic ---
    recoverBiosample() {
        let count = this.data.interactions["biosamples"] || 0;

        if (count < 3) {
            this.research?.addPoints(50);
            console.log("Biosample recovered! +50 RP");
        } else {
            this.research?.addPoints(10); // Diminishing returns
            console.log("Biosample recovered! +10 RP");
        }

        this.data.interactions["biosamples"] = count + 1;
        this.save();
        this.notify();
    }

    // --- Passive Milestones Logic ---

    // Throttle save
    private lastSaveTime = 0;

    checkPassiveMilestones(rocket: { state: { position: { x: number, y: number }, velocity: { x: number, y: number } }, _altitudeForSnapshot?: number, _latitudeForSnapshot?: number }) {
        let changed = false;

        // 1. Velocity
        const v = Math.hypot(rocket.state.velocity.x, rocket.state.velocity.y);
        const currentMaxV = this.data.interactions["max_velocity"] || 0;
        if (v > currentMaxV) {
            this.data.interactions["max_velocity"] = v;
            changed = true;
        }

        // 2. Altitude
        const alt = rocket._altitudeForSnapshot ?? 0;
        const currentMaxAlt = this.data.interactions["max_altitude"] || 0;
        if (alt > currentMaxAlt) {
            this.data.interactions["max_altitude"] = alt;
            changed = true;
        }

        // 3. Distance (Angular displacement from 90° launch site)
        const currentLat = (rocket as any)._latitudeForSnapshot ?? 90;
        // Displacement in degrees. Launch is at 90. 
        // We handle wrapping by ensuring we take the shortest path or just absolute diff if small.
        let diff = Math.abs(currentLat - 90);
        if (diff > 180) diff = 360 - diff;

        const currentMaxDist = this.data.interactions["max_distance"] || 0;
        if (diff > currentMaxDist) {
            this.data.interactions["max_distance"] = diff;
            changed = true;
        }

        if (changed) {
            const now = Date.now();
            if (now - this.lastSaveTime > 2000) {
                this.save();
                this.lastSaveTime = now;
                this.notify();
            }
        }
    }
}
