import { SessionKeys } from "./SessionKeys";

export type ScriptItem = { id: string; name: string; code: string; compiledCode?: string; updatedAt: number };
export type RocketScriptAssign = { rocketIndex: number; scriptId: string | null; enabled: boolean };

export class ScriptLibraryService {
  newId(): string { return "s_" + Math.random().toString(36).slice(2, 9); }

  list(): ScriptItem[] {
    try { const raw = localStorage.getItem(SessionKeys.SCRIPTS); return raw ? JSON.parse(raw) : []; } catch { return []; }
  }

  saveAll(all: ScriptItem[]): void {
    try { localStorage.setItem(SessionKeys.SCRIPTS, JSON.stringify(all)); } catch { }
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

  loadAssignments(): RocketScriptAssign[] {
    try { const raw = localStorage.getItem(SessionKeys.CPU_SLOTS); return raw ? JSON.parse(raw) : []; } catch { return []; }
  }

  saveAssignments(all: RocketScriptAssign[]): void {
    try { localStorage.setItem(SessionKeys.CPU_SLOTS, JSON.stringify(all)); } catch { }
  }

  seedIfEmpty(defaultCode: string, defaultName = "FirstHop.ts"): void {
    // Migrate old localStorage key if present and no session script yet
    if (!localStorage.getItem(SessionKeys.SCRIPT)) {
      const legacy = localStorage.getItem("user-script");
      const seed = legacy ?? defaultCode;
      try { localStorage.setItem(SessionKeys.SCRIPT, seed); } catch { }
    }
    // Seed scripts library if empty
    if (!localStorage.getItem(SessionKeys.SCRIPTS)) {
      const initialCode = localStorage.getItem(SessionKeys.SCRIPT) ?? defaultCode;
      const item: ScriptItem = { id: this.newId(), name: defaultName, code: initialCode, updatedAt: Date.now() };
      this.saveAll([item]);
      try { localStorage.setItem(SessionKeys.CURRENT_SCRIPT_NAME, defaultName); } catch { }
    }
  }
}
