import { createContext, useContext } from "react";
import type { SimulationManager } from "./sim/SimulationManager";
import type { LayoutService } from "./services/LayoutService";
import type { ScriptLibraryService } from "./services/ScriptLibraryService";
import type { TelemetryService } from "./services/TelemetryService";
import type { UpgradesService } from "./services/UpgradesService";
import type { ResearchService } from "./services/ResearchService";

export interface AppCore {
  manager: SimulationManager | null;
  services: {
    layout: LayoutService | null;
    scripts: ScriptLibraryService | null;
    telemetry: TelemetryService | null;
    upgrades: UpgradesService | null;
    research: ResearchService | null;
    pending: any | null;
    base?: any | null;
  };
}

export const AppCoreContext = createContext<AppCore>({
  manager: null,
  services: { layout: null, scripts: null, telemetry: null, upgrades: null, research: null, pending: null },
});

export function useAppCore() {
  return useContext(AppCoreContext);
}
