import { Rocket } from "../../simulation/Rocket";

export class TelemetryService {
  currentKeys(rocket: Rocket): string[] {
    const allowed = new Set<string>();
    for (const s of rocket.sensors) for (const k of s.exposes) allowed.add(k);
    for (const e of rocket.engines) if ((e as any).exposes) for (const k of (e as any).exposes) allowed.add(k);
    for (const t of rocket.fuelTanks) if ((t as any).exposes) for (const k of (t as any).exposes) allowed.add(k);
    for (const b of rocket.batteries) if ((b as any).exposes) for (const k of (b as any).exposes) allowed.add(k);
    for (const rw of (rocket as any).reactionWheels ?? []) if ((rw as any).exposes) for (const k of (rw as any).exposes) allowed.add(k);
    for (const ant of (rocket as any).antennas ?? []) if ((ant as any).exposes) for (const k of (ant as any).exposes) allowed.add(k);
    if (rocket.cpu && (rocket.cpu as any).exposes) for (const k of (rocket.cpu as any).exposes) allowed.add(k);
    return Array.from(allowed);
  }

  publish(keys: string[]): void {
    try {
      const detail = { keys } as any;
      window.dispatchEvent(new CustomEvent("telemetry-keys", { detail }));
    } catch {}
  }
}
