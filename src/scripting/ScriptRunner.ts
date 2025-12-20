/**
 * ScriptRunner coordinates Sandbox + RocketAPI per simulation tick.
 * - Builds the API and command queue around the provided Rocket.
 * - Compiles user code respecting the installed CPU part limits.
 * - On each tick, runs the script within budget and drains battery.
 *
 * Single Script Architecture:
 * Each rocket runs exactly one main loop script.
 */
import { Rocket, SimpleQueue } from "../simulation/Rocket";
import { RocketAPI } from "./RocketAPI";
import { CompiledScript, Sandbox, SandboxOptions } from "./Sandbox";

export interface ScriptRunnerOptions {
  /** Optional wall-clock limit per tick execution for the sandbox. */
  timeLimitMs?: number;
}

export interface RunnerScriptState {
  compiled: CompiledScript | null;
  name: string;
  enabled: boolean;
  logs: string[];
}

export class ScriptRunner {
  private activeScript: RunnerScriptState = { compiled: null, name: "None", enabled: true, logs: [] };
  private readonly queue = new SimpleQueue();
  private readonly api: RocketAPI | undefined;
  private readonly sandbox = new Sandbox();
  // Accumulates elapsed seconds since last script execution (for CPU interval gating)
  private elapsedSinceRunS = 0;

  constructor(private readonly rocket: Rocket | undefined) {
    if (rocket) {
      this.api = new RocketAPI(rocket, this.queue, {});
    }
  }

  /** Install script (Single Slot) */
  async installScript(userCode: string, opts?: ScriptRunnerOptions, name?: string, language: 'typescript' = 'typescript'): Promise<void> {
    if (!this.rocket || !this.rocket.cpu) throw new Error("No CPU installed on rocket");
    const cpu = this.rocket.cpu;

    // Reset state
    this.activeScript.compiled = null;
    this.activeScript.logs = [];
    if (name) this.activeScript.name = name;

    const sbOpts: SandboxOptions = {
      maxChars: cpu.maxScriptChars,
      budgetPerTick: cpu.processingBudgetPerTick,
      energyPerTickJ: cpu.energyPerTickJ,
      timeLimitMs: opts?.timeLimitMs ?? 8,
    };

    try {
      const compiled = await this.sandbox.compile(userCode, sbOpts, language);
      this.activeScript.compiled = compiled;
      this.appendLog(`System: Script "${this.activeScript.name}" loaded.`);
    } catch (e: any) {
      this.appendLog(`System: Compilation failed: ${e.message}`);
      throw e;
    }
  }

  setEnabled(enabled: boolean): void {
    this.activeScript.enabled = enabled;
  }

  getScriptInfo(): { name: string; enabled: boolean; hasScript: boolean; logs: readonly string[] } {
    const s = this.activeScript;
    return { name: s.name, enabled: s.enabled, hasScript: !!s.compiled, logs: s.logs };
  }

  /** Legacy compat: returns array of 1 */
  getSlotInfo() {
    return [this.getScriptInfo()];
  }

  appendLog(msg: string): void {
    const slot = this.activeScript;
    slot.logs.push(msg);
    if (slot.logs.length > 200) slot.logs.splice(0, slot.logs.length - 200);
  }

  clearLogs(): void {
    this.activeScript.logs.length = 0;
  }

  /**
   * Runs scripts according to the CPU processing interval.
   * Accumulates dt and executes only when the interval elapses.
   * Returns the command queue to be applied by the environment.
   */
  runTick(dt: number, opts?: ScriptRunnerOptions): SimpleQueue {
    if (!this.rocket || !this.rocket.cpu || !this.api) return this.queue;
    const cpu = this.rocket.cpu;

    const interval = cpu.processingIntervalSeconds ?? 0;
    if (interval > 0) {
      this.elapsedSinceRunS += Math.max(0, dt || 0);
      if (this.elapsedSinceRunS + 1e-9 < interval) {
        // Not time yet
        (this.rocket as any)._cpuScriptsRunning = 0; // 0 or 1
        (this.rocket as any)._cpuEnergyUsedLastTick = 0;
        (this.rocket as any)._cpuNextRunInSeconds = Math.max(0, interval - this.elapsedSinceRunS);
        return this.queue;
      }
      this.elapsedSinceRunS = Math.max(0, this.elapsedSinceRunS - interval);
    } else {
      (this.rocket as any)._cpuNextRunInSeconds = 0;
    }

    const timeLimit = opts?.timeLimitMs ?? 8;
    let scriptsRan = 0;
    let totalEnergy = 0;

    // Execute Active Script
    const slot = this.activeScript;
    if (slot.enabled && slot.compiled) {
      const sbOpts: SandboxOptions = {
        maxChars: cpu.maxScriptChars,
        budgetPerTick: cpu.processingBudgetPerTick,
        energyPerTickJ: cpu.energyPerTickJ,
        timeLimitMs: timeLimit,
      };

      try {
        // Provide api logging hook
        (this.api as any)._setLogger?.((m: string) => this.appendLog(m));
        const ok = this.sandbox.runTick(slot.compiled, this.rocket, this.api, sbOpts);
        if (ok) {
          scriptsRan = 1;
          totalEnergy += cpu.energyPerTickJ;
        }
      } catch (e: any) {
        this.appendLog(`Runtime Error: ${e?.message ?? String(e)}`);
      }
    }

    // Update debug fields
    (this.rocket as any)._cpuScriptsRunning = scriptsRan; // 0 or 1
    (this.rocket as any)._cpuEnergyUsedLastTick = totalEnergy;

    const _interval = this.rocket.cpu?.processingIntervalSeconds ?? 0;
    (this.rocket as any)._cpuNextRunInSeconds = _interval > 0 ? Math.max(0, _interval - this.elapsedSinceRunS) : 0;

    return this.queue;
  }
}
