/**
 * ResearchSystem
 * Manages global Research Points (RP) and unlocked technologies.
 */

export interface TechDefinition {
    id: string;
    name: string;
    costRP: number;
    description: string;
    unlocksParts: string[]; // Part IDs enabled by this tech
}

export interface ResearchState {
    points: number;
    unlockedTechs: string[]; // IDs of unlocked techs
}

export class ResearchSystem {
    private state: ResearchState = {
        points: 0,
        unlockedTechs: [],
    };

    constructor(initialState?: Partial<ResearchState>) {
        // Ensure "tech.start" is always unlocked by merging with default
        this.state = {
            points: initialState?.points ?? 0,
            unlockedTechs: initialState?.unlockedTechs ?
                [...new Set([...initialState.unlockedTechs, "tech.start"])] :
                ["tech.start"]
        };
    }

    get points() {
        return this.state.points;
    }

    get unlockedTechs() {
        return this.state.unlockedTechs;
    }

    addPoints(amount: number) {
        this.state.points += amount;
    }

    canUnlock(tech: TechDefinition): boolean {
        if (this.isUnlocked(tech.id)) return false;
        return this.state.points >= tech.costRP;
    }

    unlock(tech: TechDefinition): boolean {
        if (!this.canUnlock(tech)) return false;
        this.state.points -= tech.costRP;
        this.state.unlockedTechs.push(tech.id);
        return true;
    }

    isUnlocked(techId: string): boolean {
        return this.state.unlockedTechs.includes(techId);
    }

    /**
     * Cheat/Debug: Unlock a tech for free
     */
    forceUnlock(techId: string) {
        if (!this.isUnlocked(techId)) {
            this.state.unlockedTechs.push(techId);
        }
    }

    snapshot(): ResearchState {
        return { ...this.state, unlockedTechs: [...this.state.unlockedTechs] };
    }

    load(state: ResearchState) {
        this.state = state;
    }
}
