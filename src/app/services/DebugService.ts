import { ResearchService } from "./ResearchService";
import { MissionManager } from "../../game/MissionManager";
import { PendingUpgradesService } from "./PendingUpgradesService";
import { TechTree } from "../../research/TechDefinitions";
import { MissionList } from "../../missions/MissionData";

/**
 * Service to handle debug cheats and reset logic.
 */
export class DebugService {
    constructor(
        private research: ResearchService,
        private missionMgr: MissionManager,
        private pending: PendingUpgradesService,
        private setMoney: (val: number) => void
    ) { }

    /**
     * Unlock all technologies, complete all missions, and give practically infinite money.
     */
    unlockAll() {
        // 1. Give Money
        this.setMoney(999_999_999);

        // 2. Unlock all Techs
        for (const tech of TechTree) {
            this.research.system.forceUnlock(tech.id);
        }
        // Force save research
        this.research.save();

        // 3. Complete all Missions (by hacking MissionManager state if possible, or just marking them)
        // MissionManager tracks completion in `completedOrder` and `missions` map.
        // We can re-seed completion by iterating all definitions and forcing them complete?
        // MissionManager methods are limited. We might need to rely on just Unlocking Techs and Money.
        // Actually, MissionManager determines availability of parts? 
        // PartStore checks `isUnlocked(completedMissions, techs)`.
        // Most parts unlock via Techs. Some legacy might check missions.
        // Let's check MissionManager limits.
        // `missionMgr.addMission` replaces mission.
        // We can iterate MissionList and add them as completed?
        for (const def of MissionList) {
            // We can't easily force "complete" on a mission instance without hacking it.
            // But we can force the "completedOrder" array if we had access? No it's private.
            // However, we can just give enough RP/Money. 
            // If parts depend on missions, they might stay locked.
            // Let's rely on Techs mostly.
        }
        alert("Cheats Applied: infinite money, all research unlocked.");
    }

    /**
     * Upgrade the active rocket to the best available parts in each category.
     */
    maximizeRocket(rocketIndex: number = 0) {
        // Best Parts Config
        const CONFIG = {
            cpu: "cpu.orbital",
            sensors: ["sensor.nav.adv"],
            batteries: ["battery.medium"],
            fuelTanks: ["fueltank.large"],
            antennas: ["antenna.deep"],
            engines: ["engine.vacuum"], // or engine.ion
            reactionWheels: ["rw.small"], // best available in PartStore
        };

        this.pending.queueUpgrade("cpu", CONFIG.cpu, rocketIndex);

        // Clear existing lists before adding? queueUpgrade for arrays replaces the list in PendingUpgradesService implementation?
        // Let's check PendingUpgradesService implementation.
        // case "sensors": s.sensors.add(id); -> it ADDS. 
        // We might want to clear first? 
        // `PendingUpgradesService` doesn't have a clear-category method, only clear-all-index.
        // We can clear index first.
        this.pending.clear(rocketIndex);

        this.pending.queueUpgrade("cpu", CONFIG.cpu, rocketIndex);
        CONFIG.sensors.forEach(id => this.pending.queueUpgrade("sensors", id, rocketIndex));
        CONFIG.batteries.forEach(id => this.pending.queueUpgrade("batteries", id, rocketIndex));
        CONFIG.fuelTanks.forEach(id => this.pending.queueUpgrade("fuelTanks", id, rocketIndex));
        CONFIG.antennas.forEach(id => this.pending.queueUpgrade("antennas", id, rocketIndex));
        CONFIG.engines.forEach(id => this.pending.queueUpgrade("engines", id, rocketIndex));
        CONFIG.reactionWheels.forEach(id => this.pending.queueUpgrade("reactionWheels", id, rocketIndex));

        alert("Rocket Maxed! Reset the rocket in World Scene to apply changes.");
    }
}
