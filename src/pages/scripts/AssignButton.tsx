
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
    language: 'typescript' | 'python';
    useMonaco: boolean;
    monacoRef: React.RefObject<MonacoScriptEditorRef>;
    legacyRef: React.RefObject<any>;
    onSuccess?: () => void;
}

export function AssignButton({
    activeRocket,
    code,
    name,
    language,
    useMonaco,
    monacoRef,
    legacyRef,
    onSuccess
}: AssignButtonProps) {
    const { manager, services } = useAppCore();

    const doAssign = async () => {
        if (!activeRocket) return;
        if (!activeRocket.cpu) { alert("No CPU"); return; }

        // Compile first!
        let compiledJs = "";
        try {
            if (useMonaco && monacoRef.current) {
                compiledJs = await monacoRef.current.compile();
            } else if (!useMonaco && legacyRef.current?.compile) {
                // Try to use legacy compile if available
                compiledJs = await legacyRef.current.compile();
            } else {
                // Fallback: raw code (Python or if legacy fails)
                compiledJs = code;
            }
        } catch (e: any) {
            alert("Compilation failed: " + e.message);
            return;
        }

        if (!compiledJs && language === 'typescript') {
            alert("Compiler returned empty output.");
            return;
        }

        const sizeLimit = activeRocket.cpu.maxScriptChars;
        if (compiledJs.length > sizeLimit) {
            alert(`Script is too large (${compiledJs.length} bytes). Limit is ${sizeLimit} bytes.`);
            return;
        }

        // Validation
        if (language === 'typescript') {
            const tier = getCPUTier(activeRocket.cpu.id);
            const val = ScriptAnalysis.validateUsage(compiledJs, tier);
            if (!val.ok) {
                if (!confirm(`Validation Warning:\n${val.error}\n\nAssign anyway?`)) {
                    return;
                }
            }
        }

        const r = manager?.getRunner();
        if (r) {
            try {
                await r.installScriptToSlot(compiledJs, { timeLimitMs: 6 }, 0, name, language);
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
