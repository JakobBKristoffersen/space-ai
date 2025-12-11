/**
 * ScriptsLibraryPanel
 * - Renders the session-scoped scripts library list
 * - Handles Load/Delete actions
 * - Handles Save / Save As using the current editor content in sessionStorage
 *
 * DOM contract (ids must exist in the page):
 * - #scriptsLibrary (container for the list)
 * - #scriptNameInput (text input for the script name)
 * - #saveScriptBtn, #saveAsScriptBtn (buttons)
 */

import { ScriptLibraryService, type ScriptItem, type SlotAssign } from "../services/ScriptLibraryService";
import { SessionKeys } from "../services/SessionKeys";

export interface ScriptsLibraryPanelDeps {
  scripts: ScriptLibraryService;
  /** Called to repopulate CPU slot selects when library changes. */
  onSlotsRepopulate?: () => void;
  /** Function indicating whether simulation is running (disables actions). */
  isRunning: () => boolean;
}

export function initScriptsLibraryPanel(deps: ScriptsLibraryPanelDeps) {
  const listEl = document.getElementById("scriptsLibrary") as HTMLElement | null;
  const nameInput = document.getElementById("scriptNameInput") as HTMLInputElement | null;
  const saveBtn = document.getElementById("saveScriptBtn") as HTMLButtonElement | null;
  const saveAsBtn = document.getElementById("saveAsScriptBtn") as HTMLButtonElement | null;

  function refreshScriptNameInput() {
    if (!nameInput) return;
    try {
      const name = sessionStorage.getItem(SessionKeys.CURRENT_SCRIPT_NAME) || "";
      nameInput.value = name;
    } catch {}
  }

  function render() {
    if (!listEl) return;
    const list = deps.scripts.list();
    if (list.length === 0) {
      listEl.innerHTML = '<div class="muted">No saved scripts yet. Use Save to add the current editor script.</div>';
      return;
    }
    const rows = list
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((s) => {
        const date = new Date(s.updatedAt).toLocaleTimeString();
        return `<div class="row" data-id="${s.id}"><strong>${s.name}</strong> <small class="muted">${date}</small> <button data-action="load" data-id="${s.id}">Load</button> <button data-action="delete" data-id="${s.id}">Delete</button></div>`;
      });
    listEl.innerHTML = rows.join("");
  }

  function saveCurrentScript(name: string, forceNew = false) {
    const code = sessionStorage.getItem(SessionKeys.SCRIPT) ?? "";
    let targetName = name && name.trim().length > 0 ? name.trim() : "Untitled.js";
    if (forceNew) {
      // ensure unique by appending (n)
      const list = deps.scripts.list();
      let base = targetName; let n = 1;
      while (list.some((s) => s.name === targetName)) {
        targetName = base.replace(/(\.\w+)?$/, (m) => ` (${n++})${m}`);
      }
    }
    const item = deps.scripts.upsertByName(targetName, code);
    try { sessionStorage.setItem(SessionKeys.CURRENT_SCRIPT_NAME, item.name); } catch {}
    refreshScriptNameInput();
    render();
    deps.onSlotsRepopulate?.();
  }

  // Click handling for list (Load/Delete)
  listEl?.addEventListener("click", (ev) => {
    if (deps.isRunning()) return;
    const t = ev.target as HTMLElement;
    const action = t.getAttribute("data-action");
    const id = t.getAttribute("data-id");
    if (!action || !id) return;
    if (action === "load") {
      const s = deps.scripts.getById(id);
      if (!s) return;
      try {
        sessionStorage.setItem(SessionKeys.SCRIPT, s.code);
        sessionStorage.setItem(SessionKeys.CURRENT_SCRIPT_NAME, s.name);
      } catch {}
      // Notify React editor to reload
      try { window.dispatchEvent(new CustomEvent("session-state-reset")); } catch {}
      refreshScriptNameInput();
    }
    if (action === "delete") {
      const list = deps.scripts.list();
      const idx = list.findIndex((x) => x.id === id);
      if (idx >= 0) {
        list.splice(idx, 1);
        deps.scripts.saveAll(list);
      }
      // Also clear assignment if any slot used this script
      const slots = deps.scripts.loadAssignments();
      let changed = false;
      for (const s of slots) { if (s.scriptId === id) { (s as any).scriptId = null; changed = true; } }
      if (changed) deps.scripts.saveAssignments(slots);
      render();
      deps.onSlotsRepopulate?.();
    }
  });

  // Save / Save As buttons
  saveBtn?.addEventListener("click", () => {
    if (deps.isRunning()) return;
    const name = nameInput?.value || "Untitled.js";
    saveCurrentScript(name, false);
  });
  saveAsBtn?.addEventListener("click", () => {
    if (deps.isRunning()) return;
    const name = nameInput?.value || "Untitled.js";
    saveCurrentScript(name, true);
  });

  // Initial render
  refreshScriptNameInput();
  render();

  return {
    render,
    refreshName: refreshScriptNameInput,
    dispose() {
      // currently nothing; event listeners are attached to stable nodes
    }
  } as const;
}
