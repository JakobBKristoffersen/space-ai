import type { Environment } from "../../simulation/Environment";
import type { TelemetryService } from "../services/TelemetryService";
import type { Rocket } from "../../simulation/Rocket";

export interface MetricsPanelDeps {
  hostId: string; // e.g., "metrics"
  getEnv: () => Environment;
  getRocket: () => Rocket;
  telemetry: TelemetryService;
}

export function initMetricsPanel(deps: MetricsPanelDeps) {
  const host = () => document.getElementById(deps.hostId) as HTMLElement | null;
  let lastRender = 0;

  function fmtNum(v: unknown): string {
    if (typeof v !== "number") return String(v);
    const a = Math.abs(v);
    if (a >= 10000) return v.toFixed(0);
    if (a >= 1000) return v.toFixed(1);
    return v.toFixed(2);
  }

  function renderNow() {
    const el = host();
    if (!el) return;
    const rocket = deps.getRocket();
    const env = deps.getEnv();
    const allowedKeys = deps.telemetry.currentKeys(rocket);
    const allowed = new Set<string>(allowedKeys);
    const snap: any = env.snapshot().rocket;
    const lines: string[] = [];
    for (const key of allowed) {
      const val = snap[key];
      if (val === undefined) continue;
      if (val && typeof val === "object") {
        for (const subKey of Object.keys(val)) {
          const subVal: any = (val as any)[subKey];
          if (typeof subVal === "number" || typeof subVal === "string") {
            lines.push(`${key}.${subKey}: ${fmtNum(subVal)}`);
          }
        }
      } else {
        lines.push(`${key}: ${fmtNum(val)}`);
      }
    }
    el.innerHTML = lines.map(l => `<div>${l}</div>`).join("");
  }

  function update(nowMs: number) {
    if (nowMs - lastRender < 200) return; // ~5 Hz
    lastRender = nowMs;
    renderNow();
  }

  return { update, renderNow } as const;
}
