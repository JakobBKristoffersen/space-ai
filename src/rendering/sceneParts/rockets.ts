/**
 * Draw a detailed rocket with optional exhaust plume and thermal glow.
 * This is a pure helper used by CelestialScene to keep the file small.
 */
export function drawRocket(
  ctx: CanvasRenderingContext2D,
  snapTimeSeconds: number,
  r: { position: { x: number; y: number }; orientationRad: number; fuelConsumptionKgPerS?: number; noseTemperature?: number; tailTemperature?: number },
  toScreen: (x: number, y: number) => { x: number; y: number },
  color: string,
  drawPlume: boolean,
): void {
  const p = toScreen(r.position.x, r.position.y);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-r.orientationRad);

  const s = 10; // Base scale unit
  const bodyW = s * 0.8;
  const bodyH = s * 1.8;
  const noseH = s * 0.8;
  const finW = s * 0.8;
  const finH = s * 0.8;

  // -- PLUME --
  if (drawPlume) {
    const t = snapTimeSeconds;
    const flicker = 0.85 + 0.3 * Math.sin(t * 30 + (r.position.x + r.position.y) * 1e-4);
    const len = s * (1.5 + 0.7 * flicker);
    const base = bodyW * 0.6;

    // Plume Gradient
    const grad = ctx.createLinearGradient(-bodyH / 2 - len, 0, -bodyH / 2, 0);
    grad.addColorStop(0, "rgba(255,220,120,0)");
    grad.addColorStop(0.2, "rgba(255,180,50,0.5)");
    grad.addColorStop(1, "rgba(255,60,10,0.9)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-bodyH / 2, 0);
    ctx.lineTo(-bodyH / 2 - len, base);
    ctx.lineTo(-bodyH / 2 - len * 0.8, 0);
    ctx.lineTo(-bodyH / 2 - len, -base);
    ctx.closePath();
    ctx.fill();
  }

  // -- ROCKET BODY --
  // We'll draw pieces: Nozzle, Fins, Body, Nose

  // 1. Nozzle (Gray)
  ctx.fillStyle = "#555";
  ctx.beginPath();
  ctx.moveTo(-bodyH / 2, bodyW * 0.4);
  ctx.lineTo(-bodyH / 2 - s * 0.3, bodyW * 0.25);
  ctx.lineTo(-bodyH / 2 - s * 0.3, -bodyW * 0.25);
  ctx.lineTo(-bodyH / 2, -bodyW * 0.4);
  ctx.fill();

  // 2. Fins (Darker Color)
  ctx.fillStyle = "#A0AEC0"; // Gray-400
  ctx.beginPath();
  // Top Fin
  ctx.moveTo(-bodyH / 2 + finH * 0.2, -bodyW / 2);
  ctx.lineTo(-bodyH / 2 - finH * 0.5, -bodyW / 2 - finW);
  ctx.lineTo(-bodyH / 2 + finH, -bodyW / 2);
  // Bottom Fin
  ctx.moveTo(-bodyH / 2 + finH * 0.2, bodyW / 2);
  ctx.lineTo(-bodyH / 2 - finH * 0.5, bodyW / 2 + finW);
  ctx.lineTo(-bodyH / 2 + finH, bodyW / 2);
  ctx.fill();


  // 3. Main Tank (Input Color - usually white or team color)
  ctx.fillStyle = color;
  ctx.fillRect(-bodyH / 2, -bodyW / 2, bodyH, bodyW);

  // Detail line
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(-bodyH / 2 + bodyH * 0.7, -bodyW / 2, 2, bodyW);


  // 4. TAIL HEAT GLOW
  // If tail temp > 600K, add glowing overlay
  if ((r.tailTemperature ?? 0) > 600) {
    const tRatio = Math.min(1, ((r.tailTemperature ?? 0) - 600) / 2000); // 0..1
    ctx.save();
    ctx.shadowBlur = 10 * tRatio;
    ctx.shadowColor = `rgba(255, 100, 0, ${tRatio})`;
    ctx.fillStyle = `rgba(255, 50, 0, ${tRatio * 0.6})`;
    // Drawn over nozzle/rear body
    ctx.beginPath();
    ctx.arc(-bodyH / 2, 0, bodyW * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 5. NOSE CONE
  // Normal color or Heat color
  let noseColor = color === "#e74c3c" ? "#c0392b" : "#CBD5E0"; // Default darker shade

  // NOSE HEAT GLOW
  const noseT = r.noseTemperature ?? 0;
  if (noseT > 600) {
    const tRatio = Math.min(1, (noseT - 600) / 2400); // Max glow at 3000K
    ctx.save();
    ctx.shadowBlur = 15 * tRatio;
    ctx.shadowColor = `rgba(255, 200, 50, ${tRatio})`;
    ctx.fillStyle = `rgba(255, ${200 - tRatio * 150}, ${100 - tRatio * 50}, ${0.5 + tRatio * 0.5})`; // White -> RED/ORANGE

    // Draw Nose
    ctx.beginPath();
    ctx.moveTo(bodyH / 2, -bodyW / 2);
    ctx.lineTo(bodyH / 2 + noseH, 0);
    ctx.lineTo(bodyH / 2, bodyW / 2);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = noseColor;
    ctx.beginPath();
    ctx.moveTo(bodyH / 2, -bodyW / 2);
    ctx.lineTo(bodyH / 2 + noseH, 0);
    ctx.lineTo(bodyH / 2, bodyW / 2);
    ctx.fill();
  }

  ctx.restore();
}
