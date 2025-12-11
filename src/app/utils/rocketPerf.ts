import type { Rocket } from "../../simulation/Rocket";

export function estimateDeltaV(rocket: Rocket): number {
  // Sum thrust (N) and mass flow (kg/s) for engines at full power
  let thrustN = 0;
  let mdot = 0;
  for (const e of rocket.engines) {
    thrustN += e.maxThrustN;
    mdot += e.fuelBurnRateKgPerS;
  }
  if (thrustN <= 0 || mdot <= 0) return 0;
  // Effective exhaust velocity (m/s)
  const ve = thrustN / mdot;
  const m0 = rocket.totalMass();
  const fuel = rocket.availableFuelKg();
  const m1 = Math.max(1e-6, m0 - fuel);
  if (m1 <= 0 || m0 <= 0 || m1 >= m0) return 0;
  const dv = ve * Math.log(m0 / m1);
  return isFinite(dv) && dv > 0 ? dv : 0;
}

export function mag2(x: number, y: number): number {
  return Math.hypot(x, y);
}
