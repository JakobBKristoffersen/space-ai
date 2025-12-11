import type { EnvironmentSnapshot } from "../../simulation/Environment";

/**
 * Draw a faded blue atmospheric glow around the primary when the active rocket
 * is within the atmosphere. This function performs no allocations on the hot path
 * and expects a stable toScreen transform.
 */
export function drawAtmosphereGlow(
  ctx: CanvasRenderingContext2D,
  snap: EnvironmentSnapshot,
  pxPerMeter: number,
  toScreen: (x: number, y: number) => { x: number; y: number },
): void {
  // Only draw if rocket is in atmosphere and the primary has an atmosphere model
  const primary = snap.bodies.find((b) => b.id === snap.primaryId);
  if (!primary) return;
  const inAtmo = (snap.rocket as any)?.inAtmosphere;
  if (!inAtmo) return;
  if (!(primary.atmosphereScaleHeightMeters && primary.atmosphereScaleHeightMeters > 0)) return;

  // Cutoff altitude comes from the Environment model when available
  const cutoffAlt = (snap as any).atmosphereCutoffAltitudeMeters ?? (primary.atmosphereScaleHeightMeters * 6);
  const Rm = primary.radiusMeters;
  const outerRpx = (Rm + Math.max(0, cutoffAlt)) * pxPerMeter;
  const Rpx = Rm * pxPerMeter;
  if (!(outerRpx > 1)) return;

  const center = toScreen(primary.position.x, primary.position.y);
  const base = primary.atmosphereColor || "rgba(80,160,255,1)";

  const toRgbaWithAlpha = (c: string, a: number) => {
    const m = c.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i);
    if (m) return `rgba(${m[1]},${m[2]},${m[3]},${a})`;
    const m2 = c.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (m2) return `rgba(${m2[1]},${m2[2]},${m2[3]},${a})`;
    const mh = c.match(/^#([0-9a-fA-F]{6})$/);
    if (mh) {
      const hex = mh[1];
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    return `rgba(80,160,255,${a})`;
  };

  const grad = ctx.createRadialGradient(center.x, center.y, Rpx, center.x, center.y, outerRpx);
  grad.addColorStop(0, toRgbaWithAlpha(base, 0.22));
  grad.addColorStop(1, toRgbaWithAlpha(base, 0));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(center.x, center.y, outerRpx, 0, Math.PI * 2);
  ctx.fill();
}
