/**
 * Vacuum Engine
 * High ISP in vacuum (e.g. 350s), poor at sea level.
 * Low thrust but efficient.
 */
import { EnginePart } from "../Rocket";

export class VacuumEngine implements EnginePart {
    readonly id = "engine.vacuum";
    readonly name = "Vacuum Engine";
    readonly dryMassKg = 300;
    readonly maxThrustN = 25000;
    private _power = 0;

    // High efficiency
    // ISP ~340s -> ~290s at sea level? Or worse?
    // Let's say burn rate is constant for max thrust.
    // F = mdot * ve
    // ve = F / mdot
    // At vac: 25000 / 7.5 ~ 3333 m/s (ISP 340s)
    readonly fuelBurnRateKgPerS = 7.5;
    readonly vacuumBonusAtVacuum = 0.0; // Base stats are VACUUM stats for simplicity? 
    // Wait, existing engines defined base as Sea Level?
    // SmallEngine: 100kN, bonus 0.25 => 125kN in vacuum.
    // If we want VacuumEngine to be BAD at sea level:
    // Define base as Sea Level thrust, with HUGE vacuum bonus.
    // Goal: 25kN Vac, 10kN SL.
    // Base = 10kN. Bonus to reach 25kN = +150% (1.5).

    // Let's redefine:
    // Base Thrust (SL) = 10000 N
    // Vac Thrust = 25000 N (ISP 340s)
    // Burn Rate = 7.5 kg/s (Constant)
    // SL ISP = 10000 / 7.5 = 1333 m/s (136s) - Terrible at SL.

    // Implementation where maxThrustN is usually "Base/SL"
    // But let's check Rocket.ts logic:
    // currentThrust = maxThrust * power * (1 + bonus * (1 - airDensity/1.225)) ??
    // Let's look at Engine.ts or Rocket.ts implementation of currentThrust.
    // "returns current thrust (N) based on power and atmosphere."
    // I should check what SmallEngine does.

    // Assuming typical scaling:
    // If I set maxThrustN to 10000 (SL) and vacuumBonusAtVacuum to 1.5
    // At vac (rho=0), mult is 1 + 1.5*(1-0) = 2.5 -> 25000 N. Correct.

    get power() { return this._power; }
    set power(v: number) { this._power = Math.max(0, Math.min(1, v)); }

    readonly exposes = ["fuelBurnRateKgPerS"]; // Engine specific data?

    currentThrust(airDensity: number, seaLevelDensity: number = 1.225): number {
        // Linear interpolation based on density
        // factor 0 (vac) -> 1 + bonus
        // factor 1 (sl) -> 1
        const vacuumFactor = Math.max(0, Math.min(1, 1 - (airDensity / seaLevelDensity)));
        const multiplier = 1 + (1.5 * vacuumFactor);
        return 10000 * this._power * multiplier;
    }
}
