/**
 * Sandbox executes user-provided scripts in a constrained environment.
 * Goals:
 * - No direct access to simulation internals (only via RocketAPI passed in).
 * - Enforce per-tick processing budget (in conjunction with RocketAPI costs).
 * - Drain battery energy per tick according to installed CPU part.
 * - Provide basic safeguards against infinite loops.
 *
 * NOTE: This is a minimal synchronous stub using Function(...) for isolation of scope.
 * It is NOT a security sandbox. For production, consider running in a WebWorker
 * and terminating the worker on budget/time overrun. Kept minimal to meet
 * the initial requirements and enable independent testing.
 */

import { Rocket } from "../simulation/Rocket";
import { RocketAPI, SimpleTickBudget } from "./RocketAPI";

export interface CompiledScript {
  /** Executes one simulation tick of user logic. */
  update(api: RocketAPI, budget: SimpleTickBudget): void;
}

export interface SandboxOptions {
  /** Max characters allowed by CPU (enforced externally and re-checked here). */
  maxChars: number;
  /** Per-tick processing budget allowed by CPU. */
  budgetPerTick: number;
  /** Energy (J) cost per tick to run this script (drained from rocket batteries). */
  energyPerTickJ: number;
  /** Optional CPU time limit in ms for script execution (soft). */
  timeLimitMs?: number;
}

export class Sandbox {
  /** Compiles and validates user code into a callable update function. */
  async compile(userCode: string, opts: SandboxOptions, language: 'typescript' | 'python' = 'typescript'): Promise<CompiledScript> {
    if (userCode.length > opts.maxChars) {
      throw new Error(`Script too large. Max ${opts.maxChars} chars.`);
    }

    if (language === 'python') {
      const { PyodideService } = await import("../services/PyodideService");
      const pyodide = PyodideService.getInstance();
      const updateFn = await pyodide.prepareScript(userCode);

      return {
        update(api: RocketAPI, budget: SimpleTickBudget): void {
          const start = performance.now();
          api.beginTick(budget);
          try {
            updateFn(api);
          } catch (e: any) {
            // Re-throw or log? Python errors might be objects
            throw new Error("Python Error: " + String(e));
          } finally {
            api.endTick();
            if (opts.timeLimitMs != null && performance.now() - start > opts.timeLimitMs) {
              throw new Error("Script time limit exceeded");
            }
          }
        }
      };
    }

    // TypeScript/JavaScript path
    // Wrap user code into a function body. The user defines function update(api, budget) { ... }
    // If not provided, we attempt to evaluate code and expect global update.
    // To keep deterministic behavior, we do not expose Date/Math.random modifications.
    const bootstrap = `"use strict";\nlet __userUpdate = undefined;\n${userCode}\nreturn typeof update === 'function' ? update : __userUpdate;`;

    // Create a function with no access to globals except what we pass in.
    let factory;
    try {
      factory = new Function(bootstrap);
    } catch (e: any) {
      if (/\bimport\b/.test(userCode) || /\bexport\b/.test(userCode)) {
        throw new Error("Cannot execute raw TypeScript modules. Please go to Software Engineering page and SAVE your script to compile it.");
      }
      throw e;
    }
    const updateFn: any = factory.call(undefined);
    if (typeof updateFn !== "function") {
      throw new Error("Script must define function update(api) { ... }");
    }

    // Provide a CompiledScript adapter that enforces budget and (soft) time limits.
    const compiled: CompiledScript = {
      update(api: RocketAPI, budget: SimpleTickBudget): void {
        const start = performance.now();
        // Soft loop guard: cap number of API calls indirectly via budget cost.
        // Additionally enforce a rough wall-clock guard.
        api.beginTick(budget);
        try {
          updateFn(api);
        } finally {
          api.endTick();
          if (opts.timeLimitMs != null && performance.now() - start > opts.timeLimitMs) {
            // In a real sandbox we'd terminate here; for now we just throw.
            throw new Error("Script time limit exceeded");
          }
        }
      },
    };

    return compiled;
  }

  /**
   * Runs one tick of the compiled script if enough battery energy is available.
   * Returns true if script executed; false if halted due to no energy.
   */
  runTick(compiled: CompiledScript, rocket: Rocket, api: RocketAPI, opts: SandboxOptions): boolean {
    // Drain battery first. If insufficient, do not execute.
    const drawn = rocket.drawEnergy(opts.energyPerTickJ);
    if (drawn < opts.energyPerTickJ) {
      // Not enough energy; halt for this tick.
      return false;
    }

    const budget = new SimpleTickBudget(opts.budgetPerTick);
    compiled.update(api, budget);
    return true;
  }
}
