import { SessionKeys } from "./SessionKeys";

export type ScriptItem = { id: string; name: string; code: string; compiledCode?: string; updatedAt: number };
export type SlotAssign = { rocketIndex?: number; slot: number; scriptId: string | null; enabled: boolean };

export class ScriptLibraryService {
  newId(): string { return "s_" + Math.random().toString(36).slice(2, 9); }

  list(): ScriptItem[] {
    try { const raw = sessionStorage.getItem(SessionKeys.SCRIPTS); return raw ? JSON.parse(raw) : []; } catch { return []; }
  }

  saveAll(all: ScriptItem[]): void {
    try { sessionStorage.setItem(SessionKeys.SCRIPTS, JSON.stringify(all)); } catch { }
  }

  upsertByName(name: string, code: string, compiledCode?: string): ScriptItem {
    const list = this.list();
    const existing = list.find(s => s.name === name);
    if (existing) {
      existing.code = code;
      if (compiledCode !== undefined) existing.compiledCode = compiledCode;
      existing.updatedAt = Date.now();
      this.saveAll(list);
      return existing;
    }
    const item: ScriptItem = { id: this.newId(), name, code, compiledCode, updatedAt: Date.now() };
    list.push(item); this.saveAll(list); return item;
  }

  getById(id: string | null | undefined): ScriptItem | null {
    if (!id) return null; const list = this.list(); return list.find(s => s.id === id) ?? null;
  }

  loadAssignments(): SlotAssign[] {
    try { const raw = sessionStorage.getItem(SessionKeys.CPU_SLOTS); return raw ? JSON.parse(raw) : []; } catch { return []; }
  }

  saveAssignments(all: SlotAssign[]): void {
    try { sessionStorage.setItem(SessionKeys.CPU_SLOTS, JSON.stringify(all)); } catch { }
  }

  seedIfEmpty(defaultCode: string, defaultName = "TakeOff.js"): void {
    // Migrate old localStorage key if present and no session script yet
    if (!sessionStorage.getItem(SessionKeys.SCRIPT)) {
      const legacy = localStorage.getItem("user-script");
      const seed = legacy ?? defaultCode;
      try { sessionStorage.setItem(SessionKeys.SCRIPT, seed); } catch { }
    }
    // Seed scripts library if empty
    if (!sessionStorage.getItem(SessionKeys.SCRIPTS)) {
      const initialCode = sessionStorage.getItem(SessionKeys.SCRIPT) ?? defaultCode;
      const item: ScriptItem = { id: this.newId(), name: defaultName, code: initialCode, updatedAt: Date.now() };
      this.saveAll([item]);
      try { sessionStorage.setItem(SessionKeys.CURRENT_SCRIPT_NAME, defaultName); } catch { }
    }
  }
}
