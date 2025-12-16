import { EnvironmentSnapshot } from "../simulation/Environment";
import { ResearchService } from "../app/services/ResearchService";
import { ScienceData } from "../simulation/parts/Science";

export interface ScienceAchievement {
    id: string;
    name: string;
    description: string;
    isCompleted: boolean;
    rewardRp: number;
    condition: (data: ScienceData) => boolean;
}

export class ScienceManager {
    private achievements: Map<string, ScienceAchievement> = new Map();
    private completedOrder: string[] = [];

    constructor(private readonly research: ResearchService | null) {
        this.initAchievements();
    }

    private initAchievements() {
        this.addAchievement({
            id: "ach.temp.low",
            name: "Low Altitude Scan",
            description: "Transmit temperature data from below 1km altitude.",
            isCompleted: false,
            rewardRp: 50,
            condition: (d) => d.experimentId === "science.temp" && d.description.includes("at ") && parseInt(d.description.split("at ")[1]) < 1000
        });

        this.addAchievement({
            id: "ach.temp.high",
            name: "High Altitude Scan",
            description: "Transmit temperature data from above 10km altitude.",
            isCompleted: false,
            rewardRp: 100,
            condition: (d) => d.experimentId === "science.temp" && d.description.includes("at ") && parseInt(d.description.split("at ")[1]) > 10000
        });

        this.addAchievement({
            id: "ach.space",
            name: "Space Data",
            description: "Transmit any science data from space (>100km).",
            isCompleted: false,
            rewardRp: 200,
            condition: (d) => d.description.includes("at ") && parseInt(d.description.split("at ")[1]) > 100000
        });
    }

    addAchievement(ach: ScienceAchievement) {
        this.achievements.set(ach.id, ach);
    }

    list(): ScienceAchievement[] {
        return Array.from(this.achievements.values());
    }

    /**
     * Called when science data is successfully transmitted to base.
     */
    onScienceReceived(data: ScienceData) {
        // Award base value
        if (this.research) {
            this.research.system.addPoints(data.value);
        }

        // Check achievements
        for (const ach of this.achievements.values()) {
            if (!ach.isCompleted && ach.condition(data)) {
                ach.isCompleted = true;
                this.completedOrder.push(ach.id);
                if (this.research) {
                    this.research.system.addPoints(ach.rewardRp);
                }
                // Notify? (Maybe return completed list)
            }
        }
    }

    /**
     * Ticking usually updates mission timers, but achievements are event-driven here.
     * We keep this signature if we need time-based checks later.
     */
    tick(snapshot: EnvironmentSnapshot) {
        // No-op for now unless we add "Maintain orbit for X time"
    }

    getCompletedIds(): readonly string[] {
        return this.completedOrder;
    }
}
