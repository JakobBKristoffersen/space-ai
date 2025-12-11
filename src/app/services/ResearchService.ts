import { ResearchSystem, ResearchState } from "../../research/ResearchSystem";

const KEY = "session:research";

export class ResearchService {
    public system: ResearchSystem;

    constructor() {
        this.system = new ResearchSystem(this.load());
    }

    private load(): ResearchState {
        try {
            const raw = sessionStorage.getItem(KEY);
            return raw ? JSON.parse(raw) : { points: 0, unlockedTechs: [] };
        } catch {
            return { points: 0, unlockedTechs: [] };
        }
    }

    save() {
        try {
            sessionStorage.setItem(KEY, JSON.stringify(this.system.snapshot()));
        } catch { }
    }

    reset() {
        this.system = new ResearchSystem();
        this.save();
    }
}
