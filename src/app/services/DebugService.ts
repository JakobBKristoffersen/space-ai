import { ResearchService } from "./ResearchService";
import { ScienceManager } from "../../game/ScienceManager";
import { PendingUpgradesService } from "./PendingUpgradesService";
import { TechTree } from "../../game/research/TechDefinitions";


import { SimulationManager } from "../../sim/SimulationManager";
import { LayoutService, StoredLayout } from "./LayoutService";
import { ORBIT_MAIN, ORBIT_UTIL } from "../bootstrap/seedScript";
import { ScriptLibraryService } from "./ScriptLibraryService";


/**
 * Service to handle debug cheats and reset logic.
 */
export class DebugService {
    constructor(
        private research: ResearchService,
        private scienceMgr: ScienceManager,
        private pending: PendingUpgradesService,
        private layout: LayoutService, // Injected
        private scriptLib: ScriptLibraryService, // Injected
        private manager: SimulationManager, // Injected
    ) { }

    // ... existing unlockAll ... (keep it)
    unlockAll() {
        // 1. Give RP
        this.research.system.addPoints(99999);

        // 2. Unlock all Techs
        for (const tech of TechTree) {
            this.research.system.forceUnlock(tech.id);
        }
        // Force save research
        this.research.save();
        alert("Cheats Applied: infinite RP, all research unlocked.");
    }

    resetToBasicRocket(rocketIndex: number = 0) {
        // Minimal Basic Rocket Layout
        const basicLayout: StoredLayout = {
            templateId: "template.basic",
            slots: {
                "slot.nose.cpu": "cpu.basic",
                "slot.body.tank": "fueltank.small",
                "slot.body.battery": "battery.small",
                "slot.tail.engine": "engine.small"
            }
        };

        // Clear any pending upgrades that might overwrite this
        this.pending.clear(rocketIndex);

        // Save layout (Session)
        this.layout.saveLayoutFor(rocketIndex, basicLayout);

        // Auto-Apply to Simulation
        this.manager.recreateFromLayout(basicLayout);

        // Notify
        alert("Active Rocket Reset to Basic configuration.");
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

        // Clear existing
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

    cheatLoadOrbitScript() {
        this.scriptLib.upsertByName("SeedUtils.ts", ORBIT_UTIL);
        this.scriptLib.upsertByName("SeedMain.ts", ORBIT_MAIN);
        alert("SeedMain.ts and SeedUtils.ts loaded into library!");
    }
}
