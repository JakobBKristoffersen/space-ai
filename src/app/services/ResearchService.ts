import { ResearchSystem, ResearchState } from "../../game/research/ResearchSystem";

const OLD_KEY = "session:research";
const KEY = "research_data";

export class ResearchService {
    public system: ResearchSystem;

    private listeners: (() => void)[] = [];

    // ...

    constructor() {
        this.system = new ResearchSystem(this.load());
    }

    private load(): ResearchState {
        try {
            let raw = localStorage.getItem(KEY);

            // Migration from sessionStorage if localStorage is empty
            if (!raw) {
                raw = sessionStorage.getItem(OLD_KEY);
                if (raw) {
                    localStorage.setItem(KEY, raw);
                    sessionStorage.removeItem(OLD_KEY);
                }
            }

            return raw ? JSON.parse(raw) : { points: 0, unlockedTechs: [] };
        } catch {
            return { points: 0, unlockedTechs: [] };
        }
    }

    save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(this.system.snapshot()));
            this.notify();
        } catch { }
    }

    reset() {
        this.system = new ResearchSystem();
        this.save();
    }

    addPoints(amount: number) {
        this.system.addPoints(amount);
        this.save();
    }

    subscribe(fn: () => void): () => void {
        this.listeners.push(fn);
        return () => { this.listeners = this.listeners.filter(l => l !== fn); };
    }

    private notify() {
        this.listeners.forEach(l => l());
    }
}
