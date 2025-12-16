
import React from "react";
import { Button } from "@chakra-ui/react";
import { useAppCore } from "../../app/AppContext";
import { ScriptAnalysis } from "../../scripting/ScriptAnalysis";
import { getCPUTier } from "../../simulation/CPUTier";
import { MonacoScriptEditorRef } from "../../ui/MonacoScriptEditor";

interface AssignButtonProps {
    activeRocket: any;
    code: string;
    name: string;
    monacoRef: React.RefObject<MonacoScriptEditorRef>;
    onSuccess?: () => void;
}

export function AssignButton({
    activeRocket,
    code,
    name,
    monacoRef,
    onSuccess
}: AssignButtonProps) {
    const { manager, services } = useAppCore();

    const doAssign = async () => {
        if (!activeRocket) return;
        if (!activeRocket.cpu) { alert("No CPU"); return; }

        // Compile first!
        let compiledJs = "";
        try {
            if (monacoRef.current) {
                compiledJs = await monacoRef.current.compile();
            } else {
                // Fallback (should not happen if mapped correctly)
                console.warn("No editor ref");
                compiledJs = code;
            }
        } catch (e: any) {
            alert("Compilation failed: " + e.message);
            return;
        }

        if (!compiledJs) {
            alert("Compiler returned empty output.");
            return;
        }

        const sizeLimit = activeRocket.cpu.maxScriptChars;
        if (compiledJs.length > sizeLimit) {
            alert(`Script is too large (${compiledJs.length} bytes). Limit is ${sizeLimit} bytes.`);
            return;
        }

        // Validation
        // Validation
        const tier = getCPUTier(activeRocket.cpu.id);
        const val = ScriptAnalysis.validateUsage(compiledJs, tier);
        if (!val.ok) {
            if (!confirm(`Validation Warning:\n${val.error}\n\nAssign anyway?`)) {
                return;
            }
        }

        const r = manager?.getRunner();
        if (r) {
            try {
                await r.installScriptToSlot(compiledJs, { timeLimitMs: 6 }, 0, name, "typescript");
                r.setSlotEnabled(0, true);

                const scripts = services.scripts as any;
                if (scripts) {
                    const assigns = scripts.loadAssignments();
                    const idx = assigns.findIndex((a: any) => a.slot === 0);
                    if (idx >= 0) assigns.splice(idx, 1);

                    // Find script ID by name to link it in assignments
                    const list = scripts.list();
                    const found = list.find((s: any) => s.name === name);
                    const sid = found ? found.id : null;

                    assigns.push({ slot: 0, scriptId: sid, enabled: true });
                    scripts.saveAssignments(assigns);
                }
                onSuccess?.();
            } catch (e: any) {
                alert("Assign Error: " + e.message);
            }
        }
    };

    if (!activeRocket) return null;

    return (
        <Button size="sm" colorPalette="green" onClick={doAssign}>Assign to Rocket</Button>
    );
}
