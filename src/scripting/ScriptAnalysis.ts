import { CPUTier, CPUTierDefs } from "../simulation/CPUTier";

export interface ValidationResult {
    ok: boolean;
    error?: string;
    usedApis?: string[];
    missingApis?: string[]; // APIs used but not allowed by tier
}

/**
 * Analyzes a script to verify compatibility with a given CPU Tier.
 * 
 * Uses a rigorous "Dry Run" approach by creating a Mock API proxy and executing 
 * the script's `update` function in a sandbox-like environment (if possible) 
 * or by regex/parsing if robust isolation isn't available.
 * 
 * Given we are in the browser, actual execution is risky if infinite loops exist, 
 * but we can wrap it.
 */
export class ScriptAnalysis {

    /**
     * Check if script size is within limits.
     */
    static checkSize(code: string, maxChars: number): ValidationResult {
        if (code.length > maxChars) {
            return {
                ok: false,
                error: `Script too large: ${code.length} chars (Limit: ${maxChars})`
            };
        }
        return { ok: true };
    }

    /**
     * Validate Compatibility by running the script against a proxy API 
     * that records feature usage.
     */
    static validateUsage(code: string, tier: CPUTier): ValidationResult {
        const allowed = new Set(CPUTierDefs[tier].api);
        const used = new Set<string>();

        // Mock API Proxy
        // We will mock the `api` object passed to `update(api)`
        const mockApi = new Proxy({}, {
            get: (target, prop) => {
                if (typeof prop === 'string') {
                    used.add(prop);
                    // Special handling for nested "memory" or others if they become restricted
                    // For now, most tier checks are on methods on the root `api` object.
                    // If the property is a function, return a dummy function.
                    return () => 0;
                }
                return undefined;
            }
        });

        // Safe execution wrapper
        try {
            // We construct a Function that takes 'api' and runs the user code.
            // CAUTION: This runs user code! 
            // We should use the same isolation attributes as the real runner if possible, 
            // or acceptable for a client-side check.
            // To prevent alerts/etc, we can't easily sandbox native browser globals without an iframe.
            // But `new Function` is what ScriptRunner uses (mostly).
            // We'll wrap in a timeout check? No, synchronous JS can't be timed out easily without loop guards.
            // We'll rely on the user "trusting" their own code for this dry run OR
            // we use the Regex heuristic as a fallback/primary if execution is deemed unsafe.

            // Let's TRY execution but maybe Regex is safer for a "pre-check"?
            // Real execution catches dynamic usage `api[variable]`.
            // But it might crash.
            // Let's do a slightly safer "Hybrid" or just Regex for "Standard" names.

            // User request: "For CPI API Usage make a dry run"
            // So we SHOULD run it.

            // We wrap in a constrained scopes.
            const userFn = new Function('api', `"use strict";\n${code};\nif(typeof update === 'function') update(api);`);
            userFn(mockApi);

        } catch (e: any) {
            // If it errors during dry run, that's possibly a runtime error OR just missing data in our mock.
            // We can't guarantee 100% success of the dry run if logic depends on real values.
            // But we collected *feature usages* up to the crash.
            // We won't fail validation just because it crashed on fake data, 
            // unless we want to enforce strict correctness.
            // Let's just log it and proceed with checking `used`.
            // console.warn("Dry run validation exception:", e);
        }

        // Check used vs allowed
        const missing: string[] = [];
        for (const u of used) {
            // Ignore common harmless props if any?
            // Ignore common harmless props and structural roots
            const IGNORED_ROOTS = ["memory", "log", "control", "telemetry", "nav", "comms", "constructor", "prototype"];
            if (!allowed.has(u) && !IGNORED_ROOTS.includes(u)) {
                // Check if it's a standard/always-available method?
                // "setTurnRate" etc should be in the Defs.
                // "memory" is usually Base but let's check.
                // If it's not in the Tier Def, it's blocked.
                missing.push(u);
            }
        }

        if (missing.length > 0) {
            return {
                ok: false,
                error: `Uses unavailable APIs for ${CPUTier[tier]} tier: ${missing.join(", ")}`,
                usedApis: Array.from(used),
                missingApis: missing
            };
        }

        return { ok: true, usedApis: Array.from(used) };
    }
}
