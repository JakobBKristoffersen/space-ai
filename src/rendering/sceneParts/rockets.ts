/**
 * Draw a simple triangular rocket with optional exhaust plume when burning.
 * This is a pure helper used by CelestialScene to keep the file small.
 */
export function drawRocket(
  ctx: CanvasRenderingContext2D,
  snapTimeSeconds: number,
  r: { position: { x: number; y: number }; orientationRad: number; fuelConsumptionKgPerS?: number },
  toScreen: (x: number, y: number) => { x: number; y: number },
  color: string,
  drawPlume: boolean,
): void {
  const p = toScreen(r.position.x, r.position.y);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-r.orientationRad);

  if (drawPlume) {
    const t = snapTimeSeconds;
    const s = 10; // base size matches existing scene style
    const flicker = 0.85 + 0.3 * Math.sin(t * 30 + (r.position.x + r.position.y) * 1e-4);
    const len = s * (1.2 + 0.6 * flicker);
    const base = s * 0.5;
    const half = s * 0.35;
    const grad = ctx.createLinearGradient(-base - len, 0, -base, 0);
    grad.addColorStop(0, "rgba(255,220,120,0)");
    grad.addColorStop(0.2, "rgba(255,200,90,0.35)");
    grad.addColorStop(0.6, "rgba(255,140,60,0.6)");
    grad.addColorStop(1, "rgba(255,100,40,0.9)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-base, 0);
    ctx.lineTo(-base - len, half);
    ctx.lineTo(-base - len * 0.9, 0);
    ctx.lineTo(-base - len, -half);
    ctx.closePath();
    ctx.fill();
  }

  // Rocket body
  ctx.fillStyle = color;
  ctx.beginPath();
  const s = 10;
  ctx.moveTo(s, 0);
  ctx.lineTo(-s * 0.8, s * 0.6);
  ctx.lineTo(-s * 0.8, -s * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
