/**
 * Ion Engine
 * Very low thrust, extremely high ISP.
 * Requires massive electricity.
 */
import { EnginePart } from "../Rocket";

export class IonEngine implements EnginePart {
    readonly id = "engine.ion";
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

    // Ion engines consume POWER (Electricity) to run. 
    // The interface 'EnginePart' doesn't adhere to drawing energy directly in tick()
    // Rocket.ts sums burn rate and draws fuel.
    // It does NOT automatically draw electricity for engines.
    // TODO: Add 'drawEnergy' to EnginePart or handle in Rocket.ts?
    // User asked for parts implementation.
    // If I add a 'energyPerSecond' property, I need to update Rocket.ts to use it.

    currentThrust(airDensity: number, seaLevelDensity?: number): number {
        return this.maxThrustN * this._power; // Constant thrust (vacuum optimized usually)
    }
}
