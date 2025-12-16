
import { RocketAPI } from "../../scripting/RocketAPI"; // Import strictly for type usage if needed, but strings are just strings here

export interface ScriptServiceRef {
    list: () => any[];
    upsertByName: (name: string, code: string) => any;
    saveAll?: (list: any[]) => void;
}

// Helper to find unique name
const getUniqueName = (base: string, existing: any[]) => {
    let name = base;
    let n = 1;
    while (existing.some((s: any) => s.name === name)) {
        name = base.replace(/(\.\w+)?$/, (m: string) => ` (${n++})${m}`);
    }
    return name;
};

export const TemplateService = {
    createNew(lib: ScriptServiceRef): any {
        const base = "Untitled.ts";
        const name = getUniqueName(base, lib.list());

        const initialCode = "function update(api: RocketAPI) {\n  api.log('Hello from TS');\n}\n";

        return lib.upsertByName(name, initialCode);
    }
};
