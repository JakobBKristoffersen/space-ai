/**
 * Engine parts.
 * Provides a simple SmallEngine implementation with binary throttle (0 or 1).
 */
import { EnginePart } from "../Rocket";

/**
 * SmallEngine
 * - 0% or 100% throttle only
 * - contributes to mass via dryMassKg
 * - consumes fuel when on
 * - produces thrust when on
 */
export class SmallEngine implements EnginePart {
  readonly id = "engine.small";
  readonly name = "Small Engine";
  readonly dryMassKg = 50;
  readonly maxThrustN = 2_000; // placeholder
  private _power: number = 0;

  get power(): number { return this._power; }
  set power(v: number) {
    // Small Engine is simple: it's either ON or OFF.
    // We clamp < 0.5 to 0, >= 0.5 to 1.
    this._power = v >= 0.5 ? 1 : 0;
  }

  readonly fuelBurnRateKgPerS = 2.5; // placeholder
  /** Additional thrust fraction at vacuum relative to sea level (e.g., 0.25 => +25% at vacuum). */
  readonly vacuumBonusAtVacuum = 0.25;
  readonly exposes = ["fuelConsumptionKgPerS"];

  /**
   * Current thrust considering ambient air density. At sea level (rho == rho0),
   * thrust = maxThrustN. As density decreases toward vacuum, thrust increases by
   * up to vacuumBonusAtVacuum fraction.
   */
  currentThrust(airDensity: number, seaLevelDensity: number = 1.225): number {
    if (this.power <= 0) return 0;
    const rho = Math.max(0, airDensity || 0);
    const rho0 = Math.max(1e-9, seaLevelDensity || 1.225);
    const rel = Math.max(0, Math.min(1, rho / rho0));
    const bonus = Math.max(0, this.vacuumBonusAtVacuum ?? 0);
    const scale = 1 + bonus * (1 - rel);
    return this.maxThrustN * scale * this.power;
  }
}
