import type { Rocket } from "../../simulation/Rocket";
import type { PartStore } from "../../game/PartStore";
import type { MissionManager } from "../../game/MissionManager";

export interface PartsPanelDeps {
  getRocket: () => Rocket;
  store: PartStore;
  missions: MissionManager;
  isRunning: () => boolean;
  getMoney: () => number;
  setMoney: (next: number) => void;
  saveLayout: (rocket: Rocket) => void;
  publishTelemetry: () => void;
  refreshInstalled: () => void;
}

export function initPartsPanel(deps: PartsPanelDeps) {
  const hostId = "parts";

  function fmt(n: number) { return n.toLocaleString(); }
  function getCompleted(): readonly string[] { return deps.missions.getCompletedMissionIds(); }

  function render() {
    const host = document.getElementById(hostId);
    if (!host) return;
    const rocket = deps.getRocket();
    host.innerHTML = "";

    // Build a set of installed ids to hide duplicates
    const installedIds = new Set<string>();
    for (const e of rocket.engines) installedIds.add(e.id);
    for (const t of rocket.fuelTanks) installedIds.add(t.id);
    for (const b of rocket.batteries) installedIds.add(b.id);
    if (rocket.cpu) installedIds.add(rocket.cpu.id);
    for (const s of rocket.sensors) installedIds.add(s.id);

    const availableAll = deps.store.listAvailable(getCompleted());
    const available = availableAll.filter(p => !installedIds.has(p.id));

    for (const p of available) {
      const row = document.createElement("div");
      row.className = "part";
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<strong>${p.name}</strong><small class=\"muted\">$${fmt(p.price)}</small>`;
      const btn = document.createElement("button");
      btn.textContent = "Install";
      btn.disabled = deps.getMoney() < p.price || deps.isRunning();
      btn.addEventListener("click", () => {
        if (deps.isRunning()) return;
        const balance = deps.getMoney();
        const res = deps.store.purchase<any>(p.id, balance, getCompleted());
        if (!res) return;
        const r = deps.getRocket();
        // Install instance by category
        switch ((p as any).category) {
          case "engine":
            (r.engines as any).push(res.instance); break;
          case "fuel":
            (r.fuelTanks as any).push(res.instance); break;
          case "battery":
            (r.batteries as any).push(res.instance); break;
          case "cpu":
            (r as any).cpu = res.instance; break;
          case "sensor":
            (r.sensors as any).push(res.instance); break;
          case "antenna":
            (r as any).antennas = (r as any).antennas || [];
            (r as any).antennas.push(res.instance);
            break;
        }
        deps.setMoney(res.newBalance);
        deps.saveLayout(r);
        deps.refreshInstalled();
        deps.publishTelemetry();
        render(); // refresh list after install
      });
      row.appendChild(meta);
      row.appendChild(btn);
      host.appendChild(row);
    }
  }

  return {
    render,
    update() { render(); },
    dispose() {}
  } as const;
}
