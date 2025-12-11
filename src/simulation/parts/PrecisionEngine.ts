import { EnginePart } from "../Rocket";

export class PrecisionEngine implements EnginePart {
    readonly id = "engine.precision";
    readonly name = "Precision Engine";
    readonly dryMassKg = 80;
    readonly maxThrustN = 10_000;
    private _power: number = 0;

    get power(): number { return this._power; }
    set power(v: number) {
        this._power = Math.max(0, Math.min(1, v));
    }

    readonly fuelBurnRateKgPerS = 4.0;
    readonly vacuumBonusAtVacuum = 0.4; // 40% better in vacuum
    readonly exposes = ["fuelConsumptionKgPerS"];

    currentThrust(airDensity: number, seaLevelDensity: number = 1.225): number {
        if (this.power <= 0) return 0;
        const rho = Math.max(0, airDensity || 0);
        const rho0 = Math.max(1e-9, seaLevelDensity || 1.225);
        const rel = Math.max(0, Math.min(1, rho / rho0));
        // Efficiency penalty in atmo for vacuum engine? Precision is intermediate.
        // Let's say it's good in vacuum. 
        const bonus = Math.max(0, this.vacuumBonusAtVacuum ?? 0);
        const scale = 1 + bonus * (1 - rel);
        return this.maxThrustN * scale * this.power;
    }
}
