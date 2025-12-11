import type { Environment } from "../../simulation/Environment";

export interface SparklinesDeps {
  getEnv: () => Environment;
  fuelCanvasId: string;
  batteryCanvasId: string;
}

export function initSparklines(deps: SparklinesDeps) {
  const fuelData: number[] = [];
  const batteryData: number[] = [];
  const maxLen = 120; // last ~24s at 5Hz

  function pushSamples() {
    const snap = deps.getEnv().snapshot().rocket as any;
    fuelData.push(Number(snap.fuelKg) || 0);
    const pct = Number(snap.batteryPercent) || 0;
    batteryData.push(pct);
    if (fuelData.length > maxLen) fuelData.splice(0, fuelData.length - maxLen);
    if (batteryData.length > maxLen) batteryData.splice(0, batteryData.length - maxLen);
  }

  function draw(canvasId: string, data: number[], color: string, normalized = false) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const w = canvas.width = canvas.clientWidth || 240;
    const h = canvas.height = canvas.height; // keep provided height
    ctx.clearRect(0, 0, w, h);
    if (data.length < 2) return;
    let min = Math.min(...data); let max = Math.max(...data);
    if (normalized) { min = 0; max = 100; }
    const span = Math.max(1e-6, max - min);
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * (w - 2) + 1;
      const y = h - 1 - ((data[i] - min) / span) * (h - 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function update() {
    pushSamples();
    draw(deps.fuelCanvasId, fuelData, "#4FD1C5", false);
    draw(deps.batteryCanvasId, batteryData, "#F6AD55", true);
  }

  return { update } as const;
}
