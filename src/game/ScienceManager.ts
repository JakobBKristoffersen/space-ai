import { EnvironmentSnapshot } from "../simulation/Environment";
import { ResearchService } from "../app/services/ResearchService";
import { ToySystem } from "../app/config/ToySystem";

export type ScienceType = "temp" | "atmo" | "surface";
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
            // Levels: Points required. 
            // Scale points based on zone size? 
            // For a 2000m atmosphere:
            // Lower ~660m. 20 points = 20m. Reasonable.
            // 500 points = 500m. Might be almost all of it.
            // Let's stick to fixed counts for now, assuming 1 point per meter is easy to get if vertical velocity is reasonable.
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

        // Space: Special case, only 1 point needed/rewarded?
        // User said: "Only one point for space is needed"
        // So we shouldn't have tiers for space. Just one "Space" milestone?
        // Or "Space I" = 1 point?
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
        // Easy: 25% (90), Med: 50% (180), Hard: 75% (270), Master: 100% (360)
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
            this.research.system.addPoints(ms.rewardRp);
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
}
