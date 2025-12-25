/**
 * Engine parts.
 * Provides specific engine implementations.
 */
import { EnginePart } from "../Rocket";
import { PartIds } from "../../game/GameIds";

/**
 * SmallEngine
 * - 0% or 100% throttle only
 * - contributes to mass via dryMassKg
 * - consumes fuel when on
 * - produces thrust when on
 */
export class SmallEngine implements EnginePart {
    readonly id = PartIds.ENGINE_SMALL;
    readonly name = "Small Engine";
    readonly dryMassKg = 30;
    readonly maxThrustN = 1_200; // placeholder
    private _power: number = 0;

    get power(): number { return this._power; }
    set power(v: number) {
        // Small Engine is simple: it's either ON or OFF.
        // We clamp < 0.5 to 0, >= 0.5 to 1.
        this._power = v >= 0.5 ? 1 : 0;
    }

    readonly fuelBurnRateKgPerS = 5.5; // placeholder
    /** Additional thrust fraction at vacuum relative to sea level (e.g., 0.25 => +25% at vacuum). */
    readonly vacuumBonusAtVacuum = 0.0;
    readonly exposes = ["fuelConsumptionKgPerS"];

    /**
     * Current thrust considering ambient air density. At sea level (rho == rho0),
     * thrust = maxThrustN. As density decreases toward vacuum, thrust increases by
     * up to vacuumBonusAtVacuum fraction.
     */
    currentThrust(airDensity: number, seaLevelDensity: number = 1.225): number {
        if (this.power <= 0) return 0;
        return this.maxThrustN * this.power;
    }
}

export class SmallEngineV2 implements EnginePart {
    readonly id = PartIds.ENGINE_SMALL_V2;
    readonly name = "Small Engine V2";
    readonly dryMassKg = 35;
    readonly maxThrustN = 1_750; // placeholder
    private _power: number = 0;

    get power(): number { return this._power; }
    set power(v: number) {
        // Small Engine is simple: it's either ON or OFF.
        // We clamp < 0.5 to 0, >= 0.5 to 1.
        this._power = v >= 0.5 ? 1 : 0;
    }

    readonly fuelBurnRateKgPerS = 4.0; // placeholder
    /** Additional thrust fraction at vacuum relative to sea level (e.g., 0.25 => +25% at vacuum). */
    readonly vacuumBonusAtVacuum = 0.0;
    readonly exposes = ["fuelConsumptionKgPerS"];

    /**
     * Current thrust considering ambient air density. At sea level (rho == rho0),
     * thrust = maxThrustN. As density decreases toward vacuum, thrust increases by
     * up to vacuumBonusAtVacuum fraction.
     */
    currentThrust(airDensity: number, seaLevelDensity: number = 1.225): number {
        if (this.power <= 0) return 0;
        return this.maxThrustN * this.power;
    }
}

export class PrecisionEngine implements EnginePart {
    readonly id = PartIds.ENGINE_PRECISION;
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

/**
 * Vacuum Engine
 * High ISP in vacuum (e.g. 350s), poor at sea level.
 * Low thrust but efficient.
 */
export class VacuumEngine implements EnginePart {
    readonly id = PartIds.ENGINE_VACUUM;
    readonly name = "Vacuum Engine";
    readonly dryMassKg = 300;
    readonly maxThrustN = 25000;
    private _power = 0;

    readonly fuelBurnRateKgPerS = 7.5;
    readonly vacuumBonusAtVacuum = 0.0;

    get power() { return this._power; }
    set power(v: number) { this._power = Math.max(0, Math.min(1, v)); }

    readonly exposes = ["fuelBurnRateKgPerS"];

    currentThrust(airDensity: number, seaLevelDensity: number = 1.225): number {
        // Linear interpolation based on density
        // factor 0 (vac) -> 1 + bonus
        // factor 1 (sl) -> 1
        const vacuumFactor = Math.max(0, Math.min(1, 1 - (airDensity / seaLevelDensity)));
        const multiplier = 1 + (1.5 * vacuumFactor);
        return 10000 * this._power * multiplier;
    }
}

/**
 * Ion Engine
 * Very low thrust, extremely high ISP.
 * Requires massive electricity.
 */
export class IonEngine implements EnginePart {
    readonly id = PartIds.ENGINE_ION;
    readonly name = "Ion Thruster";
    readonly dryMassKg = 50;
    // Thrust: 2 N (Tiny!)
    // Burn Rate: Very low. ISP ~3000s -> ve ~30000 m/s.
    // mdot = F / ve = 2 / 30000 = 0.000066 kg/s
    readonly maxThrustN = 2;
    readonly fuelBurnRateKgPerS = 0.00007;
    private _power = 0;

    get power() { return this._power; }
    set power(v: number) { this._power = Math.max(0, Math.min(1, v)); }

    currentThrust(airDensity: number, seaLevelDensity?: number): number {
        return this.maxThrustN * this._power; // Constant thrust (vacuum optimized usually)
    }
}
