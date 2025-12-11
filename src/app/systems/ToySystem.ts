import type { CelestialSystemDef } from "../../simulation/Environment";

/**
 * Shared toy solar system definition used across bootstrap and main.
 * Keeping this in one place avoids drift during refactors.
 */
export const ToySystem: CelestialSystemDef = {
  primaryId: "planet",
  bodies: [
    {
      id: "planet",
      name: "Toy Planet",
      radiusMeters: 5000,
      surfaceGravity: 9.81,
      color: "#2e5d2e",
      // Keep a small scale height per previous tuning; Environment constructs
      // AtmosphereWithCutoff with cutoffFactor, so effective cutoff ~ H*7
      atmosphereScaleHeightMeters: 200,
      atmosphereColor: "rgba(90,160,255,1)",
    },
    {
      id: "moon",
      name: "Big Moon",
      radiusMeters: 800,
      surfaceGravity: 1.62, // gentle
      color: "#7a7a7a",
      orbit: {
        aroundId: "planet",
        radiusMeters: 25000,
        angularSpeedRadPerS: (2 * Math.PI) / 600, // 600s period
        phaseRad: 0,
      },
    },
  ],
};
