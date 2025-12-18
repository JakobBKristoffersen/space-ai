import type { CelestialSystemDef } from "../../simulation/CelestialSystem";

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
      radiusMeters: 8000,
      surfaceGravity: 12.0,
      color: "#2e5d2e",
      // Keep a small scale height per previous tuning; Environment constructs
      // Explicit atmosphere cutoff at 2000m (Physics scaled to this)
      atmosphereScaleHeightMeters: 285,
      atmosphereHeightMeters: 2000,
      atmosphereColor: "rgba(90,160,255,1)",
      terrain: [
        { type: "Plains", color: "#2e5d2e", startRad: 0, endRad: 1.5 },
        { type: "Mountains", color: "#5d5d5d", startRad: 1.5, endRad: 2.5 },
        { type: "Water", color: "#1e3f5a", startRad: 2.5, endRad: 3.5 },
        { type: "Desert", color: "#c2b280", startRad: 3.5, endRad: 4.5 },
        { type: "Forest", color: "#1a331a", startRad: 4.5, endRad: 5.5 },
        { type: "Ice", color: "#e0f7fa", startRad: 5.5, endRad: Math.PI * 2 + 0.1 }, // Overlap slightly to close loop
      ],
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
