import { SimulationManager } from "../sim/SimulationManager";

export interface ControlsPanelDeps {
  manager: SimulationManager;
}

export function initControlsPanel(deps: ControlsPanelDeps) {
  const { manager } = deps;

  function bindClick(id: string, fn: () => void) {
    const el = document.getElementById(id) as HTMLButtonElement | null;
    if (el && !(el as any).__bound) {
      el.addEventListener("click", fn);
      (el as any).__bound = true;
    }
  }

  // Bind both top Controls card and bottom game bar buttons
  bindClick("engineOn", () => manager.enqueue({ type: "setEnginePower", value: 1 }));
  bindClick("engineOff", () => manager.enqueue({ type: "setEnginePower", value: 0 }));
  bindClick("engineOn2", () => manager.enqueue({ type: "setEnginePower", value: 1 }));
  bindClick("engineOff2", () => manager.enqueue({ type: "setEnginePower", value: 0 }));
  bindClick("turnLeft", () => manager.enqueue({ type: "turnLeft", value: 0.01 }));
  bindClick("turnRight", () => manager.enqueue({ type: "turnRight", value: 0.01 }));

  return {
    update() {
      // Manual controls remain usable while running; nothing to update for now.
    },
    dispose() {
      // No-op for now; if we add dynamic state later, unbind listeners here.
    }
  } as const;
}
