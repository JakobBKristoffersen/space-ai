import type { Rocket } from "../../simulation/Rocket";

export interface InstalledPanelDeps {
  /** Provide current rocket instance (may change after reset). */
  getRocket: () => Rocket;
}

export function initInstalledPanel(deps: InstalledPanelDeps) {
  function render() {
    const host = document.getElementById("installed");
    if (!host) return;
    const rocket = deps.getRocket();
    host.innerHTML = "";
    const addRow = (name: string) => {
      const row = document.createElement("div");
      row.className = "part";
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<strong>${name}</strong>`;
      row.appendChild(meta);
      host.appendChild(row);
    };
    for (const e of rocket.engines) addRow(e.name);
    for (const t of rocket.fuelTanks) addRow(t.name);
    for (const b of rocket.batteries) addRow(b.name);
    for (const rw of (rocket as any).reactionWheels ?? []) addRow((rw as any).name);
    if (rocket.cpu) addRow(rocket.cpu.name);
    for (const s of rocket.sensors) addRow(s.name);
  }

  return { render } as const;
}
