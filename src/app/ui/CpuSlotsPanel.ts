/**
 * CpuSlotsPanel
 * - Manages CPU slot assignment, enable/disable toggles, and per-slot logs rendering.
 * - DOM contract (ids): #slot1Select, #slot2Select, #assignSlot1, #assignSlot2, #toggleSlot1, #toggleSlot2, #logSlot1, #logSlot2
 */
import type { ScriptLibraryService } from "../services/ScriptLibraryService";
import type { SimulationManager } from "../sim/SimulationManager";

export interface CpuSlotsPanelDeps {
  manager: SimulationManager;
  scripts: ScriptLibraryService;
}

export function initCpuSlotsPanel(deps: CpuSlotsPanelDeps) {
  const s1El = document.getElementById("slot1Select") as HTMLSelectElement | null;
  const s2El = document.getElementById("slot2Select") as HTMLSelectElement | null;
  const assign1 = document.getElementById("assignSlot1") as HTMLButtonElement | null;
  const assign2 = document.getElementById("assignSlot2") as HTMLButtonElement | null;
  const toggle1 = document.getElementById("toggleSlot1") as HTMLButtonElement | null;
  const toggle2 = document.getElementById("toggleSlot2") as HTMLButtonElement | null;
  const log1El = document.getElementById("logSlot1") as HTMLElement | null;
  const log2El = document.getElementById("logSlot2") as HTMLElement | null;

  function populateSelects() {
    const list = deps.scripts.list();
    const opts = ["<option value=\"\">-- Select script --</option>", ...list.map(s => `<option value="${s.id}">${s.name}</option>`)];
    if (s1El) s1El.innerHTML = opts.join("");
    if (s2El) s2El.innerHTML = opts.join("");

    const assigns = deps.scripts.loadAssignments();
    const s1 = assigns.find(a => a.slot === 0)?.scriptId || "";
    const s2 = assigns.find(a => a.slot === 1)?.scriptId || "";
    if (s1El) s1El.value = s1 || "";
    if (s2El) s2El.value = s2 || "";
  }

  function setAssignment(slot: number, scriptId: string | null) {
    const list = deps.scripts.loadAssignments();
    const ex = list.find(a => a.slot === slot);
    if (ex) ex.scriptId = scriptId; else list.push({ slot, scriptId, enabled: false });
    deps.scripts.saveAssignments(list);
  }

  assign1?.addEventListener("click", () => {
    if (deps.manager.isRunning()) return;
    const id = s1El?.value || "";
    if (!id) return;
    const s = deps.scripts.getById(id);
    if (!s) return;
    try { deps.manager.getRunner().installScriptToSlot(s.code, { timeLimitMs: 6 }, 0, s.name); setAssignment(0, s.id); } catch (e: any) { alert("Compile error: " + (e?.message ?? String(e))); }
  });
  assign2?.addEventListener("click", () => {
    if (deps.manager.isRunning()) return;
    const id = s2El?.value || "";
    if (!id) return;
    const s = deps.scripts.getById(id);
    if (!s) return;
    try { deps.manager.getRunner().installScriptToSlot(s.code, { timeLimitMs: 6 }, 1, s.name); setAssignment(1, s.id); } catch (e: any) { alert("Compile error: " + (e?.message ?? String(e))); }
  });

  toggle1?.addEventListener("click", () => {
    if (deps.manager.isRunning()) return;
    const info = deps.manager.getRunner().getSlotInfo?.()?.[0];
    const next = !(info?.enabled);
    deps.manager.getRunner().setSlotEnabled?.(0, next);
    const list = deps.scripts.loadAssignments();
    const ex = list.find(a => a.slot === 0);
    if (ex) ex.enabled = next; else list.push({ slot: 0, scriptId: ex?.scriptId ?? null, enabled: next } as any);
    deps.scripts.saveAssignments(list);
  });
  toggle2?.addEventListener("click", () => {
    if (deps.manager.isRunning()) return;
    const info = deps.manager.getRunner().getSlotInfo?.()?.[1];
    const next = !(info?.enabled);
    deps.manager.getRunner().setSlotEnabled?.(1, next);
    const list = deps.scripts.loadAssignments();
    const ex = list.find(a => a.slot === 1);
    if (ex) ex.enabled = next; else list.push({ slot: 1, scriptId: ex?.scriptId ?? null, enabled: next } as any);
    deps.scripts.saveAssignments(list);
  });

  function render() {
    const info = deps.manager.getRunner().getSlotInfo?.() ?? [];
    const slots = deps.manager.getRocket().cpu?.scriptSlots ?? 1;
    if (toggle1) toggle1.textContent = info[0]?.enabled ? "Disable Slot 1" : "Enable Slot 1";
    if (toggle2) toggle2.textContent = info[1]?.enabled ? "Disable Slot 2" : "Enable Slot 2";
    const running = deps.manager.isRunning();
    if (assign2) assign2.disabled = slots < 2 || running;
    if (toggle2) toggle2.disabled = slots < 2 || running;
    if (assign1) assign1.disabled = running;
    if (toggle1) toggle1.disabled = running;
    if (s1El) s1El.disabled = running;
    if (s2El) s2El.disabled = slots < 2 || running;
    if (log1El) log1El.innerHTML = (info[0]?.logs ?? []).slice(-200).map(l => `<div>${l}</div>`).join("");
    if (log2El) log2El.innerHTML = (info[1]?.logs ?? []).slice(-200).map(l => `<div>${l}</div>`).join("");
  }

  populateSelects();
  render();

  return { populateSelects, render } as const;
}
