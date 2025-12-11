/**
 * Bootstrap for the application orchestration layer.
 *
 * This thin module wires services and the SimulationManager together.
 * For now, it is provided alongside the existing main.ts implementation and
 * will gradually replace it as UI controllers are extracted.
 */
import { LayoutService, type StoredLayout } from "../services/LayoutService";
import { ScriptLibraryService } from "../services/ScriptLibraryService";
import { TelemetryService } from "../services/TelemetryService";
import { SimulationManager } from "../sim/SimulationManager";
import type { Rocket } from "../../simulation/Rocket";
import { Environment, SimpleAtmosphere, QuadraticDrag, SimpleHeating } from "../../simulation/Environment";
import { ToySystem } from "../config/ToySystem";

export interface BootstrapDeps {
  canvas: HTMLCanvasElement;
  rocket: Rocket;
}

export function createServices() {
  const layoutSvc = new LayoutService();
  const scriptLib = new ScriptLibraryService();
  const telemetry = new TelemetryService();
  return { layoutSvc, scriptLib, telemetry };
}

/**
 * Creates a SimulationManager with the given canvas and rocket.
 * Returns the manager instance so callers can start/pause and subscribe to updates.
 */
export function createSimulationManager(deps: BootstrapDeps) {
  const ctx = deps.canvas.getContext("2d") ?? undefined;
  const services = createServices();
  const manager = new SimulationManager({
    rocket: deps.rocket,
    system: ToySystem,
    ctx,
    layoutSvc: services.layoutSvc,
    scriptLib: services.scriptLib,
    telemetry: services.telemetry,
    defaultScriptRunnerOpts: { timeLimitMs: 6 },
  });
  return { manager, services };
}

// Temporary bridge: expose the legacy initAppLogic from src/main.ts so pages can import
// the bootstrap entry from app/bootstrap/initAppLogic during the migration phase.
export { initAppLogic } from "../../main";
