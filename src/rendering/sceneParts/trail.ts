export interface TrailPoint { x: number; y: number; t: number }

/**
 * Mutates the provided trail array by pruning old points and optionally appending
 * the current rocket position when engines are burning and spacing exceeded.
 * Returns updated last point cache.
 */
export function updateTrail(
  trail: TrailPoint[],
  nowT: number,
  burning: boolean,
  rx: number,
  ry: number,
  maxTrailAgeSec: number,
  minSpacingMeters: number,
  lastX: number | null,
  lastY: number | null,
): { lastX: number | null; lastY: number | null } {
  // Prune old points
  if (trail.length > 0) {
    let cut = 0;
    for (let i = 0; i < trail.length; i++) {
      if (nowT - trail[i].t <= maxTrailAgeSec) { cut = i; break; }
    }
    if (cut > 0) trail.splice(0, cut);
    if (trail.length && nowT - trail[0].t > maxTrailAgeSec) {
      trail.length = 0;
      lastX = lastY = null;
    }
  }

  if (burning) {
    let shouldAdd = false;
    if (lastX === null || lastY === null) {
      shouldAdd = true;
    } else {
      const dxm = rx - lastX;
      const dym = ry - lastY;
      const dist = Math.hypot(dxm, dym);
      if (dist >= minSpacingMeters) shouldAdd = true;
    }
    if (shouldAdd) {
      trail.push({ x: rx, y: ry, t: nowT });
      lastX = rx; lastY = ry;
    }
  } else {
    // Reset spacing reference so next burn makes a new segment immediately
    lastX = lastY = null;
  }

  return { lastX, lastY };
}

/**
 * Draws a glowing trail for engine-on segments. No allocations are performed.
 */
export function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: readonly TrailPoint[],
  toScreen: (x: number, y: number) => { x: number; y: number },
  nowT: number,
  maxTrailAgeSec: number,
): void {
  if (trail.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 1; i < trail.length; i++) {
    const p0 = trail[i - 1];
    const p1 = trail[i];
    const ageMid = nowT - (p0.t + p1.t) * 0.5;
    const k = Math.max(0, Math.min(1, 1 - ageMid / maxTrailAgeSec));
    if (k <= 0) continue;
    const a = 0.85 * k * k;
    const w = 3 * k + 0.5;
    const s0 = toScreen(p0.x, p0.y);
    const s1 = toScreen(p1.x, p1.y);
    ctx.strokeStyle = `rgba(255,200,80,${a.toFixed(3)})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(s0.x, s0.y);
    ctx.lineTo(s1.x, s1.y);
    ctx.stroke();
  }
  ctx.restore();
}
