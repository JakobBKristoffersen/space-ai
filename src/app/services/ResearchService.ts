import { ResearchSystem, ResearchState } from "../../game/research/ResearchSystem";

const KEY = "session:research";

export class ResearchService {
    public system: ResearchSystem;

    private listeners: (() => void)[] = [];

    // ...

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
            this.notify();
        } catch { }
    }

    reset() {
        this.system = new ResearchSystem();
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
