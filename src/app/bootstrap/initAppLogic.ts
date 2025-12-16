/**
 * Application bootstrap (React pages call this once on mount).
 * Owns services and SimulationManager creation and exposes globals for UI.
 */
import { LayoutService } from "../services/LayoutService";
import { ScriptLibraryService } from "../services/ScriptLibraryService";
import { TelemetryService } from "../services/TelemetryService";
import { UpgradesService } from "../services/UpgradesService";
import { PendingUpgradesService } from "../services/PendingUpgradesService";
import { ResearchService } from "../services/ResearchService";
import { SimulationManager } from "../sim/SimulationManager";
import { ToySystem } from "../config/ToySystem";
import { DEFAULT_EXAMPLE } from "./seedScript";
import { BASE_STARTING_MONEY, seedDefaultMissions } from "../config";
import { MissionManager } from "../../game/MissionManager";
import { PartStore, DefaultCatalog } from "../../game/PartStore";
import { SessionKeys } from "../services/SessionKeys";
import { DebugService } from "../services/DebugService";

export function initAppLogic(): void {
  // 1) Ensure canvas exists and is sized to CSS box
  const canvas = document.getElementById("game") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("Canvas #game not found");
  const cssW = canvas.clientWidth || 900;
  const cssH = canvas.clientHeight || 600;
  canvas.width = Math.max(1, Math.round(cssW));
  canvas.height = Math.max(1, Math.round(cssH));
  const ctx = canvas.getContext("2d") ?? undefined;
  if (ctx) ctx.imageSmoothingEnabled = true;

  // 2) Services
  const layoutSvc = new LayoutService();
  const scriptLib = new ScriptLibraryService();
  const telemetrySvc = new TelemetryService();
  const upgrades = new UpgradesService();
  const pending = new PendingUpgradesService();
  const research = new ResearchService();

  // 3) Seed example script (moved early so we can assign it to default rocket)
  // 3) Ensure Start.ts exists (Upsert to guarantee it's there even if library wasn't empty)
  let startScriptId: string | undefined;
  try {
    const existing = sessionStorage.getItem(SessionKeys.SCRIPT);
    const seed = existing ?? (typeof DEFAULT_EXAMPLE === 'string' ? DEFAULT_EXAMPLE : 'export function update(api: any){}');
    // Force upsert to ensure it exists with this name and we get the real ID
    const s = scriptLib.upsertByName("Start.ts", seed);
    startScriptId = s.id;
  } catch { }

  // 4) Build rocket from stored layout (index 0); if absent, fix it.
  let layout = layoutSvc.loadLayout();

  // Create default if missing, OR patch default if it's the basic rocket but missing the script
  if (!layout || (layout.templateId === "template.basic" && !layout.scriptId)) {
    if (!layout) {
      layoutSvc.buildDefaultRocket();
      layout = layoutSvc.loadLayout();
    }

    // Assign script if we have one and the layout needs it
    if (layout && startScriptId) {
      layout.scriptId = startScriptId;
      layoutSvc.saveLayout(layout); // Persist the fix to layout storage
    }
  }

  // 5) Manager (owns Environment/Renderer/Loop)
  const manager = new SimulationManager({
    rocket: layoutSvc.buildRocketFromLayout(layout),
    system: ToySystem,
    ctx,
    layoutSvc,
    scriptLib,
    telemetry: telemetrySvc,
    pending,
    defaultScriptRunnerOpts: { timeLimitMs: 6 },
  });

  // Ensure the script is actually installed in the runner if we have a scriptId
  // (SimulationManager might not auto-install on fresh boot unless we tell it)
  if (layout?.scriptId && startScriptId) {
    try {
      const s = scriptLib.getById(layout.scriptId);
      if (s) {
        manager.getRunner().installScriptToSlot(s.compiledCode || s.code, { timeLimitMs: 6 }, 0, s.name);

        // Also persist assignment so UI sees it
        scriptLib.saveAssignments([{ rocketIndex: 0, slot: 0, scriptId: s.id, enabled: true }]);
      }
    } catch { }
  }


  // Sync initial rocket name if available from stored layout
  if (layout && layout.name) {
    try { manager.setRocketName(0, layout.name); } catch { }
  }

  // 6) Missions + money + store
  let missionMgr = new MissionManager(research);
  seedDefaultMissions(missionMgr);
  let money: number = (window as any).__money ?? (typeof BASE_STARTING_MONEY === 'number' ? BASE_STARTING_MONEY : 100);
  const store = new PartStore(DefaultCatalog);

  // Debug Service
  const debugSvc = new DebugService(research, missionMgr, pending, layoutSvc, scriptLib, manager, (v) => { money = v; });

  // Rewards flow on post-tick
  manager.onPostTick(() => {
    try {
      const env = manager.getEnvironment();
      const newly = missionMgr.tick(env.snapshot());
      if (newly.length > 0) {
        let gained = 0; for (const m of newly) gained += m.reward().money;
        money += gained;
      }
    } catch { }
  });

  // 7) Expose globals for React pages
  try {
    (window as any).__manager = manager;
    (window as any).__services = {
      layoutSvc,
      scripts: scriptLib,
      telemetrySvc,
      upgrades,
      research,
      pending,
      debug: debugSvc, // Expose for UI
      // Missions
      getMissions: () => { try { return missionMgr.describeAll(manager.getEnvironment().snapshot()); } catch { return []; } },
      getCompleted: () => missionMgr.getCompletedMissionIds(),
      // Money
      getMoney: () => money,
      setMoney: (v: number) => { money = Math.max(0, Number(v) || 0); },
      getResearchPoints: () => research.system.points,
      getReceivedPackets: () => manager.getReceivedPackets(),
      // Store helpers
      getAvailableIds: () => {
        try { return store.listAvailable(missionMgr.getCompletedMissionIds(), research.system.unlockedTechs).map(p => p.id); } catch { return []; }
      },
      purchasePart: (partId: string) => {
        try {
          const techs = research.system.unlockedTechs;
          const available = store.listAvailable(missionMgr.getCompletedMissionIds(), techs);
          const part: any = available.find(p => p.id === partId);
          if (!part) return { ok: false, reason: "locked" };
          if (money < part.price) return { ok: false, reason: "insufficient", price: part.price, balance: money };
          money -= part.price;
          return { ok: true, price: part.price, newBalance: money, part: { id: part.id, name: part.name, category: part.category } };
        } catch (e: any) {
          return { ok: false, reason: "error", message: e?.message ?? String(e) };
        }
      },
      // Reset All - NUCLEAR OPTION
      resetAll: () => {
        if (!confirm("Are you sure you want to completely reset all progress and data? This cannot be undone.")) return;
        try { manager.pause(); } catch { }
        try {
          // Clear EVERYTHING
          localStorage.clear();
          sessionStorage.clear();
        } catch { }
        location.reload();
      },
    };
  } catch { }

  // 8) Start always-running simulation and publish initial telemetry
  try { manager.start(); } catch { }
  try { manager.publishTelemetry(); } catch { }
}

